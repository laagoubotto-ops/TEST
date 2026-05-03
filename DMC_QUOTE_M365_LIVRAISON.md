# Livraison DMC Quote + M365 + Workflow complet

## Nouveautés depuis la précédente livraison

### 1. Workflow DMC Quote (5 nouveaux endpoints)

```
POST /api/dmc-quotes/{id}/send       — envoi devis (M365 Mail.Send) + DOCX/XLSX en pièce jointe
POST /api/dmc-quotes/{id}/accept     — accepte le devis → auto-création Project (status=WON) + lien CRM
POST /api/dmc-quotes/{id}/reject     — refuse avec raison optionnelle
POST /api/dmc-quotes/{id}/clone      — clone V1 (lockée) → V2 modifiable
GET  /api/dmc-quotes/{id}/versions   — chaîne de versions (V1 → V2 → V3…)
```

### 2. Modèle DmcQuote enrichi (7 nouveaux champs)

| Champ | Type | Rôle |
|---|---|---|
| `sent_to_email` | str | Dernier destinataire |
| `sent_message_id` | str | ID message M365 (pour tracking) |
| `parent_quote_id` | FK → dmc_quotes | Pour la chaîne de versionning |
| `version` | int | V1, V2, V3… |
| `is_locked` | bool | Immuable après envoi/clone |
| `project_id` | str | Lien vers Project créé automatiquement |
| `accepted_at` | datetime | Horodatage acceptation |

### 3. Workflow visible dans l'UI `/dmc-quotes/{id}`

- Bandeau **Workflow & Versionning** : badge statut, version, verrou
- 4 boutons d'action : **Envoyer (M365)** · **Accepter (→ Project Won)** · **Refuser** · **Cloner V+1**
- Modal d'envoi : destinataires, CC, sujet, message libre, cases à cocher pour les pièces jointes
- Tableau de la chaîne de versions avec lien "Ouvrir" sur chaque V

### 4. Intégrations transparentes

- **M365** : si une connexion existe pour l'utilisateur en mode demo → `{status:simulated, message_id:demo-out-…}`. Si connexion live (Azure AD configuré) → `{status:queued_live}`. Sinon → `{status:no_m365_connection}`. **Aucune erreur ne bloque le workflow** : le devis passe en statut "sent" même si l'envoi M365 échoue (avec log CRM).
- **CRM** : chaque action (envoi/acceptation/refus) crée une `crm_activity` immuable sur l'account lié (`type=proposal_sent|won|lost`).
- **Projects** : lors de `accept`, si un `account_id` est lié au devis et qu'aucun project n'existe encore, **création automatique** d'un `Project(status=WON)` avec référence = code du devis.

## Smoke tests (passés)

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a.chakir@stours.ma","password":"Abdo@1937"}' | jq -r .access_token)

# 2. Récupérer le devis seedé
QID=$(curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/dmc-quotes | jq -r '.[0].id')

# 3. Envoyer
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"to":["client@example.com"],"attach_docx":true,"attach_xlsx":true}' \
  http://127.0.0.1:8000/api/dmc-quotes/$QID/send
# → {"ok":true,"status":"sent","send":{"status":"no_m365_connection"|"simulated"},"attachments":[…]}

# 4. Cloner (V1 sera lockée → V2 créée)
curl -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/dmc-quotes/$QID/clone
# → {…,"version":2,"parent_quote_id":"<v1-id>","status":"draft","is_locked":false,"days":[…9 days…]}

# 5. Accepter V1 → crée Project Won automatiquement
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{}' http://127.0.0.1:8000/api/dmc-quotes/$QID/accept
# → {"status":"accepted","accepted_at":"…","project_id":"<new-uuid>","is_locked":true}

# 6. Voir la chaîne complète
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/dmc-quotes/$QID/versions
# → [{V1 accepted locked}, {V2 draft}]
```

## Démarrage

```bash
unzip rihla_dmc_workflow_complet.zip && cd rihla/backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -c "import app.main; from app.shared.models import Base; from app.core.database import engine; Base.metadata.create_all(bind=engine)"
python scripts/seed_users.py && python scripts/seed_projects.py && python scripts/seed_crm.py && python scripts/seed_dmc_quote.py
uvicorn app.main:app --reload --port 8000

# autre terminal
cd ../frontend && npm install && VITE_API_URL=http://127.0.0.1:8000 npm run dev
```
Login : `a.chakir@stours.ma` / `Abdo@1937`

## Vérifications

- Backend : 410 routes chargées sans erreur
- TS compile : `npx tsc --noEmit` → 0 erreur
- `npm run build` → OK (2822 modules)
- 5 nouveaux endpoints DMC Quote testés en live (send, accept, clone, reject, versions)
- DOCX program (40 KB) + XLSX quote (7.4 KB) générés conformes au format YS Travel

## Reste à faire

| Module | Effort | Priorité |
|---|---|---|
| **M365 live** : ajouter `MS_CLIENT_ID/TENANT_ID/CLIENT_SECRET` dans `.env` + tester OAuth réel + vrai envoi mail Graph | 1-2j | Haute (dès Azure AD configuré) |
| **Édition inline** monuments_json/activities_json (modal détaillé par jour pour ajouter/supprimer monument avec entrance_fee) | 1j | Moyenne |
| Account picker dans la création de devis (rattacher quote à un compte CRM dès création) | 0.5j | Moyenne |
| **Travel Designer S1-S5** drag-and-drop catalogue → itinéraire | 5-8j | Moyenne |
| **Engine d'automatisations** A1-A12 (auto-réponse <1min, follow-ups J+2/J+5, NPS J+3, etc.) | 3-4j | Haute |
| **Portail B2B** `portal.stours.ma` (magic-link, devis interactif, live tracking) | 8-10j | Haute |

Voir <ref_file file="/home/ubuntu/rihla/RIHLA_DMC_BLUEPRINT.md" /> pour la roadmap 12 semaines complète.
