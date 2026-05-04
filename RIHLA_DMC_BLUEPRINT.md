# RIHLA — Blueprint CRM & SaaS DMC

**Cible** : stours.ma (Morocco DMC) — B2B avec agences internationales (FIT + groupes), opérations hôtels / transport / guides / activités.
**Stack en place** : FastAPI + SQLAlchemy + Postgres-ready (SQLite dev) + React 18 + Vite + Tailwind + TanStack Query + JWT multi-tenant. **À garder, pas de migration HubSpot.**
**Ce blueprint = roadmap exécutable**, pas un cours théorique. Chaque section pointe sur du code à écrire dans `backend/app/modules/*` et `frontend/src/pages/*`.

---

## 1. CRM STRUCTURE — modèle de données

### 1.1 Entités centrales

```
Company (tenant)                 ← déjà OK (multi-tenant via JWT)
  └── User (commercial / ops / direction)
  └── Account (agence B2B / TO / direct / corporate / MICE)        ← crm_accounts ✅
  └── Contact (personnes dans l'agence)                            ← crm_contacts ✅
  └── Project (= Group / Trip — OBJET CENTRAL)                     ← projects ✅ à enrichir
  └── Deal (opportunité commerciale liée à 1 Project)              ← crm_deals ✅
  └── Activity (timeline immuable)                                 ← crm_activities ✅
  └── Task (todo / rappel)                                         ← crm_tasks ✅
  └── Service (item facturable d'un Project)                       ← project_lines à étendre
       ├── Hotel ref → suppliers_hotels
       ├── Restaurant ref → suppliers_restaurants
       ├── Activity ref → suppliers_activities
       ├── Monument ref → suppliers_monuments
       ├── Transport ref → suppliers_transports
       └── Guide ref → suppliers_guides
  └── Supplier (master data partagée par tous les projets)         ← inventory/* ✅ partiel
  └── Quote (= version de Project, JSONB des lignes + marges)      ← quotations ✅
  └── Booking (Project confirmé) — nouveau
  └── Invoice / Payment                                            ← invoices ✅
  └── Document (pièces jointes — proposal PDF, vouchers, NDA)
```

### 1.2 Tables clés à créer / étendre

| Table | Statut | Champs critiques |
|---|---|---|
| `projects` (= Groups) | ✅ existe — à enrichir | `id`, `company_id`, `account_id` FK, `code` (ex. `RIH-2026-0042`), `title`, `pax_adults`, `pax_children`, `start_date`, `end_date`, `nights`, `destinations[]`, `status` (= ops pipeline), `lifecycle` (= sales pipeline), `assigned_user_id`, `lead_source`, `currency`, `total_cost_mad`, `total_sell_mad`, `margin_mad`, `margin_pct` (computed), `lost_reason`, `won_at`, `created_at` |
| `crm_deals` | ✅ | déjà bon — lie `project_id` ↔ `account_id`, `stage`, `amount_mad`, `probability` |
| `project_services` | ⚠️ à formaliser | 1 ligne = 1 service. Colonnes : `project_id`, `day_index` (J1, J2…), `service_type` (`hotel`/`transport`/`restaurant`/`activity`/`monument`/`guide`/`other`), `supplier_id` (polymorphe — `hotel_id` xor `restaurant_id`…), `quantity`, `unit_cost_mad`, `unit_sell_mad`, `markup_pct`, `currency`, `notes` |
| `suppliers_hotels` | ✅ | `name`, `city`, `stars`, `room_types[]`, `tariff_grids` (JSONB par saison/chambre), `commission_pct`, `payment_terms_days`, `cancellation_policy_days`, `contract_pdf_url`, `lat`, `lng` |
| `suppliers_restaurants` | ❌ à créer | `name`, `city`, `cuisine_type`, `price_per_pax_lunch`, `price_per_pax_dinner`, `capacity`, `menu_options` (JSONB), `lat`, `lng`, `photo_urls[]` |
| `suppliers_monuments` | ❌ à créer | `name`, `city`, `entry_fee_mad`, `duration_min`, `opening_hours` (JSONB par jour), `audio_guide_available`, `lat`, `lng` |
| `suppliers_activities` | ✅ catalogue 25 — promouvoir en DB | + ajouter tarifs adulte/enfant, capacité min/max, durée, créneaux disponibles |
| `suppliers_transports` | ✅ | + `vehicle_type` (sedan/minivan/coach 33pax/coach 50pax), `pricing_grid` (km × type) |
| `suppliers_guides` | ✅ | + `languages[]`, `specialties[]` (history/culinary/photography), `daily_rate_mad`, `available_dates` (JSONB) |
| `bookings` | ❌ à créer | `id`, `project_id` FK 1-1, `confirmed_at`, `confirmation_number`, `voucher_pdf_url`, `client_signature_url`, `deposit_paid_at`, `final_payment_due_at` |
| `b2b_portal_sessions` | ❌ à créer | `account_id`, `magic_link_token`, `expires_at`, `last_seen_at` |
| `automations` | ❌ à créer | `trigger_type`, `condition` JSONB, `action` JSONB, `is_active` |

