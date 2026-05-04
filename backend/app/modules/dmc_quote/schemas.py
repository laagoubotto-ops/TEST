from datetime import date as _date, datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict


class DmcQuoteDayBase(BaseModel):
    day_index: int
    date: Optional[_date] = None
    cities: Optional[str] = None
    primary_city: Optional[str] = None
    km: float = 0

    hotel_name: Optional[str] = None
    hotel_category: Optional[str] = None
    room_type: Optional[str] = "STANDARD"
    basis: Optional[str] = None
    hotel_twin_mad: float = 0
    hotel_ss_mad: float = 0
    hotel_taxes_mad: float = 0
    hotel_upgrade_mad: float = 0
    hotel_water_mad: float = 0

    lunch_name: Optional[str] = None
    lunch_menu: Optional[str] = None
    lunch_pp_mad: float = 0
    dinner_name: Optional[str] = None
    dinner_menu: Optional[str] = None
    dinner_pp_mad: float = 0
    meal_water_mad: float = 0

    monuments_json: Optional[list[Any]] = None
    monuments_total_mad: float = 0
    activities_json: Optional[list[Any]] = None

    guide_day_mad: float = 0
    local_guide_mad: float = 0

    narrative: Optional[str] = None


class DmcQuoteDayIn(DmcQuoteDayBase):
    pass


class DmcQuoteDayOut(DmcQuoteDayBase):
    id: str
    quote_id: str
    model_config = ConfigDict(from_attributes=True)


class DmcQuoteBase(BaseModel):
    code: Optional[str] = None
    title: str
    client_reference: Optional[str] = None
    client_name: Optional[str] = None
    account_id: Optional[str] = None
    travel_period: Optional[str] = None
    start_date: Optional[_date] = None
    end_date: Optional[_date] = None
    nb_days: int = 0
    nb_nights: int = 0
    language: str = "en"
    currency_sell: str = "USD"
    fx_to_mad: float = 10.25
    markup_pct: float = 8.0
    bus_cost_per_km: float = 8.5
    fuel_factor: float = 1.0
    foc_ratio: Optional[str] = "1 FOC"
    pax_brackets_json: Optional[dict[str, Any]] = None
    status: str = "draft"

    inclusions: Optional[str] = None
    exclusions: Optional[str] = None
    terms: Optional[str] = None
    payment_terms: Optional[str] = None
    cancellation_policy: Optional[str] = None
    transportation_notes: Optional[str] = None
    guides_notes: Optional[str] = None
    notes: Optional[str] = None


class DmcQuoteIn(DmcQuoteBase):
    days: Optional[list[DmcQuoteDayIn]] = None


class DmcQuoteOut(DmcQuoteBase):
    id: str
    company_id: str
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    sent_to_email: Optional[str] = None
    sent_message_id: Optional[str] = None
    parent_quote_id: Optional[str] = None
    version: int = 1
    is_locked: bool = False
    project_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    days: list[DmcQuoteDayOut] = []
    model_config = ConfigDict(from_attributes=True)


class DmcQuoteCalcOut(BaseModel):
    """Computed pricing output for a quote, per pax bracket."""
    quote_id: str
    currency_sell: str
    fx_to_mad: float
    markup_pct: float
    totals_mad: dict[str, float]   # {"hotels":..., "restaurants":..., "monuments":..., "tips":..., "guide":..., "bus":..., "total":...}
    brackets: list[dict[str, Any]]  # [{"pax":10,"twin_pp":1588,"ss":315,"foc_count":1}, ...]
