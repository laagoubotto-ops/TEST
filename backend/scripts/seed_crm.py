"""Seed CRM with demo accounts, contacts, activities, deals, tasks."""
from datetime import datetime, timedelta, timezone, date
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app.main  # noqa: F401  -- ensures all models are loaded
from app.core.database import SessionLocal, engine
from app.shared.models import Base
from app.modules.companies.models import Company
from app.modules.crm.models import CrmAccount, CrmContact, CrmActivity, CrmDeal, CrmTask

# Make sure CRM tables exist
Base.metadata.create_all(bind=engine)


def now() -> datetime:
    return datetime.now(timezone.utc)


def main():
    db = SessionLocal()
    try:
        c = db.query(Company).first()
        if not c:
            print("No company found. Run seed_companies first.")
            return
        cid = c.id

        # Reset
        db.query(CrmTask).filter(CrmTask.company_id == cid).delete()
        db.query(CrmActivity).filter(CrmActivity.company_id == cid).delete()
        db.query(CrmDeal).filter(CrmDeal.company_id == cid).delete()
        db.query(CrmContact).filter(CrmContact.company_id == cid).delete()
        db.query(CrmAccount).filter(CrmAccount.company_id == cid).delete()
        db.commit()

        # Accounts
        accounts_data = [
            dict(code="AG-001", name="Luxe Voyages International", legal_name="Luxe Voyages SAS",
                 account_type="agency", primary_email="s.martin@luxevoyages.fr", primary_phone="+33145678900",
                 country="France", city="Paris", language="fr", timezone="Europe/Paris",
                 tier="platinum", lifecycle_stage="champion", health_score=92, nps_score=68,
                 currency="EUR", payment_terms_days=30, credit_limit=200000,
                 tags=["luxury","fr","b2b","top-10"], preferences={"hotels":"5*","guides":"fr","transfer":"vip-mercedes"},
                 description="Tour-opérateur premium français. Volume annuel ~45 dossiers."),
            dict(code="AG-002", name="Atlas Tours UK", legal_name="Atlas Tours Ltd",
                 account_type="tour_operator", primary_email="jsmith@atlastours.co.uk", primary_phone="+442075550100",
                 country="United Kingdom", city="London", language="en", timezone="Europe/London",
                 tier="gold", lifecycle_stage="customer", health_score=72, nps_score=45,
                 currency="GBP", payment_terms_days=45,
                 tags=["outdoor","en","b2b"], preferences={"diet":"vegetarian-friendly","activities":"outdoor"},
                 description="Spécialiste outdoor & trekking depuis Londres."),
            dict(code="AG-003", name="Iberia Travel Group", legal_name="Iberia Travel SL",
                 account_type="agency", primary_email="cruiz@iberiatravel.es", primary_phone="+34915550100",
                 country="Spain", city="Madrid", language="es",
                 tier="silver", lifecycle_stage="opportunity", health_score=55,
                 currency="EUR", payment_terms_days=30,
                 tags=["budget","es"], preferences={"groups":"20+","budget":"optimized"},
                 description="Volumes importants en groupes (20+ pax). Marges serrées."),
            dict(code="AG-004", name="Elite Destinations NY", legal_name="Elite Destinations LLC",
                 account_type="agency", primary_email="sarah@elitedest.com", primary_phone="+12125550100",
                 country="USA", city="New York", language="en",
                 tier="platinum", lifecycle_stage="champion", health_score=95, nps_score=72,
                 currency="USD", payment_terms_days=15, credit_limit=500000,
                 tags=["ultra-lux","us","b2b","top-5"], preferences={"hotels":"private-riad","transport":"helicopter"},
                 description="Ultra-luxury concierge. Conversion 93%."),
            dict(code="DR-001", name="Hewett Group", legal_name="Hewett Family",
                 account_type="direct", primary_email="contact@hewett.com",
                 country="USA", city="Boston", language="en",
                 tier="gold", lifecycle_stage="opportunity", health_score=68,
                 description="Famille Hewett — Cités Impériales 11j en cours."),
            dict(code="MC-001", name="TotalEnergies MICE", legal_name="TotalEnergies SE",
                 account_type="mice", primary_email="incentive@totalenergies.com",
                 country="France", city="Paris", language="fr",
                 tier="platinum", lifecycle_stage="customer", health_score=85, nps_score=55,
                 currency="EUR",
                 tags=["mice","corporate","fr"],
                 description="Incentive corporate récurrent. 80 pax annuel."),
            dict(code="AG-005", name="Schmidt KG Reisen", legal_name="Schmidt KG",
                 account_type="agency", primary_email="info@schmidt-reisen.de",
                 country="Germany", city="Munich", language="de",
                 tier="gold", lifecycle_stage="customer", health_score=80,
                 currency="EUR",
                 description="DE outbound. Spécialiste désert."),
            dict(code="LD-001", name="Boston University Travel", legal_name="Boston University",
                 account_type="corporate", primary_email="travel@bu.edu",
                 country="USA", city="Boston", language="en",
                 tier="silver", lifecycle_stage="lead", health_score=40,
                 description="Lead universitaire. Voyages d'étude étudiants."),
        ]
        accounts: list[CrmAccount] = []
        for d in accounts_data:
            a = CrmAccount(company_id=cid, **d)
            db.add(a); accounts.append(a)
        db.flush()

        # Contacts (1-2 per account)
        contact_seed = {
            "AG-001": [("Sophie", "Martin", "Directrice DMC", "s.martin@luxevoyages.fr", "+33614200100", True, True),
                       ("Pierre", "Dubois", "Acheteur", "p.dubois@luxevoyages.fr", "+33614200101", False, False)],
            "AG-002": [("James", "Smith", "Founder", "jsmith@atlastours.co.uk", "+447700900100", True, True)],
            "AG-003": [("Carlos", "Ruiz", "Director Comercial", "cruiz@iberiatravel.es", "+34666700100", True, True),
                       ("Lucia", "Gomez", "Junior Producer", "lgomez@iberiatravel.es", None, False, False)],
            "AG-004": [("Sarah", "Jenkins", "VP Travel", "sarah@elitedest.com", "+12125550100", True, True)],
            "DR-001": [("Mark", "Hewett", "Owner", "mark@hewett.com", None, True, True)],
            "MC-001": [("Marc", "Lemaire", "Event Manager", "incentive@totalenergies.com", None, True, True)],
            "AG-005": [("Klaus", "Schmidt", "GM", "klaus@schmidt-reisen.de", "+498912345", True, True)],
            "LD-001": [("Dr. Anna", "Reyes", "Travel Director", "areyes@bu.edu", None, True, True)],
        }
        for a in accounts:
            for fn, ln, title, email, phone, prim, dm in contact_seed.get(a.code, []):
                db.add(CrmContact(
                    company_id=cid, account_id=a.id,
                    first_name=fn, last_name=ln, title=title, email=email, phone=phone,
                    is_primary=prim, is_decision_maker=dm,
                ))
        db.flush()

        # Deals (open + won + lost)
        deals_seed = [
            ("AG-001", "Cités Impériales 11j · Hewett",        "won",          245000,  100, -45, "Maroc"),
            ("AG-001", "Sahara Premium 9j · oct 2026",          "negotiation",  380000,  70,    35, "Sahara"),
            ("AG-001", "Atlas Trek 7j · printemps",             "proposal",     185000,  50,    60, "Atlas"),
            ("AG-002", "Outdoor Adventure 8j",                  "qualification", 95000,  20,    90, "Atlas"),
            ("AG-003", "Group MICE 20pax",                      "lost",          78000,    0,  -30, "Marrakech"),
            ("AG-003", "Andalusia + Maroc combo 12j",           "qualification", 110000,  25,   100, "Combo"),
            ("AG-004", "Honeymoon Riad Luxe 5j",                "won",          165000, 100,   -20, "Marrakech"),
            ("AG-004", "Helicopter Tour Marrakech 3j",          "negotiation",  220000,  80,    20, "Marrakech"),
            ("AG-004", "Imperial Discovery 10j · Boston Univ",  "proposal",     320000,  60,    45, "Cités"),
            ("DR-001", "Imperial 11j · 22 pax",                 "negotiation",  185000,  75,    20, "Cités"),
            ("MC-001", "Incentive Casa-Marrakech 4j 80pax",     "won",          425000, 100,   -15, "Casa+Marra"),
            ("MC-001", "Workshop Sahara 5j",                    "qualification",230000,  20,   120, "Sahara"),
            ("AG-005", "Erg Chebbi Lux 6j",                     "won",          135000, 100,   -60, "Sahara"),
            ("AG-005", "Coast & Atlas 9j printemps",            "proposal",     162000,  55,    70, "Atlas"),
            ("LD-001", "Educational Trip 8j 30 students",       "qualification",  62000, 15,   150, "Cités"),
        ]
        accounts_by_code = {a.code: a for a in accounts}
        for code, title, stage, amount, prob, day_offset, dest in deals_seed:
            a = accounts_by_code.get(code)
            if not a: continue
            close_dt = (now() + timedelta(days=day_offset)).date()
            d = CrmDeal(
                company_id=cid, account_id=a.id, title=title, stage=stage,
                amount_mad=amount, probability=prob, expected_close_date=close_dt,
                destination=dest, pax=20, description=f"Deal {title} pour {a.name}",
            )
            if stage in ("won", "lost"):
                d.closed_at = now() - timedelta(days=abs(day_offset))
                if stage == "lost":
                    d.lost_reason = "Prix supérieur à concurrent"
            db.add(d)
        db.flush()

        # Activities (a few per account)
        for a in accounts:
            db.add(CrmActivity(
                company_id=cid, account_id=a.id, type="note",
                title=f"Compte créé: {a.name}",
                occurred_at=now() - timedelta(days=120),
            ))
            db.add(CrmActivity(
                company_id=cid, account_id=a.id, type="email",
                title="Email envoyé: présentation services DMC",
                description="Mail de bienvenue + brochure 2026",
                occurred_at=now() - timedelta(days=30),
            ))
            db.add(CrmActivity(
                company_id=cid, account_id=a.id, type="call",
                title="Appel: discussion budget 2026",
                description="15 min — intéressé par circuits luxe & MICE",
                occurred_at=now() - timedelta(days=12),
            ))
            db.add(CrmActivity(
                company_id=cid, account_id=a.id, type="meeting",
                title="Visio: démo plateforme",
                occurred_at=now() - timedelta(days=5),
            ))
            a.last_contact_at = now() - timedelta(days=5)

        # Tasks
        tasks_seed = [
            ("AG-001", "Envoyer proposal Sahara Premium",       "high",   2),
            ("AG-001", "Relancer Sophie sur signature contrat", "urgent", -1),  # overdue
            ("AG-002", "Préparer cotation outdoor 8j",          "normal", 5),
            ("AG-003", "Appel suivi après devis Andalusia",     "normal", 3),
            ("AG-004", "Visio Sarah pour helicopter tour",      "high",   1),
            ("DR-001", "Confirmer dates Imperial 11j",          "high",   4),
            ("MC-001", "Réserver Auberge Atlas 80 pax",         "urgent", 6),
            ("AG-005", "Envoyer photos circuit Atlas",          "low",    14),
        ]
        for code, title, prio, day_offset in tasks_seed:
            a = accounts_by_code.get(code)
            if not a: continue
            db.add(CrmTask(
                company_id=cid, account_id=a.id,
                title=title, priority=prio,
                due_date=now() + timedelta(days=day_offset),
            ))

        db.commit()
        print(f"OK: {len(accounts)} comptes · "
              f"{db.query(CrmContact).filter(CrmContact.company_id==cid).count()} contacts · "
              f"{db.query(CrmDeal).filter(CrmDeal.company_id==cid).count()} deals · "
              f"{db.query(CrmActivity).filter(CrmActivity.company_id==cid).count()} activités · "
              f"{db.query(CrmTask).filter(CrmTask.company_id==cid).count()} tâches")
    finally:
        db.close()


if __name__ == "__main__":
    main()
