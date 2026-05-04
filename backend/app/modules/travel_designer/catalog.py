"""Catalogue de référence du Travel Designer Pro.

Pourquoi un catalogue local : les tables Hotel/Menu/Transport sont parfois
vides en démo. On retombe sur ce catalogue pour offrir une expérience riche
sans dépendre du seed des autres modules. En production, il s'enrichit
automatiquement avec les données métier (cf. `_blend_db_catalog` dans le
router).
"""

DEMO_CATALOG = {
    "hotels": [
        {"id": "h-royal-mansour",   "label": "Royal Mansour Marrakech",      "city": "Marrakech",   "category": "5* Palace", "unit_cost": 4800, "currency": "MAD", "supplier": "Direct"},
        {"id": "h-mamounia",        "label": "La Mamounia",                  "city": "Marrakech",   "category": "5* Palace", "unit_cost": 3900, "currency": "MAD", "supplier": "Direct"},
        {"id": "h-fes-palais",      "label": "Palais Faraj",                 "city": "Fès",         "category": "5*",         "unit_cost": 1450, "currency": "MAD", "supplier": "Direct"},
        {"id": "h-sahara-luxe",     "label": "Sahara Luxury Camp",           "city": "Merzouga",    "category": "Camp 5*",    "unit_cost": 1800, "currency": "MAD", "supplier": "Local DMC"},
        {"id": "h-essaouira-palais","label": "Heure Bleue Palais",           "city": "Essaouira",   "category": "5*",         "unit_cost": 1350, "currency": "MAD", "supplier": "Direct"},
        {"id": "h-chefchaouen",     "label": "Lina Ryad & Spa",              "city": "Chefchaouen", "category": "Boutique 4*","unit_cost":  890, "currency": "MAD", "supplier": "Direct"},
        {"id": "h-rabat-libertas",  "label": "Sofitel Rabat Jardin des Roses","city":"Rabat",       "category": "5*",         "unit_cost": 1650, "currency": "MAD", "supplier": "Accor"},
        {"id": "h-casa-fourseasons","label": "Four Seasons Casablanca",      "city": "Casablanca",  "category": "5*",         "unit_cost": 2400, "currency": "MAD", "supplier": "Direct"},
    ],
    "restaurants": [
        {"id": "r-namaskar",   "label": "Namaskar Palace",                  "city": "Marrakech",   "meal_type": "dinner",     "unit_cost": 750, "currency": "MAD", "supplier": "Direct"},
        {"id": "r-dar-roumana","label": "Dar Roumana",                      "city": "Fès",         "meal_type": "dinner",     "unit_cost": 480, "currency": "MAD", "supplier": "Direct"},
        {"id": "r-chez-ali",   "label": "Chez Ali Fantasia (gala)",         "city": "Marrakech",   "meal_type": "gala_dinner","unit_cost": 590, "currency": "MAD", "supplier": "Chez Ali"},
        {"id": "r-elfenn",     "label": "El Fenn Rooftop",                  "city": "Marrakech",   "meal_type": "lunch",      "unit_cost": 320, "currency": "MAD", "supplier": "Direct"},
        {"id": "r-saveurs-pal","label": "Saveurs du Palais",                "city": "Rabat",       "meal_type": "lunch",      "unit_cost": 290, "currency": "MAD", "supplier": "Direct"},
        {"id": "r-essaouira-c","label": "Caravane Café",                    "city": "Essaouira",   "meal_type": "lunch",      "unit_cost": 240, "currency": "MAD", "supplier": "Direct"},
        {"id": "r-kasbah-bbq", "label": "BBQ Berbère Kasbah",               "city": "Ouarzazate",  "meal_type": "bbq",        "unit_cost": 380, "currency": "MAD", "supplier": "Local"},
    ],
    "monuments": [
        {"id": "m-jemaa",       "label": "Place Jemaa el-Fna (visite guidée)",     "city": "Marrakech", "entry": "free",        "unit_cost":   0, "currency": "MAD"},
        {"id": "m-bahia",       "label": "Palais de la Bahia",                     "city": "Marrakech", "entry": "incl",        "unit_cost":  70, "currency": "MAD"},
        {"id": "m-saadian",     "label": "Tombeaux Saadiens",                      "city": "Marrakech", "entry": "incl",        "unit_cost":  70, "currency": "MAD"},
        {"id": "m-fes-medina",  "label": "Médina de Fès (visite guidée)",          "city": "Fès",       "entry": "exterior",    "unit_cost":   0, "currency": "MAD"},
        {"id": "m-volubilis",   "label": "Volubilis (site romain)",                "city": "Meknès",    "entry": "incl",        "unit_cost":  70, "currency": "MAD"},
        {"id": "m-ait-benhad",  "label": "Aït-Ben-Haddou (UNESCO)",                "city": "Ouarzazate","entry": "incl",        "unit_cost":  60, "currency": "MAD"},
        {"id": "m-merzouga-dunes","label": "Erg Chebbi — coucher de soleil",       "city": "Merzouga",  "entry": "free",        "unit_cost":   0, "currency": "MAD"},
        {"id": "m-essaouira-port","label": "Port d'Essaouira & Skala",             "city": "Essaouira", "entry": "free",        "unit_cost":   0, "currency": "MAD"},
        {"id": "m-chefchaouen", "label": "Médina bleue de Chefchaouen",            "city": "Chefchaouen","entry":"exterior",     "unit_cost":   0, "currency": "MAD"},
    ],
    "transport": [
        {"id": "t-berline",      "label": "Berline 1-3 PAX (chauffeur)",   "city": "—", "vehicle": "Berline 4PAX",    "capacity":  3, "unit_cost": 2500, "currency": "MAD", "supplier": "Stours Fleet"},
        {"id": "t-4x4",          "label": "4×4 Land Cruiser 1-6 PAX",      "city": "—", "vehicle": "Land Cruiser",    "capacity":  6, "unit_cost": 3200, "currency": "MAD", "supplier": "Stours Fleet"},
        {"id": "t-mini-van-7",   "label": "Mini-van 4-7 PAX",              "city": "—", "vehicle": "Mercedes Vito",   "capacity":  7, "unit_cost": 2900, "currency": "MAD", "supplier": "Stours Fleet"},
        {"id": "t-mini-bus-26",  "label": "Mini-bus 26 PAX",               "city": "—", "vehicle": "MB Sprinter",     "capacity": 26, "unit_cost": 4800, "currency": "MAD", "supplier": "Stours Fleet"},
        {"id": "t-bus-48",       "label": "Autocar 39-48 PAX",             "city": "—", "vehicle": "MAN Irizar I6",   "capacity": 48, "unit_cost": 6500, "currency": "MAD", "supplier": "Stours Fleet"},
    ],
    "guides": [
        {"id": "g-marrakech",    "label": "Guide Officiel — Marrakech",     "city": "Marrakech",  "lang": "FR/EN/ES", "unit_cost": 1500, "currency": "MAD", "supplier": "Réseau S'TOURS"},
        {"id": "g-fes",          "label": "Guide Officiel — Fès",            "city": "Fès",        "lang": "FR/EN/AR", "unit_cost": 1500, "currency": "MAD", "supplier": "Réseau S'TOURS"},
        {"id": "g-rabat",        "label": "Guide Officiel — Rabat",          "city": "Rabat",      "lang": "FR/EN",    "unit_cost": 1300, "currency": "MAD", "supplier": "Réseau S'TOURS"},
        {"id": "g-tour-leader",  "label": "Tour Leader National (FR)",       "city": "—",          "lang": "FR",       "unit_cost": 1100, "currency": "MAD", "supplier": "Réseau S'TOURS"},
        {"id": "g-tour-leader-en","label": "Tour Leader National (EN)",      "city": "—",          "lang": "EN",       "unit_cost": 1200, "currency": "MAD", "supplier": "Réseau S'TOURS"},
    ],
    "activities": [
        {"id": "a-hammam",       "label": "Hammam & Spa",                  "city": "Marrakech",   "duration_min": 90,  "unit_cost":  450, "currency": "MAD", "supplier": "Direct"},
        {"id": "a-cooking",      "label": "Atelier cuisine marocaine",     "city": "Marrakech",   "duration_min": 180, "unit_cost":  650, "currency": "MAD", "supplier": "La Maison Arabe"},
        {"id": "a-camel",        "label": "Balade en chameau (1h)",        "city": "Merzouga",    "duration_min": 60,  "unit_cost":  250, "currency": "MAD", "supplier": "Local"},
        {"id": "a-quad",         "label": "Excursion quad (2h)",           "city": "Merzouga",    "duration_min": 120, "unit_cost":  450, "currency": "MAD", "supplier": "Local"},
        {"id": "a-surf",         "label": "Cours de surf — Essaouira",     "city": "Essaouira",   "duration_min": 120, "unit_cost":  350, "currency": "MAD", "supplier": "Surfschool"},
        {"id": "a-kasbah-tour",  "label": "Tour Kasbahs Vallée du Drâa",   "city": "Ouarzazate",  "duration_min": 240, "unit_cost":  580, "currency": "MAD", "supplier": "Local"},
    ],
}

CITIES = [
    "Casablanca", "Rabat", "Tanger", "Chefchaouen", "Fès", "Meknès",
    "Marrakech", "Essaouira", "Ouarzazate", "Aït-Ben-Haddou", "Merzouga",
    "Erfoud", "Agadir",
]


def category_of(item_id: str) -> str:
    """Return catalog kind for an item id (best-effort)."""
    for kind, items in DEMO_CATALOG.items():
        if any(it["id"] == item_id for it in items):
            # Map plurals → singular kind for line storage
            return {
                "hotels": "hotel", "restaurants": "restaurant",
                "monuments": "monument", "transport": "transport",
                "guides": "guide", "activities": "activity",
            }.get(kind, "misc")
    return "misc"


def find_item(item_id: str) -> dict | None:
    for items in DEMO_CATALOG.values():
        for it in items:
            if it["id"] == item_id:
                return it
    return None
