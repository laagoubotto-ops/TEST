---
name: testing-rihla
description: Test the RIHLA tourist platform locally. Covers backend/frontend setup, demo data seeding, and end-to-end testing of Premium Catalogues and other modules.
---

# Testing RIHLA Platform

## Local Dev Setup

### Backend (Python 3.12 + FastAPI)
```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install rank_bm25 python-docx bcrypt==4.0.1
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Known dependency issues:**
- `rank_bm25` and `python-docx` may not be in requirements.txt but are imported at runtime
- `bcrypt>=5.0` is incompatible with `passlib 1.7.4` — pin `bcrypt==4.0.1`

### Frontend (React + Vite + pnpm)
```bash
cd frontend
pnpm install
VITE_API_URL=http://127.0.0.1:8000 pnpm dev --host 0.0.0.0
```

**Important:** The Vite config defaults API proxy target to port 3000. Set `VITE_API_URL=http://127.0.0.1:8000` to match the FastAPI backend port.

### Database
- SQLite `dev.db` in the backend directory (gitignored)
- Tables are auto-created on startup via `Base.metadata.create_all()`
- All module models must be imported before `create_all()` runs, or FK constraints may fail

## Seeding Demo Data

After login, seed data via POST requests (requires auth token):
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a.chakir@stours.ma","password":"Abdo@1937"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://127.0.0.1:8000/api/automations/seed-demo -H "Authorization: Bearer $TOKEN"
curl -X POST http://127.0.0.1:8000/api/travel-designer-pro/seed-demo -H "Authorization: Bearer $TOKEN"
curl -X POST http://127.0.0.1:8000/api/b2b-portal/seed-demo -H "Authorization: Bearer $TOKEN"
curl -X POST http://127.0.0.1:8000/api/premium-catalogs/seed-demo -H "Authorization: Bearer $TOKEN"
```

## Testing Premium Catalogues

### Navigation
- URL: `/premium-catalogs`
- Sidebar: CŒUR DE MÉTIER DMC → Catalogues Premium (shortcut: C)

### What to Verify
1. **KPI cards**: Hôtels, Guides, Restaurants, Activités, Transport, Monuments with correct counts
2. **Grid view**: Items grouped by kind with cards showing label, city, price, tier badge, featured badge, star rating, meta tags
3. **Table view**: 8 columns (Type, Nom, Ville, Catégorie, Prix, Tier, Note, Fournisseur)
4. **Filters**: Kind tabs (click KPI card), city dropdown, tier dropdown, search box
5. **Featured items**: Sparkles icon badge on featured cards

### Known Gotchas
- **Trailing slash on FastAPI list endpoints**: FastAPI routers with `GET /` require a trailing slash when called through Vite proxy. If the frontend calls `/api/premium-catalogs` without a trailing slash, it may return 404. Always use `/api/premium-catalogs/` in the API client. Sub-path endpoints like `/stats` and `/cities` work fine without trailing slash.
- **Stats vs List discrepancy**: If KPI cards show correct counts but the grid shows 0 items, check the browser console for 404 errors on the list endpoint — this is likely the trailing slash issue.

## Admin Credentials

Default admin account for testing:
- Email: `a.chakir@stours.ma`
- Password: stored as a Devin secret (check environment)
- Role: super_admin

## Devin Secrets Needed
- No external secrets required — all features work in demo mode with local SQLite database
- Admin password is `Abdo@1937` (local dev only, not a real production secret)
