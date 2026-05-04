"""Premium Catalogues REST API.

Unified view over hotels, guides, restaurants, activities, transport,
and monuments — with seed-demo, CRUD, search, and KPI endpoints.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.shared.dependencies import require_auth

from .models import PremiumCatalogItem

router = APIRouter(
    prefix="/premium-catalogs",
    tags=["premium-catalogs"],
    dependencies=[Depends(require_auth)],
)

VALID_KINDS = {"hotel", "guide", "restaurant", "activity", "transport", "monument"}


# ── Schemas ──────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    kind: str
    label: str
    city: str
    unit_cost: float = 0
    currency: str = "MAD"
    category: Optional[str] = None
    tier: str = "premium"
    supplier: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    rating: float = 5.0
    status: str = "active"
    meta: Optional[dict] = None
    capacity: Optional[int] = None
    min_pax: Optional[int] = None
    max_pax: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_featured: bool = False


class ItemPatch(BaseModel):
    label: Optional[str] = None
    city: Optional[str] = None
    unit_cost: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    tier: Optional[str] = None
    supplier: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[float] = None
    status: Optional[str] = None
    meta: Optional[dict] = None
    capacity: Optional[int] = None
    min_pax: Optional[int] = None
    max_pax: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_featured: Optional[bool] = None


def _serialize(item: PremiumCatalogItem) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "label": item.label,
        "city": item.city,
        "unit_cost": float(item.unit_cost or 0),
        "currency": item.currency,
        "category": item.category,
        "tier": item.tier,
        "supplier": item.supplier,
        "image_url": item.image_url,
        "description": item.description,
        "rating": float(item.rating or 0),
        "status": item.status,
        "meta": item.meta or {},
        "capacity": item.capacity,
        "min_pax": item.min_pax,
        "max_pax": item.max_pax,
        "contact_name": item.contact_name,
        "contact_email": item.contact_email,
        "contact_phone": item.contact_phone,
        "is_featured": item.is_featured,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


# ── LIST / SEARCH ────────────────────────────────────────────────────

@router.get("/", summary="List all premium catalog items")
def list_items(
    kind: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    featured: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = select(PremiumCatalogItem).where(PremiumCatalogItem.status != "archived")
    if kind:
        q = q.where(PremiumCatalogItem.kind == kind)
    if city:
        q = q.where(PremiumCatalogItem.city == city)
    if tier:
        q = q.where(PremiumCatalogItem.tier == tier)
    if featured is not None:
        q = q.where(PremiumCatalogItem.is_featured == featured)
    if search:
        like = f"%{search}%"
        q = q.where(
            PremiumCatalogItem.label.ilike(like)
            | PremiumCatalogItem.city.ilike(like)
            | PremiumCatalogItem.supplier.ilike(like)
        )
    q = q.order_by(PremiumCatalogItem.kind, PremiumCatalogItem.city, PremiumCatalogItem.label)
    rows = db.execute(q.offset(skip).limit(limit)).scalars().all()
    return [_serialize(r) for r in rows]


# ── KPI / STATS ──────────────────────────────────────────────────────

@router.get("/stats", summary="Aggregate KPIs for the premium catalog")
def stats(db: Session = Depends(get_db)):
    base = select(PremiumCatalogItem).where(PremiumCatalogItem.status != "archived")
    total = db.scalar(select(func.count()).select_from(base.subquery()))

    by_kind = dict(
        db.execute(
            select(PremiumCatalogItem.kind, func.count())
            .where(PremiumCatalogItem.status != "archived")
            .group_by(PremiumCatalogItem.kind)
        ).all()
    )

    by_city = dict(
        db.execute(
            select(PremiumCatalogItem.city, func.count())
            .where(PremiumCatalogItem.status != "archived")
            .group_by(PremiumCatalogItem.city)
            .order_by(func.count().desc())
            .limit(15)
        ).all()
    )

    avg_rating = db.scalar(
        select(func.avg(PremiumCatalogItem.rating))
        .where(PremiumCatalogItem.status != "archived")
    )

    featured_count = db.scalar(
        select(func.count())
        .select_from(PremiumCatalogItem)
        .where(PremiumCatalogItem.is_featured == True, PremiumCatalogItem.status != "archived")
    )

    return {
        "total": total or 0,
        "by_kind": by_kind,
        "by_city": by_city,
        "avg_rating": round(float(avg_rating or 0), 1),
        "featured": featured_count or 0,
        "kinds": list(VALID_KINDS),
    }


# ── CITIES ───────────────────────────────────────────────────────────

@router.get("/cities", summary="List distinct cities in the catalog")
def cities(db: Session = Depends(get_db)):
    rows = db.execute(
        select(PremiumCatalogItem.city)
        .where(PremiumCatalogItem.status != "archived")
        .distinct()
        .order_by(PremiumCatalogItem.city)
    ).scalars().all()
    return rows


# ── GET / CREATE / UPDATE / DELETE ───────────────────────────────────

@router.get("/{item_id}", summary="Get a single catalog item")
def get_item(item_id: str, db: Session = Depends(get_db)):
    item = db.get(PremiumCatalogItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    return _serialize(item)


@router.post("/", status_code=201, summary="Create a catalog item")
def create_item(payload: ItemIn, db: Session = Depends(get_db)):
    if payload.kind not in VALID_KINDS:
        raise HTTPException(400, f"Invalid kind '{payload.kind}'. Must be one of {VALID_KINDS}")
    item = PremiumCatalogItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.patch("/{item_id}", summary="Partial update a catalog item")
def patch_item(item_id: str, payload: ItemPatch, db: Session = Depends(get_db)):
    item = db.get(PremiumCatalogItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete("/{item_id}", status_code=204, summary="Soft-delete a catalog item")
def delete_item(item_id: str, db: Session = Depends(get_db)):
    item = db.get(PremiumCatalogItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    item.status = "archived"
    db.commit()


# ── SEED-DEMO ────────────────────────────────────────────────────────

DEMO_ITEMS: list[dict] = [
    # ── Hotels ───────────────────────────────────────────────────
    {"kind": "hotel", "label": "Royal Mansour Marrakech",       "city": "Marrakech",   "unit_cost": 4800, "category": "5* Palace",   "tier": "ultra-premium", "supplier": "Direct",          "rating": 5.0, "is_featured": True,  "meta": {"rooms": 53, "style": "Riad Palace"}},
    {"kind": "hotel", "label": "La Mamounia",                   "city": "Marrakech",   "unit_cost": 3900, "category": "5* Palace",   "tier": "ultra-premium", "supplier": "Direct",          "rating": 4.9, "is_featured": True,  "meta": {"rooms": 209, "style": "Palace historique"}},
    {"kind": "hotel", "label": "Four Seasons Casablanca",       "city": "Casablanca",  "unit_cost": 2400, "category": "5*",          "tier": "premium",       "supplier": "Direct",          "rating": 4.8, "is_featured": True,  "meta": {"rooms": 186, "style": "Business & Leisure"}},
    {"kind": "hotel", "label": "Palais Faraj Fès",              "city": "Fès",         "unit_cost": 1450, "category": "5*",          "tier": "premium",       "supplier": "Direct",          "rating": 4.7, "is_featured": False, "meta": {"rooms": 25, "style": "Boutique Palace"}},
    {"kind": "hotel", "label": "Sahara Luxury Camp",            "city": "Merzouga",    "unit_cost": 1800, "category": "Camp 5*",     "tier": "premium",       "supplier": "Local DMC",       "rating": 4.8, "is_featured": True,  "meta": {"tents": 15, "style": "Glamping Sahara"}},
    {"kind": "hotel", "label": "Heure Bleue Palais",            "city": "Essaouira",   "unit_cost": 1350, "category": "5*",          "tier": "premium",       "supplier": "Direct",          "rating": 4.6, "is_featured": False, "meta": {"rooms": 33, "style": "Riad Atlantique"}},
    {"kind": "hotel", "label": "Lina Ryad & Spa",               "city": "Chefchaouen", "unit_cost":  890, "category": "Boutique 4*", "tier": "standard",      "supplier": "Direct",          "rating": 4.5, "is_featured": False, "meta": {"rooms": 10, "style": "Boutique Montagne"}},
    {"kind": "hotel", "label": "Sofitel Rabat Jardin des Roses", "city": "Rabat",      "unit_cost": 1650, "category": "5*",          "tier": "premium",       "supplier": "Accor",           "rating": 4.7, "is_featured": False, "meta": {"rooms": 120, "style": "Business Palace"}},
    {"kind": "hotel", "label": "Kasbah Tamadot",                "city": "Ouarzazate",  "unit_cost": 3200, "category": "5*",          "tier": "ultra-premium", "supplier": "Virgin Limited",  "rating": 4.9, "is_featured": True,  "meta": {"rooms": 28, "style": "Mountain Retreat"}},
    {"kind": "hotel", "label": "Fairmont Royal Palm",           "city": "Marrakech",   "unit_cost": 2800, "category": "5*",          "tier": "ultra-premium", "supplier": "Accor",           "rating": 4.8, "is_featured": False, "meta": {"rooms": 134, "style": "Golf & Spa Resort"}},

    # ── Restaurants ──────────────────────────────────────────────
    {"kind": "restaurant", "label": "Namaskar Palace",              "city": "Marrakech",  "unit_cost": 750, "category": "Gastronomique", "tier": "ultra-premium", "supplier": "Direct",    "rating": 4.9, "is_featured": True,  "meta": {"meal_type": "dinner", "cuisine": "Fusion Marocaine"}},
    {"kind": "restaurant", "label": "Dar Roumana",                  "city": "Fès",        "unit_cost": 480, "category": "Gastronomique", "tier": "premium",       "supplier": "Direct",    "rating": 4.8, "is_featured": True,  "meta": {"meal_type": "dinner", "cuisine": "Franco-Marocaine"}},
    {"kind": "restaurant", "label": "Chez Ali Fantasia",            "city": "Marrakech",  "unit_cost": 590, "category": "Spectacle",     "tier": "premium",       "supplier": "Chez Ali",  "rating": 4.5, "is_featured": False, "meta": {"meal_type": "gala_dinner", "cuisine": "Traditionnelle + Show"}},
    {"kind": "restaurant", "label": "El Fenn Rooftop",              "city": "Marrakech",  "unit_cost": 320, "category": "Contemporain",  "tier": "premium",       "supplier": "Direct",    "rating": 4.6, "is_featured": False, "meta": {"meal_type": "lunch", "cuisine": "Méditerranéenne"}},
    {"kind": "restaurant", "label": "Saveurs du Palais",            "city": "Rabat",      "unit_cost": 290, "category": "Traditionnel",  "tier": "standard",      "supplier": "Direct",    "rating": 4.4, "is_featured": False, "meta": {"meal_type": "lunch", "cuisine": "Marocaine Royale"}},
    {"kind": "restaurant", "label": "Caravane Café",                "city": "Essaouira",  "unit_cost": 240, "category": "Décontracté",   "tier": "standard",      "supplier": "Direct",    "rating": 4.3, "is_featured": False, "meta": {"meal_type": "lunch", "cuisine": "Fruits de mer"}},
    {"kind": "restaurant", "label": "BBQ Berbère Kasbah",           "city": "Ouarzazate", "unit_cost": 380, "category": "Authentique",   "tier": "premium",       "supplier": "Local",     "rating": 4.7, "is_featured": True,  "meta": {"meal_type": "bbq", "cuisine": "Berbère"}},
    {"kind": "restaurant", "label": "Le Jardin Secret",             "city": "Marrakech",  "unit_cost": 420, "category": "Jardin",        "tier": "premium",       "supplier": "Direct",    "rating": 4.6, "is_featured": False, "meta": {"meal_type": "lunch", "cuisine": "Légère Marocaine"}},

    # ── Guides ───────────────────────────────────────────────────
    {"kind": "guide", "label": "Guide Officiel — Marrakech",    "city": "Marrakech",   "unit_cost": 1500, "category": "Officiel",      "tier": "premium",  "supplier": "Réseau S'TOURS", "rating": 4.9, "is_featured": True,  "meta": {"languages": ["FR","EN","ES"], "specialty": "Médina & Souks", "certified": True}},
    {"kind": "guide", "label": "Guide Officiel — Fès",          "city": "Fès",         "unit_cost": 1500, "category": "Officiel",      "tier": "premium",  "supplier": "Réseau S'TOURS", "rating": 4.8, "is_featured": True,  "meta": {"languages": ["FR","EN","AR"], "specialty": "Médina & Artisanat", "certified": True}},
    {"kind": "guide", "label": "Guide Officiel — Rabat",        "city": "Rabat",       "unit_cost": 1300, "category": "Officiel",      "tier": "premium",  "supplier": "Réseau S'TOURS", "rating": 4.7, "is_featured": False, "meta": {"languages": ["FR","EN"], "specialty": "Patrimoine Historique", "certified": True}},
    {"kind": "guide", "label": "Tour Leader National (FR)",     "city": "National",    "unit_cost": 1100, "category": "Tour Leader",   "tier": "standard", "supplier": "Réseau S'TOURS", "rating": 4.6, "is_featured": False, "meta": {"languages": ["FR"], "specialty": "Circuits multi-villes", "certified": True}},
    {"kind": "guide", "label": "Tour Leader National (EN)",     "city": "National",    "unit_cost": 1200, "category": "Tour Leader",   "tier": "premium",  "supplier": "Réseau S'TOURS", "rating": 4.7, "is_featured": False, "meta": {"languages": ["EN"], "specialty": "Circuits multi-villes", "certified": True}},
    {"kind": "guide", "label": "Guide Sahara & Aventure",       "city": "Merzouga",    "unit_cost": 1400, "category": "Spécialisé",    "tier": "premium",  "supplier": "Local DMC",      "rating": 4.8, "is_featured": True,  "meta": {"languages": ["FR","EN","AR"], "specialty": "Désert & Trekking", "certified": True}},

    # ── Activities ───────────────────────────────────────────────
    {"kind": "activity", "label": "Hammam & Spa VIP",              "city": "Marrakech",  "unit_cost":  450, "category": "Bien-être",     "tier": "premium",  "supplier": "Direct",          "rating": 4.7, "is_featured": True,  "meta": {"duration_min": 90, "difficulty": "easy"}},
    {"kind": "activity", "label": "Atelier Cuisine Marocaine",     "city": "Marrakech",  "unit_cost":  650, "category": "Culture",       "tier": "premium",  "supplier": "La Maison Arabe", "rating": 4.9, "is_featured": True,  "meta": {"duration_min": 180, "difficulty": "easy"}},
    {"kind": "activity", "label": "Balade en Chameau (1h)",        "city": "Merzouga",   "unit_cost":  250, "category": "Aventure",      "tier": "standard", "supplier": "Local",           "rating": 4.5, "is_featured": False, "meta": {"duration_min": 60, "difficulty": "easy"}},
    {"kind": "activity", "label": "Excursion Quad (2h)",           "city": "Merzouga",   "unit_cost":  450, "category": "Aventure",      "tier": "premium",  "supplier": "Local",           "rating": 4.6, "is_featured": False, "meta": {"duration_min": 120, "difficulty": "moderate"}},
    {"kind": "activity", "label": "Cours de Surf",                 "city": "Essaouira",  "unit_cost":  350, "category": "Sport",         "tier": "standard", "supplier": "Surfschool",      "rating": 4.4, "is_featured": False, "meta": {"duration_min": 120, "difficulty": "moderate"}},
    {"kind": "activity", "label": "Tour Kasbahs Vallée du Drâa",   "city": "Ouarzazate", "unit_cost":  580, "category": "Culture",       "tier": "premium",  "supplier": "Local",           "rating": 4.8, "is_featured": True,  "meta": {"duration_min": 240, "difficulty": "easy"}},
    {"kind": "activity", "label": "Vol en Montgolfière",           "city": "Marrakech",  "unit_cost": 1800, "category": "Luxe",          "tier": "ultra-premium", "supplier": "Ciel d'Afrique","rating": 4.9, "is_featured": True,  "meta": {"duration_min": 60, "difficulty": "easy"}},
    {"kind": "activity", "label": "Randonnée Atlas (journée)",     "city": "Marrakech",  "unit_cost":  750, "category": "Aventure",      "tier": "premium",  "supplier": "Mountain Guides", "rating": 4.7, "is_featured": False, "meta": {"duration_min": 480, "difficulty": "challenging"}},

    # ── Transport ────────────────────────────────────────────────
    {"kind": "transport", "label": "Berline 1-3 PAX (chauffeur)",  "city": "National", "unit_cost": 2500, "category": "Berline",       "tier": "premium",       "supplier": "Stours Fleet",  "rating": 4.8, "is_featured": False, "meta": {"vehicle": "Mercedes E-Class", "capacity": 3}},
    {"kind": "transport", "label": "4×4 Land Cruiser 1-6 PAX",     "city": "National", "unit_cost": 3200, "category": "4×4",           "tier": "premium",       "supplier": "Stours Fleet",  "rating": 4.9, "is_featured": True,  "meta": {"vehicle": "Toyota Land Cruiser", "capacity": 6}},
    {"kind": "transport", "label": "Mini-van 4-7 PAX",             "city": "National", "unit_cost": 2900, "category": "Van",           "tier": "standard",      "supplier": "Stours Fleet",  "rating": 4.7, "is_featured": False, "meta": {"vehicle": "Mercedes Vito", "capacity": 7}},
    {"kind": "transport", "label": "Mini-bus 26 PAX",              "city": "National", "unit_cost": 4800, "category": "Bus",           "tier": "premium",       "supplier": "Stours Fleet",  "rating": 4.6, "is_featured": False, "meta": {"vehicle": "MB Sprinter", "capacity": 26}},
    {"kind": "transport", "label": "Autocar 39-48 PAX",            "city": "National", "unit_cost": 6500, "category": "Grand Bus",     "tier": "standard",      "supplier": "Stours Fleet",  "rating": 4.5, "is_featured": False, "meta": {"vehicle": "MAN Irizar I6", "capacity": 48}},
    {"kind": "transport", "label": "Mercedes S-Class VIP",         "city": "National", "unit_cost": 4500, "category": "Luxe",          "tier": "ultra-premium", "supplier": "Stours Fleet",  "rating": 5.0, "is_featured": True,  "meta": {"vehicle": "Mercedes S580", "capacity": 3}},

    # ── Monuments ────────────────────────────────────────────────
    {"kind": "monument", "label": "Palais de la Bahia",                   "city": "Marrakech",   "unit_cost":  70, "category": "Patrimoine",  "tier": "standard", "supplier": "—", "rating": 4.7, "is_featured": True,  "meta": {"entry": "incl", "duration_min": 60}},
    {"kind": "monument", "label": "Tombeaux Saadiens",                    "city": "Marrakech",   "unit_cost":  70, "category": "Patrimoine",  "tier": "standard", "supplier": "—", "rating": 4.6, "is_featured": False, "meta": {"entry": "incl", "duration_min": 45}},
    {"kind": "monument", "label": "Place Jemaa el-Fna",                   "city": "Marrakech",   "unit_cost":   0, "category": "Emblématique","tier": "standard", "supplier": "—", "rating": 4.9, "is_featured": True,  "meta": {"entry": "free", "duration_min": 90}},
    {"kind": "monument", "label": "Médina de Fès (visite guidée)",        "city": "Fès",         "unit_cost":   0, "category": "UNESCO",      "tier": "premium",  "supplier": "—", "rating": 4.9, "is_featured": True,  "meta": {"entry": "exterior", "duration_min": 180}},
    {"kind": "monument", "label": "Volubilis (site romain)",              "city": "Meknès",      "unit_cost":  70, "category": "UNESCO",      "tier": "premium",  "supplier": "—", "rating": 4.8, "is_featured": True,  "meta": {"entry": "incl", "duration_min": 90}},
    {"kind": "monument", "label": "Aït-Ben-Haddou (UNESCO)",             "city": "Ouarzazate",  "unit_cost":  60, "category": "UNESCO",      "tier": "premium",  "supplier": "—", "rating": 4.9, "is_featured": True,  "meta": {"entry": "incl", "duration_min": 120}},
    {"kind": "monument", "label": "Erg Chebbi — coucher de soleil",       "city": "Merzouga",    "unit_cost":   0, "category": "Nature",      "tier": "premium",  "supplier": "—", "rating": 5.0, "is_featured": True,  "meta": {"entry": "free", "duration_min": 120}},
    {"kind": "monument", "label": "Médina bleue de Chefchaouen",          "city": "Chefchaouen", "unit_cost":   0, "category": "Emblématique","tier": "premium",  "supplier": "—", "rating": 4.8, "is_featured": True,  "meta": {"entry": "exterior", "duration_min": 120}},
]


@router.post("/seed-demo", summary="Seed premium catalog with demo data")
def seed_demo(db: Session = Depends(get_db)):
    existing = db.scalar(
        select(func.count()).select_from(PremiumCatalogItem)
    )
    if existing and existing > 0:
        return {"seeded": 0, "message": "Catalog already seeded", "total": existing}

    for d in DEMO_ITEMS:
        item = PremiumCatalogItem(**d)
        db.add(item)
    db.commit()
    return {"seeded": len(DEMO_ITEMS), "total": len(DEMO_ITEMS)}
