"""Room Categories & Rates API for hotel items."""

from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth
from .models import PremiumCatalogItem
from .room_models import RoomCategory, RoomRate

router = APIRouter(
    prefix="/premium-catalogs",
    tags=["room-categories"],
    dependencies=[Depends(require_auth)],
)


class RoomCategoryIn(BaseModel):
    name: str
    capacity: int = 2
    description: Optional[str] = None
    amenities: Optional[list] = None
    view: Optional[str] = None
    surface_m2: Optional[int] = None
    bed_type: Optional[str] = None
    sort_order: int = 0


class RoomCategoryPatch(BaseModel):
    name: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None
    amenities: Optional[list] = None
    view: Optional[str] = None
    surface_m2: Optional[int] = None
    bed_type: Optional[str] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None


class RoomRateIn(BaseModel):
    season_id: Optional[str] = None
    season_label: Optional[str] = None
    rate_type: str = "contractuel"
    rate_sgl: float = 0
    rate_dbl: float = 0
    rate_tpl: Optional[float] = None
    meal_plan: str = "BB"
    currency: str = "MAD"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    notes: Optional[str] = None


def _serialize_room(rc: RoomCategory) -> dict:
    return {
        "id": rc.id,
        "hotel_id": rc.hotel_id,
        "name": rc.name,
        "capacity": rc.capacity,
        "description": rc.description,
        "amenities": rc.amenities or [],
        "view": rc.view,
        "surface_m2": rc.surface_m2,
        "bed_type": rc.bed_type,
        "sort_order": rc.sort_order,
        "status": rc.status,
    }


def _serialize_rate(rr: RoomRate) -> dict:
    return {
        "id": rr.id,
        "room_category_id": rr.room_category_id,
        "season_id": rr.season_id,
        "season_label": rr.season_label,
        "rate_type": rr.rate_type,
        "rate_sgl": float(rr.rate_sgl) if rr.rate_sgl else 0,
        "rate_dbl": float(rr.rate_dbl) if rr.rate_dbl else 0,
        "rate_tpl": float(rr.rate_tpl) if rr.rate_tpl else None,
        "meal_plan": rr.meal_plan,
        "currency": rr.currency,
        "date_from": rr.date_from,
        "date_to": rr.date_to,
        "notes": rr.notes,
    }


# ── Room Categories ────────────────────────────────────────

@router.get("/{hotel_id}/rooms/", summary="List room categories for hotel")
def list_rooms(hotel_id: str, db: Session = Depends(get_db)):
    hotel = db.get(PremiumCatalogItem, hotel_id)
    if not hotel or hotel.kind != "hotel":
        raise HTTPException(404, "Hotel not found")
    q = select(RoomCategory).where(
        RoomCategory.hotel_id == hotel_id,
        RoomCategory.status == "active",
    ).order_by(RoomCategory.sort_order)
    rooms = db.execute(q).scalars().all()
    return [_serialize_room(r) for r in rooms]


@router.post("/{hotel_id}/rooms/", summary="Add room category", status_code=201)
def create_room(hotel_id: str, body: RoomCategoryIn, db: Session = Depends(get_db)):
    hotel = db.get(PremiumCatalogItem, hotel_id)
    if not hotel or hotel.kind != "hotel":
        raise HTTPException(404, "Hotel not found")
    rc = RoomCategory(hotel_id=hotel_id, **body.model_dump())
    db.add(rc)
    db.commit()
    db.refresh(rc)
    return _serialize_room(rc)


