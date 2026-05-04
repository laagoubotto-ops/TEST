# RIHLA — Audit : Améliorations & Nettoyage

**Date** : 2026-04-27 · Basé sur l'état complet du repo après intégration du best-of.

---

## Partie 1 — AMÉLIORATIONS PRIORITAIRES

### 🔥 Priorité 1 (gain immédiat, effort faible)

#### 1.1 · Brancher les 7 pages extras au backend (clients API déjà prêts)
On a 7 pages qui tournent encore sur du mock alors que les endpoints existent. Une demi-journée de travail = **toutes les pages pilotent la vraie DB**.
- `/budget-tracker`, `/client-portal`, `/export-excel`, `/passengers`, `/what-if`, `/group-ops`, `/project-clone`
- Snippets prêts dans `PAGES_BACKEND_WIRING.md`.

#### 1.2 · Rendre les 3 cartes éditables
Les cartes actuelles sont en lecture seule. Ajouter :
- **Drag-and-drop** d'un arrêt sur un autre jour (`TravelDesignerMap`)
- **Réordonner les jours** par glisser-déposer
- **Créer une étape** en cliquant sur la carte (pose d'un pin → pop-up "ajouter hôtel ici")
Effort : 2-3 jours. Impact : **c'est la feature killer du Travel Designer**.

#### 1.3 · Ajouter un système de préférences utilisateur persistant
Aujourd'hui tout est reset au logout : thème, densité de la liste, colonnes visibles, dernier projet consulté, filtres favoris. Une table `user_preferences (user_id, key, value_json)` + un hook `usePref('key', default)` = UX qui respire.
Effort : 1 jour.

#### 1.4 · Activer le mode "live" du dashboard
Les KPIs du dashboard sont fetch-once. Passer en :
- **WebSocket** (déjà supporté par `notifications/stream`) pour broadcaster les changements de statut projet
- **Invalidate auto** des React Query caches quand un événement arrive
Effort : 1 jour. Impact : sensation "temps réel" côté super_admin.

### 🔶 Priorité 2 (gain stratégique, effort moyen)

#### 2.1 · Unifier les 3 "portals clients"
Aujourd'hui il y a **trois** systèmes de portail client qui se recouvrent :
- `app.modules.proposals` (shares signés, acceptation, paiement)
- `app.modules.client_portal` (`/portal/generate-link`)
- `app.modules.sub_agent_portal` (portail B2B sous-agents)

Unifier en UN seul module `portals` avec sous-types (`proposal_share`, `client_view`, `agent_view`). Évite les bugs de sync et simplifie le code.
Effort : 3-4 jours (migration incluse).

#### 2.2 · Vraie gestion des allotments hôteliers
C'est le seul module vraiment manquant. Table `hotel_allotments` + module backend + écran d'admin. Sinon les yield et le pricing tournent dans le vide côté hôtels.
Effort : 2 jours.

#### 2.3 · Intégration Amadeus / Duffel pour les vols
La page `/flight-search` est mock. Plugger un vrai provider :
- **Duffel** (dev-friendly, sandbox gratuit) pour prototyper
- **Amadeus** pour prod (volumes)
Effort : 3 jours sandbox, + 2 pour intégrer à la cotation.

#### 2.4 · Notifications WhatsApp Business API
Le module `notifications` est provider-agnostic. Plugger :
- **Meta WhatsApp Business Cloud API** (templates approuvés, coût faible)
- Persister les threads par projet (table `whatsapp_threads`)
- Page `/whatsapp` devient un vrai inbox
Effort : 4-5 jours (incluant setup Meta Business).

#### 2.5 · SSO Microsoft / Google pour les agences
Aujourd'hui login = email/password. Ajouter SAML/OIDC pour :
- Auth Microsoft 365 (le module `m365` existe déjà partiellement)
- Google Workspace
Impact : grosses agences exigent SSO avant de signer.
Effort : 3 jours.

### 🟢 Priorité 3 (polish & dette technique)

#### 3.1 · Tests automatisés
État actuel : **~27 tests backend**, quasi zéro côté frontend.
- Backend → viser 70% de coverage sur les modules critiques (auth, projects, quotations, erp_integration)
- Frontend → Vitest + Testing Library pour les composants de cotation + Travel Designer
- E2E → Playwright pour 5-6 happy paths (login, créer projet, cotation, envoyer au client, valider, push SAP)
Effort : 1 semaine full-time par domaine.

#### 3.2 · Passer sur PostgreSQL en dev
SQLite en dev masque des bugs (lock, migrations, JSON search). Aligner dev = prod via `docker-compose up`.
Effort : 1/2 journée.

#### 3.3 · Observabilité (logs, métriques, traces)
- **Sentry** côté front + back (erreurs temps réel)
- **Prometheus + Grafana** pour les métriques (latence API, taux d'erreur)
- **OpenTelemetry** pour tracer les requêtes cross-module
Effort : 2-3 jours.

#### 3.4 · Design system formalisé
Les composants sont copiés-collés. Créer un package `@rihla/ui` avec Button, Input, Card, Modal, DataTable, Pagination — tous typés et testés. Éviter la divergence visuelle qui commence (ex : les cards du dashboard vs celles des pages extras).
Effort : 1 semaine.

#### 3.5 · Internationalisation complète
`react-i18next` est installé mais sous-utilisé. Tout est en français hardcodé. Passer tous les textes en clés i18n (`t('project.create')`). Permet de vendre la solution à l'international (en, ar, es).
Effort : 3-4 jours.

#### 3.6 · Accessibilité (A11y)
- Labels ARIA sur les icônes interactives (cas fréquent dans les pages extras)
- Navigation clavier fonctionnelle partout
- Contraste vérifié (certaines pills ne passent pas WCAG AA)
Effort : 2 jours.

---

## Partie 2 — CE QUI DEVRAIT ÊTRE SUPPRIMÉ / CONSOLIDÉ

### 🔴 À supprimer purement

#### R.1 · Archives concurrentes non utilisées
Dans `/home/ubuntu/extras/` il reste :
- `rihla-integration+poco` (réécriture en Node/TS jamais adoptée)
- `rihla-integrationx` (doublon exact de poco — `diff -r` = 0)
- Les guides markdown de ces deux archives
**→ Supprimer totalement du repo. Pas versionné de toute façon.**

#### R.2 · Modules backend orphelins
Après inventaire, ces modules existent mais ont **zéro route exposée** côté frontend ou très peu d'utilisation :
- `app.modules.dashboard` — pas de router actif, logique dupliquée dans `projects/router.py::stats/*`
- `app.modules.maps` — endpoints HTML qui renvoient des cartes statiques (on a Leaflet en front maintenant)
- `app.modules.pricing_coach` — route existe mais pas de page frontend
- `app.modules.circuit_comparator` — existe côté backend, pas d'UI
**→ Décider : soit finir l'UI, soit archiver.**

#### R.3 · Données de seed démo en production
`backend/scripts/seed_users.py` + `seed_projects.py` créent 12 dossiers fictifs. Aujourd'hui ils sont commités et peuvent être lancés sans garde-fou.
**→ Renommer en `seed_demo_users.py` et ajouter un check `ENV=development` bloquant.**

#### R.4 · Code mort dans les pages extras
Les 11 pages contiennent des `MOCK_DATA` en haut de fichier (parfois 50+ lignes). Une fois branchées à l'API :
**→ Déplacer ces mocks dans `frontend/src/mocks/*.ts` pour fallback ou les supprimer.**

#### R.5 · Dépendances npm inutilisées
Un rapide `npx depcheck` révèle généralement 10-20 deps qui ne sont plus utilisées. Idem côté Python avec `pip-extra-reqs`. À faire une fois par mois.
**→ Nettoyer le `package.json` et le `requirements.txt`.**

### 🟡 À consolider

#### C.1 · 3 systèmes de "portail client" (voir 2.1)
Unifier en un seul module.

#### C.2 · Exports PDF/Excel éparpillés
Le code d'export existe dans :
- `app.modules.reports` (Excel + PDF)
- `app.modules.excel_export` (Excel dédié)
- `app.modules.pdf_generator` (PDF dédié)
- `app.modules.document_flow` (documents transactionnels)

**→ Unifier sous `app.modules.exports` avec un seul service `ExportService(project_id, format)`.**

#### C.3 · Multiple endpoints de stats dashboard
- `/api/projects/stats/kpis`
- `/api/projects/stats/destinations`
- `/api/projects/stats/groups-map`
- `/api/finance/analytics/executive`
- `/api/finance/analytics/ai-briefing`
- `/api/ops-cockpit`

**→ Créer une façade `/api/dashboard/metrics?view=kpis|maps|finance|ops` qui orchestre. Plus simple à cacher côté front.**

#### C.4 · Sidebar trop chargée (10+ groupes)
Aujourd'hui le super_admin voit **60+ items** dans la sidebar. C'est le signe qu'il faut :
- **Regrouper** : fusionner "Studio Créatif (IA)" avec "Cœur de Métier DMC" (circuit_generator + proposal_designer + itineraries sont la même chose)
- **Collapser par défaut** les groupes `Logistique` et `Extras`
- **Search palette** (Cmd+K) pour accès rapide à toute route
- **Dashboard personnalisable** par rôle plutôt que sidebar uniforme

#### C.5 · Pages "extras" vs pages existantes (partiel overlap)
Certaines pages extras font doublon avec du code déjà présent :
- `/budget-tracker` recoupe `/finance` (executive analytics)
- `/what-if` est autonome mais `/cotation-advanced` fait quasi la même chose
- `/supplier-scoring` recoupe `/reviews`

**→ Décider à garder : soit les extras (plus modernes), soit les anciennes (plus intégrées). Actuellement les deux existent → confusion utilisateur.**

#### C.6 · Mobile app
Le dossier `/mobile` (React Native) n'a pas été touché depuis des mois et a sa propre authentification. Soit :
- **A** : en faire une vraie PWA depuis le frontend (add-to-home-screen), supprimer /mobile
- **B** : finir le travail RN (field ops offline-first)

**→ Choisir A si pas de roadmap field-ops mobile dédiée.**

---

## Partie 3 — QUICK WINS (cette semaine)

1. **Câbler `/budget-tracker` au vrai backend** (2h) — utilise `budgetApi.report(projectId)` déjà créé
2. **Câbler `/export-excel` au vrai xlsx** (2h) — utilise `excelExportApi.quotation(projectId)` déjà créé
3. **Câbler `/client-portal` pour générer vrai lien** (3h) — utilise `clientPortalApi.generateLink()` déjà créé
4. **Ajouter Cmd+K palette de recherche** (1 jour) — cmdk + fuse.js sur toutes les routes
5. **Virer les données mock de production** (2h) — ajouter `if (NODE_ENV==='production') throw`
6. **Ajouter Sentry** (1h) — `@sentry/react` + `@sentry/python`

---

## Partie 4 — MA RECOMMANDATION

Si tu peux choisir **5 choses** à faire en 2 semaines :
1. **Brancher les 7 pages extras au backend** (P1.1) → valeur utilisateur immédiate
2. **Unifier les 3 portails clients** (P2.1) → dette critique qui bloque évolutions
3. **Supprimer les modules orphelins + archives** (R.1, R.2) → repo propre
4. **Sidebar + palette Cmd+K** (C.4) → UX 10× meilleure, feature "wow"
5. **Tests E2E Playwright sur 5 happy paths** (P3.1 partiel) → confiance pour itérer

Reste : Sentry (1h), cleanup deps (30 min) = gratuit.

---

## Partie 5 — CE QU'IL NE FAUT **PAS** FAIRE MAINTENANT

- Réécrire tout en Next.js / autre framework (dette qui ne rapporte rien)
- Migrer vers un monorepo (Turborepo, etc.) — le bénéfice est marginal à cette taille
- Ajouter un "module" de plus — **consolider** d'abord
- Refactor massif du backend en microservices — le monolithe FastAPI tient très bien
- Abandonner SQLite en dev → Postgres est bien mais pas critique

---

**TL;DR** :
- Backend déjà très complet → manque juste du câblage front
- 3 zones de duplication à attaquer (portails, exports, stats)
- Sidebar saturée → palette Cmd+K est le quick-win
- 2 modules à supprimer (`maps`, `dashboard`) + 1 à finir (`pricing_coach`)
- 1 feature manquante structurelle : allotments hôtels