### 1.3 Relations critiques (à matérialiser en FK)

```
Account 1───n Project (n trips/agence)
Project 1───1 Deal (sales opportunity)
Project 1───n ProjectService (lignes itinéraire/devis)
Project 1───n Quote (versions de devis)
Project 1───0..1 Booking (confirmé)
Project 1───n Activity (timeline)
Project 1───n Task
Account 1───n Activity
Account 1───n Contact
Supplier_* 1───n ProjectService
Project 1───n Document (PDFs)
```

### 1.4 Index DB recommandés (perf)

```sql
CREATE INDEX idx_projects_company_status ON projects(company_id, status);
CREATE INDEX idx_projects_account_lifecycle ON projects(account_id, lifecycle);
CREATE INDEX idx_deals_company_stage ON crm_deals(company_id, stage);
CREATE INDEX idx_activities_account_created ON crm_activities(account_id, created_at DESC);
CREATE INDEX idx_tasks_user_due ON crm_tasks(assigned_user_id, due_at) WHERE status='open';
CREATE INDEX idx_project_services_project_day ON project_services(project_id, day_index);
```

---

## 2. PIPELINE DESIGN — 2 flux séparés

### 2.1 Sales pipeline (commercial)

```
LEAD          : prospect identifié, pas encore de demande
INQUIRY       : demande reçue (formulaire site / email / WhatsApp)
QUALIFIED     : besoins clarifiés (pax, dates, budget)
QUOTE_SENT    : devis envoyé
NEGOTIATION   : revisions du devis en cours
WON           : devis accepté → bascule vers ops pipeline
LOST          : refusé (avec lost_reason obligatoire)
```

**Champ DB** : `projects.lifecycle` enum.
**Frontend** : `/crm/pipeline` Kanban — déjà en place ✅. Ajouter colonne `INQUIRY` et `QUALIFIED`.
**Règle clé** : passage `WON` → crée automatiquement un `Booking` + déclenche workflow ops.

### 2.2 Operations pipeline (production)

```
PREPARATION   : briefing, cahier des charges, attribution chef de projet
CONFIRMED     : suppliers réservés, vouchers générés, paiement acompte reçu
IN_PROGRESS   : groupe en cours (J1 → J-fin)
COMPLETED     : retour groupe + facture finale
ARCHIVED      : facture payée, NPS collecté, dossier clos
```

**Champ DB** : `projects.status` enum.
**Frontend** : nouvelle page `/operations/pipeline` (Kanban ops) — actuellement on a `/operations` (suivi terrain) qui montre le détail mais pas le board.

### 2.3 Transitions automatiques

| Trigger | Action |
|---|---|
| Sales `WON` | crée `Booking`, status ops = `PREPARATION`, assigne chef de projet par règle (round-robin ou par destination), crée 5 tâches standard |
| Ops `CONFIRMED` | envoie email confirmation + voucher PDF au client B2B |
| Ops `IN_PROGRESS` | active le module field-ops (suivi terrain temps réel) |
| Ops `COMPLETED` | déclenche facturation finale + email NPS J+3 |

---

## 3. AUTOMATION

### 3.1 Moteur d'automatisations

**Pas de Zapier / Make** — trop cher au volume DMC. À implémenter en interne :

```python
# backend/app/modules/automations/engine.py
class AutomationEngine:
    def on_event(self, event: str, payload: dict):
        # event = "project.lifecycle_changed", "task.created", etc.
        rules = Automation.query.filter_by(trigger=event, is_active=True).all()
        for rule in rules:
            if self._matches_condition(rule.condition, payload):
                self._execute_action(rule.action, payload)
```

**Stack technique** :
- Queue de jobs : **Celery + Redis** (ou **APScheduler** pour cron simple)
- Email : **SendGrid** (transactional) ou **Mailgun** (250€/mois pour 50K emails)
- WhatsApp : **Twilio WhatsApp Business API** (~0.005 €/msg) ou **WATI** (60€/mois)
- SMS : Twilio (fallback si pas de réponse WhatsApp)

