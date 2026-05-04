"""Portail B2B — endpoints internes (cockpit STOURS) + endpoints publics (token-based).

Internal `/api/b2b-portal/*` (auth requise) :
- /dashboard, /seed-demo
- /agencies (list/create/get/patch)
- /quotations (list/create/get/send/accept/reject)
- /tracking (list/create per booking)
- /sessions/magic-link (génère un token et URL public)

Public `/api/b2b-portal/public/*` (no auth, token-only) :
- /quote/{token}    → consulte un devis envoyé
- /quote/{token}/accept|reject  → action client
- /tracking/{token} → consulte la timeline d'un voyage
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from secrets import token_urlsafe

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth
from app.modules.b2b_portal.models import (
    B2BAgency, B2BQuotation, B2BSession, B2BTrackingEvent
)


internal_router = APIRouter(
    prefix="/b2b-portal",
    tags=["b2b-portal"],
    dependencies=[Depends(require_auth)],
)
public_router = APIRouter(
    prefix="/b2b-portal/public",
    tags=["b2b-portal-public"],
)


# ─── Schemas ────────────────────────────────────────────────────────────────
class AgencyIn(BaseModel):
    name: str
    email: str
    contact_name: Optional[str] = None
    country: Optional[str] = None
    locale: str = "fr"
    tier: str = "standard"
    commission_pct: float = 10.0
    notes: Optional[str] = ""


class QuotationIn(BaseModel):
    agency_id: str
    title: str
    reference: Optional[str] = None
    pax: int = 2
    currency: str = "EUR"
    public_total: float = 0
    per_pax: float = 0
    margin_pct: float = 15.0
    days: list[dict] = Field(default_factory=list)
    payload: dict = Field(default_factory=dict)
    notes: Optional[str] = ""


class TrackingEventIn(BaseModel):
    agency_id: str
    booking_id: str
    booking_label: Optional[str] = None
    kind: str = "status"
    title: str
    body: Optional[str] = ""
    severity: str = "info"
    payload: dict = Field(default_factory=dict)


class MagicLinkIn(BaseModel):
    agency_id: str
    purpose: str = "login"        # login|quote|tracking
    target_id: Optional[str] = None
    expires_in_hours: int = 72


class StatusActionIn(BaseModel):
    note: Optional[str] = None


# ─── Helpers ────────────────────────────────────────────────────────────────
def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _agency_out(a: B2BAgency) -> dict:
    return {
        "id": a.id, "name": a.name, "email": a.email,
        "contact_name": a.contact_name, "country": a.country,
        "locale": a.locale, "tier": a.tier, "status": a.status,
        "commission_pct": float(a.commission_pct or 0),
        "notes": a.notes or "",
        "last_login_at": _iso(a.last_login_at),
        "created_at": _iso(a.created_at),
    }


def _quot_out(q: B2BQuotation, agency: Optional[B2BAgency] = None) -> dict:
    return {
        "id": q.id,
        "agency_id": q.agency_id,
        "agency_name": agency.name if agency else None,
        "agency_email": agency.email if agency else None,
        "title": q.title,
        "reference": q.reference,
        "pax": q.pax,
        "currency": q.currency,
        "public_total": float(q.public_total or 0),
        "per_pax": float(q.per_pax or 0),
        "margin_pct": float(q.margin_pct or 0),
        "status": q.status,
        "days": q.days or [],
        "payload": q.payload or {},
        "public_token": q.public_token,
        "public_url": (
            f"https://portal.stours.ma/quote/{q.public_token}" if q.public_token else None
        ),
        "sent_at": _iso(q.sent_at),
        "viewed_at": _iso(q.viewed_at),
        "accepted_at": _iso(q.accepted_at),
        "rejected_at": _iso(q.rejected_at),
        "expires_at": _iso(q.expires_at),
        "created_at": _iso(q.created_at),
        "notes": q.notes or "",
    }


def _track_out(t: B2BTrackingEvent) -> dict:
    return {
        "id": t.id,
        "agency_id": t.agency_id,
        "booking_id": t.booking_id,
        "booking_label": t.booking_label,
        "kind": t.kind,
        "title": t.title,
        "body": t.body or "",
        "severity": t.severity,
        "occurred_at": _iso(t.occurred_at),
        "payload": t.payload or {},
    }


def _demo_days(title: str) -> list[tuple[str, str]]:
    if "Imperial" in title:
        return [
            ("Casablanca", "Arrivée + visite Hassan II"),
            ("Rabat", "Tour de ville et Kasbah des Oudayas"),
            ("Fès", "Médina + tannerie Chouara"),
            ("Fès", "Volubilis + Meknès en excursion"),
            ("Marrakech", "Route via Ifrane"),
            ("Marrakech", "Bahia + Saadiens + Jemaa"),
            ("Marrakech", "Atlas + déjeuner berbère"),
            ("Marrakech", "Cuisine atelier + souk shopping"),
            ("Essaouira", "Excursion littorale"),
            ("Marrakech", "Soirée gala Chez Ali"),
            ("Casablanca", "Transfert départ"),
        ]
    if "Sahara" in title:
        return [
            ("Marrakech", "Riad Royal Mansour arrival"),
            ("Marrakech", "Spa privé + dîner Mamounia"),
            ("Aït-Ben-Haddou", "Kasbah patrimoine UNESCO"),
            ("Skoura", "Palmeraie + lodge boutique"),
            ("Merzouga", "Erg Chebbi · camel sunset"),
            ("Merzouga", "Sahara Luxury Camp · gala"),
            ("Marrakech", "Retour via Tichka"),
            ("Marrakech", "Départ"),
        ]
    if "YS Morocco" in title or "YS Travel" in title:
        return [
            ("Casablanca", "Arrival · welcome dinner"),
            ("Rabat", "Royal palace + Hassan tower"),
            ("Chefchaouen", "Blue city walk"),
            ("Fès", "Medina full day"),
            ("Volubilis", "Roman ruins half-day"),
            ("Erfoud", "Atlas crossing"),
            ("Merzouga", "Desert sunset"),
            ("Ouarzazate", "Studios + Aït-Ben-Haddou"),
            ("Marrakech", "Jardins + Bahia"),
            ("Marrakech", "Atlas mountain"),
            ("Casablanca", "Departure"),
        ]
    return [
        ("Marrakech", "Day program"), ("Marrakech", "Day program"),
        ("Marrakech", "Day program"), ("Marrakech", "Day program"),
        ("Marrakech", "Departure")
    ]


# ═══════════════════════════════════════════════════════════════════════════
# INTERNAL ENDPOINTS (cockpit STOURS)
# ═══════════════════════════════════════════════════════════════════════════
@internal_router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    agencies = db.execute(select(B2BAgency)).scalars().all()
    quots = db.execute(select(B2BQuotation)).scalars().all()
    sessions = db.execute(
        select(B2BSession).where(B2BSession.revoked == False)  # noqa: E712
    ).scalars().all()
    tracks = db.execute(select(B2BTrackingEvent)).scalars().all()

    by_status: dict[str, int] = {}
    for q in quots:
        by_status[q.status] = by_status.get(q.status, 0) + 1
    accepted = by_status.get("accepted", 0)
    sent = (by_status.get("sent", 0) + by_status.get("viewed", 0)
            + accepted + by_status.get("rejected", 0))
    conversion = round(accepted / sent * 100, 1) if sent else 0.0

    pipeline = sum(float(q.public_total or 0) for q in quots if q.status in ("sent", "viewed"))
    won = sum(float(q.public_total or 0) for q in quots if q.status == "accepted")

    by_tier: dict[str, int] = {}
    for a in agencies:
        by_tier[a.tier] = by_tier.get(a.tier, 0) + 1

    return {
        "agencies_total": len(agencies),
        "agencies_active": sum(1 for a in agencies if a.status == "active"),
        "agencies_by_tier": by_tier,
        "quotations_total": len(quots),
        "quotations_by_status": by_status,
        "conversion_pct": conversion,
        "pipeline_value": round(pipeline, 2),
        "won_value": round(won, 2),
        "active_sessions": len(sessions),
        "tracking_events_total": len(tracks),
        "active_bookings": len({t.booking_id for t in tracks}),
    }


@internal_router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    """Seed 5 agences + 4 quotations + 8 tracking events."""
    for tbl in (B2BTrackingEvent, B2BSession, B2BQuotation, B2BAgency):
        db.query(tbl).delete()
    db.commit()

    agencies_data = [
        ("Voyageurs du Monde", "contact@voyageursdumonde.fr",
         "Pauline Martin", "France", "fr", "platinum", 12.0),
        ("Audley Travel", "ops@audleytravel.co.uk",
         "James Whitford", "Royaume-Uni", "en", "platinum", 11.0),
        ("YS Travel Morocco", "info@ystravel.com",
         "Yasmin Sherif", "USA", "en", "gold", 10.0),
        ("Giant Tour Italia", "morocco@gianttour.it",
         "Marco Rossi", "Italie", "fr", "gold", 9.5),
        ("Tour Magico", "ventas@tourmagico.es",
         "Carla Vega", "Espagne", "fr", "standard", 8.0),
    ]
    agencies: list[B2BAgency] = []
    for name, email, contact, country, locale, tier, comm in agencies_data:
        a = B2BAgency(
            name=name, email=email, contact_name=contact, country=country,
            locale=locale, tier=tier, status="active",
            commission_pct=comm, notes=f"Partenaire {tier} · {country}",
        )
        db.add(a)
        db.flush()
        agencies.append(a)
    db.commit()

    now = datetime.now(timezone.utc)
    quotations_data = [
        (agencies[0].id, "Imperial Cities 11D Nov 2026", "QB-2026-0001",
         18, "EUR", 36400, 2022, "sent", -3),
        (agencies[1].id, "Sahara Luxury 8D — déc 2026", "QB-2026-0002",
         6, "EUR", 21800, 3633, "viewed", -2),
        (agencies[2].id, "YS Travel Morocco 11D Adhoc Nov 2026", "QB-2026-0003",
         14, "USD", 28140, 2010, "accepted", -7),
        (agencies[3].id, "Marrakech Atlas 5D", "QB-2026-0004",
         10, "EUR", 12500, 1250, "draft", 0),
    ]
    quots: list[B2BQuotation] = []
    for ag_id, title, ref, pax, cur, total, per_pax, status, days_offset in quotations_data:
        token_str = token_urlsafe(24) if status != "draft" else None
        sent_at = now + timedelta(days=days_offset) if status != "draft" else None
        viewed_at = (now + timedelta(days=days_offset + 1)
                     if status in ("viewed", "accepted", "rejected") else None)
        accepted_at = now + timedelta(days=days_offset + 2) if status == "accepted" else None
        q = B2BQuotation(
            agency_id=ag_id, title=title, reference=ref, pax=pax, currency=cur,
            public_total=total, per_pax=per_pax, margin_pct=15.0, status=status,
            public_token=token_str, sent_at=sent_at, viewed_at=viewed_at,
            accepted_at=accepted_at, expires_at=now + timedelta(days=21),
            days=[
                {"day_num": i + 1, "city": city, "summary": summary}
                for i, (city, summary) in enumerate(_demo_days(title))
            ],
            payload={
                "includes": ["Hôtels", "Transport privé", "Guide francophone"],
                "excludes": ["Vols internationaux", "Boissons"],
            },
            notes="",
        )
        db.add(q)
        db.flush()
        quots.append(q)
    db.commit()

    accepted_q = quots[2]
    tracking_data = [
        ("status", "Confirmation reçue",
         "Acompte 30% encaissé. Réservations hôtels lancées.", "success", -7),
        ("status", "Vouchers émis",
         "Bon d'échange Riad + transports envoyés à l'agence.", "success", -5),
        ("status", "J-7 — Briefing voyageur",
         "Email pré-départ envoyé : checklist + contact 24/7.", "info", -3),
        ("status", "J-1 — Welcome ready",
         "Guide confirmé · véhicule MAN Irizar I6 préparé.", "info", -1),
        ("location", "Arrivée Casablanca",
         "Vol AT 207 atterri 11h45. Transfert hôtel en cours.", "info", 0),
        ("photo", "Médina de Fès",
         "Photo groupe devant Bab Boujloud (groupe au complet).", "info", 1),
        ("alert", "Retard mineur — Atlas",
         "Trafic Tichka : ETA Ouarzazate +30 min. Pas d'impact dîner.", "warning", 2),
        ("status", "Désert Merzouga atteint",
         "Camp Sahara Luxury · ciel dégagé · gala 21h.", "success", 3),
    ]
    for kind, title, body, sev, days_offset in tracking_data:
        ev = B2BTrackingEvent(
            agency_id=accepted_q.agency_id,
            booking_id=accepted_q.id,
            booking_label=accepted_q.title,
            kind=kind, title=title, body=body, severity=sev,
            occurred_at=now + timedelta(days=days_offset),
            payload={},
        )
        db.add(ev)
    db.commit()

    return {
        "agencies_created": len(agencies),
        "quotations_created": len(quots),
        "tracking_events_created": len(tracking_data),
        "accepted_booking_id": accepted_q.id,
    }


# ─── Agencies CRUD ──────────────────────────────────────────────────────────
@internal_router.get("/agencies")
def list_agencies(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(B2BAgency).order_by(desc(B2BAgency.created_at))
    if status:
        q = q.where(B2BAgency.status == status)
    if tier:
        q = q.where(B2BAgency.tier == tier)
    rows = db.execute(q).scalars().all()
    return [_agency_out(a) for a in rows]


@internal_router.post("/agencies")
def create_agency(payload: AgencyIn, db: Session = Depends(get_db)):
    if db.execute(
        select(B2BAgency).where(B2BAgency.email == payload.email)
    ).scalar_one_or_none():
        raise HTTPException(409, "Une agence avec cet email existe déjà")
    a = B2BAgency(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return _agency_out(a)


@internal_router.get("/agencies/{agency_id}")
def get_agency(agency_id: str, db: Session = Depends(get_db)):
    a = db.get(B2BAgency, agency_id)
    if not a:
        raise HTTPException(404, "Agence introuvable")
    return _agency_out(a)


@internal_router.patch("/agencies/{agency_id}")
def patch_agency(agency_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    a = db.get(B2BAgency, agency_id)
    if not a:
        raise HTTPException(404, "Agence introuvable")
    allowed = {"name", "contact_name", "country", "locale", "tier", "status",
               "commission_pct", "notes"}
    for k, v in payload.items():
        if k in allowed:
            setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _agency_out(a)


# ─── Magic-link ─────────────────────────────────────────────────────────────
@internal_router.post("/sessions/magic-link")
def issue_magic_link(payload: MagicLinkIn, db: Session = Depends(get_db)):
    a = db.get(B2BAgency, payload.agency_id)
    if not a:
        raise HTTPException(404, "Agence introuvable")
    token = token_urlsafe(24)
    sess = B2BSession(
        agency_id=payload.agency_id,
        token=token,
        purpose=payload.purpose,
        target_id=payload.target_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours),
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    base_path = {
        "login": "login",
        "quote": f"quote/{payload.target_id}",
        "tracking": f"tracking/{payload.target_id}",
    }.get(payload.purpose, "login")
    public_url = f"https://portal.stours.ma/{base_path}?t={token}"
    return {
        "session_id": sess.id,
        "token": token,
        "purpose": sess.purpose,
        "agency": _agency_out(a),
        "public_url": public_url,
        "expires_at": _iso(sess.expires_at),
        "demo_email_sent": True,
        "demo_email_subject": f"S'TOURS — Accès portail {a.name}",
    }


@internal_router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.execute(
        select(B2BSession).where(B2BSession.revoked == False)  # noqa: E712
        .order_by(desc(B2BSession.created_at))
    ).scalars().all()
    out = []
    for s in sessions:
        a = db.get(B2BAgency, s.agency_id)
        out.append({
            "id": s.id, "agency_id": s.agency_id,
            "agency_name": a.name if a else None,
            "purpose": s.purpose, "target_id": s.target_id,
            "expires_at": _iso(s.expires_at),
            "used_at": _iso(s.used_at),
            "last_seen_at": _iso(s.last_seen_at),
            "created_at": _iso(s.created_at),
        })
    return out


# ─── Quotations CRUD ────────────────────────────────────────────────────────
@internal_router.get("/quotations")
def list_quotations(
    status: Optional[str] = None,
    agency_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(B2BQuotation).order_by(desc(B2BQuotation.created_at))
    if status:
        q = q.where(B2BQuotation.status == status)
    if agency_id:
        q = q.where(B2BQuotation.agency_id == agency_id)
    rows = db.execute(q).scalars().all()
    out = []
    for row in rows:
        a = db.get(B2BAgency, row.agency_id)
        out.append(_quot_out(row, a))
    return out


@internal_router.post("/quotations")
def create_quotation(payload: QuotationIn, db: Session = Depends(get_db)):
    if not db.get(B2BAgency, payload.agency_id):
        raise HTTPException(404, "Agence introuvable")
    q = B2BQuotation(
        **payload.model_dump(),
        status="draft",
        expires_at=datetime.now(timezone.utc) + timedelta(days=21),
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


@internal_router.get("/quotations/{quotation_id}")
def get_quotation(quotation_id: str, db: Session = Depends(get_db)):
    q = db.get(B2BQuotation, quotation_id)
    if not q:
        raise HTTPException(404, "Devis introuvable")
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


@internal_router.post("/quotations/{quotation_id}/send")
def send_quotation(quotation_id: str, db: Session = Depends(get_db)):
    q = db.get(B2BQuotation, quotation_id)
    if not q:
        raise HTTPException(404, "Devis introuvable")
    if q.status not in ("draft", "sent"):
        raise HTTPException(400, f"Statut {q.status} non ré-envoyable")
    if not q.public_token:
        q.public_token = token_urlsafe(24)
    q.status = "sent"
    q.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)
    a = db.get(B2BAgency, q.agency_id)
    return {
        "quotation": _quot_out(q, a),
        "demo_email_sent_to": a.email if a else None,
        "demo_email_subject": f"S'TOURS · Devis {q.title}",
    }


@internal_router.post("/quotations/{quotation_id}/accept")
def accept_quotation(
    quotation_id: str,
    payload: StatusActionIn = Body(default=StatusActionIn()),
    db: Session = Depends(get_db),
):
    q = db.get(B2BQuotation, quotation_id)
    if not q:
        raise HTTPException(404, "Devis introuvable")
    q.status = "accepted"
    q.accepted_at = datetime.now(timezone.utc)
    if payload.note:
        q.notes = (q.notes or "") + f"\n[ACCEPT] {payload.note}"
    db.commit()
    db.refresh(q)
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


@internal_router.post("/quotations/{quotation_id}/reject")
def reject_quotation(
    quotation_id: str,
    payload: StatusActionIn = Body(default=StatusActionIn()),
    db: Session = Depends(get_db),
):
    q = db.get(B2BQuotation, quotation_id)
    if not q:
        raise HTTPException(404, "Devis introuvable")
    q.status = "rejected"
    q.rejected_at = datetime.now(timezone.utc)
    if payload.note:
        q.notes = (q.notes or "") + f"\n[REJECT] {payload.note}"
    db.commit()
    db.refresh(q)
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


# ─── Tracking ───────────────────────────────────────────────────────────────
@internal_router.get("/tracking")
def list_tracking(
    booking_id: Optional[str] = None,
    agency_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(B2BTrackingEvent).order_by(desc(B2BTrackingEvent.occurred_at))
    if booking_id:
        q = q.where(B2BTrackingEvent.booking_id == booking_id)
    if agency_id:
        q = q.where(B2BTrackingEvent.agency_id == agency_id)
    rows = db.execute(q).scalars().all()
    return [_track_out(t) for t in rows]


@internal_router.post("/tracking")
def create_tracking(payload: TrackingEventIn, db: Session = Depends(get_db)):
    ev = B2BTrackingEvent(**payload.model_dump())
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _track_out(ev)


@internal_router.get("/tracking/active")
def active_bookings(db: Session = Depends(get_db)):
    """Distinct bookings with at least one tracking event (for the cockpit)."""
    rows = db.execute(select(B2BTrackingEvent)).scalars().all()
    by_booking: dict[str, dict] = {}
    for r in rows:
        slot = by_booking.setdefault(r.booking_id, {
            "booking_id": r.booking_id,
            "booking_label": r.booking_label,
            "agency_id": r.agency_id,
            "events": 0,
            "last_event_at": None,
            "last_title": None,
            "max_severity": "info",
        })
        slot["events"] += 1
        if (slot["last_event_at"] is None
                or (r.occurred_at and r.occurred_at.isoformat() > slot["last_event_at"])):
            slot["last_event_at"] = _iso(r.occurred_at)
            slot["last_title"] = r.title
        sev_rank = {"info": 0, "success": 1, "warning": 2, "critical": 3}
        if sev_rank.get(r.severity, 0) > sev_rank.get(slot["max_severity"], 0):
            slot["max_severity"] = r.severity
    out = list(by_booking.values())
    for slot in out:
        a = db.get(B2BAgency, slot["agency_id"])
        slot["agency_name"] = a.name if a else None
    out.sort(key=lambda r: r["last_event_at"] or "", reverse=True)
    return out


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS (token-based, no auth — l'agence accède via magic-link)
# ═══════════════════════════════════════════════════════════════════════════
@public_router.get("/quote/{token}")
def public_quote(token: str, db: Session = Depends(get_db)):
    q = db.execute(
        select(B2BQuotation).where(B2BQuotation.public_token == token)
    ).scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Lien invalide ou expiré")
    if q.status == "sent":
        q.status = "viewed"
        q.viewed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(q)
    a = db.get(B2BAgency, q.agency_id)
    return _quot_out(q, a)


@public_router.post("/quote/{token}/accept")
def public_accept(
    token: str,
    payload: StatusActionIn = Body(default=StatusActionIn()),
    db: Session = Depends(get_db),
):
    q = db.execute(
        select(B2BQuotation).where(B2BQuotation.public_token == token)
    ).scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Lien invalide")
    q.status = "accepted"
    q.accepted_at = datetime.now(timezone.utc)
    if payload.note:
        q.notes = (q.notes or "") + f"\n[CLIENT-ACCEPT] {payload.note}"
    db.commit()
    db.refresh(q)
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


@public_router.post("/quote/{token}/reject")
def public_reject(
    token: str,
    payload: StatusActionIn = Body(default=StatusActionIn()),
    db: Session = Depends(get_db),
):
    q = db.execute(
        select(B2BQuotation).where(B2BQuotation.public_token == token)
    ).scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Lien invalide")
    q.status = "rejected"
    q.rejected_at = datetime.now(timezone.utc)
    if payload.note:
        q.notes = (q.notes or "") + f"\n[CLIENT-REJECT] {payload.note}"
    db.commit()
    db.refresh(q)
    return _quot_out(q, db.get(B2BAgency, q.agency_id))


@public_router.get("/tracking/{token}")
def public_tracking(token: str, db: Session = Depends(get_db)):
    """Token = magic-link token de purpose=tracking, target_id=booking_id."""
    sess = db.execute(
        select(B2BSession).where(B2BSession.token == token, B2BSession.revoked == False)  # noqa: E712
    ).scalar_one_or_none()
    if not sess or sess.purpose != "tracking" or not sess.target_id:
        raise HTTPException(404, "Lien invalide")
    sess.last_seen_at = datetime.now(timezone.utc)
    if not sess.used_at:
        sess.used_at = sess.last_seen_at
    db.commit()
    quot = db.get(B2BQuotation, sess.target_id)
    a = db.get(B2BAgency, sess.agency_id)
    events = db.execute(
        select(B2BTrackingEvent)
        .where(B2BTrackingEvent.booking_id == sess.target_id)
        .order_by(B2BTrackingEvent.occurred_at)
    ).scalars().all()
    return {
        "booking": _quot_out(quot, a) if quot else None,
        "agency": _agency_out(a) if a else None,
        "events": [_track_out(e) for e in events],
    }
