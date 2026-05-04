"""Generate the final program DOCX in the YS Travel / S'TOURS layout.

Sections (in order):
  1. Cover (title + nb days/nights + client + period)
  2. General information
  3. Accommodation table (DAY | CITY | HOTEL | CATEGORY | ROOM TYPE | BASIS)
  4. Catering table (DAY | CITY | MEAL | RESTAURANT | MENU)
  5. Activities & Monuments (DAY | CITY | MONUMENTS w/ entrance fee | View from outside)
  6. Guides
  7. Transportation
  8. Pricing — per pax bracket
  9. Inclusions
 10. Exclusions
 11. Terms & Conditions
"""
from io import BytesIO
from typing import Any

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, RGBColor, Cm

from .models import DmcQuote, DmcQuoteDay


BRAND_RED = RGBColor(0xC0, 0x39, 0x2B)        # S'TOURS terracotta
BRAND_GOLD = RGBColor(0xC9, 0xA2, 0x27)
HEAD_BG = "C0392B"


def _set_cell_bg(cell, hex_color: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def _add_section_header(doc: Document, text: str):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(14)
    run.font.color.rgb = BRAND_RED


def _add_table_header(table, labels: list[str]):
    hdr = table.rows[0]
    for i, label in enumerate(labels):
        cell = hdr.cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(label)
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        run.font.size = Pt(10)
        _set_cell_bg(cell, HEAD_BG)


def _add_data_row(table, values: list[str]):
    row = table.add_row()
    for i, v in enumerate(values):
        cell = row.cells[i]
        cell.text = ""
        p = cell.paragraphs[0]
        run = p.add_run(str(v) if v is not None else "")
        run.font.size = Pt(9)


def generate_program_docx(quote: DmcQuote, days: list[DmcQuoteDay], pricing: dict[str, Any]) -> bytes:
    doc = Document()

    # ── Cover ───────────────────────────────────────────────────────────────
    cover = doc.add_paragraph()
    cover.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = cover.add_run((quote.title or "DISCOVER MOROCCO").upper())
    title_run.bold = True
    title_run.font.size = Pt(28)
    title_run.font.color.rgb = BRAND_RED

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub.add_run(f"{quote.nb_days or len(days)} DAYS / {quote.nb_nights or max(len(days)-1, 0)} NIGHTS")
    sub_run.bold = True
    sub_run.font.size = Pt(16)
    sub_run.font.color.rgb = BRAND_GOLD

    if quote.client_reference:
        ref = doc.add_paragraph()
        ref.alignment = WD_ALIGN_PARAGRAPH.CENTER
        ref.add_run(quote.client_reference).italic = True

    doc.add_paragraph()

    # ── General Information ─────────────────────────────────────────────────
    _add_section_header(doc, "General Information")
    info_lines = [
        ("CLIENT", quote.client_name or ""),
        ("CLIENT REFERENCE", quote.client_reference or ""),
        ("TRAVEL DATES", quote.travel_period or (
            f"{quote.start_date.isoformat() if quote.start_date else ''} → "
            f"{quote.end_date.isoformat() if quote.end_date else ''}"
        )),
        ("LANGUAGE", (quote.language or "EN").upper()),
        ("CURRENCY", quote.currency_sell or "USD"),
    ]
    for k, v in info_lines:
        p = doc.add_paragraph()
        run = p.add_run(f"{k}: ")
        run.bold = True
        p.add_run(str(v))

    # ── Accommodation ───────────────────────────────────────────────────────
    _add_section_header(doc, "Accommodation")
    acc_table = doc.add_table(rows=1, cols=6)
    acc_table.style = "Light Grid Accent 2"
    _add_table_header(acc_table, ["DAY", "CITY", "HOTEL / RIAD", "CATEGORY", "ROOM TYPE", "BASIS"])
    for d in days:
        if d.hotel_name:
            _add_data_row(acc_table, [
                d.day_index,
                (d.primary_city or d.cities or ""),
                d.hotel_name,
                d.hotel_category or "",
                d.room_type or "STANDARD",
                d.basis or "",
            ])
    nb = doc.add_paragraph()
    nb.add_run(
        "N.B.: Services are subject to availability upon confirmation; hotels may be substituted with similar ones."
    ).italic = True

    # ── Catering ────────────────────────────────────────────────────────────
    _add_section_header(doc, "Catering")
    cat_table = doc.add_table(rows=1, cols=5)
    cat_table.style = "Light Grid Accent 2"
    _add_table_header(cat_table, ["DAY", "CITY", "MEAL", "RESTAURANT", "MENU"])
    for d in days:
        if d.lunch_name:
            _add_data_row(cat_table, [d.day_index, d.primary_city or d.cities or "", "LUNCH", d.lunch_name, d.lunch_menu or ""])
        if d.dinner_name:
            _add_data_row(cat_table, [d.day_index, d.primary_city or d.cities or "", "DINNER", d.dinner_name, d.dinner_menu or ""])
    p = doc.add_paragraph()
    p.add_run("1 large bottle mineral water / 3 pax each meal").italic = True

    # ── Activities & Monuments ──────────────────────────────────────────────
    _add_section_header(doc, "Activities & Monuments")
    mon_table = doc.add_table(rows=1, cols=4)
    mon_table.style = "Light Grid Accent 2"
    _add_table_header(mon_table, ["DAY", "CITY", "ENTRANCE FEE INCL.", "VIEW FROM THE OUTSIDE"])
    for d in days:
        entries = []
        outside = []
        for m in (d.monuments_json or []):
            if not isinstance(m, dict):
                continue
            name = m.get("name", "")
            if m.get("entrance"):
                entries.append(name + (" (entrance)" if not name.endswith(")") else ""))
            else:
                outside.append(name)
        if entries or outside:
            _add_data_row(mon_table, [
                d.day_index, d.primary_city or d.cities or "",
                "; ".join(entries), "; ".join(outside),
            ])
    note = doc.add_paragraph()
    note.add_run(
        "N.B: All museums in Morocco are closed on Tuesday and religious holidays. "
        "Entrance fees may be subject to change without prior notice."
    ).italic = True

    # ── Guides ──────────────────────────────────────────────────────────────
    _add_section_header(doc, "Guides")
    doc.add_paragraph(
        quote.guides_notes
        or f"An [{(quote.language or 'EN').upper()}]-speaking guide will be available throughout the journey, "
        "responsible for facilitating your travel, providing information on visited sites, and "
        "assisting with any inquiries.\n"
        "For groups of 20+ pax, a local guide in each city is mandatory under Moroccan law."
    )

    # ── Transportation ──────────────────────────────────────────────────────
    _add_section_header(doc, "Transportation")
    doc.add_paragraph(
        quote.transportation_notes
        or "At S'TOURS, we prioritize the comfort and safety of our guests. All vehicles are recent models, "
        "equipped with seatbelts, A/C, reclining seats, and Wi-Fi. Drivers are seasoned professionals."
    )

    # ── Pricing ─────────────────────────────────────────────────────────────
    _add_section_header(doc, f"Pricing — Estimate offer {quote.travel_period or ''}")
    pr_table = doc.add_table(rows=1, cols=3)
    pr_table.style = "Light Grid Accent 2"
    _add_table_header(pr_table, [
        "BASIS",
        f"PRICE / PERSON SHARING A TWIN ROOM ({quote.currency_sell or 'USD'})",
        f"SINGLE SUPPLEMENT ({quote.currency_sell or 'USD'})",
    ])
    for b in pricing.get("brackets", []):
        _add_data_row(pr_table, [
            f"{b['pax']} + {b.get('foc_count', 1)} FOC",
            f"{b['twin_pp_sell']:,.0f}",
            f"{b['ss_pp_sell']:,.0f}",
        ])

    # ── Inclusions ──────────────────────────────────────────────────────────
    _add_section_header(doc, "Inclusions")
    inc_text = quote.inclusions or (
        "• Accommodation in hotels as detailed in the Accommodation section\n"
        "• Buffet breakfasts at hotels\n"
        "• Lunches & dinners at venues specified in the Catering section\n"
        "• Mineral water 1.5L / 3 pax / meal\n"
        "• Complimentary single room for tour leader\n"
        "• Vehicle as outlined in the Transportation section\n"
        "• English-speaking guide throughout the tour\n"
        "• Local guides during visits to major cities for groups of 20+\n"
        "• Access to all monuments listed with (*)\n"
        "• City taxes\n"
        "• Tips for waiters at restaurants & hotels\n"
        "• Tips for hotel porters (in/out)"
    )
    for line in inc_text.split("\n"):
        if line.strip():
            doc.add_paragraph(line, style="List Bullet")

    # ── Exclusions ──────────────────────────────────────────────────────────
    _add_section_header(doc, "Exclusions")
    exc_text = quote.exclusions or (
        "• Personal extras (laundry, telephone, minibar...)\n"
        "• Tips for guides and drivers\n"
        "• Drinks not mentioned as included\n"
        "• Meals not mentioned above\n"
        "• Travel insurance\n"
        "• Visa fees\n"
        "• International flight tickets\n"
        "• Porter services at airports"
    )
    for line in exc_text.split("\n"):
        if line.strip():
            doc.add_paragraph(line, style="List Bullet")

    # ── Terms & Conditions ──────────────────────────────────────────────────
    _add_section_header(doc, "Terms & Conditions")
    doc.add_paragraph(
        quote.terms or (
            f"This offer is a preliminary estimate, valid for the period {quote.travel_period or ''}. "
            "No bookings have been made at this time; this document serves solely as a quotation. "
            f"Prices are quoted in {quote.currency_sell or 'USD'} based on the current exchange rate. "
            "Adjustments may be made if rates change before final payment. "
            "Rooming list to be sent 1 month prior to guests' arrival."
        )
    )

    _add_section_header(doc, "Payment Terms")
    doc.add_paragraph(quote.payment_terms or (
        "• Deposit: 20 % to confirm reservation, deducted from total invoice.\n"
        "• Full payment due 15 days before departure.\n"
        "• Payment methods: bank transfer, credit card, PayPal."
    ))

    _add_section_header(doc, "Cancellation Policy")
    doc.add_paragraph(quote.cancellation_policy or (
        "Cancellations made within the periods specified per offer. During peak seasons or for "
        "certain services (festivals, holidays), stricter cancellation policies may apply. "
        "Modifications subject to availability and may incur additional fees."
    ))

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()
