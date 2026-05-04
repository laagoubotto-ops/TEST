"""Allotments — Pydantic schemas."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class AllotmentIn(BaseModel):
    project_id: Optional[str] = None
    hotel_name: str
    city: str
    category: Optional[str] = None
    contract_id: Optional[str] = None
    check_in: date
    check_out: date
    deadline: Optional[date] = None
    rooms_blocked: int = Field(ge=0, default=0)
    rooms_confirmed: int = Field(ge=0, default=0)
    rooms_released: int = Field(ge=0, default=0)
    price_per_night: float = 0.0
    status: str = "blocked"
    notes: Optional[str] = None


class AllotmentOut(AllotmentIn):
    id: str

    class Config:
        from_attributes = True


class AllotmentUpdate(BaseModel):
    project_id: Optional[str] = None
    hotel_name: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    contract_id: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    deadline: Optional[date] = None
    rooms_blocked: Optional[int] = None
    rooms_confirmed: Optional[int] = None
    rooms_released: Optional[int] = None
    price_per_night: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
