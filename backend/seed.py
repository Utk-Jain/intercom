import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import logging
from sqlalchemy import select
from database.database import AsyncSessionLocal, init_db, engine
from database.models import Base, Workspace, Category, Article


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    logger.info("Initializing fresh database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        logger.info("Seeding default Knowledge Base articles...")
        # Default workspace for instant demo
        ws = Workspace(
            name="Default Workspace",
            custom_domain="support.company.com"
        )
        db.add(ws)
        await db.flush()

        cat1 = Category(workspace_id=ws.id, name="Account & Billing")
        cat2 = Category(workspace_id=ws.id, name="Getting Started")
        cat3 = Category(workspace_id=ws.id, name="Troubleshooting")
        db.add_all([cat1, cat2, cat3])
        await db.flush()

        articles = [
            Article(
                workspace_id=ws.id,
                category_id=cat1.id,
                title="How to update payment methods",
                content="To update your credit card or billing details, navigate to Settings -> Billing -> Payment Methods, click Edit, enter your card details, and click Save.",
                published=True
            ),
            Article(
                workspace_id=ws.id,
                category_id=cat1.id,
                title="Refund and cancellation policy",
                content="You can cancel your subscription at any time under Settings -> Billing. Refunds are processed within 5-7 business days upon request to support.",
                published=True
            ),
            Article(
                workspace_id=ws.id,
                category_id=cat2.id,
                title="How to reset your password",
                content="Click 'Forgot Password' on the login screen, enter your registered email address, and check your inbox for a secure reset link.",
                published=True
            ),
            Article(
                workspace_id=ws.id,
                category_id=cat2.id,
                title="Setting up email integration",
                content="Our system connects directly to Gmail IMAP and SMTP. Ensure SUPPORT_EMAIL and GMAIL_APP_PASSWORD are set in your environment variables.",
                published=True
            ),
            Article(
                workspace_id=ws.id,
                category_id=cat3.id,
                title="Fixing chat widget connectivity issues",
                content="If the live chat widget shows Offline, verify your backend server is running on port 8000 and WebSockets are allowed through your firewall.",
                published=True
            )
        ]
        db.add_all(articles)
        await db.commit()
        logger.info("Database reset and seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
