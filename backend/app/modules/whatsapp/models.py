"""WhatsApp Hub — local DB-backed stub (no Twilio).

Stores conversations + messages in local DB for demo/persistence.
Swap `service.send_outgoing` with a real Twilio client when available.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime, Text, Integer, Boolean, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class WaConversation(Base, BaseMixin):
    __tablename__ = "wa_conversations"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    project_ref: Mapped[Optional[str]] = mapped_column(String(60))
    contact_name: Mapped[str] = mapped_column(String(200))
    contact_phone: Mapped[str] = mapped_column(String(40), index=True)
    role: Mapped[str] = mapped_column(String(20), default="client")  # guide|client|driver|supplier|agent
    avatar: Mapped[Optional[str]] = mapped_column(String(10))
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    unread: Mapped[int] = mapped_column(Integer, default=0)
    last_message: Mapped[Optional[str]] = mapped_column(Text)
    last_time: Mapped[Optional[datetime]] = mapped_column(DateTime)

    __table_args__ = (
        Index("idx_wa_convo_company", "company_id"),
    )


class WaMessage(Base, BaseMixin):
    __tablename__ = "wa_messages"

    company_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("companies.id", ondelete="CASCADE"), index=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("wa_conversations.id", ondelete="CASCADE"), index=True,
    )
    text: Mapped[str] = mapped_column(Text)
    is_outgoing: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="sent")  # sent|delivered|read
    type: Mapped[str] = mapped_column(String(20), default="text")    # text|proposal|location|alert|image
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
