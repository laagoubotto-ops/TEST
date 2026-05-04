"""WhatsApp Hub router — /api/whatsapp.

Local stub (no Twilio). Persists conversations + messages to DB so the
frontend has real data flowing. Outgoing messages are marked delivered
immediately (no external provider call).
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.whatsapp.models import WaConversation, WaMessage


router = APIRouter(
    prefix="/whatsapp",
    tags=["whatsapp"],
    dependencies=[Depends(require_auth)],
)


class ConversationIn(BaseModel):
    contact_name: str
    contact_phone: str
    role: str = "client"
    project_ref: Optional[str] = None
    avatar: Optional[str] = None


class ConversationOut(ConversationIn):
    id: str
    unread: int = 0
    last_message: Optional[str] = None
    last_time: Optional[datetime] = None
    is_online: bool = False

    class Config:
        from_attributes = True


class MessageIn(BaseModel):
    text: str
    type: str = "text"


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    text: str
    is_outgoing: bool
    status: str
    type: str
    sent_at: datetime

    class Config:
        from_attributes = True


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    return (
        db.query(WaConversation)
        .filter(WaConversation.company_id == company_id, WaConversation.active == True)
        .order_by(WaConversation.last_time.desc().nullslast())
        .all()
    )


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    data: ConversationIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = WaConversation(company_id=company_id, **data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/conversations/{convo_id}/messages", response_model=list[MessageOut])
def list_messages(
    convo_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    convo = db.query(WaConversation).filter(
        WaConversation.id == convo_id, WaConversation.company_id == company_id
    ).first()
    if not convo:
        raise HTTPException(404, "Conversation not found")
    # Mark as read
    if convo.unread > 0:
        convo.unread = 0
        db.commit()
    return (
        db.query(WaMessage)
        .filter(WaMessage.conversation_id == convo_id)
        .order_by(WaMessage.sent_at.asc())
        .all()
    )


@router.post("/conversations/{convo_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    convo_id: str,
    data: MessageIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    convo = db.query(WaConversation).filter(
        WaConversation.id == convo_id, WaConversation.company_id == company_id
    ).first()
    if not convo:
        raise HTTPException(404, "Conversation not found")

    msg = WaMessage(
        company_id=company_id,
        conversation_id=convo_id,
        text=data.text,
        type=data.type,
        is_outgoing=True,
        status="delivered",  # stub: no real provider
        sent_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    convo.last_message = data.text[:200]
    convo.last_time = msg.sent_at
    db.commit()
    db.refresh(msg)
    return msg
