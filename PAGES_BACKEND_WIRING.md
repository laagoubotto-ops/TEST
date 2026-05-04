# Guide de Câblage Backend des 11 Pages Extras

> **Bonne nouvelle** : en vérifiant le repo, **la plupart des endpoints existent déjà** (modules LINAPRESS intégrés précédemment). Ce guide liste, page par page, l'endpoint exact et le client `lib/api.ts` à utiliser.

## Légende
- ✅ **WIRED** : déjà branchée à l'API backend dans le code livré.
- 🔌 **READY** : endpoint backend existe + client ajouté à `lib/api.ts`, front à brancher (snippet ci-dessous).
- 🆕 **NEW** : nécessite création d'un endpoint backend minimal.

---

## 1. `/projects/clone` — Dupliquer Projet ✅ WIRED

- Endpoint : `POST /api/projects/{id}/clone`
- Client : `projectsApi.clone(id, payload)` dans `lib/api.ts`
- Fichier modifié : `pages/ProjectClonePage.tsx` → `handleClone()` appelle la vraie API.

---

## 2. `/supplier-scoring` — Scoring Fournisseurs ✅ WIRED

- Endpoint : `GET /api/supplier-scores`
- Client : `supplierScoresApi.list()` (dans `lib/api.ts`)
- Mapping : `SupplierScoringPage.tsx` récupère les scores live et les **mappe** à la forme UI (fallback mock si vide).

---

## 3. `/what-if` — Simulation What-If 🔌 READY

- Endpoint : `POST /api/whatif/simulate` (+ `/hotel-swap`, `/margin-adjust`, `/meal-swap`)
- Client : **`whatIfApi.simulate(body)`** — déjà ajouté à `lib/api.ts`

Snippet :
```tsx
import { whatIfApi } from '@/lib/api'
import { useMutation } from '@tanstack/react-query'

const sim = useMutation({
  mutationFn: (body: any) => whatIfApi.simulate(body).then(r => r.data),
})

// Remplacer le calcul local par :
<button onClick={() => sim.mutate({
  project_id: currentProjectId,
  margin_override: margin / 100,
  pax_override: pax,
})}>
```

---

## 4. `/export-excel` — Export Excel Cotation 🔌 READY

- Endpoint : `GET /api/export/quotation/{project_id}` (+ `/quotation-csv/{id}`)
- Client : **`excelExportApi.quotation(projectId)`** — déjà ajouté à `lib/api.ts`

Snippet :
```tsx
import { excelExportApi } from '@/lib/api'

const handleRealExport = async () => {
  const res = await excelExportApi.quotation(currentProjectId)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a'); a.href = url
  a.download = `cotation_${currentProjectId}.xlsx`; a.click()
  URL.revokeObjectURL(url)
}
```

---

## 5. `/client-portal` — Portail Client Interactif 🔌 READY

- Endpoint : `POST /api/portal/generate-link` + `GET /api/portal/status/{id}` + `GET /api/portal/comments/{id}`
- Client : **`clientPortalApi.generateLink / status / comments`** — déjà ajouté
- Alternative : `proposalsApi.createShare(projectId, {...})` si tu veux le workflow "proposals" complet (avec signature électronique / paiement).

Snippet :
```tsx
import { clientPortalApi } from '@/lib/api'

const share = await clientPortalApi.generateLink(projectId, { expires_days: 30 })
const publicUrl = share.data.portal_url  // copier dans le presse-papier
```

---

## 6. `/budget-tracker` — Budget Tracker 🔌 READY

- Endpoint : `GET /api/budget/{project_id}/report` + `POST /api/budget/{id}/actuals` + `GET /api/budget/trends`
- Client : **`budgetApi.report / actuals / trends`** — déjà ajouté

Snippet :
```tsx
import { budgetApi } from '@/lib/api'

const { data: report } = useQuery({
  queryKey: ['budget-report', projectId],
  queryFn: () => budgetApi.report(projectId).then(r => r.data),
})
// report = { quoted, actual, variance, by_category: [...] }
```

---

## 7. `/passengers` — Gestion Passagers 🔌 READY

- Endpoint : `GET /api/passengers/{project_id}` + `POST /add` + `PUT /` + `DELETE /{pid}` + `GET /stats`
- Stocké dans `project.pax_profiles` (JSON) — pas de migration.
- Client : **`passengersApi.list / add / save / remove / stats / exportRooming`** — déjà ajouté

Snippet :
```tsx
import { passengersApi } from '@/lib/api'

const { data: pax } = useQuery({
  queryKey: ['passengers', projectId],
  queryFn: () => passengersApi.list(projectId).then(r => r.data),
})
// pax = { passengers: [...], expected_pax, registered_pax, completion_pct }
```

---

## 8. `/allotments` — Allotments Hôtels 🆕 NEW (backend absent)

Le backend n'a pas de table `allotments` dédiée. Options :
- **A** (rapide) : persister dans `localStorage` côté front.
- **B** (propre) : migration Alembic `0021_allotments.py` + module `backend/app/modules/allotments/`.

---

## 9. `/whatsapp` — WhatsApp Hub 🆕 partiel

Le module `notifications` gère un provider pluggable, mais **pas** d'endpoint WhatsApp dédié ni d'historique de thread. À créer :
```python
# backend/app/modules/whatsapp/router.py
@router.post("/send")  # body: {project_id, recipient, text}
@router.get("/threads/{project_id}")  # list messages
```

---

## 10. `/flight-search` — Recherche de Vols 🆕 NEW

Aucun endpoint n'existe. Créer un endpoint minimal, initialement avec des résultats mock, puis plugger un provider (Amadeus / Duffel / Skyscanner).

---

## 11. `/group-ops` — Coordination Groupe 🔌 READY

- Endpoints : `GET /api/field-ops/tasks?project_id={id}` + `POST /api/field-ops/incidents` + `GET /api/projects/{id}`
- Client : **`fieldOpsApi.tasks / patchStatus / incidents / voucher`** — déjà ajouté

---

## Ordre de câblage recommandé (priorité)

1. **`/budget-tracker`** — endpoint prêt, gros impact visuel (vrai CA).
2. **`/client-portal`** — génère un **vrai** lien partageable.
3. **`/export-excel`** — vrai xlsx téléchargeable.
4. **`/passengers`** — module très complet côté backend.
5. **`/group-ops`** — field-ops tasks déjà en prod.
6. **`/what-if`** — simulation serveur.
7. **`/whatsapp`**, **`/flight-search`**, **`/allotments`** — nécessitent du backend neuf.

---

## Clients API ajoutés (prêts à l'emploi)

Tous dans `frontend/src/lib/api.ts` :
- `passengersApi`, `budgetApi`, `excelExportApi`, `clientPortalApi`, `whatIfApi`, `supplierScoresApi`, `fieldOpsApi`
- `projectsApi.clone(id, payload)`
- `erpApi.*` (SAP)

**Convention** : garde toujours le **fallback mock** (`apiData.length > 0 ? apiData : MOCK`) pour que les pages restent démoables sur un environnement vierge. Pattern appliqué sur `ProjectClonePage` et `SupplierScoringPage`.
