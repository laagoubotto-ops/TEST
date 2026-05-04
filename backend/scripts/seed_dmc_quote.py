"""Seed a sample DMC quote based on the YS Travel Morocco 11D adhoc Nov 2026 file.

Usage:
    python scripts/seed_dmc_quote.py
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app.main  # noqa: F401  ensure all models loaded
from app.core.database import SessionLocal, engine
from app.shared.models import Base
from app.modules.dmc_quote.models import DmcQuote, DmcQuoteDay
from app.modules.companies.models import Company


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        company = db.query(Company).first()
        if not company:
            print("[ERR] No company found. Run seed_users.py first.")
            return
        cid = company.id

        existing = db.query(DmcQuote).filter_by(company_id=cid, code="YST-2026-001").first()
        if existing:
            print(f"[SKIP] Already seeded: {existing.id}")
            return

        quote = DmcQuote(
            company_id=cid,
            code="YST-2026-001",
            title="DISCOVER MOROCCO 09 DAYS / 08 NIGHTS",
            client_name="SAINT TOUR",
            client_reference="YS Travel Morocco 11D adhoc (Giant Tour is competitor) November 2026 dep",
            travel_period="NOV 2026",
            start_date=date(2026, 11, 8),
            end_date=date(2026, 11, 16),
            nb_days=9,
            nb_nights=8,
            language="en",
            currency_sell="USD",
            fx_to_mad=10.25,
            markup_pct=8.0,
            bus_cost_per_km=8.5,
            fuel_factor=1.0,
            foc_ratio="1 FOC",
            pax_brackets_json={"brackets": [10, 15, 20, 25, 30, 35]},
            status="draft",
            transportation_notes=(
                "At S'TOURS, we prioritize the comfort and safety of our guests. All vehicles are "
                "recent models, equipped with seatbelts, A/C, reclining seats, and Wi-Fi. "
                "48-seater coach for groups from 26 to 40 people (MAN Irizar I6, Mercedes Irizar I6 or similar)."
            ),
            guides_notes=(
                "An ENGLISH-speaking guide will be available throughout the journey. "
                "For groups of 20+ pax, a local guide in each city is mandatory under Moroccan law."
            ),
        )
        db.add(quote)
        db.flush()

        # 9-day program from the YS Travel docx (cities, hotels, restos, monuments)
        days_data = [
            dict(
                day_index=1, date=date(2026, 11, 8), cities="CASA", primary_city="CASABLANCA", km=0,
                hotel_name="MOVENPICK CASABLANCA", hotel_category="5*", room_type="STANDARD", basis="BB",
                hotel_twin_mad=600, hotel_ss_mad=400, hotel_taxes_mad=39.6,
                dinner_name="RICK'S CAFÉ", dinner_pp_mad=500,
                monuments_json=[
                    {"name": "Royal Palace of Casablanca", "exterior": True},
                    {"name": "Habbouss quarter / Mohammed 5th square", "exterior": True},
                ],
                narrative="Arrival in Casablanca, transfer & check-in at Movenpick. Dinner at Rick's Café.",
            ),
            dict(
                day_index=2, date=date(2026, 11, 9), cities="CAS/RBA/CHEF", primary_city="CHEFCHAOUEN", km=540,
                hotel_name="DAR ECHAOUEN", hotel_category="4*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=746, hotel_ss_mad=350, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="MARINA SLA", lunch_menu="Soup fish or Salad; Plate fresh fishes & garnish; dessert", lunch_pp_mad=160,
                dinner_name="HOTEL", dinner_menu="Buffet or 3-course menu", dinner_pp_mad=0,
                monuments_json=[
                    {"name": "Hassan II Mosque", "entrance": True, "entrance_fee": 150},
                    {"name": "Royal Palace of Rabat", "exterior": True},
                    {"name": "Hassan Tower", "exterior": True},
                    {"name": "Mohammed V Mausoleum", "exterior": True},
                ],
                monuments_total_mad=150, local_guide_mad=600,
                narrative="Casablanca → Rabat → Chefchaouen via Atlantic coast. Visit Hassan II Mosque and Rabat monuments.",
            ),
            dict(
                day_index=3, date=date(2026, 11, 10), cities="CHEF/V/M/FES", primary_city="FES", km=300,
                hotel_name="PALAIS MEDINA RIAD RESORT", hotel_category="5*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=750, hotel_ss_mad=400, hotel_taxes_mad=39.6, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="ROMAN CITY", lunch_menu="Harira soup or vegetable soup or salads; Beef tajin with vegetables; seasonal fruit or Moroccan cake", lunch_pp_mad=140,
                dinner_name="HOTEL", dinner_menu="Buffet or 3-course menu",
                monuments_json=[
                    {"name": "Medina of Chefchaouen", "exterior": True},
                    {"name": "Volubilis (UNESCO Roman site)", "entrance": True, "entrance_fee": 100},
                    {"name": "Bab Mansour Gate (Meknes)", "exterior": True},
                    {"name": "City Walls of Meknes", "exterior": True},
                ],
                monuments_total_mad=100, local_guide_mad=700,
                narrative="Chefchaouen → Volubilis → Meknes → Fes. Visit UNESCO Roman ruins and Meknes city walls.",
            ),
            dict(
                day_index=4, date=date(2026, 11, 11), cities="FES/MIDELT", primary_city="MIDELT", km=270,
                hotel_name="TADART", hotel_category="3*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=420, hotel_ss_mad=170, hotel_taxes_mad=10, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="CHENESE RESTAURANT", lunch_menu="7 dishes + 1 soup", lunch_pp_mad=150,
                dinner_name="CHENESE RESTAURANT", dinner_menu="Soup or salad; Grilled trout with garnish; apple tart",
                guide_day_mad=400,
                monuments_json=[
                    {"name": "Terrasse de Tannerie (Fes)", "entrance": True, "entrance_fee": 0},
                    {"name": "Bou Inania Madrasah", "entrance": True, "entrance_fee": 20},
                    {"name": "Bab Bou Jeloud", "exterior": True},
                    {"name": "Karaouine Mosque", "exterior": True},
                    {"name": "Mosque of Moulay Idriss", "exterior": True},
                    {"name": "Royal Palace in Fes", "exterior": True},
                ],
                monuments_total_mad=20, local_guide_mad=200,
                narrative="Fes city tour with local guide: tanneries, Bou Inania Madrasah, Karaouine. Drive to Midelt.",
            ),
            dict(
                day_index=5, date=date(2026, 11, 12), cities="MIDELT/MERZ", primary_city="MERZOUGA", km=290,
                hotel_name="KASBAH TOMBOCTOU", hotel_category="4*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=550, hotel_ss_mad=250, hotel_taxes_mad=5, hotel_upgrade_mad=400, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="Chergui Hotel / Restaurant", lunch_menu="Salad; Lamb with prunes; seasonal fruits", lunch_pp_mad=150,
                dinner_name="HOTEL", dinner_menu="Buffet or 3-course menu",
                monuments_json=[
                    {"name": "Stone Lion (Ifran)", "exterior": True},
                    {"name": "4x4 vehicles to Merzouga dunes", "entrance": True, "entrance_fee": 0},
                    {"name": "Sunset Camel-Riding", "entrance": True, "entrance_fee": 0},
                    {"name": "Fossil factory", "exterior": True},
                ],
                activities_json=[
                    {"name": "Erfoud–Merzouga 4x4 transfer", "included": True, "cost_pp_mad": 0},
                    {"name": "Sunset camel ride", "included": True, "cost_pp_mad": 0},
                ],
                narrative="Midelt → Erfoud → Merzouga via cedar forests. 4x4 transfer to dune camp, sunset camel ride.",
            ),
            dict(
                day_index=6, date=date(2026, 11, 13), cities="MERZ/OZZ", primary_city="OUARZAZATE", km=350,
                hotel_name="OSCAR STUDIO HOTEL", hotel_category="4*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=700, hotel_ss_mad=350, hotel_taxes_mad=16.5, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="YASMINA", lunch_menu="Mixed salad or vegetable soup; Chicken tajin lemon & olives; assorted fruits", lunch_pp_mad=110,
                dinner_name="HOTEL", dinner_menu="Buffet or 3-course menu",
                guide_day_mad=400,
                monuments_json=[
                    {"name": "Kasbah Road", "exterior": True},
                    {"name": "Tinghir Oasis", "exterior": True},
                    {"name": "Todgha Gorges", "exterior": True},
                    {"name": "Dades Valley / Kalla Mgouna", "exterior": True},
                ],
                narrative="Merzouga → Tinghir → Todgha Gorges → Dades → Ouarzazate. Scenic drive through the valley of roses.",
            ),
            dict(
                day_index=7, date=date(2026, 11, 14), cities="OZZ/RAK", primary_city="MARRAKECH", km=200,
                hotel_name="ADAM PARK", hotel_category="5*", room_type="STANDARD", basis="HB",
                hotel_twin_mad=680, hotel_ss_mad=350, hotel_taxes_mad=28.6, hotel_water_mad=10, meal_water_mad=8,
                lunch_name="OASIS D'OR", lunch_menu="Mixed salad or Berber omelette; Mixed skewers (Kebab) with garnish; dessert", lunch_pp_mad=140,
                dinner_name="HOTEL", dinner_menu="Buffet or 3-course menu",
                monuments_json=[
                    {"name": "Atlas Studio (Ouarzazate)", "entrance": True, "entrance_fee": 80},
                    {"name": "Ait Ben Haddou (UNESCO)", "exterior": True},
                    {"name": "Tizzi-N-Tichka pass", "exterior": True},
                    {"name": "Koutoubia Mosque", "exterior": True},
                ],
                monuments_total_mad=80, local_guide_mad=200,
                narrative="Ouarzazate → Ait Ben Haddou (UNESCO) → Tizzi-N-Tichka pass → Marrakech.",
            ),
            dict(
                day_index=8, date=date(2026, 11, 15), cities="RAK/ESU/RAK", primary_city="MARRAKECH", km=380,
                hotel_name="ADAM PARK", hotel_category="5*", room_type="STANDARD", basis="BB",
                hotel_twin_mad=570, hotel_ss_mad=350, hotel_taxes_mad=28.6, hotel_water_mad=0, meal_water_mad=8,
                lunch_name="ZAHRA GRILL", lunch_menu="Octopus salad; Oysters; Grilled fish with garnish; dessert", lunch_pp_mad=250,
                dinner_name="CHEZ ALI", dinner_menu="Soup; Meat skewers; Vegetable couscous; Milk pastilla; mint tea; Moroccan pastries", dinner_pp_mad=400,
                monuments_json=[
                    {"name": "Argan Oil Cooperative (Essaouira)", "exterior": True},
                    {"name": "Essaouira Medina", "entrance": True, "entrance_fee": 0},
                    {"name": "Bahia Palace", "entrance": True, "entrance_fee": 70},
                    {"name": "Majorelle Garden", "entrance": True, "entrance_fee": 200},
                ],
                monuments_total_mad=270, local_guide_mad=300,
                activities_json=[
                    {"name": "Horse carriage in Marrakech medina", "included": True, "pax_per_carriage": 4, "cost_group_mad": 250},
                ],
                narrative="Marrakech → Essaouira day trip → Marrakech. Visit the Argan cooperative, medina and harbour.",
            ),
            dict(
                day_index=9, date=date(2026, 11, 16), cities="RAK", primary_city="MARRAKECH", km=20,
                hotel_name="DEPARTURE", hotel_category="", room_type="", basis="",
                narrative="Transfer to airport. End of services.",
            ),
        ]
        for d in days_data:
            db.add(DmcQuoteDay(quote_id=quote.id, **d))

        db.commit()
        print(f"[OK] Seeded DMC quote {quote.code} (id={quote.id}) with {len(days_data)} days.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
