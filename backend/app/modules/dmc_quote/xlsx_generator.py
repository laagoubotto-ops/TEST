"""Generate the internal S'TOURS quote XLSX (operator pricing sheet).

Mirrors the Excel layout used by S'TOURS:
- Top: client + reference
- Daily grid (Day | Date | KMS | Cities | Hotel | Guide | Upgrade | Water |
  1/2 Double | SS | Taxes | M.Water | Restaurant | Price | Monuments | MONU | LG)
- Totals row
- Pricing brackets at bottom (10/15/20/25/30/35) with markup
"""
from io import BytesIO
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .models import DmcQuote, DmcQuoteDay


HEAD_FILL = PatternFill(start_color="C0392B", end_color="C0392B", fill_type="solid")
TOTAL_FILL = PatternFill(start_color="F4E4C1", end_color="F4E4C1", fill_type="solid")
WHITE = Font(color="FFFFFF", bold=True, size=10)
BOLD = Font(bold=True, size=10)
BORDER = Border(*[Side(style="thin", color="999999")] * 4)


def generate_quote_xlsx(quote: DmcQuote, days: list[DmcQuoteDay], pricing: dict[str, Any]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = (quote.client_name or "QUOTE")[:31]

    # ── Header ─────────────────────────────────────────────────────────────
    ws["A1"] = "S'TOURS — DMC QUOTE"
    ws["A1"].font = Font(bold=True, size=14, color="C0392B")
    ws["A2"] = quote.title or ""
    ws["A2"].font = Font(bold=True, size=11)
    ws["A3"] = f"CLIENT: {quote.client_name or ''}"
    ws["A4"] = f"REF:    {quote.client_reference or ''}"
    ws["A5"] = f"PERIOD: {quote.travel_period or ''}     |     CURRENCY: {quote.currency_sell or 'USD'}     |     FX: {quote.fx_to_mad}     |     MARKUP: {quote.markup_pct}%"

    # ── Day grid ───────────────────────────────────────────────────────────
    cols = [
        "DAY", "DATE", "KMS", "CITIES", "HOTEL", "BASIS",
        "GUIDE", "UPGRADE", "WATER", "1/2 DOUBLE", "SS", "TAXES",
        "M.WATER", "RESTAURANT", "PRICE", "MONUMENTS", "MONU", "LG",
    ]
    head_row = 7
    for c, label in enumerate(cols, start=1):
        cell = ws.cell(row=head_row, column=c, value=label)
        cell.fill = HEAD_FILL
        cell.font = WHITE
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER

    r = head_row + 1
    for d in days:
        rest_label = ""
        rest_price = 0
        if d.lunch_name:
            rest_label = d.lunch_name
            rest_price += float(d.lunch_pp_mad or 0)
        if d.dinner_name:
            rest_label = (rest_label + " / " if rest_label else "") + d.dinner_name
            rest_price += float(d.dinner_pp_mad or 0)
        mon_names = "; ".join((m.get("name", "") for m in (d.monuments_json or []) if isinstance(m, dict)))
        values = [
            d.day_index,
            d.date.isoformat() if d.date else "",
            float(d.km or 0),
            d.cities or d.primary_city or "",
            d.hotel_name or "",
            d.basis or "",
            float(d.guide_day_mad or 0),
            float(d.hotel_upgrade_mad or 0),
            float(d.hotel_water_mad or 0),
            float(d.hotel_twin_mad or 0),
            float(d.hotel_ss_mad or 0),
            float(d.hotel_taxes_mad or 0),
            float(d.meal_water_mad or 0),
            rest_label,
            round(rest_price, 2),
            mon_names,
            float(d.monuments_total_mad or 0),
            float(d.local_guide_mad or 0),
        ]
        for c, v in enumerate(values, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="center" if isinstance(v, (int, float)) else "left", vertical="center")
        r += 1

    # ── Totals row ─────────────────────────────────────────────────────────
    totals = pricing.get("totals_mad", {})
    r += 1
    ws.cell(row=r, column=1, value="TOTAL MAD").font = BOLD
    ws.cell(row=r, column=10, value=totals.get("hotels", 0)).font = BOLD
    ws.cell(row=r, column=15, value=totals.get("restaurants", 0)).font = BOLD
    ws.cell(row=r, column=17, value=totals.get("monuments", 0)).font = BOLD
    for c in range(1, len(cols) + 1):
        ws.cell(row=r, column=c).fill = TOTAL_FILL

    # ── Pricing brackets ───────────────────────────────────────────────────
    r += 3
    ws.cell(row=r, column=1, value=f"PRICING PER PAX — {quote.currency_sell or 'USD'}").font = Font(bold=True, size=12, color="C0392B")
    r += 1
    bracket_headers = ["BASIS"] + [f"{b['pax']} + {b['foc_count']} FOC" for b in pricing.get("brackets", [])]
    for c, label in enumerate(bracket_headers, start=1):
        cell = ws.cell(row=r, column=c, value=label)
        cell.fill = HEAD_FILL
        cell.font = WHITE
        cell.alignment = Alignment(horizontal="center")
        cell.border = BORDER
    r += 1
    ws.cell(row=r, column=1, value="TWIN").font = BOLD
    for c, b in enumerate(pricing.get("brackets", []), start=2):
        cell = ws.cell(row=r, column=c, value=b["twin_pp_sell"])
        cell.alignment = Alignment(horizontal="center")
        cell.border = BORDER
    r += 1
    ws.cell(row=r, column=1, value="SINGLE SUPP.").font = BOLD
    for c, b in enumerate(pricing.get("brackets", []), start=2):
        cell = ws.cell(row=r, column=c, value=b["ss_pp_sell"])
        cell.alignment = Alignment(horizontal="center")
        cell.border = BORDER

    # ── Column widths ──────────────────────────────────────────────────────
    widths = [5, 11, 7, 14, 22, 6, 8, 9, 8, 10, 8, 8, 9, 22, 9, 22, 8, 8]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