@router.patch("/rooms/{room_id}", summary="Update room category")
def update_room(room_id: str, body: RoomCategoryPatch, db: Session = Depends(get_db)):
    rc = db.get(RoomCategory, room_id)
    if not rc:
        raise HTTPException(404, "Room category not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rc, k, v)
    db.commit()
    db.refresh(rc)
    return _serialize_room(rc)


@router.delete("/rooms/{room_id}", summary="Archive room category")
def delete_room(room_id: str, db: Session = Depends(get_db)):
    rc = db.get(RoomCategory, room_id)
    if not rc:
        raise HTTPException(404, "Room category not found")
    rc.status = "archived"
    db.commit()
    return {"ok": True}


# ── Room Rates ─────────────────────────────────────────────

@router.get("/rooms/{room_id}/rates/", summary="List rates for room category")
def list_rates(room_id: str, db: Session = Depends(get_db)):
    rc = db.get(RoomCategory, room_id)
    if not rc:
        raise HTTPException(404, "Room category not found")
    q = select(RoomRate).where(RoomRate.room_category_id == room_id)
    rates = db.execute(q).scalars().all()
    return [_serialize_rate(r) for r in rates]


@router.post("/rooms/{room_id}/rates/", summary="Add rate", status_code=201)
def create_rate(room_id: str, body: RoomRateIn, db: Session = Depends(get_db)):
    rc = db.get(RoomCategory, room_id)
    if not rc:
        raise HTTPException(404, "Room category not found")
    rr = RoomRate(room_category_id=room_id, **body.model_dump())
    db.add(rr)
    db.commit()
    db.refresh(rr)
    return _serialize_rate(rr)


@router.delete("/rates/{rate_id}", summary="Delete rate")
def delete_rate(rate_id: str, db: Session = Depends(get_db)):
    rr = db.get(RoomRate, rate_id)
    if not rr:
        raise HTTPException(404, "Rate not found")
    db.delete(rr)
    db.commit()
    return {"ok": True}


@router.post("/{hotel_id}/rooms/seed-demo", summary="Seed demo rooms & rates for hotel")
def seed_demo_rooms(hotel_id: str, db: Session = Depends(get_db)):
    hotel = db.get(PremiumCatalogItem, hotel_id)
    if not hotel or hotel.kind != "hotel":
        raise HTTPException(404, "Hotel not found")

    existing = db.scalar(
        select(func.count()).select_from(
            select(RoomCategory).where(RoomCategory.hotel_id == hotel_id).subquery()
        )
    )
    if existing > 0:
        return {"seeded": 0, "message": "Rooms already exist for this hotel"}

    rooms_data = [
        {"name": "Standard", "capacity": 2, "bed_type": "double", "surface_m2": 25, "view": "ville", "sort_order": 1,
         "rates": [
             {"season_label": "Haute Saison", "rate_type": "contractuel", "rate_sgl": 1200, "rate_dbl": 1500, "meal_plan": "BB"},
             {"season_label": "Basse Saison", "rate_type": "contractuel", "rate_sgl": 800, "rate_dbl": 1000, "meal_plan": "BB"},
         ]},
        {"name": "Supérieure", "capacity": 2, "bed_type": "king", "surface_m2": 35, "view": "jardin", "sort_order": 2,
         "rates": [
             {"season_label": "Haute Saison", "rate_type": "contractuel", "rate_sgl": 2000, "rate_dbl": 2500, "meal_plan": "BB"},
             {"season_label": "Basse Saison", "rate_type": "contractuel", "rate_sgl": 1400, "rate_dbl": 1800, "meal_plan": "BB"},
         ]},
        {"name": "Suite", "capacity": 3, "bed_type": "king", "surface_m2": 55, "view": "piscine", "sort_order": 3,
         "amenities": ["salon", "minibar", "terrasse"],
         "rates": [
             {"season_label": "Haute Saison", "rate_type": "contractuel", "rate_sgl": 4000, "rate_dbl": 4800, "rate_tpl": 5500, "meal_plan": "HB"},
             {"season_label": "Basse Saison", "rate_type": "contractuel", "rate_sgl": 2800, "rate_dbl": 3500, "rate_tpl": 4000, "meal_plan": "HB"},
         ]},
    ]
    count = 0
    for rd in rooms_data:
        rates = rd.pop("rates")
        rc = RoomCategory(hotel_id=hotel_id, **rd)
        db.add(rc)
        db.flush()
        for rate in rates:
            db.add(RoomRate(room_category_id=rc.id, **rate))
            count += 1
        count += 1
    db.commit()
    return {"seeded_rooms": len(rooms_data), "seeded_rates": count - len(rooms_data)}