### 3.2 Automatisations à livrer dès J0

| # | Trigger | Action | Délai |
|---|---|---|---|
| A1 | `inquiry.received` | email auto-réponse "Nous avons reçu votre demande, devis sous 24h" + créer Project en LEAD + assigner commercial | <1 min |
| A2 | `inquiry.received` | tâche commerciale "Qualifier la demande" (priority=urgent, due=+4h) | <1 min |
| A3 | `quote.sent` ET pas de réponse | follow-up email auto "Avez-vous eu le temps de regarder ?" | J+2 |
| A4 | `quote.sent` ET pas de réponse | follow-up email "On peut adapter, dites-nous quoi ajuster" + tâche commerciale "Appeler le client" | J+5 |
| A5 | `quote.sent` ET pas de réponse | passage auto en `LOST` avec `lost_reason='no_response_after_10d'` + activity loggée | J+10 |
| A6 | `deal.won` | crée Booking + 5 tâches ops + email confirmation + génère voucher PDF | <1 min |
| A7 | `booking.confirmed` ET supplier_payment_due-3d | tâche finance "Payer hôtel X" + email rappel | J-3 avant due |
| A8 | `project.start_date` − 7j | email pré-départ au client B2B avec docs | J-7 |
| A9 | `project.completed` | email NPS au contact principal + au passager principal | J+3 après fin |
| A10 | `task.overdue` | notif Slack/email au manager du commercial | J+1 après due |
| A11 | `account.lifecycle = at_risk` | tâche CSM "Appeler le compte X" + alerte direction | immédiat |
| A12 | `payment.received` ET `booking.confirmed` | bascule status → `CONFIRMED` + voucher | <1 min |

### 3.3 Implémentation FastAPI — pattern recommandé

```python
# backend/app/modules/automations/router.py
@router.post("/projects/{id}/lifecycle")
def update_lifecycle(id: UUID, new: LifecycleEnum, ...):
    project = ...
    old = project.lifecycle
    project.lifecycle = new
    db.commit()
    # publish event
    automation_engine.on_event("project.lifecycle_changed", {
        "project_id": id, "old": old, "new": new
    })
```

**Cron quotidien** (APScheduler) à 06:00 UTC : scan des deals/tâches en retard → déclenche A3, A4, A5, A8, A9, A10.

---

## 4. B2B PORTAL — agences extranet

### 4.1 Routes & accès

```
Auth : magic-link (pas de mot de passe — l'agence reçoit un lien à 7j à chaque interaction)
URL  : portal.stours.ma  (sous-domaine séparé du backoffice)
```

### 4.2 Pages portail

| Route | Fonction |
|---|---|
| `/portal/dashboard` | KPIs agence : devis en cours, bookings actifs, factures à payer, dernier voyage |
| `/portal/quotes` | Liste de tous les devis reçus (avec versions, statut, PDF download, bouton "Accepter") |
| `/portal/quote/:id` | Vue interactive du devis (J/J + carte + photos) — inspirée Trello/Notion |
| `/portal/bookings` | Liste des groupes confirmés avec progression ops (preparation → in_progress → completed) |
| `/portal/booking/:id` | Détails groupe : itinéraire jour-par-jour, vouchers, contacts d'urgence H24, **carte temps réel** pendant le voyage |
| `/portal/documents` | Upload passeports, allergies, demandes spéciales (drag-and-drop) |
| `/portal/messaging` | **Inbox unifié** chat avec l'équipe DMC (lié aux activities CRM côté backoffice) |
| `/portal/invoices` | Factures, paiements, soldes |
| `/portal/library` | Brochures, fiches techniques destinations, photos haute déf à réutiliser |

### 4.3 Magic-link auth (FastAPI)

```python
@router.post("/portal/login")
def request_link(email: str):
    contact = Contact.query.filter_by(email=email).first()
    if not contact: return {"ok": True}  # ne pas leak qui est inscrit
    token = secrets.token_urlsafe(32)
    PortalSession.create(contact_id=contact.id, token=token, expires_at=now+7d)
    send_email(email, magic_link=f"https://portal.stours.ma/auth?t={token}")
    return {"ok": True}
```

### 4.4 Différenciateurs portail

