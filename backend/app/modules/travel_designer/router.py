"""Travel Designer Pro REST API.

S1 — drag-drop catalogue → days
S2 — réordonner / éditer / supprimer items
S3 — recompute totals + margin
S4 — save versions
S5 — promote to Itinerary + Quotation (demo)
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth

from .catalog import DEMO_CATALOG, CITIES, category_of, find_item
from .models import TravelDraft

router = APIRouter(prefix="/travel-designer-pro", tags=["travel-designer-pro"], dependencies=[Depends(require_auth)])


# ── Schemas ─────────────────────────────────────────────────────────
class DraftIn(BaseModel):
    name: str = Field(default="Nouveau circuit")
    project_id: Optional[str] = None
    pax: int = 10
    start_date: Optional[str] = None
    currency: str = "MAD"
    margin_pct: float = 15.0


class DraftPatch(BaseModel):
    name: Optional[str] = None
    pax: Optional[int] = None
    start_date: Optional[str] = None
    currency: Optional[str] = None
    margin_pct: Optional[float] = None
    days: Optional[list] = None
    notes: Optional[str] = None


class AddDayIn(BaseModel):
    city: str = "Marrakech"
    date: Optional[str] = None


class AddItemIn(BaseModel):
    day_num: int
    item_id: str
    qty: int = 1


class MoveItemIn(BaseModel):
    from_day: int
    to_day: int
    item_index: int
    new_index: Optional[int] = None


class RemoveItemIn(BaseModel):
    day_num: int
    item_index: int


# ── Helpers ─────────────────────────────────────────────────────────
def _new_day(day_num: int, city: str, date: Optional[str] = None) -> dict:
    return {"day_num": day_num, "city": city, "date": date, "items": []}


def _materialize(item_id: str, qty: int = 1) -> Optional[dict]:
    src = find_item(item_id)
    if not src:
        return None
    return {
        "kind": category_of(item_id),
        "item_id": item_id,
        "label": src["label"],
        "city": src.get("city"),
        "qty": qty,
        "unit_cost": float(src.get("unit_cost", 0)),
        "currency": src.get("currency", "MAD"),
        "supplier": src.get("supplier"),
        "meta": {k: v for k, v in src.items() if k not in {"id", "label", "city", "unit_cost", "currency", "supplier"}},
    }


def _recompute(draft: TravelDraft) -> dict:
    pax = max(1, draft.pax or 10)
    days = draft.days or []
    by_kind: dict[str, float] = {}
    by_city: dict[str, float] = {}
    total = 0.0
    for d in days:
        for it in d.get("items", []):
            line_cost = float(it.get("unit_cost", 0)) * int(it.get("qty", 1))
            total += line_cost
            by_kind[it.get("kind", "misc")] = by_kind.get(it.get("kind", "misc"), 0) + line_cost
            city = d.get("city") or "—"
            by_city[city] = by_city.get(city, 0) + line_cost
    margin = float(draft.margin_pct or 0) / 100.0
    public = total * (1.0 + margin)
    per_pax = public / pax
    totals = {
        "lines": int(sum(len(d.get("items", [])) for d in days)),
        "days": len(days),
        "total_cost": round(total, 2),
        "margin_pct": float(draft.margin_pct or 0),
        "margin_value": round(public - total, 2),
        "public_total": round(public, 2),
        "per_pax": round(per_pax, 2),
        "currency": draft.currency,
        "by_kind": {k: round(v, 2) for k, v in by_kind.items()},
        "by_city": {k: round(v, 2) for k, v in by_city.items()},
    }
    draft.totals = totals
    return totals


def _serialize(draft: TravelDraft) -> dict:
    return {
        "id": draft.id,
        "project_id": draft.project_id,
        "name": draft.name,
        "pax": draft.pax,
        "start_date": draft.start_date,
        "currency": draft.currency,
        "margin_pct": float(draft.margin_pct or 0),
        "status": draft.status,
        "version": draft.version,
        "days": draft.days or [],
        "totals": draft.totals or {},
        "notes": draft.notes or "",
        "last_saved_at": draft.last_saved_at.isoformat() if draft.last_saved_at else None,
    }


# ── S1 · Catalogue ──────────────────────────────────────────────────
@router.get("/catalog")
def catalog():
    """Catalogue de référence (hotels/restaurants/monuments/transport/guides/activities)."""
    return {
        "kinds": list(DEMO_CATALOG.keys()),
        "items_total": sum(len(v) for v in DEMO_CATALOG.values()),
        "cities": CITIES,
        "catalog": DEMO_CATALOG,
    }


# ── Drafts CRUD ─────────────────────────────────────────────────────
@router.get("/drafts")
def list_drafts(db: Session = Depends(get_db)):
    rows = db.execute(select(TravelDraft).order_by(TravelDraft.created_at.desc())).scalars().all()
    return [_serialize(r) for r in rows]


@router.post("/drafts", status_code=201)
def create_draft(payload: DraftIn, db: Session = Depends(get_db)):
    draft = TravelDraft(
        name=payload.name,
        project_id=payload.project_id,
        pax=payload.pax,
        start_date=payload.start_date,
        currency=payload.currency,
        margin_pct=payload.margin_pct,
        days=[],
        totals={},
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: str, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")
    return _serialize(draft)


@router.patch("/drafts/{draft_id}")
def patch_draft(draft_id: str, payload: DraftPatch, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404, "Draft not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(draft, k, v)
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.delete("/drafts/{draft_id}", status_code=204)
def delete_draft(draft_id: str, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    db.delete(draft)
    db.commit()


# ── S2 · Days & items mutations ─────────────────────────────────────
@router.post("/drafts/{draft_id}/days")
def add_day(draft_id: str, payload: AddDayIn, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    days = list(draft.days or [])
    day_num = (max((d.get("day_num", 0) for d in days), default=0) or 0) + 1
    date = payload.date
    if not date and draft.start_date:
        try:
            base = datetime.fromisoformat(draft.start_date)
            date = (base + timedelta(days=day_num - 1)).date().isoformat()
        except Exception:
            pass
    days.append(_new_day(day_num, payload.city, date))
    draft.days = days
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.delete("/drafts/{draft_id}/days/{day_num}")
def remove_day(draft_id: str, day_num: int, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    days = [d for d in (draft.days or []) if d.get("day_num") != day_num]
    # renumerate
    for i, d in enumerate(days, start=1):
        d["day_num"] = i
    draft.days = days
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.post("/drafts/{draft_id}/items")
def add_item(draft_id: str, payload: AddItemIn, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    item = _materialize(payload.item_id, payload.qty)
    if not item:
        raise HTTPException(404, f"Item {payload.item_id} not in catalog")
    days = list(draft.days or [])
    target = next((d for d in days if d.get("day_num") == payload.day_num), None)
    if not target:
        # auto-create the day
        target = _new_day(payload.day_num, item.get("city") or "—")
        days.append(target)
    target.setdefault("items", []).append(item)
    draft.days = days
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.post("/drafts/{draft_id}/items/move")
def move_item(draft_id: str, payload: MoveItemIn, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    days = list(draft.days or [])
    src = next((d for d in days if d.get("day_num") == payload.from_day), None)
    dst = next((d for d in days if d.get("day_num") == payload.to_day), None)
    if not src or not dst:
        raise HTTPException(400, "from/to day not found")
    items = src.get("items", [])
    if not (0 <= payload.item_index < len(items)):
        raise HTTPException(400, "item_index out of range")
    item = items.pop(payload.item_index)
    new_index = payload.new_index if payload.new_index is not None else len(dst.get("items", []))
    dst.setdefault("items", []).insert(new_index, item)
    draft.days = days
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.post("/drafts/{draft_id}/items/remove")
def remove_item(draft_id: str, payload: RemoveItemIn, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    days = list(draft.days or [])
    target = next((d for d in days if d.get("day_num") == payload.day_num), None)
    if not target:
        raise HTTPException(400, "day not found")
    items = target.get("items", [])
    if not (0 <= payload.item_index < len(items)):
        raise HTTPException(400, "item_index out of range")
    items.pop(payload.item_index)
    draft.days = days
    draft.last_saved_at = datetime.now(timezone.utc)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


# ── S3 · Recompute ──────────────────────────────────────────────────
@router.post("/drafts/{draft_id}/recompute")
def recompute(draft_id: str, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    totals = _recompute(draft)
    db.commit()
    return {"id": draft.id, "totals": totals}


# ── S4 · Save / Version ─────────────────────────────────────────────
@router.post("/drafts/{draft_id}/save-version")
def save_version(draft_id: str, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    draft.version = (draft.version or 1) + 1
    draft.last_saved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(draft)
    return {"id": draft.id, "version": draft.version, "saved_at": draft.last_saved_at.isoformat()}


# ── S5 · Promote (demo) ─────────────────────────────────────────────
@router.post("/drafts/{draft_id}/promote")
def promote_to_itinerary(draft_id: str, db: Session = Depends(get_db)):
    draft = db.get(TravelDraft, draft_id)
    if not draft:
        raise HTTPException(404)
    _recompute(draft)
    draft.status = "published"
    db.commit()
    db.refresh(draft)
    return {
        "id": draft.id,
        "status": draft.status,
        "promoted_at": datetime.now(timezone.utc).isoformat(),
        "summary": f"Itinéraire {draft.name} ({len(draft.days or [])}j) → Itinerary + Quotation V{draft.version}",
        "totals": draft.totals,
        "demo_itinerary_id": f"itin-demo-{draft.id[:8]}",
        "demo_quotation_id": f"quot-demo-{draft.id[:8]}",
    }


# ── Demo seed ───────────────────────────────────────────────────────
@router.post("/seed-demo")
def seed_demo(db: Session = Depends(get_db)):
    """Crée un brouillon démo 'Imperial Cities 7D' avec quelques items pré-placés."""
    existing = db.execute(select(TravelDraft).where(TravelDraft.name == "Imperial Cities — démo 7j")).scalars().first()
    if existing:
        return {"id": existing.id, "created": False}

    seed_days = [
        {"day_num": 1, "city": "Casablanca", "date": "2026-06-01", "items": [
            _materialize("h-casa-fourseasons"),
            _materialize("t-mini-bus-26"),
        ]},
        {"day_num": 2, "city": "Rabat", "date": "2026-06-02", "items": [
            _materialize("h-rabat-libertas"),
            _materialize("g-rabat"),
            _materialize("r-saveurs-pal"),
        ]},
        {"day_num": 3, "city": "Fès", "date": "2026-06-03", "items": [
            _materialize("h-fes-palais"),
            _materialize("g-fes"),
            _materialize("m-fes-medina"),
            _materialize("r-dar-roumana"),
        ]},
        {"day_num": 4, "city": "Meknès", "date": "2026-06-04", "items": [
            _materialize("m-volubilis"),
        ]},
        {"day_num": 5, "city": "Marrakech", "date": "2026-06-05", "items": [
            _materialize("h-mamounia"),
            _materialize("g-marrakech"),
            _materialize("m-bahia"),
            _materialize("m-jemaa"),
        ]},
        {"day_num": 6, "city": "Marrakech", "date": "2026-06-06", "items": [
            _materialize("h-mamounia"),
            _materialize("a-cooking"),
            _materialize("r-namaskar"),
        ]},
        {"day_num": 7, "city": "Marrakech", "date": "2026-06-07", "items": [
            _materialize("r-chez-ali"),
            _materialize("t-mini-bus-26"),
        ]},
    ]
    draft = TravelDraft(
        name="Imperial Cities — démo 7j",
        pax=15,
        start_date="2026-06-01",
        currency="MAD",
        margin_pct=18.0,
        days=seed_days,
        totals={},
    )
    db.add(draft)
    _recompute(draft)
    db.commit()
    db.refresh(draft)
    return {"id": draft.id, "created": True, "days": len(draft.days), "totals": draft.totals}
