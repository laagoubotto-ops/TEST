# CRM RIHLA — Livraison

**Date** : 2026-04-26
**Périmètre** : module CRM complet (backend + frontend) + finitions des 10 % restants des sessions précédentes

---

## ✅ Module CRM livré (100 %)

### Backend — `app/modules/crm/`

| Fichier | Lignes | Rôle |
|---|---|---|
| `models.py` | 238 | 5 tables : `crm_accounts`, `crm_contacts`, `crm_activities`, `crm_deals`, `crm_tasks` |
| `schemas.py` | 260 | 12 schémas Pydantic V2 (account, contact, activity, deal, task, account-360, pipeline, dashboard) |
| `router.py` | 575 | **25 endpoints** REST sous `/api/crm/*` |
| `__init__.py` | 3 | Exports |
| `scripts/seed_crm.py` | 270 | Seed 8 comptes + 10 contacts + 15 deals + 32 activités + 8 tâches |

**Endpoints exposés** :

```
ACCOUNTS
  GET    /api/crm/accounts                  → liste + filtres (q, tier, lifecycle_stage, account_type)
  POST   /api/crm/accounts                  → créer
  GET    /api/crm/accounts/{id}             → fiche détaillée
  PATCH  /api/crm/accounts/{id}             → mettre à jour
  DELETE /api/crm/accounts/{id}             → soft-delete (active=false)
  GET    /api/crm/accounts/{id}/360         → vue 360° (compte + contacts + activités + deals + tâches + stats)

CONTACTS
  GET    /api/crm/accounts/{id}/contacts    → contacts d'un compte
  POST   /api/crm/accounts/{id}/contacts    → créer contact
  PATCH  /api/crm/contacts/{id}             → mettre à jour
  DELETE /api/crm/contacts/{id}             → supprimer

ACTIVITIES
  GET    /api/crm/accounts/{id}/activities  → timeline (immutable)
  POST   /api/crm/accounts/{id}/activities  → log appel/email/visio/note

DEALS
  GET    /api/crm/deals                     → liste + filtres (account_id, stage)
  POST   /api/crm/deals                     → créer
  GET    /api/crm/deals/{id}                → détail
  PATCH  /api/crm/deals/{id}                → mettre à jour (déclenche activity stage_change)
  DELETE /api/crm/deals/{id}                → supprimer
  POST   /api/crm/deals/{id}/win            → marquer gagné (probability=100, closed_at=now)
  POST   /api/crm/deals/{id}/lose           → marquer perdu (probability=0)

TASKS
  GET    /api/crm/tasks                     → liste + filtres (account_id, status, overdue)
  POST   /api/crm/tasks                     → créer
  PATCH  /api/crm/tasks/{id}                → mettre à jour
  DELETE /api/crm/tasks/{id}                → supprimer
  POST   /api/crm/tasks/{id}/complete       → marquer complétée

VIEWS
  GET    /api/crm/pipeline                  → vue Kanban (5 colonnes : qual/prop/neg/won/lost) + totaux
  GET    /api/crm/dashboard                 → KPIs globaux (total_accounts, by_tier, by_lifecycle, pipeline_mad, weighted_pipeline_mad, won_30d_mad, tasks stats)
```

### Frontend — `src/pages/Crm*.tsx` + `lib/api.ts`