- **Mode "live tracking"** pendant le voyage : la carte du dossier (TravelDesignerMap) montre la position du bus + photos uploadées par le guide en temps réel
- **Comparaison de versions de devis** côte-à-côte (V1 vs V2 — diff visuel)
- **Co-branding** : l'agence personnalise son portail avec son logo et ses couleurs (le PDF est généré aux couleurs agence)
- **API publique** pour les TO qui veulent intégrer dans leur propre back-office (`/api/v1/partner/*` avec API key dédiée)

---

## 5. QUOTATION SYSTEM — pricing dynamique

### 5.1 Formule générique par ligne de service

```
unit_cost_supplier_currency  = grille fournisseur (saison/chambre/pax)
unit_cost_mad                = unit_cost × FX(supplier_currency → MAD, date_du_jour)
unit_sell_mad                = unit_cost_mad × (1 + markup_pct/100)
line_total_cost_mad          = unit_cost_mad × quantity × pax (selon le type)
line_total_sell_mad          = unit_sell_mad × quantity × pax
line_margin_mad              = line_total_sell_mad − line_total_cost_mad
```

### 5.2 Markup par catégorie (configurable par tenant)

| Service | Markup standard | Min | Max |
|---|---|---|---|
| Hôtels | 18 % | 10 % | 30 % |
| Restaurants | 22 % | 15 % | 35 % |
| Transports | 25 % | 15 % | 40 % |
| Activités | 30 % | 20 % | 50 % |
| Monuments (entrées) | 15 % | 10 % | 20 % |
| Guides | 25 % | 15 % | 35 % |
| Frais agence | + 5 % flat sur le total HT | | |

**Stocké dans** : `companies.pricing_rules` (JSONB) → modifiable par direction.

### 5.3 Marge de projet — 3 vues

```
Marge brute     = Σ line_margin_mad
Marge nette     = Marge brute − frais agence (5 %) − commissions (si paid)
Marge %         = Marge nette / Total sell
```

**Affichage** : dans `/travel-designer` (panneau droit) + sur fiche projet — déjà en place via `BudgetTrackerPage` ✅.

### 5.4 Règles de cohérence (validations server-side)

- ❌ Marge < markup_min → bloquer la sauvegarde + alerte direction
- ⚠️ Marge entre markup_min et markup_standard → warning visuel
- ✅ Marge ≥ markup_standard → OK
- ⚠️ FX > 5 % d'écart vs jour J de réservation → recalcul auto au moment de la confirmation

### 5.5 Yield management (déjà partiellement présent)

- Saisons hautes (avril-mai, sept-oct) : markup +3 pts auto
- Last-minute (<14j) : markup +5 pts (sur services flexibles)
- Pax > 30 : remise auto -2 pts (on accepte de baisser pour fermer le volume)

### 5.6 Devis multi-versions

```
Quote V1 → Quote V2 → Quote V3 (chaque version est immuable, snapshot du Project)
Frontend : `/quotations/:id/compare?v1=1&v2=3` montre le diff (lignes ajoutées/supprimées/modifiées + Δ marge)
```

---

## 6. DASHBOARD & KPI

### 6.1 KPIs commerciaux (CRM)

| KPI | Formule | Cible DMC saine |
|---|---|---|
| **Conversion rate** | won / (won+lost+inquiry_>30d) | > 25 % |
| **Time to first quote** | median(quote_sent_at − inquiry_created_at) | < 24h |
| **Time to win** | median(won_at − inquiry_created_at) | < 14j |
| **Avg deal size** | won_amount / won_count | dépend du tier |
| **Pipeline weighted** | Σ open.amount × probability/100 | trend ↗ |
| **Win rate par source** | won / (won+lost) per `lead_source` | benchmark canaux |
| **Win rate par commercial** | won / (won+lost) per `assigned_user_id` | identifier top performers |
| **NPS** | promoters%−detractors% (collecté J+3 fin de voyage) | > 50 |

### 6.2 KPIs opérationnels

| KPI | Formule |
|---|---|
| Marge moyenne par groupe | Σ margin / count(bookings) |
| Marge % moyenne | médiane(margin_pct) |
| Coût ops moyen / pax / jour | total_cost / pax / nights |
| Délai paiement supplier moyen | median(paid_at − invoice_received_at) |
| % bookings avec incident | count(incidents > 0) / count(bookings) |
| Taux de retour client (LTV) | repeat_customers / total_customers (12 mois) |

### 6.3 KPIs financiers

