import os
import logging
import httpx

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

async def generate_conversation_summary(messages: list) -> str:
    """
    Summarize conversation history into customer issue, attempted fixes, and current status.
    """
    if not messages:
        return "No messages in conversation yet."

    groq_key = os.getenv("GROQ_API_KEY", "")
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    formatted_transcript = ""
    for msg in messages:
        sender = msg.get("sender", "unknown")
        body = msg.get("body", "")
        formatted_transcript += f"{sender.upper()}: {body}\n"

    prompt = (
        "Analyze the following conversation between a customer and support team/bot.\n"
        "Provide a concise 3-bullet summary with exact headers:\n"
        "• Customer Issue: <brief issue summary>\n"
        "• Attempted Fixes: <any troubleshooting or fixes mentioned, or 'None yet'>\n"
        "• Current Status: <open / awaiting customer reply / resolved>\n\n"
        f"Conversation:\n{formatted_transcript}"
    )

    if not groq_key:

        # Fallback if no API Key provided
        customer_msgs = [m.get('body', '') for m in messages if m.get('sender') == 'customer']
        last_issue = customer_msgs[0] if customer_msgs else "Customer initiated chat"
        return (
            f"• Customer Issue: {last_issue[:100]}\n"
            f"• Attempted Fixes: None recorded\n"
            f"• Current Status: Awaiting agent response"
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": groq_model,
                    "messages": [
                        {"role": "system", "content": "You are a concise customer support AI assistant."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 250
                }
            )

            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.error(f"Groq API error {response.status_code}: {response.text}")
                return "Failed to generate AI summary from Groq API."
    except Exception as e:
        logger.error(f"Exception during Groq API call: {e}")
        return "Error connecting to AI summary service."
