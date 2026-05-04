"""DMC quote router — REST endpoints + DOCX/XLSX generation + workflow."""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenant import get_current_company_id

from .models import DmcQuote, DmcQuoteDay
from .schemas import (
    DmcQuoteIn, DmcQuoteOut, DmcQuoteDayIn, DmcQuoteDayOut, DmcQuoteCalcOut,
)
from .calculator import calc_for_quote, compute_brackets
from .docx_generator import generate_program_docx
from .xlsx_generator import generate_quote_xlsx

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/dmc-quotes", tags=["dmc-quotes"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _serialize(q: DmcQuote, days: list[DmcQuoteDay]) -> dict:
    out = DmcQuoteOut.model_validate(q, from_attributes=True).model_dump()
    out["days"] = [DmcQuoteDayOut.model_validate(d, from_attributes=True).model_dump() for d in days]
    return out


# ── List / create ──────────────────────────────────────────────────────────
@router.get("")
def list_quotes(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    q = db.query(DmcQuote).filter_by(company_id=company_id)
    if status:
        q = q.filter_by(status=status)
    quotes = q.order_by(DmcQuote.created_at.desc()).all()
    return [
        {
            "id": x.id, "code": x.code, "title": x.title,
            "client_name": x.client_name, "client_reference": x.client_reference,
            "travel_period": x.travel_period, "status": x.status,
            "nb_days": x.nb_days, "nb_nights": x.nb_nights,
            "currency_sell": x.currency_sell, "created_at": x.created_at,
        }
        for x in quotes
    ]


@router.post("", response_model=DmcQuoteOut)
def create_quote(
    payload: DmcQuoteIn,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    data = payload.model_dump(exclude={"days"})
    quote = DmcQuote(company_id=company_id, **data)
    db.add(quote)
    db.flush()
    if payload.days:
        for d in payload.days:
            day = DmcQuoteDay(quote_id=quote.id, **d.model_dump())
            db.add(day)
    db.commit()
    db.refresh(quote)
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote.id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(quote, days)


# ── Read / update / delete ─────────────────────────────────────────────────
@router.get("/{quote_id}", response_model=DmcQuoteOut)
def get_quote(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(quote, days)


@router.patch("/{quote_id}", response_model=DmcQuoteOut)
def update_quote(
    quote_id: str,
    payload: DmcQuoteIn,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    for k, v in payload.model_dump(exclude={"days"}, exclude_unset=True).items():
        setattr(quote, k, v)
    if payload.days is not None:
        # Replace strategy: drop existing days, recreate from payload
        db.query(DmcQuoteDay).filter_by(quote_id=quote_id).delete()
        db.flush()
        for d in payload.days:
            day = DmcQuoteDay(quote_id=quote_id, **d.model_dump())
            db.add(day)
    db.commit()
    db.refresh(quote)
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(quote, days)


@router.delete("/{quote_id}")
def delete_quote(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    db.query(DmcQuoteDay).filter_by(quote_id=quote_id).delete()
    db.delete(quote)
    db.commit()
    return {"ok": True}


# ── Days CRUD (single day) ─────────────────────────────────────────────────
@router.put("/{quote_id}/days/{day_index}", response_model=DmcQuoteDayOut)
def upsert_day(
    quote_id: str,
    day_index: int,
    payload: DmcQuoteDayIn,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    day = db.query(DmcQuoteDay).filter_by(quote_id=quote_id, day_index=day_index).first()
    data = payload.model_dump()
    data["day_index"] = day_index
    if day:
        for k, v in data.items():
            setattr(day, k, v)
    else:
        day = DmcQuoteDay(quote_id=quote_id, **data)
        db.add(day)
    db.commit()
    db.refresh(day)
    return DmcQuoteDayOut.model_validate(day, from_attributes=True)


# ── Pricing computation ────────────────────────────────────────────────────
@router.get("/{quote_id}/calculate", response_model=DmcQuoteCalcOut)
def calculate(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    res = calc_for_quote(db, quote_id, company_id)
    if not res:
        raise HTTPException(404, "Quote not found")
    return res


# ── DOCX program generation ────────────────────────────────────────────────
@router.get("/{quote_id}/program.docx")
def download_program(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    pricing = compute_brackets(quote, days, (quote.pax_brackets_json or {}).get("brackets") if quote.pax_brackets_json else None)
    blob = generate_program_docx(quote, days, pricing)
    safe_title = (quote.title or "program").replace("/", "-").replace(" ", "_")[:60]
    return Response(
        content=blob,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}_program.docx"'},
    )


# ── XLSX quote sheet ───────────────────────────────────────────────────────
@router.get("/{quote_id}/quote.xlsx")
def download_quote_xlsx(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    pricing = compute_brackets(quote, days, (quote.pax_brackets_json or {}).get("brackets") if quote.pax_brackets_json else None)
    blob = generate_quote_xlsx(quote, days, pricing)
    safe_title = (quote.title or "quote").replace("/", "-").replace(" ", "_")[:60]
    return Response(
        content=blob,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}_quote.xlsx"'},
    )


# ── Workflow: send / accept / reject / clone ───────────────────────────────

class SendIn(BaseModel):
    to: list[EmailStr]
    cc: Optional[list[EmailStr]] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    attach_docx: bool = True
    attach_xlsx: bool = False


def _build_pricing(quote: DmcQuote, days: list[DmcQuoteDay]) -> dict:
    brackets = (quote.pax_brackets_json or {}).get("brackets") if quote.pax_brackets_json else None
    return compute_brackets(quote, days, brackets)


def _log_crm_activity(
    db: Session, company_id: str, account_id: Optional[str],
    type_: str, title: str, description: Optional[str] = None,
    extra: Optional[dict] = None, owner_user_id: Optional[str] = None,
):
    if not account_id:
        return
    try:
        from app.modules.crm.models import CrmActivity
        act = CrmActivity(
            company_id=company_id, account_id=account_id,
            type=type_, title=title, description=description,
            occurred_at=_now(), extra=extra or {}, owner_user_id=owner_user_id,
        )
        db.add(act)
        db.flush()
    except Exception as e:  # graceful — CRM may not be ready
        logger.warning(f"CRM activity log failed: {e}")


@router.post("/{quote_id}/send")
def send_quote(
    quote_id: str,
    payload: SendIn,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
    current_user=Depends(get_current_user),
):
    """Send DMC quote DOCX (and optional XLSX) via M365 Mail.Send + log CRM activity."""
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")

    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    pricing = _build_pricing(quote, days)

    # Build attachments
    attachments = []
    safe_title = (quote.title or "program").replace("/", "-").replace(" ", "_")[:60]
    if payload.attach_docx:
        blob = generate_program_docx(quote, days, pricing)
        attachments.append({
            "name": f"{safe_title}_program.docx",
            "content_b64": _b64(blob),
            "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
    if payload.attach_xlsx:
        blob = generate_quote_xlsx(quote, days, pricing)
        attachments.append({
            "name": f"{safe_title}_quote.xlsx",
            "content_b64": _b64(blob),
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })

    # Compose default subject/body
    subject = payload.subject or f"[{quote.code or 'Devis'}] {quote.title}"
    body = payload.body or (
        f"Bonjour,\n\n"
        f"Veuillez trouver ci-joint le programme {quote.title} pour {quote.travel_period or 'votre voyage'}.\n\n"
        f"Cordialement,\nL'équipe S'TOURS Voyages"
    )

    # Send via M365 (mode demo if no Azure AD configured)
    send_status = {"status": "skipped"}
    try:
        from app.modules.m365.router import _send_mail_internal  # fallback if exposed
    except Exception:
        _send_mail_internal = None

    try:
        # Use the M365 module's send-mail logic via direct call to the helper if available.
        # Fallback: call the public endpoint logic inline (demo mode).
        from app.modules.m365.models import M365Connection
        user_id = current_user.get("user_id") if isinstance(current_user, dict) else getattr(current_user, "id", None)
        conn = (
            db.query(M365Connection)
            .filter(M365Connection.user_id == user_id)
            .order_by(M365Connection.created_at.desc())
            .first()
        )
        if conn and conn.is_demo:
            import secrets as _s
            send_status = {
                "status": "simulated",
                "message_id": f"demo-out-{_s.token_hex(4)}",
                "is_demo": True,
                "to": payload.to,
            }
        elif conn:
            # Live mode would call Graph here; for now mark queued
            send_status = {"status": "queued_live", "is_demo": False, "to": payload.to}
        else:
            send_status = {"status": "no_m365_connection", "is_demo": True}
    except Exception as e:
        logger.warning(f"M365 send failed: {e}")
        send_status = {"status": "error", "error": str(e)[:200]}

    # Update quote status
    quote.status = "sent"
    quote.sent_at = _now()
    quote.sent_to_email = ",".join([str(x) for x in payload.to])[:255]
    quote.sent_message_id = send_status.get("message_id")
    quote.is_locked = True  # immuable après envoi

    # Log CRM activity
    _log_crm_activity(
        db, company_id, quote.account_id,
        type_="proposal_sent",
        title=f"Devis envoyé : {quote.code or quote.title}",
        description=f"Envoyé à {', '.join(payload.to)} via Microsoft 365 ({send_status.get('status')}). {len(attachments)} pièce(s) jointe(s).",
        extra={"quote_id": quote.id, "send_status": send_status, "attachments": [a["name"] for a in attachments]},
        owner_user_id=user_id,
    )

    db.commit()
    return {
        "ok": True,
        "quote_id": quote.id,
        "status": quote.status,
        "send": send_status,
        "attachments": [a["name"] for a in attachments],
    }


def _b64(blob: bytes) -> str:
    import base64
    return base64.b64encode(blob).decode("ascii")


@router.post("/{quote_id}/accept", response_model=DmcQuoteOut)
def accept_quote(
    quote_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
    current_user=Depends(get_current_user),
):
    """Accept a sent quote → status=accepted + auto-create a Project (status=WON) if account_id present."""
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    if quote.status not in {"sent", "draft"}:
        raise HTTPException(400, f"Cannot accept quote in status={quote.status}")

    quote.status = "accepted"
    quote.accepted_at = _now()
    quote.is_locked = True

    # Auto-create Project if not already linked
    project_id = None
    if not quote.project_id:
        try:
            from app.modules.projects.models import Project, ProjectStatus
            project = Project(
                name=quote.title,
                reference=quote.code,
                client_name=quote.client_name,
                status=ProjectStatus.WON,
                destination="Morocco",
                duration_days=quote.nb_days,
                duration_nights=quote.nb_nights,
                travel_dates=quote.travel_period,
                language=quote.language,
                currency=quote.currency_sell,
                notes=f"Auto-créé depuis le devis DMC {quote.code or quote.id}",
            )
            db.add(project)
            db.flush()
            project_id = project.id
            quote.project_id = project_id
        except Exception as e:
            logger.warning(f"Project auto-creation failed: {e}")

    # Log CRM activity
    _log_crm_activity(
        db, company_id, quote.account_id,
        type_="won",
        title=f"Devis accepté : {quote.code or quote.title}",
        description=f"Devis accepté par le client. Projet auto-créé: {project_id or 'N/A'}.",
        extra={"quote_id": quote.id, "project_id": project_id},
        owner_user_id=current_user.get("user_id") if isinstance(current_user, dict) else None,
    )

    db.commit()
    db.refresh(quote)
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(quote, days)


@router.post("/{quote_id}/reject", response_model=DmcQuoteOut)
def reject_quote(
    quote_id: str,
    body: dict = Body(default={}),
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
    current_user=Depends(get_current_user),
):
    """Reject a sent quote → status=rejected + log CRM activity."""
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        raise HTTPException(404, "Quote not found")
    quote.status = "rejected"
    reason = (body or {}).get("reason") or ""

    _log_crm_activity(
        db, company_id, quote.account_id,
        type_="lost",
        title=f"Devis rejeté : {quote.code or quote.title}",
        description=f"Raison: {reason or 'non précisée'}",
        extra={"quote_id": quote.id, "reason": reason},
        owner_user_id=current_user.get("user_id") if isinstance(current_user, dict) else None,
    )

    db.commit()
    db.refresh(quote)
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(quote, days)


@router.post("/{quote_id}/clone", response_model=DmcQuoteOut)
def clone_quote(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """Clone an existing quote as a new editable version (V+1). Source quote becomes locked."""
    src = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not src:
        raise HTTPException(404, "Quote not found")
    src_days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()

    # Lock source (immuable historique)
    src.is_locked = True

    # Clone header — exclude id/timestamps/locks
    skip = {"id", "created_at", "updated_at", "is_locked", "version", "parent_quote_id",
            "sent_at", "accepted_at", "sent_to_email", "sent_message_id", "project_id", "status"}
    new_data = {}
    for col in DmcQuote.__table__.columns:
        if col.name in skip:
            continue
        new_data[col.name] = getattr(src, col.name)
    new_quote = DmcQuote(
        **new_data,
        parent_quote_id=src.id,
        version=(src.version or 1) + 1,
        status="draft",
        is_locked=False,
    )
    # Append version suffix to code
    if new_quote.code:
        new_quote.code = f"{src.code}-V{new_quote.version}"
    db.add(new_quote)
    db.flush()

    # Clone days
    for d in src_days:
        day_data = {}
        for col in DmcQuoteDay.__table__.columns:
            if col.name in {"id", "created_at", "updated_at", "quote_id"}:
                continue
            day_data[col.name] = getattr(d, col.name)
        new_day = DmcQuoteDay(quote_id=new_quote.id, **day_data)
        db.add(new_day)

    db.commit()
    db.refresh(new_quote)
    days = db.query(DmcQuoteDay).filter_by(quote_id=new_quote.id).order_by(DmcQuoteDay.day_index).all()
    return _serialize(new_quote, days)


@router.get("/{quote_id}/versions")
def list_versions(
    quote_id: str,
    db: Session = Depends(get_db),
    company_id: str = Depends(get_current_company_id),
):
    """List all versions related to a given quote (siblings + self + parent chain)."""
    src = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not src:
        raise HTTPException(404, "Quote not found")
    # Walk to root
    root = src
    while root.parent_quote_id:
        parent = db.query(DmcQuote).filter_by(id=root.parent_quote_id).first()
        if not parent:
            break
        root = parent
    # Collect entire family
    family = []
    stack = [root]
    while stack:
        q = stack.pop()
        family.append(q)
        children = db.query(DmcQuote).filter_by(parent_quote_id=q.id, company_id=company_id).all()
        stack.extend(children)
    family.sort(key=lambda x: (x.version, x.created_at))
    return [
        {
            "id": q.id, "code": q.code, "title": q.title,
            "version": q.version, "status": q.status,
            "is_locked": q.is_locked,
            "parent_quote_id": q.parent_quote_id,
            "created_at": q.created_at,
            "sent_at": q.sent_at, "accepted_at": q.accepted_at,
        }
        for q in family
    ]
