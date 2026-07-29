import os
import asyncio
import logging
import imaplib
import smtplib
import email
from email.mime.text import MIMEText
from email.header import decode_header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database.database import AsyncSessionLocal
from database.models import Conversation, Message, Workspace
from services.websocket_service import manager

logger = logging.getLogger(__name__)

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "jainutk619@gmail.com")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "").replace(" ", "")

def decode_mime_words(s):
    if not s:
        return ""
    decoded = decode_header(s)
    parts = []
    for content, encoding in decoded:
        if isinstance(content, bytes):
            parts.append(content.decode(encoding or "utf-8", errors="ignore"))
        else:
            parts.append(str(content))
    return "".join(parts)

async def send_gmail_smtp_reply(recipient: str, subject: str, body: str, thread_id: str = None, last_message_id: str = None) -> bool:
    """
    Send outbound email reply using Gmail SMTP.
    """
    if not (SUPPORT_EMAIL and GMAIL_APP_PASSWORD):
        logger.warning("Gmail SMTP credentials not set. Mocking email reply.")
        return True

    formatted_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = SUPPORT_EMAIL
    msg["To"] = recipient
    msg["Subject"] = formatted_subject

    if last_message_id:
        msg["In-Reply-To"] = last_message_id
        msg["References"] = last_message_id

    try:
        def _send():
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(SUPPORT_EMAIL, GMAIL_APP_PASSWORD)
                server.send_message(msg)
        
        await asyncio.to_thread(_send)
        logger.info(f"Successfully sent email reply to {recipient} via Gmail SMTP")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via Gmail SMTP: {e}")
        return False

async def poll_gmail_imap_loop():
    """
    Background loop that polls Gmail IMAP inbox every 15 seconds for live customer emails.
    """
    logger.info("Starting Live Gmail IMAP polling background worker...")
    loop = asyncio.get_running_loop()
    while True:
        try:
            if SUPPORT_EMAIL and GMAIL_APP_PASSWORD:
                await asyncio.to_thread(_check_imap_inbox, loop)
        except Exception as e:
            logger.error(f"Error during IMAP poll loop: {e}")
        await asyncio.sleep(5)


def _check_imap_inbox(loop):
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(SUPPORT_EMAIL, GMAIL_APP_PASSWORD)
        mail.select("inbox")

        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK' or not messages[0]:
            mail.logout()
            return

        msg_nums = messages[0].split()
        for num in msg_nums:
            res, data = mail.fetch(num, '(RFC822)')
            if res != 'OK':
                continue
            
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject = decode_mime_words(msg.get("Subject", "No Subject"))
            sender_raw = decode_mime_words(msg.get("From", "Customer"))
            message_id = msg.get("Message-ID", "")
            in_reply_to = msg.get("In-Reply-To", "")

            # Extract email address from sender header
            sender_email = sender_raw
            if "<" in sender_raw and ">" in sender_raw:
                sender_email = sender_raw.split("<")[1].split(">")[0].strip()

            # Ignore emails sent from the support address itself
            if sender_email.lower() == SUPPORT_EMAIL.lower():
                continue

            # Extract Body
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition"))
                    if content_type == "text/plain" and "attachment" not in content_disposition:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                            break
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")

            if not body:
                body = subject

            # Run async DB insertion loop on main event loop
            asyncio.run_coroutine_threadsafe(
                _save_inbound_email(sender_email, subject, body, message_id, in_reply_to),
                loop
            )

        mail.logout()
    except Exception as err:
        logger.error(f"IMAP check error: {err}")

async def _save_inbound_email(sender_email, subject, body, message_id, in_reply_to):
    try:
        async with AsyncSessionLocal() as db:
            ws_res = await db.execute(select(Workspace))
            workspaces = ws_res.scalars().all()
            if not workspaces:
                return

            for workspace in workspaces:
                conversation = None

                # 1. Match by In-Reply-To message ID
                if in_reply_to:
                    msg_res = await db.execute(select(Message).where(Message.message_id == in_reply_to))
                    matched_msg = msg_res.scalars().first()
                    if matched_msg:
                        conv_res = await db.execute(select(Conversation).where(Conversation.id == matched_msg.conversation_id))
                        conversation = conv_res.scalars().first()

                # 2. Match open conversation by sender email
                if not conversation:
                    conv_res = await db.execute(
                        select(Conversation).where(
                            Conversation.workspace_id == workspace.id,
                            Conversation.channel == "email",
                            Conversation.visitor_id == sender_email,
                            Conversation.status == "open"
                        )
                    )
                    conversation = conv_res.scalars().first()

                # 3. Create new conversation if no match
                if not conversation:
                    conversation = Conversation(
                        workspace_id=workspace.id,
                        channel="email",
                        status="open",
                        email_thread_id=message_id or sender_email,
                        visitor_id=sender_email,
                        subject=subject
                    )
                    db.add(conversation)
                    await db.flush()

                new_msg = Message(
                    conversation_id=conversation.id,
                    sender="customer",
                    body=body.strip(),
                    message_id=message_id
                )
                db.add(new_msg)
                await db.commit()

                # Broadcast to Dashboard in real-time
                await manager.broadcast_to_workspace(workspace.id, {
                    "type": "chat_message",
                    "conversation_id": conversation.id,
                    "message": {
                        "id": new_msg.id,
                        "conversation_id": conversation.id,
                        "sender": "customer",
                        "body": body.strip(),
                        "created_at": new_msg.created_at.isoformat()
                    }
                })
                logger.info(f"Live incoming email from {sender_email} added to inbox for workspace {workspace.id}!")
    except Exception as ex:
        logger.error(f"Error saving inbound email: {ex}")