| KPI | Formule |
|---|---|
| CA mensuel | Σ booking.total_sell WHERE month = M |
| CA par destination | groupby `destinations[0]` |
| DSO (days sales outstanding) | Σ(payment_received − invoice_sent) / count |
| Cash position 30j | predicted income − predicted out |
| Top 10 comptes par CA | Σ won per account |

### 6.4 Implémentation

- Backend : 1 endpoint `/api/dashboard/metrics?view=sales|ops|finance` qui retourne tout en 1 requête (cache Redis 5 min)
- Frontend : `/dashboard` actuel ✅ — ajouter onglets `Ventes` / `Opérations` / `Finance`
- Export CSV / Excel pour direction (déjà en place ✅)

---

## 7. TECH STACK — recommandation finale

### 7.1 À garder (ne pas migrer)

| Couche | Stack RIHLA actuel | Verdict |
|---|---|---|
| Backend | FastAPI + SQLAlchemy + Pydantic V2 | ✅ excellent — garder |
| DB | PostgreSQL (prod) — SQLite (dev) | ✅ garder. Activer JSONB et pg_trgm pour search fuzzy |
| Frontend | React 18 + Vite + TanStack Query + Tailwind | ✅ excellent — garder |
| Auth | JWT multi-tenant via `company_id` | ✅ garder |
| Maps | Leaflet + CartoDB | ✅ garder |
| State | Zustand (existant pour UI) + React Query (server) | ✅ garder |

### 7.2 À ajouter — production-ready

| Besoin | Choix recommandé | Pourquoi pas X |
|---|---|---|
| **Queue / async jobs** | **Celery + Redis** | RQ trop limité; Sidekiq = Ruby |
| **Search global** | **Meilisearch** (self-hosted, 1 conteneur) | Elasticsearch overkill pour le volume |
| **Email transactionnel** | **Postmark** (excellent deliverability) ou **Mailgun** (moins cher) | SendGrid ok mais cher |
| **WhatsApp** | **Twilio WhatsApp** (officiel) | Stub déjà en place — variable env `TWILIO_AUTH_TOKEN` |
| **PDF rendering** | **WeasyPrint** (HTML→PDF, déjà utilisé) | Puppeteer = lourd |
| **File storage** | **S3** ou **Cloudflare R2** (zéro egress fee) | local OK pour dev |
| **Monitoring** | **Sentry** (front + back) | gratuit jusqu'à 5K events/mois |
| **Logs** | **Loki + Grafana** (auto-hosted) ou **Better Stack** | Datadog cher |
| **Analytics produit** | **PostHog** (self-hosted possible) | Mixpanel cher |
| **CDN** | **Cloudflare** (free) | déjà standard |
| **Backup DB** | **pgBackRest** + S3 (PITR) | crucial pour DMC |
| **Secret manager** | **Doppler** ou .env+Vault | jamais de secrets en clair |

### 7.3 Ce qu'il NE faut pas faire

- ❌ **HubSpot** : 600€/mois minimum pour vraies features, lock-in vendor, pas adapté DMC, custom limited
- ❌ **Salesforce** : 1500€/mois, complexité énorme, ROI inexistant pour < 50 commerciaux
- ❌ **Pipedrive** : pas de portail B2B, pas de gestion de produits/services complexes
- ❌ Réécrire en Next.js/Node : surcoût 6 mois zéro valeur
- ❌ Microservices : monolithe FastAPI suffit jusqu'à 10K projets/an

### 7.4 Architecture déploiement

```
[Cloudflare CDN] ─→ [Frontend Vite build sur Vercel/Netlify]
                                │
                                ▼
                        [API api.stours.ma]  ←─ Sentry
                                │              ←─ PostHog
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   [Postgres RDS]        [Redis ElastiCache]     [Celery workers]
   (avec PITR)           (queue + cache)         (3 répliques)
        │                                                │
        ▼                                                ▼
   [S3: docs, voucher PDFs,                     [Cron daily 06:00 UTC :
    photos, backups]                             follow-ups, NPS, alerts]
```

---

## 8. UX & DIFFÉRENCIATION

### 8.1 Speed — performance perçue

- **Skeleton loaders** partout (pas de spinners) — déjà partiellement en place
- **Optimistic UI** sur les mutations (drag deal, complete task) → rollback si erreur API
- **Prefetch** au hover des liens (`<Link>` Tanstack Query prefetch) — économie 200ms/clic
- **TTFB < 100 ms** sur le portail B2B (cache Redis sur dashboards)
- **Recherche instantanée** (debounce 150ms, Meilisearch) — partout, Cmd+K déjà en place ✅

### 8.2 Transparency — confiance

