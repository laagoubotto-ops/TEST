"""DMC quote calculator — replicates the Excel pricing logic of the YS Travel sheet.

Reads the DmcQuote header and its DmcQuoteDay rows, sums all costs in MAD, then
spreads them per pax bracket (10/15/20/25/30/35) following S'TOURS' standard formula:

  per_pax_mad = (HTL + RESTAURANTS + MONUM + TIPS + WATER + GUIDES + BUS) / pax
  per_pax_with_markup = per_pax_mad * (1 + markup_pct/100)
  per_pax_sell = per_pax_with_markup / fx_to_mad      (in selling currency)

Single supplement = sum(hotel_ss_mad) / fx_to_mad.

A "1 FOC" rule (one free of charge per group) reduces the effective revenue base —
the operator absorbs the FOC cost in the per-pax markup. We expose both the raw and
adjusted prices so the user can pick.
"""
from typing import Any
from sqlalchemy.orm import Session

from .models import DmcQuote, DmcQuoteDay


DEFAULT_BRACKETS = [10, 15, 20, 25, 30, 35]


def compute_totals(quote: DmcQuote, days: list[DmcQuoteDay]) -> dict[str, float]:
    """Sum every per-day item to total MAD costs, mirroring the Excel sheet."""
    hotels_twin = sum(float(d.hotel_twin_mad or 0) for d in days)
    hotels_ss = sum(float(d.hotel_ss_mad or 0) for d in days)
    hotels_taxes = sum(float(d.hotel_taxes_mad or 0) for d in days)
    hotels_upgrade = sum(float(d.hotel_upgrade_mad or 0) for d in days)
    hotels_water = sum(float(d.hotel_water_mad or 0) for d in days)
    hotels_subtotal = hotels_twin + hotels_taxes + hotels_upgrade + hotels_water

    restaurants = sum(float(d.lunch_pp_mad or 0) + float(d.dinner_pp_mad or 0)
                      + float(d.meal_water_mad or 0) for d in days)

    monuments = sum(float(d.monuments_total_mad or 0) for d in days)

    # Activities cost from JSON (flat per group costs only — pp costs treated separately)
    activities_group = 0.0
    for d in days:
        for a in (d.activities_json or []):
            cost = a.get("cost_group_mad") if isinstance(a, dict) else 0
            if cost:
                activities_group += float(cost)

    guides_total = sum(float(d.guide_day_mad or 0) for d in days)
    local_guides_total = sum(float(d.local_guide_mad or 0) for d in days)

    total_km = sum(float(d.km or 0) for d in days)
    bus_cost = total_km * float(quote.bus_cost_per_km or 0) * float(quote.fuel_factor or 1)

    # Standard tips & misc (matching the YS sheet R43-R44, R57)
    tips_lug = 70.0
    tips_rest = 75.0

    return {
        "hotels": round(hotels_subtotal, 2),
        "hotels_twin": round(hotels_twin, 2),
        "hotels_ss": round(hotels_ss, 2),
        "hotels_taxes": round(hotels_taxes, 2),
        "restaurants": round(restaurants, 2),
        "monuments": round(monuments, 2),
        "activities": round(activities_group, 2),
        "guide": round(guides_total, 2),
        "local_guide": round(local_guides_total, 2),
        "bus": round(bus_cost, 2),
        "total_km": round(total_km, 2),
        "tips_lug": tips_lug,
        "tips_rest": tips_rest,
    }


def compute_brackets(
    quote: DmcQuote,
    days: list[DmcQuoteDay],
    brackets: list[int] | None = None,
) -> dict[str, Any]:
    """Compute per-bracket pricing.

    Returns a dict with totals + a list of brackets:
      [{"pax":10, "twin_pp_mad":..., "twin_pp_sell":..., "ss_pp_sell":..., "foc_count":1}, ...]
    """
    brackets = brackets or DEFAULT_BRACKETS
    totals = compute_totals(quote, days)
    fx = float(quote.fx_to_mad or 1)
    markup = float(quote.markup_pct or 0) / 100.0

    # Group fixed cost in MAD = everything except hotels (per-pax) and SS
    group_fixed = (
        totals["restaurants"]
        + totals["monuments"]
        + totals["activities"]
        + totals["guide"]
        + totals["local_guide"]
        + totals["bus"]
        + totals["tips_lug"]
        + totals["tips_rest"]
    )
    hotels_per_pax = totals["hotels"]  # already per-pax (twin half)

    out_brackets: list[dict[str, Any]] = []
    for pax in brackets:
        # 1 FOC absorbed by group: paying pax = pax (operator already accounts for this)
        per_pax_mad = (group_fixed / pax) + hotels_per_pax
        per_pax_with_markup_mad = per_pax_mad * (1 + markup)
        per_pax_sell = round(per_pax_with_markup_mad / fx, 2) if fx else round(per_pax_with_markup_mad, 2)
        ss_sell = round((totals["hotels_ss"] * (1 + markup)) / fx, 2) if fx else 0
        out_brackets.append({
            "pax": pax,
            "foc_count": 1,
            "twin_pp_mad": round(per_pax_with_markup_mad, 2),
            "twin_pp_sell": per_pax_sell,
            "ss_pp_sell": ss_sell,
        })

    return {
        "currency_sell": quote.currency_sell,
        "fx_to_mad": fx,
        "markup_pct": float(quote.markup_pct or 0),
        "totals_mad": {
            "hotels": totals["hotels"],
            "restaurants": totals["restaurants"],
            "monuments": totals["monuments"],
            "guide": totals["guide"] + totals["local_guide"],
            "bus": totals["bus"],
            "tips": totals["tips_lug"] + totals["tips_rest"],
            "total_group_fixed": round(group_fixed, 2),
            "hotels_per_pax": totals["hotels"],
        },
        "brackets": out_brackets,
    }


def calc_for_quote(db: Session, quote_id: str, company_id: str) -> dict[str, Any]:
    quote = db.query(DmcQuote).filter_by(id=quote_id, company_id=company_id).first()
    if not quote:
        return {}
    days = db.query(DmcQuoteDay).filter_by(quote_id=quote_id).order_by(DmcQuoteDay.day_index).all()
    requested = (quote.pax_brackets_json or {}).get("brackets") if quote.pax_brackets_json else None
    res = compute_brackets(quote, days, requested)
    res["quote_id"] = quote_id
    return res
