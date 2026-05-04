"""Seasons REST API — Global season definitions."""

from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth
from .models import Season

router = APIRouter(
    prefix="/seasons",
    tags=["seasons"],
    dependencies=[Depends(require_auth)],
)


class SeasonIn(BaseModel):
    name: str
    season_type: str
    date_from: str
    date_to: str
    applies_to: Optional[list] = None
    color: Optional[str] = None
    notes: Optional[str] = None


class SeasonPatch(BaseModel):
    name: Optional[str] = None
    season_type: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    applies_to: Optional[list] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def _serialize(s: Season) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "season_type": s.season_type,
        "date_from": s.date_from,
        "date_to": s.date_to,
        "applies_to": s.applies_to or [],
        "color": s.color,
        "notes": s.notes,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/", summary="List seasons")
def list_seasons(
    season_type: Optional[str] = Query(None),
    status: str = Query("active"),
    db: Session = Depends(get_db),
):
    q = select(Season).where(Season.status == status)
    if season_type:
        q = q.where(Season.season_type == season_type)
    q = q.order_by(Season.date_from)
    return [_serialize(s) for s in db.execute(q).scalars().all()]


@router.get("/{season_id}", summary="Get season")
def get_season(season_id: str, db: Session = Depends(get_db)):
    s = db.get(Season, season_id)
    if not s:
        raise HTTPException(404, "Season not found")
    return _serialize(s)


@router.post("/", summary="Create season", status_code=201)
def create_season(body: SeasonIn, db: Session = Depends(get_db)):
    s = Season(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@router.patch("/{season_id}", summary="Update season")
def update_season(season_id: str, body: SeasonPatch, db: Session = Depends(get_db)):
    s = db.get(Season, season_id)
    if not s:
        raise HTTPException(404, "Season not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@router.delete("/{season_id}", summary="Archive season")
def delete_season(season_id: str, db: Session = Depends(get_db)):
    s = db.get(Season, season_id)
    if not s:
        raise HTTPException(404, "Season not found")
    s.status = "archived"
    db.commit()
    return {"ok": True}


@router.post("/seed-demo", summary="Seed demo seasons")
def seed_demo(db: Session = Depends(get_db)):
    existing = db.scalar(select(func.count()).select_from(select(Season).subquery()))
    if existing > 0:
        return {"seeded": 0, "message": "Seasons already exist"}

    demos = [
        {"name": "Haute Saison Été 2025", "season_type": "haute", "date_from": "2025-06-15", "date_to": "2025-09-15", "color": "#ef4444", "applies_to": ["hotel", "transport", "guide"]},
        {"name": "Haute Saison Noël/Nouvel An 2025", "season_type": "haute", "date_from": "2025-12-20", "date_to": "2026-01-05", "color": "#ef4444", "applies_to": ["hotel", "transport", "guide"]},
        {"name": "Moyenne Saison Printemps 2025", "season_type": "moyenne", "date_from": "2025-03-15", "date_to": "2025-06-14", "color": "#f59e0b", "applies_to": ["hotel", "transport", "guide"]},
        {"name": "Moyenne Saison Automne 2025", "season_type": "moyenne", "date_from": "2025-09-16", "date_to": "2025-12-19", "color": "#f59e0b", "applies_to": ["hotel", "transport", "guide"]},
        {"name": "Basse Saison Hiver 2025", "season_type": "basse", "date_from": "2025-01-06", "date_to": "2025-03-14", "color": "#3b82f6", "applies_to": ["hotel", "transport", "guide"]},
        {"name": "Festival Musiques Sacrées Fès", "season_type": "speciale", "date_from": "2025-06-06", "date_to": "2025-06-14", "color": "#8b5cf6", "applies_to": ["hotel", "guide"], "notes": "Tarifs majorés zone Fès"},
    ]
    for d in demos:
        db.add(Season(**d))
    db.commit()
    return {"seeded": len(demos)}