- **Live tracking** carte temps réel pendant le voyage (côté portail B2B)
- **Audit log visible** côté agence : "Devis envoyé le X · ouvert le Y · accepté le Z"
- **Historique versions de devis** (V1/V2/V3 avec diff visuel)
- **Alerte proactive** : si retard vol détecté → email automatique à l'agence avant qu'elle nous appelle (déjà esquissé dans la notif "Mise à jour Vol")
- **NPS publié** sur la home portail : "92 % de nos agences nous recommandent" (avec score live)

### 8.3 Ease of use — agences internationales

- **Multi-langue** : EN / FR / ES / DE (i18n React) — natif dès J0
- **Multi-devise** : tous les prix affichés dans la devise de l'agence + conversion MAD en hover
- **Fuseaux horaires** : toutes les dates sont localisées au TZ de l'agence (pas Africa/Casablanca par défaut)
- **Templates de demande** : "Lune de miel 7j", "MICE 50pax 3j", "Famille 4 pax 10j" → l'agence remplit en 60 secondes
- **WhatsApp natif** : bouton "Reply on WhatsApp" sur chaque email — l'agence n'a rien à apprendre

### 8.4 Différenciateurs killer (ce que les concurrents n'ont PAS)

1. **Carte interactive du dossier** (déjà livrée ✅) — vue globale + jour-par-jour + timeline horaire
2. **Drag-and-drop de l'itinéraire** sur 3 panneaux (catalogue / itinéraire / devis live) — Travel Designer S2-S3
3. **What-If simulator** déjà en place ✅ — "et si on swap Royal Mansour → Mamounia ?" → recalcule le devis en 2 sec
4. **Comparateur de circuits** côte-à-côte
5. **AI Proposal Writer** déjà en place ✅ — l'agence reçoit un mail rédigé en 3 paragraphes avec photos
6. **Scoring fournisseur** déjà en place ✅ — visible à l'agence pour transparence
7. **Carte des groupes en temps réel** ✅ — dashboard direction
8. **Exports unifiés** ✅ — Excel/PDF en 1 clic avec branding agence
9. **Empreinte carbone** par voyage (calculée) ✅ — argument de vente fort en 2026
10. **Connecteur ERP SAP** (S/4HANA + B1) ✅ — pour les TO corporate avec compta intégrée

### 8.5 Onboarding agence — friction zéro

```
J0  : Inscription via formulaire site (email pro + nom agence)
J0+5min : Magic-link reçu → accès portail
J0+5min : Tutoriel interactif (3 étapes, déjà en place ✅)
J1  : Account manager dédié envoie un message WhatsApp de bienvenue
J7  : Premier devis demandé → réponse < 24h garantie
J30 : Premier voyage opéré → review NPS demandée
```

### 8.6 Pricing modèle SaaS (si commercialisation à d'autres DMC)

```
STARTER     0€     1 user, 10 projects/mois, branding RIHLA visible
GROWTH      49€    5 users, 100 projects/mois, white-label, API
SCALE       199€   25 users, illimité, multi-tenant, support prioritaire
ENTERPRISE  custom SSO, SLA 99.9 %, RGPD/ISO27001, ERP connector
```

---

## ANNEXE — Roadmap d'implémentation 12 semaines

| Semaine | Livrable |
|---|---|
| S1 | Tables `restaurants` + `monuments` + jonctions `project_services` |
| S2 | Catalogue panneau gauche Travel Designer (filtres + photos) |
| S3 | Drag-and-drop catalogue → itinéraire → devis live |
| S4 | Pipeline ops Kanban + transitions auto |
| S5 | Engine d'automatisations + 12 règles A1-A12 |
| S6 | Portail B2B `portal.stours.ma` + magic-link + dashboard agence |
| S7 | Portail : devis interactif + upload docs + chat |
| S8 | Yield management + règles markup configurables par tenant |
| S9 | Recherche globale Meilisearch + i18n EN/ES/DE |
| S10 | Live tracking carte temps réel pendant voyage |
| S11 | KPIs avancés (NPS, LTV, time-to-quote) + Sentry + PostHog |
| S12 | Hardening sécurité (audit RGPD, backup PITR, rate limiting) + load test |

---

**Bottom line** : la base RIHLA est déjà à ~80 % du chemin. Les 12 semaines ci-dessus closent le gap pour avoir un produit **vendable à d'autres DMC** au Maroc / Tunisie / Egypte / Jordanie sous licence SaaS — sans toucher à la stack actuelle.
