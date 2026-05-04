"""Master Data routers — Partners and Articles."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.master_data.models import (
    Article,
    ArticleCategory,
    Partner,
    PartnerType,
)
from app.modules.master_data.schemas import (
    ArticleCreate,
    ArticleOut,
    ArticleUpdate,
    PartnerCreate,
    PartnerOut,
    PartnerUpdate,
)

partners_router = APIRouter(prefix="/partners", tags=["master-data"])
articles_router = APIRouter(prefix="/articles", tags=["master-data"])


# ── Partners ───────────────────────────────────────────────────────

@partners_router.get("", response_model=list[PartnerOut])
def list_partners(
    type: Optional[PartnerType] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(Partner).filter(Partner.company_id == company_id)
    if type:
        q = q.filter(Partner.type == type)
    if search:
        like = f"%{search}%"
        q = q.filter((Partner.name.ilike(like)) | (Partner.code.ilike(like)))
    return q.order_by(Partner.name).offset(skip).limit(limit).all()


@partners_router.post("", response_model=PartnerOut, status_code=201)
def create_partner(
    payload: PartnerCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    if (
        db.query(Partner)
        .filter(Partner.company_id == company_id, Partner.code == payload.code)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Code partenaire déjà utilisé")
    partner = Partner(**payload.model_dump(), company_id=company_id)
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


@partners_router.get("/stats", summary="Partner KPIs")
def partner_stats(
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    base = db.query(Partner).filter(Partner.company_id == company_id, Partner.is_active.is_(True))
    total = base.count()
    by_type = dict(
        db.query(Partner.type, func.count())
        .filter(Partner.company_id == company_id, Partner.is_active.is_(True))
        .group_by(Partner.type)
        .all()
    )
    return {"total": total, "by_type": by_type}


@partners_router.post("/seed-demo", summary="Seed demo partners")
def seed_demo_partners(
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    existing = db.query(Partner).filter(Partner.company_id == company_id).count()
    if existing > 0:
        return {"seeded": 0, "message": "Partners already exist for this company"}

    demos = [
        {"code": "CLI-001", "name": "Voyages Atlas", "type": "customer", "email": "mehdi@voyagesatlas.ma", "phone": "+212 522 112233", "currency": "MAD", "payment_terms_days": 30, "credit_limit": 500000, "address": {"city": "Casablanca", "country": "Maroc"}},
        {"code": "CLI-002", "name": "Sahara Dreams TO", "type": "customer", "email": "claire@saharadreams.fr", "phone": "+33 1 45678901", "currency": "EUR", "payment_terms_days": 45, "credit_limit": 1000000, "address": {"city": "Paris", "country": "France"}},
        {"code": "CLI-003", "name": "OCP Group", "type": "customer", "email": "travel@ocp.ma", "phone": "+212 522 334455", "currency": "MAD", "payment_terms_days": 60, "credit_limit": 2000000, "address": {"city": "Casablanca", "country": "Maroc"}},
        {"code": "CLI-004", "name": "Marrakech Excursions", "type": "customer", "email": "hassan@marrakechexcursions.com", "phone": "+212 524 445566", "currency": "MAD", "payment_terms_days": 15, "address": {"city": "Marrakech", "country": "Maroc"}},
        {"code": "CLI-005", "name": "Kuoni Travel", "type": "customer", "email": "morocco@kuoni.ch", "currency": "CHF", "payment_terms_days": 30, "credit_limit": 750000, "address": {"city": "Zürich", "country": "Suisse"}},
        {"code": "CLI-006", "name": "Jean-Pierre Moreau", "type": "customer", "email": "jp.moreau@gmail.com", "phone": "+33 6 12345678", "currency": "EUR", "address": {"city": "Lyon", "country": "France"}},
        {"code": "SUP-001", "name": "Royal Mansour Collection", "type": "supplier", "email": "reservations@royalmansour.ma", "phone": "+212 524 808080", "currency": "MAD", "address": {"city": "Marrakech", "country": "Maroc"}},
        {"code": "SUP-002", "name": "Accor Hotels Maroc", "type": "supplier", "email": "groups.maroc@accor.com", "phone": "+212 522 998877", "currency": "MAD", "address": {"city": "Casablanca", "country": "Maroc"}},
        {"code": "SUP-003", "name": "S'Tours Fleet", "type": "supplier", "email": "fleet@stours.ma", "phone": "+212 524 556677", "currency": "MAD", "address": {"city": "Marrakech", "country": "Maroc"}},
        {"code": "SUP-004", "name": "La Maison Arabe", "type": "supplier", "email": "events@lamaisonarabe.com", "phone": "+212 524 387010", "currency": "MAD", "address": {"city": "Marrakech", "country": "Maroc"}},
        {"code": "GID-001", "name": "Fatima Zahra El Alami", "type": "guide", "email": "fatima@stours.ma", "phone": "+212 661 223344", "currency": "MAD", "address": {"city": "Marrakech", "country": "Maroc"}},
        {"code": "GID-002", "name": "Youssef Amrani", "type": "guide", "email": "youssef.guide@gmail.com", "phone": "+212 662 445566", "currency": "MAD", "address": {"city": "Fès", "country": "Maroc"}},
    ]
    for d in demos:
        db.add(Partner(company_id=company_id, **d))
    db.commit()
    return {"seeded": len(demos), "customers": 6, "suppliers": 4, "guides": 2}


@partners_router.get("/{partner_id}", response_model=PartnerOut)
def get_partner(
    partner_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    partner = (
        db.query(Partner)
        .filter(Partner.id == partner_id, Partner.company_id == company_id)
        .first()
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")
    return partner


@partners_router.patch("/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: str,
    payload: PartnerUpdate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    partner = (
        db.query(Partner)
        .filter(Partner.id == partner_id, Partner.company_id == company_id)
        .first()
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Partenaire introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(partner, k, v)
    db.commit()
    db.refresh(partner)
    return partner


# ── Articles ───────────────────────────────────────────────────────

@articles_router.get("", response_model=list[ArticleOut])
def list_articles(
    category: Optional[ArticleCategory] = Query(None),
    supplier_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(Article).filter(Article.company_id == company_id)
    if category:
        q = q.filter(Article.category == category)
    if supplier_id:
        q = q.filter(Article.default_supplier_id == supplier_id)
    if search:
        like = f"%{search}%"
        q = q.filter((Article.name.ilike(like)) | (Article.code.ilike(like)))
    return q.order_by(Article.name).offset(skip).limit(limit).all()


@articles_router.post("", response_model=ArticleOut, status_code=201)
def create_article(
    payload: ArticleCreate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    if (
        db.query(Article)
        .filter(Article.company_id == company_id, Article.code == payload.code)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Code article déjà utilisé")
    if payload.default_supplier_id:
        supplier = (
            db.query(Partner)
            .filter(
                Partner.id == payload.default_supplier_id,
                Partner.company_id == company_id,
            )
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=400, detail="Fournisseur introuvable")
    article = Article(**payload.model_dump(), company_id=company_id)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@articles_router.get("/{article_id}", response_model=ArticleOut)
def get_article(
    article_id: str,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    article = (
        db.query(Article)
        .filter(Article.id == article_id, Article.company_id == company_id)
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article introuvable")
    return article


@articles_router.patch("/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: str,
    payload: ArticleUpdate,
    _=Depends(require_auth),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    article = (
        db.query(Article)
        .filter(Article.id == article_id, Article.company_id == company_id)
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(article, k, v)
    db.commit()
    db.refresh(article)
    return article
