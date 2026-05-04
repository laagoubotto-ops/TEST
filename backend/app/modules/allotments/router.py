"""Allotments router — /api/allotments."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant import get_current_company_id
from app.shared.dependencies import require_auth
from app.modules.allotments.models import ProjectAllotment as Allotment
from app.modules.allotments.schemas import AllotmentIn, AllotmentOut, AllotmentUpdate


router = APIRouter(
    prefix="/allotments",
    tags=["allotments"],
    dependencies=[Depends(require_auth)],
)


@router.get("", response_model=list[AllotmentOut])
def list_allotments(
    project_id: Optional[str] = Query(None),
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    q = db.query(Allotment).filter(Allotment.company_id == company_id, Allotment.active == True)
    if project_id:
        q = q.filter(Allotment.project_id == project_id)
    return q.order_by(Allotment.check_in.asc()).all()


@router.post("", response_model=AllotmentOut, status_code=201)
def create_allotment(
    data: AllotmentIn,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = Allotment(company_id=company_id, **data.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{allotment_id}", response_model=AllotmentOut)
def update_allotment(
    allotment_id: str,
    data: AllotmentUpdate,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(Allotment).filter(
        Allotment.id == allotment_id, Allotment.company_id == company_id
    ).first()
    if not row:
        raise HTTPException(404, "Allotment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{allotment_id}/confirm", response_model=AllotmentOut)
def confirm_allotment(
    allotment_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(Allotment).filter(
        Allotment.id == allotment_id, Allotment.company_id == company_id
    ).first()
    if not row:
        raise HTTPException(404, "Allotment not found")
    row.rooms_confirmed = row.rooms_blocked
    row.status = "confirmed"
    db.commit()
    db.refresh(row)
    return row


@router.post("/{allotment_id}/release", response_model=AllotmentOut)
def release_allotment(
    allotment_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(Allotment).filter(
        Allotment.id == allotment_id, Allotment.company_id == company_id
    ).first()
    if not row:
        raise HTTPException(404, "Allotment not found")
    row.rooms_released = max(0, row.rooms_blocked - row.rooms_confirmed)
    row.status = "partial" if row.rooms_confirmed > 0 else "released"
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{allotment_id}", status_code=204)
def delete_allotment(
    allotment_id: str,
    company_id: str = Depends(get_current_company_id),
    db: Session = Depends(get_db),
):
    row = db.query(Allotment).filter(
        Allotment.id == allotment_id, Allotment.company_id == company_id
    ).first()
    if not row:
        raise HTTPException(404, "Allotment not found")
    row.active = False
    db.commit()
    return None