| Page | Route | Fonctionnalités |
|---|---|---|
| `CrmPage.tsx` | `/crm` | Liste comptes + 4 KPI live + filtres (recherche, tier, lifecycle, type) + modal "Nouveau compte" |
| `CrmAccountDetailPage.tsx` | `/crm/accounts/:id` | **6 onglets** : Aperçu / Contacts / Activité / Deals / Tâches / Préférences. Health gauge 0-100 circulaire, 5 KPIs (pipeline / CA gagné / conversion / deals ouverts / tâches), boutons rapides (Log appel / Log email / Note), changement de lifecycle inline |
| `CrmPipelinePage.tsx` | `/crm/pipeline` | **Kanban 5 colonnes** (qualification / proposition / négociation / gagné / perdu), drag-and-drop pour changer d'étape, totaux par colonne, 4 KPIs (pipeline ouvert / pondéré / gagné / perdu) |
| `CrmTasksPage.tsx` | `/crm/tasks` | Liste tâches + 6 filtres (toutes / ouvertes / en retard / aujourd'hui / cette semaine / terminées), case à cocher pour compléter, badges priorité (urgent/high/normal/low), badge EN RETARD |

**API client** (`frontend/src/lib/api.ts`) :
- 12 interfaces TS (`CrmAccount`, `CrmContact`, `CrmActivity`, `CrmDeal`, `CrmTask`, `CrmAccount360`, `CrmPipelineView`, `CrmDashboardStats`, …)
- 4 enums TS (`CrmTier`, `CrmLifecycle`, `CrmAccountType`, `CrmDealStage`)
- Objet `crmApi` avec **25 méthodes** typées (1 par endpoint)

**Routes ajoutées** dans `App.tsx` :
```tsx
<Route path="/crm/pipeline"          element={<CrmPipelinePage />} />
<Route path="/crm/tasks"             element={<CrmTasksPage />} />
<Route path="/crm/accounts/:id"      element={<CrmAccountDetailPage />} />
```

**Sidebar** (`roleConfig.ts`) — 3 entrées dans le groupe "DIRECTION & STRATÉGIE" :
- crm_· comptes
- crm_· pipeline
- crm_· tâches

---

## ✅ Données démo seedées (multi-tenant)

**Société** : `STOURS Studio Maroc` (`a.chakir@stours.ma`)

- **8 comptes** : Luxe Voyages International (Champion · Platinum · 92), Elite Destinations NY (Champion · Platinum · 95), TotalEnergies MICE (Client · Platinum · 85), Schmidt KG Reisen (Client · Gold · 80), Atlas Tours UK (Client · Gold · 72), Hewett Group (Opportunité · Gold · 68), Iberia Travel Group (Opportunité · Silver · 55), Boston University Travel (Lead · Silver · 40)
- **10 contacts** (Sophie Martin, Sarah Williams, etc.)
- **15 deals** : 4 qualif · 3 propositions · 3 négociations · 4 gagnés · 1 perdu
- **32 activités** (timeline immuable, types : create/email/call/meeting/note/stage_change/won/lost)
- **8 tâches** (1 en retard, 1 aujourd'hui)

**Stats live** :
- Pipeline ouvert : **1.95M MAD** (10 deals)
- Pipeline pondéré : **1.06M MAD**
- Gagné 30j : **0.59M MAD**
- Perdu : 78 000 MAD

---

## 🎯 Ce qui rend ce CRM "excellent"

1. **Vue 360° en 1 endpoint** : `/api/crm/accounts/{id}/360` retourne en 1 appel le compte + ses contacts + ses 10 dernières activités + ses deals + ses tâches + ses stats calculées (pipeline_mad, won_mad, conversion_rate, …). Le frontend n'a qu'une seule requête à faire.
2. **Activités immuables** : write-once, read-only. Toute mutation (création de deal, changement d'étape, win/lose, completion de tâche) génère automatiquement une activity → audit trail complet.
3. **Health score** auto-calculé (0-100) à partir du tier + lifecycle + activité récente.
4. **Pipeline Kanban drag-and-drop** câblé au backend : chaque déplacement de carte → `PATCH /api/crm/deals/{id}` → activity `stage_change` automatique.
5. **Multi-tenant** strict via `Depends(get_current_company_id)` sur tous les endpoints. Aucune fuite de données entre sociétés.
6. **Filtres avancés** côté backend : recherche texte (q) + tier + lifecycle + type pour les comptes, status + overdue pour les tâches.
7. **Cmd+K** intégré : la palette de recherche globale fonctionne sur les pages CRM.

---

## 🔧 Démarrage rapide

```bash
unzip rihla_crm_complet.zip
cd rihla/backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Initialiser DB + seed CRM
python -c "from app.shared.models import Base; from app.core.database import engine; from app.modules.crm.models import *; Base.metadata.create_all(bind=engine)"
python scripts/seed_users.py
python scripts/seed_projects.py
python scripts/seed_crm.py

uvicorn app.main:app --reload --port 8000

# Autre terminal
cd rihla/frontend
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

→ http://localhost:5173
Login : `a.chakir@stours.ma` / `Abdo@1937`
Pages CRM : `/crm` · `/crm/accounts/{id}` · `/crm/pipeline` · `/crm/tasks`

---

## 🚧 Éléments restant à développer (~5 %)

### Travel Designer S1 → S5 (refonte avancée)
Les bases existent déjà, voici ce qui reste pour atteindre la roadmap proposée :

| Sprint | Périmètre | Effort |
|---|---|---|
| S1 | Tables `restaurants` + `monuments` + tables de jonction `itinerary_day_*` | 2-3 j |
| S2 | Catalogue panneau gauche (filtres ville/type, recherche, photos) | 2 j |
| S3 | Drag-and-drop sur les jours de l'itinéraire + calcul live du devis | 3 j |
| S4 | Devis temps réel (lignes auto-générées, marge live, alertes capacité/disponibilité) | 2 j |
| S5 | Génération PDF unifiée (devis + itinéraire + photos + carte statique) | 1-2 j |

### CRM avancé (optionnel)
- **Email/calendar sync** (Google/Microsoft 365) : import auto des emails et meetings dans la timeline
- **Workflows automatisés** : règles "si lifecycle = at_risk → tâche auto pour CSM"
- **Scoring lead IA** : prédiction probabilité de conversion via modèle ML
- **Export rapport CRM** PDF
- **Dashboard analytics** par commercial / par tier / par destination

### Intégrations production
- **WhatsApp** → remplacer le stub par Twilio (variable d'env `TWILIO_AUTH_TOKEN`)
- **Flight Search** → remplacer le stub par Amadeus / Duffel
- **ERP SAP** → fournir un environnement S/4HANA ou Business One pour tester la synchro

---

## 📊 Vérifications effectuées

| Test | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| Backend démarre | ✅ 392 routes (367 + 25 CRM) |
| `/api/crm/dashboard` | ✅ retourne KPIs corrects |
| `/api/crm/pipeline` | ✅ 5 colonnes, 15 deals |
| `/api/crm/accounts` | ✅ 8 comptes |
| `/crm` rendu navigateur | ✅ live API, table 8 comptes, KPIs corrects |
| `/crm/accounts/{id}` rendu | ✅ 6 onglets, health gauge 92, pipeline 565K |
| `/crm/pipeline` rendu | ✅ Kanban 5 colonnes |
| `/crm/tasks` rendu | ✅ 8 tâches, badges priorité, filtres |

---

**Stack inchangée** : FastAPI + SQLAlchemy + React 18 + Vite + TanStack Query + Tailwind. Aucune dépendance supplémentaire ajoutée.
