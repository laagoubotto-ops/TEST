"""Flight Search router — /api/flight-search.

Stateless stub that returns plausible flights for a given route + date.
Deterministic per (origin, destination, date) so the UI can rely on
stable results. Swap `search_flights` with a real provider (Amadeus,
Duffel, Skyscanner) by replacing the body of that function.
"""

import hashlib
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.shared.dependencies import require_auth


router = APIRouter(
    prefix="/flight-search",
    tags=["flight-search"],
    dependencies=[Depends(require_auth)],
)


AIRPORTS = {
    "CDG": ("Paris CDG", "Paris"),
    "ORY": ("Paris ORY", "Paris"),
    "BVA": ("Paris BVA", "Paris"),
    "CMN": ("Casablanca CMN", "Casablanca"),
    "RAK": ("Marrakech RAK", "Marrakech"),
    "AGA": ("Agadir AGA", "Agadir"),
    "FEZ": ("Fès FEZ", "Fès"),
    "TNG": ("Tanger TNG", "Tanger"),
    "LHR": ("London LHR", "London"),
    "MAD": ("Madrid MAD", "Madrid"),
    "FRA": ("Frankfurt FRA", "Frankfurt"),
    "JFK": ("New York JFK", "New York"),
}

AIRLINES = [
    ("Royal Air Maroc", "AT", True),
    ("Air France", "AF", False),
    ("Ryanair", "FR", False),
    ("Transavia", "TO", False),
    ("Turkish Airlines", "TK", False),
    ("Iberia", "IB", False),
    ("Lufthansa", "LH", False),
]


class FlightSearchParams(BaseModel):
    origin: str  # IATA code or substring
    destination: str
    depart_date: date
    return_date: Optional[date] = None
    pax: int = Field(ge=1, default=1)
    cabin_class: str = "economy"


class FlightLeg(BaseModel):
    airport: str
    code: str
    time: str
    date: str


class FlightResult(BaseModel):
    id: str
    airline: str
    airline_code: str
    flight_number: str
    departure: FlightLeg
    arrival: FlightLeg
    duration: str
    stops: int
    stop_cities: List[str] = []
    price: float
    currency: str = "EUR"
    cabin_class: str = "Economy"
    seats_left: int
    baggage: str
    recommended: bool = False


class FlightSearchResponse(BaseModel):
    outbound: list[FlightResult]
    inbound: list[FlightResult] = []
    provider: str = "mock-local"
    currency: str = "EUR"


def _code(s: str) -> str:
    """Extract IATA code from 'Paris (CDG)' or raw 'CDG'."""
    s = (s or "").upper()
    for code in AIRPORTS:
        if code in s:
            return code
    return s[:3]


def _seed(*parts) -> int:
    h = hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:8], 16)


def _gen_flights(origin: str, destination: str, d: date, pax: int, cabin: str) -> list[FlightResult]:
    o_code = _code(origin)
    d_code = _code(destination)
    o_name = AIRPORTS.get(o_code, (origin, origin))[0]
    d_name = AIRPORTS.get(d_code, (destination, destination))[0]

    out: list[FlightResult] = []
    base_seed = _seed(o_code, d_code, d.isoformat())
    for i, (name, al_code, preferred) in enumerate(AIRLINES):
        seed = (base_seed + i * 7919) & 0xFFFFFFFF
        hh = 6 + (seed % 16)
        mm = (seed >> 8) % 4 * 15
        dur_min = 150 + (seed >> 16) % 240  # 2h30 - 6h30
        stops = 0 if dur_min < 200 else (1 if (seed >> 24) % 3 else 0)
        stop_cities = ["Istanbul IST"] if stops and al_code == "TK" else (["Madrid MAD"] if stops and al_code == "IB" else [])
        price = 89 + ((seed >> 4) % 260)  # 89 - 349
        seats = 2 + (seed % 40)
        dep_time = f"{hh:02d}:{mm:02d}"
        arr_dt = datetime.combine(d, datetime.min.time()) + timedelta(hours=hh, minutes=mm + dur_min)
        out.append(FlightResult(
            id=f"{al_code}-{d.isoformat()}-{o_code}-{d_code}-{i}",
            airline=name,
            airline_code=al_code,
            flight_number=f"{al_code} {1000 + (seed % 8000)}",
            departure=FlightLeg(airport=o_name, code=o_code, time=dep_time, date=d.isoformat()),
            arrival=FlightLeg(airport=d_name, code=d_code, time=arr_dt.strftime("%H:%M"), date=arr_dt.date().isoformat()),
            duration=f"{dur_min // 60}h{dur_min % 60:02d}",
            stops=stops,
            stop_cities=stop_cities,
            price=float(price),
            cabin_class=cabin.capitalize(),
            seats_left=seats,
            baggage="23kg inclus" if al_code in ("AT", "AF", "LH", "TK") else ("Bagage cabine uniquement" if al_code == "FR" else "20kg en option"),
            recommended=preferred,
        ))
    # sort by price asc, keep 6
    out.sort(key=lambda f: f.price)
    return out[:6]


@router.post("/search", response_model=FlightSearchResponse)
def search_flights(params: FlightSearchParams):
    out = _gen_flights(params.origin, params.destination, params.depart_date, params.pax, params.cabin_class)
    inb: list[FlightResult] = []
    if params.return_date:
        inb = _gen_flights(params.destination, params.origin, params.return_date, params.pax, params.cabin_class)[:3]
    return FlightSearchResponse(outbound=out, inbound=inb)


@router.get("/airports")
def list_airports():
    """Return known airport codes for autocomplete."""
    return [
        {"code": c, "name": n, "city": city}
        for c, (n, city) in AIRPORTS.items()
    ]
