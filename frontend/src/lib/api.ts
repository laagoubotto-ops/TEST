import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',  // Ensure GZip negotiation
  },
  timeout: 30_000,  // 30s global timeout
})

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stours_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 → try silent refresh, then redirect to login
let _isRefreshing = false
let _pendingQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function _drainQueue(token: string | null, error: unknown) {
  _pendingQueue.forEach(p => token ? p.resolve(token) : p.reject(error))
  _pendingQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err)
    }

    // Avoid infinite loop on the refresh endpoint itself
    if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')) {
      localStorage.removeItem('stours_token')
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      window.location.href = '/login'
      return Promise.reject(err)
    }

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _pendingQueue.push({
          resolve: (token) => { original.headers.Authorization = `Bearer ${token}`; resolve(api(original)) },
          reject,
        })
      })
    }

    original._retry = true
    _isRefreshing = true

    try {
      const { useAuthStore } = await import('@/stores/authStore')
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) throw new Error('no_refresh_token')

      const { data } = await api.post<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { refresh_token: refreshToken },
      )
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
      _drainQueue(data.access_token, null)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (refreshErr) {
      _drainQueue(null, refreshErr)
      localStorage.removeItem('stours_token')
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      _isRefreshing = false
    }
  }
)

// ── Auth ──────────────────────────────────────────────────────────
export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  role?: string
}

export const authApi = {
  login:    (email: string, password: string) =>
    api.post<{ access_token: string; token_type: string; refresh_token?: string }>('/auth/login', { email, password }),
  me:       () => api.get('/auth/me'),
  register: (data: RegisterPayload) => api.post('/auth/register', data),
}

// ── Projects ──────────────────────────────────────────────────────
export interface ProjectListParams {
  limit?: number
  skip?: number
  offset?: number
  sort?: string
  order?: 'asc' | 'desc'
  status?: string
  search?: string
  project_type?: string
}
export interface ProjectPayload {
  name: string
  client_name: string
  destination?: string
  start_date?: string
  end_date?: string
  pax?: number
  notes?: string
}

export const projectsApi = {
  list:    (params?: ProjectListParams) => api.get('/projects/', { params }),
  get:     (id: string)   => api.get(`/projects/${id}`),
  getAudit: (id: string)  => api.get(`/projects/${id}/audit`),
  create:  (data: ProjectPayload)    => api.post('/projects', data),
  update:  (id: string, data: Partial<ProjectPayload>) => api.put(`/projects/${id}`, data),
  patch:   (id: string, dataOrStatus: string | Record<string, unknown>) =>
    typeof dataOrStatus === 'string'
      ? api.patch(`/projects/${id}/status`, null, { params: { new_status: dataOrStatus } })
      : api.patch(`/projects/${id}`, dataOrStatus),
  delete:  (id: string)   => api.delete(`/projects/${id}`),
  saveEmailDraft: (id: string, draft: any) => api.post(`/projects/${id}/email-draft`, draft),
  getKpis: () => api.get('/projects/stats/kpis'),
  invalidateKpiCache: () => api.post('/projects/stats/kpis/invalidate'),
  clone:   (id: string, data: { new_name?: string; new_client_name?: string; new_client_email?: string; clone_itinerary?: boolean; clone_quotation?: boolean }) =>
    api.post(`/projects/${id}/clone`, data),
}

// ── Quotations ────────────────────────────────────────────────────
export interface QuotationPayload {
  project_id: string
  title?: string
  currency?: string
  margin_pct?: number
  pax?: number
}
export interface QuotationLinePayload {
  category: string
  label: string
  unit_price: number
  quantity: number
  nights?: number
}

export const quotationsApi = {
  create:      (data: QuotationPayload) => api.post('/quotations', data),
  get:         (id: string) => api.get(`/quotations/${id}`),
  update:      (id: string, data: Partial<QuotationPayload>) => api.put(`/quotations/${id}`, data),
  addLine:     (id: string, data: QuotationLinePayload) => api.post(`/quotations/${id}/lines`, data),
  recalculate: (id: string, pax: number) =>
    api.post(`/quotations/${id}/recalculate`, null, { params: { pax } }),
  byProject:   (projectId: string) =>
    api.get('/quotations', { params: { project_id: projectId } }),
}

// ── Itineraries ───────────────────────────────────────────────────
export interface ItineraryPayload {
  project_id: string
  title?: string
  language?: 'fr' | 'en'
}
export interface DayPayload {
  day_number: number
  title?: string
  description?: string
  city?: string
}
export interface GenerateDayPayload {
  tone?: 'luxury' | 'adventure' | 'budget' | 'family'
  language?: 'fr' | 'en'
  context?: string
}

export const itinerariesApi = {
  create:      (data: ItineraryPayload)         => api.post('/itineraries', data),
  get:         (id: string)                     => api.get(`/itineraries/${id}`),
  byProject:   (projectId: string)              => api.get(`/itineraries/project/${projectId}`),
  updateDay:   (itinId: string, dayId: string, data: Partial<DayPayload>) =>
    api.put(`/itineraries/${itinId}/days/${dayId}`, data),
  addDay:      (itinId: string, data: DayPayload) => api.post(`/itineraries/${itinId}/days`, data),
  deleteDay:   (itinId: string, dayId: string)  => api.delete(`/itineraries/${itinId}/days/${dayId}`),
  generateDay: (itinId: string, dayId: string, data: GenerateDayPayload) =>
    api.post(`/itineraries/${itinId}/days/${dayId}/generate-ai`, data),
  reorder:     (itinId: string, data: { id: string; day_number: number }[]) =>
    api.patch(`/itineraries/${itinId}/reorder`, data),
}

// ── Itinerary Templates (B1) ─────────────────────────────────────
export interface ItineraryTemplate {
  id: string
  company_id?: string | null
  name: string
  description?: string | null
  destination?: string | null
  duration_days: number
  language: string
  hotel_category?: string | null
  target_audience?: string | null
  tags?: string[] | null
  thumbnail_url?: string | null
  is_public: boolean
  use_count: number
  created_at: string
  updated_at: string
  days?: Array<{
    id: string
    day_number: number
    title: string
    subtitle?: string | null
    city?: string | null
    description?: string | null
    hotel?: string | null
    hotel_category?: string | null
    meal_plan?: string | null
    travel_time?: string | null
    distance_km?: number | null
    activities?: string[] | null
    image_url?: string | null
  }>
}

export const itineraryTemplatesApi = {
  list: (params?: { search?: string; destination?: string; audience?: string; min_days?: number; max_days?: number }) =>
    api.get<ItineraryTemplate[]>('/itinerary-templates/', { params }),
  get: (id: string) => api.get<ItineraryTemplate>(`/itinerary-templates/${id}`),
  create: (data: Partial<ItineraryTemplate> & { name: string; days?: any[] }) =>
    api.post<ItineraryTemplate>('/itinerary-templates/', data),
  saveFromItinerary: (itineraryId: string, params: { name: string; description?: string; is_public?: boolean }) =>
    api.post<ItineraryTemplate>(`/itinerary-templates/from-itinerary/${itineraryId}`, null, { params }),
  apply: (templateId: string, projectId: string, overwrite = false) =>
    api.post<{ itinerary_id: string; project_id: string; days_created: number }>(
      `/itinerary-templates/${templateId}/apply`,
      { project_id: projectId, overwrite }
    ),
  update: (id: string, data: Partial<ItineraryTemplate>) => api.put<ItineraryTemplate>(`/itinerary-templates/${id}`, data),
  delete: (id: string) => api.delete(`/itinerary-templates/${id}`),
}

// ── Media Library (B2) ───────────────────────────────────────────
export interface MediaAsset {
  id: string
  company_id?: string | null
  asset_type: 'photo' | 'poi' | 'description'
  title: string
  subtitle?: string | null
  description?: string | null
  city?: string | null
  country?: string | null
  category?: string | null
  tags?: string[] | null
  language: string
  image_url?: string | null
  thumb_url?: string | null
  source?: string | null
  license?: string | null
  is_public: boolean
  use_count: number
  created_at: string
  updated_at: string
}

export interface MediaFacets {
  cities: { value: string; count: number }[]
  categories: { value: string; count: number }[]
  types: { value: string; count: number }[]
}

export const mediaLibraryApi = {
  list: (params?: { q?: string; asset_type?: string; city?: string; category?: string; tag?: string }) =>
    api.get<MediaAsset[]>('/media-library/', { params }),
  facets: () => api.get<MediaFacets>('/media-library/facets'),
  get: (id: string) => api.get<MediaAsset>(`/media-library/${id}`),
  create: (data: Partial<MediaAsset> & { title: string }) =>
    api.post<MediaAsset>('/media-library/', data),
  update: (id: string, data: Partial<MediaAsset>) => api.put<MediaAsset>(`/media-library/${id}`, data),
  trackUse: (id: string) => api.post<MediaAsset>(`/media-library/${id}/use`),
  delete: (id: string) => api.delete(`/media-library/${id}`),
}

export const hotelsApi = {
  list:             (city?: string) => api.get('/hotels', { params: { city } }),
  get:              (id: string)    => api.get(`/hotels/${id}`),
  checkAvailability:(id: string, dates?: string) => api.get(`/hotels/${id}/availability`, { params: { dates } }),
}

// ── AI ────────────────────────────────────────────────────────────
export const aiApi = {
  generate: (prompt: string, provider: string = 'anthropic', projectId?: string) =>
    api.post('/ai/generate', { prompt, provider, project_id: projectId }),
  magicExtract: (brief: string) =>
    api.post('/ai/magic-extract', { brief }),
  getPredictivePricing: (projectId: string, market: string = 'FR') =>
    api.get(`/ai/predictive-pricing/${projectId}`, { params: { market } }),
}

// ── A2 — IA Proposal Writer ───────────────────────────────────────
export interface ProposalWriterStatus {
  configured: boolean
  provider: 'anthropic' | 'demo'
  model: string
  languages: string[]
  tones: string[]
}
export interface ProposalWriterResult {
  project_id: string
  language: string
  tone: string
  provider: string
  content: string
  word_count: number
  duration_ms: number
  cost_estimate_usd?: number | null
  is_demo: boolean
}
export const proposalWriterApi = {
  status: () => api.get<ProposalWriterStatus>('/proposal-writer/status'),
  generate: (data: {
    project_id: string
    language?: 'fr' | 'en' | 'es'
    tone?: 'premium' | 'warm' | 'concise' | 'poetic'
    extra_instructions?: string
  }) => api.post<ProposalWriterResult>('/proposal-writer/generate', data),
}

// ── B5 — Payments (Stripe + CMI) ──────────────────────────────────
export interface PaymentsStatus {
  stripe_configured: boolean
  cmi_configured: boolean
  stripe_publishable_key?: string | null
  cmi_gateway_url: string
  supported_currencies: string[]
}
export interface CheckoutResult {
  provider: 'stripe' | 'cmi'
  is_demo: boolean
  checkout_url: string
  session_id: string
  amount: number
  currency: string
  invoice_id: string
  kind: 'deposit' | 'balance' | 'full'
}
export interface CmiInitiateResult {
  is_demo: boolean
  gateway_url: string
  fields: Record<string, string>
  amount: number
  currency: string
  oid: string
}
export const paymentsApi = {
  status: () => api.get<PaymentsStatus>('/payments/status'),
  stripeCheckout: (data: {
    invoice_id: string
    kind?: 'deposit' | 'balance' | 'full'
    success_url?: string
    cancel_url?: string
  }) => api.post<CheckoutResult>('/payments/stripe/checkout', data),
  cmiInitiate: (data: {
    invoice_id: string
    kind?: 'deposit' | 'balance' | 'full'
  }) => api.post<CmiInitiateResult>('/payments/cmi/initiate', data),
}

// ── B7 — Microsoft Outlook calendar sync ──────────────────────────
export interface CalSyncStatus {
  configured: boolean
  connected: boolean
  user_email?: string | null
  expires_at?: string | null
  is_demo: boolean
}
export interface CalEventPreview {
  subject: string
  start: string
  end: string
  location?: string | null
  body?: string | null
  category: string
}
export interface CalPushResult {
  project_id: string
  is_demo: boolean
  events_planned: number
  events_pushed: number
  preview: CalEventPreview[]
}
export const calendarSyncApi = {
  status: () => api.get<CalSyncStatus>('/calendar-sync/status'),
  authStart: () => api.get<{ auth_url: string; state: string; is_demo: boolean }>(
    '/calendar-sync/oauth/start',
  ),
  disconnect: () => api.post('/calendar-sync/disconnect'),
  preview: (projectId: string) =>
    api.get<CalEventPreview[]>('/calendar-sync/preview', { params: { project_id: projectId } }),
  push: (data: { project_id: string; dry_run?: boolean; categories?: string[] }) =>
    api.post<CalPushResult>('/calendar-sync/push', data),
}

// ── Field Ops (C6 + offline) ──────────────────────────────────────
export interface FieldVoucher {
  task_id: string
  title: string
  location?: string
  time?: string
  pax_count?: number
  vehicle?: string
  voucher_token: string
  voucher_url: string
  expires_in_days: number
}

export const fieldOpsApi = {
  getTasks:      () => api.get('/field-ops/tasks'),
  updateStatus:  (id: string, status: string) =>
    api.patch(`/field-ops/tasks/${id}/status`, null, { params: { new_status: status } }),
  reportIncident:(message: string, severity: string = 'medium', taskId?: string) =>
    api.post('/field-ops/incidents', { message, severity, task_id: taskId }),
  getVoucher:    (taskId: string) => api.get<FieldVoucher>(`/field-ops/tasks/${taskId}/voucher`),
  verifyVoucher: (token: string) => api.get(`/field-ops/vouchers/verify`, { params: { token } }),
  bulkSync:      (updates: { task_id: string; status: string; timestamp?: number }[]) =>
    api.post('/field-ops/sync', { updates }),
}

// ── Finance ───────────────────────────────────────────────────────
export const financeApi = {
  getSummary:       () => api.get('/finance/summary'),
  simulateDiscount: (projectId: string, discount: number) => 
    api.get('/finance/simulate-discount', { params: { project_id: projectId, discount_pct: discount } }),
  getExecutiveBi:   () => api.get('/finance/analytics/executive'),
  getAiBriefing:    () => api.get('/finance/analytics/ai-briefing'),
}

export const gamificationApi = {
  getLeaderboard: (role?: string) => api.get('/gamification/leaderboard', { params: { role } }),
  getMyStats:     (userId: string) => api.get(`/gamification/my-stats/${userId}`),
}

export const collaborationApi = {
  reportPresence: (projectId: string) => api.post(`/collaboration/presence/${projectId}`),
  getPresence:    (projectId: string) => api.get(`/collaboration/presence/${projectId}`),
  acquireLock:    (resourceId: string) => api.post(`/collaboration/lock/${resourceId}`),
  releaseLock:    (resourceId: string) => api.delete(`/collaboration/lock/${resourceId}`),
}

// ── Proposals (Public & Auth) ─────────────────────────────────────
export const proposalsApi = {
  createShare: (projectId: string, data: any) => api.post(`/proposals/${projectId}/share`, data),
  listShares:  (projectId: string)            => api.get(`/proposals/${projectId}/shares`),
  getView:     (token: string)                => api.get(`/proposals/view/${token}`),
  addComment:  (token: string, data: any)     => api.post(`/proposals/view/${token}/comments`, data),
  accept:      (token: string)                => api.patch(`/proposals/view/${token}/accept`),
  sign:        (token: string, data: any)     => api.post(`/proposals/view/${token}/sign`, data),
  pay:         (token: string)                => api.post(`/proposals/view/${token}/pay`),
}

// ── Report Builder ────────────────────────────────────────────────
export const dataSourcesApi = {
  list:      ()            => api.get('/datasources'),
  create:    (data: any)   => api.post('/datasources', data),
  records:   (id: string, filters?: any) =>
    api.get(`/datasources/${id}/records`,
      { params: filters ? { filters: JSON.stringify(filters) } : {} }),
  addRows:   (id: string, rows: any[]) =>
    api.post(`/datasources/${id}/records`, { rows }),
  aggregate: (id: string, groupBy: string, metric: string) =>
    api.get(`/datasources/${id}/aggregate`, { params: { group_by: groupBy, metric } }),
}

export const reportsApi = {
  list:   ()            => api.get('/reports'),
  create: (data: any)   => api.post('/reports', data),
  get:    (id: string)  => api.get(`/reports/${id}`),
  update: (id: string, data: any) => api.put(`/reports/${id}`, data),
  delete: (id: string)  => api.delete(`/reports/${id}`),
  export: (data: any)   =>
    api.post('/reports/exports/generate', data, { responseType: 'blob' }),
}

// ── References / Générateur de références ────────────────────────
export const referencesApi = {
  airports:    () => api.get('/references/airports'),
  departments: () => api.get('/references/departments'),
  preview:     (params: any) => api.get('/references/preview', { params }),
  generate:    (data: any)   => api.post('/references/generate', data),
  list:        (params?: any)=> api.get('/references', { params }),
  delete:      (id: string)  => api.delete(`/references/${id}`),
}

// ── Invoices ──────────────────────────────────────────────────────
export interface InvoiceListParams {
  project_id?: string
  status?: string
  skip?: number
  limit?: number
}
export interface InvoicePayload {
  project_id: string
  quotation_id?: string
  due_date?: string
  notes?: string
  client_name?: string
  client_email?: string
  currency?: string
  pax_count?: number
  travel_dates?: string
  subtotal?: number
  tax_rate?: number
  deposit_pct?: number
}

export const invoicesApi = {
  list:          (params?: InvoiceListParams) => api.get('/invoices/', { params }),
  byProject:     (projectId: string) => api.get(`/invoices/project/${projectId}`),
  get:           (id: string) => api.get(`/invoices/${id}`),
  create:        (data: InvoicePayload) => api.post('/invoices', data),
  fromProject:   (projectId: string, quotationId?: string) =>
    api.post(`/invoices/from-project/${projectId}`,
      null, { params: quotationId ? { quotation_id: quotationId } : {} }),
  update:        (id: string, data: Partial<InvoicePayload>) => api.put(`/invoices/${id}`, data),
  updateStatus:  (id: string, status: string) =>
    api.patch(`/invoices/${id}/status`, null, { params: { new_status: status } }),
  generatePdf:   (id: string) =>
    api.post(`/invoices/${id}/generate-pdf`, null, { responseType: 'blob' }),
  delete:        (id: string) => api.delete(`/invoices/${id}`),
  exportErp:     (ids: string[]) => 
    api.get('/invoices/export/erp', { params: { ids }, paramsSerializer: { indexes: null }, responseType: 'blob' }),
}

// ── Pricing Engine (DMC avancé v0.5) ─────────────────────────────
export const pricingEngineApi = {
  calculate:      (data: any) => api.post('/quotations/engine/calculate', data),
  calculateRange: (data: any) => api.post('/quotations/engine/calculate-range', data),
  presets:        ()          => api.get('/quotations/engine/presets'),
}

// ── Guides ────────────────────────────────────────────────────────
export const guidesApi = {
  list:   (city?: string) => api.get('/guides', { params: city ? { city } : {} }),
  get:    (id: string)    => api.get(`/guides/${id}`),
  create: (data: any)     => api.post('/guides', data),
  update: (id: string, data: any) => api.put(`/guides/${id}`, data),
  delete: (id: string)    => api.delete(`/guides/${id}`),
}

// ── Transports ────────────────────────────────────────────────────
export const transportsApi = {
  list:   (params?: {
    vehicle_type?: string
    transport_type?: string
    origin_city?: string
    destination_city?: string
    is_luxury?: boolean
    skip?: number
    limit?: number
  }) => api.get('/transports', { params }),
  get:    (id: string)            => api.get(`/transports/${id}`),
  create: (data: any)             => api.post('/transports', data),
  update: (id: string, data: any) => api.put(`/transports/${id}`, data),
  patch:  (id: string, data: any) => api.patch(`/transports/${id}`, data),
  delete: (id: string)            => api.delete(`/transports/${id}`),
  search: (q: string)             => api.get('/transports/search/query', { params: { q } }),
}

// ── Menus / Restauration ──────────────────────────────────────────
export const menusApi = {
  list:   (params?: {
    meal_type?: string
    category?: string
    city?: string
    has_halal?: boolean
    has_vegetarian?: boolean
    skip?: number
    limit?: number
  }) => api.get('/menus', { params }),
  get:    (id: string)            => api.get(`/menus/${id}`),
  create: (data: any)             => api.post('/menus', data),
  update: (id: string, data: any) => api.put(`/menus/${id}`, data),
  patch:  (id: string, data: any) => api.patch(`/menus/${id}`, data),
  delete: (id: string)            => api.delete(`/menus/${id}`),
  search: (q: string)             => api.get('/menus/search/query', { params: { q } }),
}

// ── Dashboard KPIs ────────────────────────────────────────────────
export interface MapDestination {
  id: string
  name: string
  lat: number
  lng: number
  tier: 'hub' | 'city' | 'etape'
  tags: string[]
  projects_total: number
  projects_active: number
  projects_won: number
  total_pax: number
  total_nights: number
}
export interface MapCircuit {
  id: string
  label: string
  cities: string[]
  color: string
}
export interface MapData {
  destinations: MapDestination[]
  circuits: MapCircuit[]
  top_destination_id: string | null
  bounds: { north: number; south: number; east: number; west: number }
  generated_at: string
}

// Group itinerary map types ──────────────────────────────────────────
export interface GroupRouteCity {
  id: string
  name: string
  lat: number
  lng: number
  tier: 'hub' | 'city' | 'etape'
}

export interface GroupItineraryDay {
  day_number: number
  title: string
  city_id: string
  city_name: string
  lat: number
  lng: number
  hotel: string | null
  hotel_category: string | null
  meal_plan: string | null
  distance_km: number | null
  image_url: string | null
}

export interface GroupItinerary {
  id: string
  name: string
  reference: string | null
  status: string
  color: string
  pax: number
  duration_days: number
  duration_nights: number
  destination: string | null
  client_name: string | null
  total_km: number
  route: GroupRouteCity[]
  days: GroupItineraryDay[]
}

export interface GroupsMapData {
  groups: GroupItinerary[]
  bounds: { north: number; south: number; east: number; west: number }
  generated_at: string
}

export const dashboardApi = {
  kpis:          () => api.get('/projects/stats/kpis'),
  recentProjects:(limit = 5) => api.get('/projects', { params: { limit, sort: 'created_at_desc' } }),
  destinations:  () => api.get<MapData>('/projects/stats/destinations'),
  groupsMap:     () => api.get<GroupsMapData>('/projects/stats/groups-map'),
}

// ── Reviews (portail client) ──────────────────────────────────────
export type ReviewTarget = 'guide' | 'driver' | 'restaurant' | 'hotel'

export interface ReviewPayload {
  project_id:  string
  target_type: ReviewTarget
  target_id?:  string
  target_name: string
  rating:      number
  comment?:    string
}

export const reviewsApi = {
  create:     (data: ReviewPayload)  => api.post('/reviews', data),
  byProject:  (projectId: string)    => api.get(`/reviews/project/${projectId}`),
  stats:      (projectId: string)    => api.get(`/reviews/stats/${projectId}`),
}

// ── Guide Portal ──────────────────────────────────────────────────
export type AvailabilityStatus = 'available' | 'busy' | 'tentative'
export type RemarkType = 'observation' | 'issue' | 'suggestion'

export interface AvailabilityPayload {
  date:        string
  status:      AvailabilityStatus
  project_id?: string
  notes?:      string
}

export interface CircuitRemarkPayload {
  project_id:       string
  itinerary_day_id?: string
  day_number?:       number
  remark_type:       RemarkType
  content:           string
}

export const guidePortalApi = {
  getAgenda:         (month?: string)         => api.get('/guide-portal/agenda', { params: month ? { month } : {} }),
  setAvailability:   (date: string, data: AvailabilityPayload) => api.put(`/guide-portal/agenda/${date}`, data),
  projectAgenda:     (projectId: string)      => api.get(`/guide-portal/agenda/project/${projectId}`),
  addRemark:         (data: CircuitRemarkPayload) => api.post('/guide-portal/remarks', data),
  getRemarks:        (projectId: string)      => api.get(`/guide-portal/remarks/project/${projectId}`),
  resolveRemark:     (id: string, resolved: boolean) => api.patch(`/guide-portal/remarks/${id}/resolve`, { is_resolved: resolved }),
}

// ── Notifications ─────────────────────────────────────────────────
export const notificationsApi = {
  list:        ()           => api.get('/notifications'),
  unreadCount: ()           => api.get('/notifications/unread-count'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.patch('/notifications/read-all'),
}


// ── Companies (multi-tenant) ──────────────────────────────────────
import type { Company, CompanyWithRole, SwitchCompanyResponse } from '@/types/company'

export const companiesApi = {
  myCompanies:  ()                                => api.get<CompanyWithRole[]>('/companies/me'),
  switch:       (company_id: string)              => api.post<SwitchCompanyResponse>('/companies/switch', { company_id }),
  list:         ()                                => api.get<Company[]>('/companies'),
  create:       (data: Partial<Company>)          => api.post<Company>('/companies', data),
  get:          (id: string)                      => api.get<Company>(`/companies/${id}`),
  update:       (id: string, data: Partial<Company>) => api.patch<Company>(`/companies/${id}`, data),
}

// ── Master Data (Partners + Articles) ─────────────────────────────
export type PartnerType = 'customer' | 'supplier' | 'guide' | 'employee' | 'sub_agent'
export type ArticleCategory = 'hotel_night' | 'meal' | 'guide_day' | 'transport' | 'excursion' | 'visa' | 'insurance' | 'flight' | 'other'

export interface Partner {
  id: string
  company_id: string
  code: string
  name: string
  type: PartnerType
  email?: string | null
  phone?: string | null
  currency: string
  is_active: boolean
}

export interface Article {
  id: string
  company_id: string
  code: string
  name: string
  category: ArticleCategory
  unit: string
  purchase_price?: number | null
  sell_price?: number | null
  currency: string
  default_supplier_id?: string | null
  is_active: boolean
}

export const partnersApi = {
  list:    (params?: { type?: PartnerType; search?: string; skip?: number; limit?: number }) =>
           api.get<Partner[]>('/partners', { params }),
  create:  (data: Partial<Partner>)         => api.post<Partner>('/partners', data),
  get:     (id: string)                     => api.get<Partner>(`/partners/${id}`),
  update:  (id: string, data: Partial<Partner>) => api.patch<Partner>(`/partners/${id}`, data),
}

export const articlesApi = {
  list:    (params?: { category?: ArticleCategory; supplier_id?: string; search?: string; skip?: number; limit?: number }) =>
           api.get<Article[]>('/articles', { params }),
  create:  (data: Partial<Article>)         => api.post<Article>('/articles', data),
  get:     (id: string)                     => api.get<Article>(`/articles/${id}`),
  update:  (id: string, data: Partial<Article>) => api.patch<Article>(`/articles/${id}`, data),
}

// ── Document Flow ─────────────────────────────────────────────────
export const documentFlowApi = {
  forProject: (projectId: string) => api.get(`/document-flow/projects/${projectId}`),
}

// ── Approvals ─────────────────────────────────────────────────────
export const approvalsApi = {
  list:    (params?: { status?: string; entity_type?: string }) =>
           api.get('/approvals', { params }),
  submit:  (data: { entity_type: string; entity_id: string; snapshot?: object; note?: string }) =>
           api.post('/approvals', data),
  get:     (id: string)                       => api.get(`/approvals/${id}`),
  approve: (id: string, comment?: string)     => api.post(`/approvals/${id}/approve`, { comment }),
  reject:  (id: string, comment?: string)     => api.post(`/approvals/${id}/reject`, { comment }),
  cancel:  (id: string)                       => api.post(`/approvals/${id}/cancel`),
}

export const approvalRulesApi = {
  list:    (entity_type?: string)              => api.get('/approval-rules', { params: { entity_type } }),
  create:  (data: object)                      => api.post('/approval-rules', data),
  update:  (id: string, data: object)          => api.patch(`/approval-rules/${id}`, data),
}

// ── Travel Companion (agency-side) ────────────────────────────────
export const travelLinksApi = {
  create:    (data: { project_id: string; expires_at?: string; pin?: string; locale?: string }) =>
             api.post('/travel-links', data),
  listForProject: (projectId: string) => api.get(`/travel-links/project/${projectId}`),
  revoke:    (id: string)             => api.post(`/travel-links/${id}/revoke`),
  messages:  (projectId: string)      => api.get(`/travel-links/${projectId}/messages`),
}

// ── Live Operations Cockpit ───────────────────────────────────────
export const opsCockpitApi = {
  snapshot: () => api.get('/ops-cockpit'),
}

// ── Supplier Performance Score ────────────────────────────────────
export const supplierScoresApi = {
  list:      (params?: { period_days?: number; only_suppliers?: boolean }) =>
             api.get('/supplier-scores', { params }),
  get:       (partnerId: string, period_days = 180) =>
             api.get(`/supplier-scores/${partnerId}`, { params: { period_days } }),
  snapshot:  (partnerId: string)  => api.post(`/supplier-scores/${partnerId}/snapshot`),
  history:   (partnerId: string, days = 180) =>
             api.get(`/supplier-scores/${partnerId}/history`, { params: { days } }),
}

export const supplierIncidentsApi = {
  list:      (partnerId?: string) =>
             api.get('/supplier-incidents', { params: { partner_id: partnerId } }),
  create:    (data: { partner_id: string; severity?: string; kind?: string; description: string; project_id?: string; occurred_at?: string }) =>
             api.post('/supplier-incidents', data),
  resolve:   (id: string) => api.post(`/supplier-incidents/${id}/resolve`),
}

// ── Sub-agent B2B Portal ──────────────────────────────────────────
export const subAgentPortalApi = {
  me:        () => api.get('/portal/me'),
  projects:  () => api.get('/portal/projects'),
  catalog:   () => api.get('/portal/catalog'),
  createQuote: (data: {
    client_name: string; pax_count: number;
    client_email?: string; client_country?: string;
    travel_dates?: string; duration_days?: number;
    destination?: string; notes?: string; catalog_item_id?: string;
  }) => api.post('/portal/quote-requests', data),
}


// ── Sustainability / Carbon footprint (CSRD) ──────────────────────
export interface CarbonItem {
  label: string
  category: 'flight' | 'ground_transport' | 'hotel' | 'activity' | 'meals'
  quantity: number
  unit: string
  factor_kg: number
  co2e_kg: number
}
export interface CarbonReport {
  project_id: string
  project_name: string
  pax_count: number
  nights: number
  duration_days: number
  items: CarbonItem[]
  total_co2e_kg: number
  total_co2e_t: number
  per_pax_co2e_kg: number
  per_night_co2e_kg: number
  benchmark_label: 'excellent' | 'good' | 'average' | 'high'
  benchmark_pct_vs_average: number
  offset_eur: number
  methodology: string
  computed_at: string
}
export interface CsrdAggregate {
  period_start: string
  period_end: string
  projects_count: number
  total_co2e_t: number
  avg_per_pax_kg: number
  breakdown_by_category: Record<string, number>
  top_emitters: Array<{ project_id: string; project_name: string; co2e_t: number; per_pax_kg: number }>
}
export const sustainabilityApi = {
  footprint: (projectId: string) => api.get<CarbonReport>(`/sustainability/footprint/${projectId}`),
  factors:   () => api.get('/sustainability/factors'),
  csrd:      (params?: { period_start?: string; period_end?: string }) =>
             api.get<CsrdAggregate>('/sustainability/csrd-report', { params }),
  offsetQuote: (co2e_kg: number) =>
             api.post<{ co2e_kg: number; co2e_t: number; price_eur_per_tonne: number; total_eur: number; project_type: string }>(
               '/sustainability/offset-quote', { co2e_kg }),
}

// ── Agent Acompte (#1a — SAP-inspired Joule Agent) ────────────────
export interface AgentReminder {
  id: string
  invoice_id: string
  level: number
  kind: string
  subject: string | null
  body_preview: string | null
  recipient: string | null
  status: string
  scheduled_at: string | null
  sent_at: string | null
}
export interface AgentQueueItem {
  invoice_id: string
  invoice_number: string
  client_name: string | null
  client_email: string | null
  total: number
  deposit_amount: number
  currency: string
  issue_date: string | null
  due_date: string | null
  last_level: number
  next_level: number | null
  next_due_at: string | null
  is_paused: boolean
  days_overdue: number
}
export interface AgentRunReport {
  processed: number
  sent: number
  skipped_paid: number
  skipped_paused: number
  items: AgentReminder[]
}
export interface AgentStats {
  queue_size: number
  total_at_risk: number
  currency_breakdown: Record<string, number>
  by_level: Record<string, number>
  paused: number
}
export interface AgentTimeline {
  invoice_id: string
  invoice_number: string
  client_email: string | null
  history: AgentReminder[]
  next_level: number | null
  next_due_at: string | null
  is_paused: boolean
}
export const paymentAgentApi = {
  settings: () => api.get('/payment-agent/settings'),
  queue:    () => api.get<AgentQueueItem[]>('/payment-agent/queue'),
  stats:    () => api.get<AgentStats>('/payment-agent/stats'),
  timeline: (invoiceId: string) => api.get<AgentTimeline>(`/payment-agent/timeline/${invoiceId}`),
  run:      (force = false) => api.post<AgentRunReport>(`/payment-agent/run?force=${force}`),
  trigger:  (invoiceId: string) => api.post<AgentReminder>(`/payment-agent/trigger/${invoiceId}`),
  pause:    (invoiceId: string) => api.post(`/payment-agent/pause/${invoiceId}`),
  resume:   (invoiceId: string) => api.post(`/payment-agent/resume/${invoiceId}`),
}

// ── A3 — Pricing Coach ──────────────────────────────────────────────
export interface PricingSample {
  project_id: string
  project_name: string | null
  destination: string | null
  duration_days: number | null
  pax_count: number | null
  margin_pct: number
  total_cost: number | null
  total_selling: number | null
  status: string
  outcome: 'won' | 'lost' | 'pending'
}
export interface PricingRecommendation {
  requested_destination: string | null
  requested_duration: number | null
  requested_pax: number | null
  requested_season: string | null
  duration_bucket: string | null
  sample_size: number
  won_count: number
  lost_count: number
  win_rate: number
  margin_won_avg: number | null
  margin_lost_avg: number | null
  margin_p25: number | null
  margin_p50: number | null
  margin_p75: number | null
  margin_recommended: number
  margin_min_safe: number
  margin_max_aggressive: number
  season: string | null
  season_multiplier: number
  flags: string[]
  rationale: string
  samples_used: PricingSample[]
  is_demo: boolean
  provider: string
}
export interface PricingInsights {
  total_samples: number
  by_destination: Array<{ key: string, count: number, avg: number | null, min: number | null, max: number | null }>
  by_duration:    Array<{ key: string, count: number, avg: number | null, min: number | null, max: number | null }>
  by_outcome: Record<string, { count: number, avg: number | null, min: number | null, max: number | null }>
  peer_avg: number
  peer_band: [number, number]
}
export const pricingCoachApi = {
  status:    () => api.get('/pricing-coach/status'),
  dataset:   () => api.get<PricingSample[]>('/pricing-coach/dataset'),
  insights:  () => api.get<PricingInsights>('/pricing-coach/insights'),
  recommend: (params: { destination?: string, duration_days?: number, pax?: number, departure_month?: number }) =>
    api.get<PricingRecommendation>('/pricing-coach/recommend', { params }),
}

// ── M365 — Microsoft 365 unified integration ───────────────────────────
export interface M365Connection {
  id: string
  user_id: string
  account_email: string
  display_name: string | null
  tenant_id: string | null
  expires_at: string | null
  is_demo: boolean
  scopes: string[]
  drive_id: string | null
  sharepoint_site_id: string | null
}
export interface M365Status {
  is_real: boolean
  is_demo: boolean
  teams_webhook_configured: boolean
  sharepoint_site_configured: boolean
  connections: M365Connection[]
}
export interface M365MailMessage {
  id: string
  subject: string | null
  sender: string | null
  recipients: string[]
  received_at: string
  preview: string | null
  direction: 'in' | 'out'
  project_id: string | null
  invoice_id: string | null
  is_demo: boolean
}
export interface M365DriveFile {
  id: string
  name: string
  folder: boolean
  size: number | null
  mime_type: string | null
  web_url: string | null
  modified_at: string | null
}
export interface M365Dashboard {
  connection: M365Connection
  inbox_unread: number
  linked_inbox: M365MailMessage[]
  recent_inbox: M365MailMessage[]
  recent_sent: M365MailMessage[]
  drive_root: M365DriveFile[]
  teams_configured: boolean
  sharepoint_configured: boolean
  is_real: boolean
}
export const m365Api = {
  status:    () => api.get<M365Status>('/m365/status'),
  dashboard: () => api.get<M365Dashboard>('/m365/dashboard'),
  oauthStart:() => api.post<{ auth_url: string, state: string, is_demo: boolean }>('/m365/oauth/start'),
  disconnect:(id: string) => api.delete(`/m365/connections/${id}`),
  inbox:     (params?: { folder?: 'inbox' | 'sent', project_id?: string, invoice_id?: string }) =>
    api.get<M365MailMessage[]>('/m365/mail/inbox', { params }),
  sendMail:  (body: { to: string[], cc?: string[], subject: string, body: string, project_id?: string, invoice_id?: string }) =>
    api.post('/m365/mail/send', body),
  timeline:  (project_id: string) => api.get<M365MailMessage[]>(`/m365/mail/timeline/${project_id}`),
  driveList: (path: string) => api.get<M365DriveFile[]>('/m365/drive/list', { params: { path } }),
  driveProvision: (project_id: string) =>
    api.post<{ folder_path: string, folder_id: string | null, subfolders: string[], web_url: string | null, is_demo: boolean }>(
      '/m365/drive/provision-folder', { project_id }),
  teamsNotify: (body: { title: string, message: string, color?: string, action_url?: string, action_label?: string, facts?: { name: string, value: string }[] }) =>
    api.post('/m365/teams/notify', body),
}

// ── O2C — Order-to-Cash unified ───────────────────────────────────────
export interface O2CKpis {
  active_projects: number
  quotations_sent: number
  quotations_accepted: number
  invoices_issued: number
  invoices_paid: number
  invoices_overdue: number
  revenue_collected: number
  revenue_outstanding: number
  revenue_pipeline: number
  dso_days: number
  conversion_rate: number
  avg_invoice_to_payment_days: number
  leakage_count: number
  currency: string
}
export interface O2CFunnelStage { stage: string; label: string; count: number; value: number }
export interface O2CFunnel { stages: O2CFunnelStage[]; overall_conversion: number }
export interface O2CLifecycleStep {
  key: string; label: string; status: 'done'|'active'|'pending'|'skipped'
  timestamp: string | null; detail: string | null
}
export interface O2CLifecycleRow {
  project_id: string; project_name: string; project_reference: string | null
  client_name: string | null; destination: string | null; pax: number | null
  travel_dates: string | null; current_stage: string; progress_pct: number
  days_in_stage: number; total_value: number; paid_value: number
  outstanding_value: number; currency: string
  is_blocked: boolean; block_reason: string | null
  steps: O2CLifecycleStep[]
}
export interface O2CAgingBucket { label: string; count: number; amount: number }
export interface O2CAging {
  buckets: O2CAgingBucket[]; total_outstanding: number
  invoices: Array<{ invoice_id: string; number: string; client_name: string | null
    amount: number; currency: string; due_date: string | null
    days_overdue: number; bucket: string; status: string }>
}
export interface O2CBottleneck {
  project_id: string; project_name: string; stage: string
  days_stuck: number; severity: 'info'|'warning'|'critical'; suggestion: string
}
export const o2cApi = {
  overview:    () => api.get<O2CKpis>('/o2c/overview'),
  funnel:      () => api.get<O2CFunnel>('/o2c/funnel'),
  lifecycle:   (params?: { blocked_only?: boolean, limit?: number }) =>
    api.get<O2CLifecycleRow[]>('/o2c/lifecycle', { params }),
  lifecycleOne:(id: string) => api.get<O2CLifecycleRow>(`/o2c/lifecycle/${id}`),
  aging:       () => api.get<O2CAging>('/o2c/aging'),
  bottlenecks: () => api.get<O2CBottleneck[]>('/o2c/bottlenecks'),
}

// ── P2P (Procure-to-Pay) ──────────────────────────────────────────────────
export interface P2PPR {
  id: string; reference: string; project_id: string | null
  category: string; title: string; description: string | null
  supplier_name: string | null; supplier_email: string | null
  qty: number; unit: string; unit_price: number; total: number; currency: string
  needed_by: string | null; status: string
  requested_by: string | null; created_at: string | null
}
export interface P2PPO {
  id: string; reference: string; requisition_id: string | null
  project_id: string | null; supplier_name: string; supplier_email: string | null
  total: number; currency: string; issue_date: string | null
  expected_delivery: string | null; payment_terms: string; status: string
  created_at: string | null
}
export interface P2PMatch {
  po_id: string; po_reference: string; po_amount: number
  receipt_amount: number; invoice_amount: number
  has_receipt: boolean; has_invoice: boolean
  status: 'matched'|'partial'|'discrepancy'|'unmatched'
  variance_amount: number; variance_pct: number
  supplier_name: string; currency: string
}
export interface P2PStats {
  pr_total: number; pr_pending_approval: number
  po_total: number; po_open: number; po_received: number
  invoices_received: number; invoices_paid: number
  matched_count: number; discrepancies: number
  spend_committed: number; spend_received: number
  spend_invoiced: number; spend_paid: number; currency: string
}
export interface P2PSupplierSpend {
  supplier_name: string; po_count: number
  spend_total: number; spend_received: number; spend_paid: number
  avg_po_value: number; currency: string
}
export interface P2PAnalytics {
  stats: P2PStats; top_suppliers: P2PSupplierSpend[]
  by_category: Array<{ category: string; spend: number; count: number }>
  matching_health: { matched_pct: number; partial_pct: number; discrepancy_pct: number; unmatched_pct: number }
  savings_opportunities: Array<{ type: string; supplier: string; rationale: string; estimated_savings: number; currency: string }>
}
export interface P2PPODetail {
  po: P2PPO
  receipts: Array<{ id: string; receipt_date: string; qty_received: number; amount_received: number; is_complete: boolean }>
  invoices: Array<{ id: string; number: string; issue_date: string | null; due_date: string | null; total: number; status: string }>
  match: P2PMatch
}

export const p2pApi = {
  analytics:    () => api.get<P2PAnalytics>('/p2p/analytics'),
  prList:       (params?: { project_id?: string; status?: string; limit?: number }) =>
    api.get<P2PPR[]>('/p2p/pr', { params }),
  prCreate:     (body: Partial<P2PPR>) => api.post<P2PPR>('/p2p/pr', body),
  prApprove:    (id: string) => api.post<P2PPR>(`/p2p/pr/${id}/approve`),
  prReject:     (id: string) => api.post<P2PPR>(`/p2p/pr/${id}/reject`),
  poList:       (params?: { project_id?: string; status?: string; limit?: number }) =>
    api.get<P2PPO[]>('/p2p/po', { params }),
  poDetail:     (id: string) => api.get<P2PPODetail>(`/p2p/po/${id}`),
  poFromPR:     (body: { requisition_id: string; expected_delivery?: string; payment_terms?: string; notes?: string }) =>
    api.post<P2PPO>('/p2p/po', body),
  matches:      () => api.get<P2PMatch[]>('/p2p/match'),
  triggerMatch: (po_id: string) => api.post<P2PMatch>(`/p2p/match/${po_id}`),
  receipt:      (body: { po_id: string; receipt_date?: string; qty_received: number; amount_received: number; is_complete?: boolean; notes?: string }) =>
    api.post('/p2p/receipt', body),
  supplierInvoice: (body: { po_id?: string; supplier_name: string; number: string; issue_date?: string; due_date?: string; total: number; currency?: string }) =>
    api.post('/p2p/supplier-invoice', body),
  seedDemo:     () => api.post<{ ok: boolean; purchase_requisitions: number; purchase_orders: number; receipts: number; invoices: number }>('/p2p/seed-demo'),
}

// ── Data Hub ─────────────────────────────────────────────────────────────
export interface DataHubHit {
  id: string; source_module: string; source_id: string
  title: string; snippet: string; score: number
  project_id: string | null; client_name: string | null
  destination: string | null; amount: number | null
  currency: string | null; status: string | null; occurred_at: string | null
}
export interface DataHubSearch {
  query: string; total: number
  facets: { by_module: Record<string, number>; by_status: Record<string, number>; by_destination: Record<string, number> }
  hits: DataHubHit[]
}
export interface DataHubStats {
  total_documents: number; by_module: Record<string, number>; last_indexed_at: string | null
}
export interface DataHubSuggestion { label: string; query: string; description: string }

export const dataHubApi = {
  reindex:     () => api.post<{ ok: boolean; indexed: Record<string, number>; total_documents: number }>('/data-hub/reindex'),
  search:      (q: string, params?: { modules?: string; limit?: number }) =>
    api.get<DataHubSearch>('/data-hub/search', { params: { q, ...params } }),
  stats:       () => api.get<DataHubStats>('/data-hub/stats'),
  suggestions: () => api.get<DataHubSuggestion[]>('/data-hub/suggestions'),
}

// ── Agent Designer ───────────────────────────────────────────────────────
export interface AgentNode {
  id: string; type: string; label?: string
  config: Record<string, any>; next: string[]; next_no?: string[] | null
}
export interface Agent {
  id: string; name: string; description?: string | null
  trigger: string; status?: string | null
  nodes: AgentNode[]; icon?: string; color?: string
  template_key?: string | null
  created_at?: string | null; updated_at?: string | null
}
export interface AgentCatalog {
  nodes: { type: string; category: string; label: string; description: string; config_schema: Record<string, string> }[]
}
export interface AgentRunTrace {
  node_id: string; label: string; type: string
  status: string; output?: any; error?: string | null; ts: string
}
export interface AgentRun {
  id: string; agent_id: string; status: string
  started_at?: string | null; finished_at?: string | null
  duration_ms: number; trace: AgentRunTrace[]; error?: string | null
}

export const agentDesignerApi = {
  catalog:       () => api.get<AgentCatalog>('/agent-designer/catalog'),
  list:          () => api.get<Agent[]>('/agent-designer/agents'),
  get:           (id: string) => api.get<Agent>(`/agent-designer/agents/${id}`),
  create:        (payload: Partial<Agent>) => api.post<Agent>('/agent-designer/agents', payload),
  update:        (id: string, payload: Partial<Agent>) => api.put<Agent>(`/agent-designer/agents/${id}`, payload),
  remove:        (id: string) => api.delete(`/agent-designer/agents/${id}`),
  run:           (id: string) => api.post<AgentRun>(`/agent-designer/agents/${id}/run`),
  runs:          (id: string) => api.get<AgentRun[]>(`/agent-designer/agents/${id}/runs`),
  seedTemplates: () => api.post<{ ok: boolean; created: number; updated: number }>('/agent-designer/seed-templates'),
}

// ── Cotation Avancée (Pricing grid + Catering + T&C + Vehicles) ────────────
export interface PricingBracket {
  id: string; quotation_id: string
  pax_basis: number; foc_count: number
  price_per_pax: number; single_supplement: number; currency: string
  breakdown?: Record<string, any>
}
export interface RecomputePayload {
  pax_brackets: number[]; foc_count: number
  markup_pct?: number | null
  bus_total_cost?: number; tour_leader_cost?: number
  guide_cost?: number; guide_local_cost?: number
  extras_per_pax?: Record<string, number>
  single_supplement?: number; currency?: string
}
export interface DayMeal {
  id: string; day_id: string
  meal_type: string; city?: string | null
  restaurant_name?: string | null; menu_text?: string | null; menu_id?: string | null
  cost_per_pax?: number | null; currency?: string | null
}
export interface QuotationTerm {
  id: string; quotation_id: string
  section: string; title?: string | null; body: string; sort_order: number
}
export interface Vehicle {
  id: string; label: string; type: string
  capacity_min: number; capacity_max: number
  brand_models?: string | null
  rate_per_km: number; rate_per_day?: number | null; currency: string
  photo_url?: string | null; specs?: Record<string, any> | null
  notes?: string | null; active: boolean
}
export interface CotationFullView {
  quotation: { id: string; project_id: string; version: number; status: string; currency: string; margin_pct: number; single_supplement: number }
  brackets: PricingBracket[]
  terms:    QuotationTerm[]
  lines:    { id: string; day_number?: number | null; category: string; label: string; city?: string | null; supplier?: string | null; unit_cost: number; quantity: number; total_cost: number }[]
  summary:  { total_lines: number; total_brackets: number; total_terms: number }
}

// ── Engine d'automatisations A1..A12 ──────────────────────────────────
export interface AutomationRule {
  key: string
  name: string
  description: string
  trigger: string
  action_type: string
  delay_label: string
  enabled: boolean
  sla_min: number
  fire_count: number
  last_run_at: string | null
  last_status: 'success' | 'skipped' | 'error' | null
}

export interface AutomationAction {
  kind: string
  to?: string
  subject?: string
  preview?: string
  message_id?: string
  channel?: string
  task_id?: string
  title?: string
  owner?: string
  priority?: string
  due_at?: string
  message?: string
  delivered_at?: string
  entity?: string
  entity_id?: string
  new_status?: string
  reason?: string
  voucher_no?: string
  url?: string
  project_id?: string
}

export interface AutomationRun {
  id: string
  rule_key: string
  rule_name: string
  trigger: string
  status: 'success' | 'skipped' | 'error'
  duration_ms: number
  started_at: string | null
  actions_count: number
  summary: string
  payload: Record<string, any> | null
  output: { actions?: AutomationAction[]; summary?: string } | null
  error: string | null
}

export interface AutomationDashboard {
  total_rules: number
  enabled: number
  disabled: number
  fires_total: number
  runs_24h: number
  errors_24h: number
  success_rate_pct: number
  top_rules: Array<{ key: string; name: string; fire_count: number; last_status: string | null; enabled: boolean }>
}

export const automationsApi = {
  dashboard: () => api.get<AutomationDashboard>('/automations/dashboard'),
  rules:     () => api.get<AutomationRule[]>('/automations/rules'),
  toggle:    (key: string, enabled: boolean) =>
    api.patch<{ key: string; enabled: boolean }>(`/automations/rules/${key}/toggle`, { enabled }),
  runRule:   (key: string, payload?: Record<string, any>) =>
    api.post(`/automations/rules/${key}/run`, { payload: payload ?? {} }),
  trigger:   (event: string, payload?: Record<string, any>) =>
    api.post<{ event: string; fired_rules: number; runs: any[] }>('/automations/trigger', { event, payload: payload ?? {} }),
  cronTick:  () => api.post<{ tick_at: string; rules_fired: number; runs: any[] }>('/automations/cron-tick'),
  runs:      (params?: { rule_key?: string; status?: string; limit?: number }) =>
    api.get<AutomationRun[]>('/automations/runs', { params }),
  runDetail: (runId: string) => api.get<AutomationRun>(`/automations/runs/${runId}`),
  seedDemo:  () => api.post<{ rules_added: number; events_fired: number; runs: number }>('/automations/seed-demo'),
}

export const cotationApi = {
  brackets:        (qid: string) => api.get<PricingBracket[]>(`/cotation/quotations/${qid}/brackets`),
  recomputeGrid:   (qid: string, payload: RecomputePayload) => api.post<PricingBracket[]>(`/cotation/quotations/${qid}/recompute-grid`, payload),
  meals:           (dayId: string) => api.get<DayMeal[]>(`/cotation/days/${dayId}/meals`),
  addMeal:         (dayId: string, payload: Partial<DayMeal>) => api.post<DayMeal>(`/cotation/days/${dayId}/meals`, payload),
  removeMeal:      (mealId: string) => api.delete(`/cotation/meals/${mealId}`),
  terms:           (qid: string) => api.get<QuotationTerm[]>(`/cotation/quotations/${qid}/terms`),
  replaceTerms:    (qid: string, payload: Omit<QuotationTerm,'id'|'quotation_id'>[]) => api.put<QuotationTerm[]>(`/cotation/quotations/${qid}/terms`, payload),
  seedStoursTerms: (qid: string) => api.post<{ ok: boolean; sections: number }>(`/cotation/quotations/${qid}/terms/seed-stours`),
  vehicles:        (active = true) => api.get<Vehicle[]>('/cotation/vehicles', { params: { active_only: active } }),
  createVehicle:   (payload: Omit<Vehicle,'id'>) => api.post<Vehicle>('/cotation/vehicles', payload),
  updateVehicle:   (id: string, payload: Omit<Vehicle,'id'>) => api.put<Vehicle>(`/cotation/vehicles/${id}`, payload),
  deleteVehicle:   (id: string) => api.delete(`/cotation/vehicles/${id}`),
  seedVehicleFleet:() => api.post<{ ok: boolean; created: number; updated: number; total: number }>('/cotation/vehicles/seed-stours'),
  fullView:        (qid: string) => api.get<CotationFullView>(`/cotation/quotations/${qid}/full`),
  projectsWithQuotations: () => api.get<Array<{
    id: string; name: string; client_name?: string | null; destination?: string | null
    quotations: Array<{ id: string; version: number; status: string; currency: string; margin_pct: number }>
  }>>('/cotation/projects-with-quotations'),
}

// ── ERP integration (SAP S/4HANA & Business One) ──────────────────────
export interface ErpConfig {
  id: string
  company_id: string
  client_key: string
  label: string
  kind: 'sap_s4hana' | 'sap_business_one'
  base_url: string | null
  is_dry_run: boolean
  is_active: boolean
  notes: string | null
  has_oauth_secret: boolean
  has_b1_password:  boolean
  oauth_token_url: string | null
  oauth_client_id: string | null
  oauth_scope:     string | null
  b1_company_db:   string | null
  b1_username:     string | null
  mapping: Record<string, any> | null
  created_at: string | null
  updated_at: string | null
}
export interface ErpConfigPayload {
  client_key: string
  label: string
  kind: 'sap_s4hana' | 'sap_business_one'
  base_url?: string | null
  is_dry_run?: boolean
  is_active?: boolean
  notes?: string | null
  oauth_token_url?: string | null
  oauth_client_id?: string | null
  oauth_client_secret?: string | null
  oauth_scope?: string | null
  b1_company_db?: string | null
  b1_username?: string | null
  b1_password?: string | null
  mapping?: Record<string, any> | null
}
export interface ErpPushResult {
  log_id: string
  status: 'pending' | 'success' | 'failed'
  http_status: number | null
  remote_ref:  string | null
  is_dry_run: boolean
  duration_ms: number | null
  error_message: string | null
  request_payload: Record<string, any> | null
}
export interface ErpPushLog {
  id: string
  company_id: string
  config_id: string | null
  invoice_id: string
  idempotency_key: string
  kind: string
  is_dry_run: boolean
  status: 'pending' | 'success' | 'failed'
  http_status: number | null
  remote_ref:  string | null
  request_payload:  Record<string, any> | null
  response_payload: Record<string, any> | null
  error_message: string | null
  duration_ms:   number | null
  created_at: string | null
}
export const erpApi = {
  listConfigs:   (params?: { is_active?: boolean }) =>
    api.get<ErpConfig[]>('/erp/configs', { params }),
  createConfig:  (payload: ErpConfigPayload) =>
    api.post<ErpConfig>('/erp/configs', payload),
  updateConfig:  (id: string, payload: Partial<ErpConfigPayload>) =>
    api.patch<ErpConfig>(`/erp/configs/${id}`, payload),
  deleteConfig:  (id: string) => api.delete(`/erp/configs/${id}`),
  pushInvoice:   (invoiceId: string, body: { config_id?: string; force?: boolean } = {}) =>
    api.post<ErpPushResult>(`/erp/invoices/${invoiceId}/push`, body),
  listLogs:      (params?: { invoice_id?: string; config_id?: string; status?: string; limit?: number }) =>
    api.get<ErpPushLog[]>('/erp/logs', { params }),
  getLog:        (id: string) => api.get<ErpPushLog>(`/erp/logs/${id}`),
}

// ── Extras pages backend clients ──────────────────────────────────
// Wire the 11 "extras" pages (Bundle zawia) to their corresponding backend
// modules. Each page can use these helpers to pull real data, with a mock
// fallback when the endpoint returns empty arrays / 404 on unseeded data.

export const passengersApi = {
  list:   (projectId: string) => api.get(`/passengers/${projectId}`),
  save:   (projectId: string, passengers: any[]) => api.put(`/passengers/${projectId}`, { passengers }),
  add:    (projectId: string, p: any) => api.post(`/passengers/${projectId}/add`, p),
  remove: (projectId: string, passengerId: string) => api.delete(`/passengers/${projectId}/${passengerId}`),
  stats:  (projectId: string) => api.get(`/passengers/${projectId}/stats`),
  exportRooming: (projectId: string) => api.get(`/passengers/${projectId}/export-rooming`),
}

export const budgetApi = {
  report:  (projectId: string) => api.get(`/budget/${projectId}/report`),
  actuals: (projectId: string, data: any) => api.post(`/budget/${projectId}/actuals`, data),
  trends:  () => api.get('/budget/trends'),
}

export const excelExportApi = {
  quotation: (projectId: string) =>
    api.get(`/export/quotation/${projectId}`, { responseType: 'blob' }),
  quotationCsv: (projectId: string) =>
    api.get(`/export/quotation-csv/${projectId}`, { responseType: 'blob' }),
}

export const clientPortalApi = {
  generateLink: (projectId: string, options?: { expires_days?: number; password?: string }) =>
    api.post(`/portal/generate-link`, { project_id: projectId, ...options }),
  comments: (projectId: string) => api.get(`/portal/comments/${projectId}`),
  status:   (projectId: string) => api.get(`/portal/status/${projectId}`),
}

export const whatIfApi = {
  simulate: (body: { project_id: string; hotel_swaps?: any[]; meal_swaps?: any[]; margin_override?: number; pax_override?: number }) =>
    api.post('/whatif/simulate', body),
  hotelSwap:    (body: any) => api.post('/whatif/hotel-swap',    body),
  marginAdjust: (body: any) => api.post('/whatif/margin-adjust', body),
  mealSwap:     (body: any) => api.post('/whatif/meal-swap',     body),
}

export interface AllotmentRow {
  id: string
  project_id?: string | null
  hotel_name: string
  city: string
  category?: string | null
  contract_id?: string | null
  check_in: string
  check_out: string
  deadline?: string | null
  rooms_blocked: number
  rooms_confirmed: number
  rooms_released: number
  price_per_night: number
  status: 'blocked' | 'confirmed' | 'partial' | 'released' | 'expired'
  notes?: string | null
}

export const allotmentsApi = {
  list:    (projectId?: string) =>
    api.get<AllotmentRow[]>('/allotments', { params: projectId ? { project_id: projectId } : {} }),
  create:  (data: Partial<AllotmentRow>) => api.post<AllotmentRow>('/allotments', data),
  update:  (id: string, data: Partial<AllotmentRow>) => api.patch<AllotmentRow>(`/allotments/${id}`, data),
  confirm: (id: string) => api.post<AllotmentRow>(`/allotments/${id}/confirm`),
  release: (id: string) => api.post<AllotmentRow>(`/allotments/${id}/release`),
  remove:  (id: string) => api.delete(`/allotments/${id}`),
}

export interface WaConversation {
  id: string
  contact_name: string
  contact_phone: string
  role: string
  avatar?: string | null
  project_ref?: string | null
  unread: number
  last_message?: string | null
  last_time?: string | null
  is_online: boolean
}
export interface WaMessage {
  id: string
  conversation_id: string
  text: string
  is_outgoing: boolean
  status: string
  type: string
  sent_at: string
}

export const whatsappApi = {
  conversations: ()                    => api.get<WaConversation[]>('/whatsapp/conversations'),
  createConvo:   (data: Partial<WaConversation>) => api.post<WaConversation>('/whatsapp/conversations', data),
  messages:      (id: string)          => api.get<WaMessage[]>(`/whatsapp/conversations/${id}/messages`),
  send:          (id: string, text: string, type: string = 'text') =>
    api.post<WaMessage>(`/whatsapp/conversations/${id}/messages`, { text, type }),
}

export interface FlightResult {
  id: string
  airline: string
  airline_code: string
  flight_number: string
  departure: { airport: string; code: string; time: string; date: string }
  arrival:   { airport: string; code: string; time: string; date: string }
  duration: string
  stops: number
  stop_cities: string[]
  price: number
  currency: string
  cabin_class: string
  seats_left: number
  baggage: string
  recommended: boolean
}
export interface FlightSearchParams {
  origin: string
  destination: string
  depart_date: string
  return_date?: string
  pax?: number
  cabin_class?: 'economy' | 'premium' | 'business' | 'first'
}

export const flightSearchApi = {
  search:   (p: FlightSearchParams) =>
    api.post<{ outbound: FlightResult[]; inbound: FlightResult[]; provider: string; currency: string }>('/flight-search/search', p),
  airports: () => api.get<{ code: string; name: string; city: string }[]>('/flight-search/airports'),
}

// NB: supplierScoresApi and fieldOpsApi are already defined above in this file.


// ──────────────────────────────────────────────────────────────────────────
// CRM — Accounts, Contacts, Activities, Deals, Tasks, Pipeline, Dashboard
// ──────────────────────────────────────────────────────────────────────────

export type CrmTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type CrmLifecycle =
  | 'prospect' | 'lead' | 'opportunity' | 'customer'
  | 'champion' | 'at_risk' | 'dormant'
export type CrmAccountType =
  | 'agency' | 'tour_operator' | 'direct' | 'corporate' | 'mice'
export type CrmDealStage =
  | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost'

export interface CrmAccount {
  id: string
  name: string
  legal_name?: string | null
  code?: string | null
  account_type: CrmAccountType
  primary_email?: string | null
  primary_phone?: string | null
  website?: string | null
  country?: string | null
  city?: string | null
  address?: string | null
  language?: string | null
  timezone?: string | null
  currency: string
  tax_id?: string | null
  payment_terms_days?: number | null
  credit_limit?: number | null
  tier: CrmTier
  lifecycle_stage: CrmLifecycle
  health_score: number
  nps_score?: number | null
  owner_user_id?: string | null
  last_contact_at?: string | null
  tags?: string[] | Record<string, unknown> | null
  preferences?: Record<string, unknown> | null
  description?: string | null
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface CrmContact {
  id: string
  account_id: string
  first_name: string
  last_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  whatsapp?: string | null
  linkedin?: string | null
  is_primary: boolean
  is_decision_maker: boolean
  notes?: string | null
  created_at: string
}

export interface CrmActivity {
  id: string
  account_id: string
  contact_id?: string | null
  deal_id?: string | null
  type: string
  title: string
  description?: string | null
  occurred_at: string
  owner_user_id?: string | null
  extra?: Record<string, unknown> | null
}

export interface CrmDeal {
  id: string
  account_id: string
  project_id?: string | null
  title: string
  stage: CrmDealStage
  amount_mad: number
  probability: number
  expected_close_date?: string | null
  closed_at?: string | null
  lost_reason?: string | null
  owner_user_id?: string | null
  description?: string | null
  pax?: number | null
  destination?: string | null
  created_at: string
}

export interface CrmTask {
  id: string
  account_id?: string | null
  deal_id?: string | null
  contact_id?: string | null
  title: string
  description?: string | null
  due_date?: string | null
  priority: 'low' | 'normal' | 'high' | 'urgent'
  completed_at?: string | null
  owner_user_id?: string | null
  created_at: string
}

export interface CrmAccountStats {
  total_projects: number
  won_projects: number
  lost_projects: number
  open_deals: number
  pipeline_value_mad: number
  won_revenue_mad: number
  conversion_rate: number
  open_tasks: number
  activities_30d: number
}

export interface CrmAccount360 {
  account: CrmAccount
  contacts: CrmContact[]
  activities: CrmActivity[]
  deals: CrmDeal[]
  tasks: CrmTask[]
  stats: CrmAccountStats
}

export interface CrmPipelineColumn {
  stage: CrmDealStage
  label: string
  deals: CrmDeal[]
  total_amount_mad: number
  count: number
}

export interface CrmPipelineView {
  columns: CrmPipelineColumn[]
  total_pipeline_mad: number
  weighted_pipeline_mad: number
}

export interface CrmDashboardStats {
  total_accounts: number
  new_accounts_30d: number
  accounts_by_tier: Record<string, number>
  accounts_by_lifecycle: Record<string, number>
  open_deals_count: number
  open_pipeline_mad: number
  weighted_pipeline_mad: number
  won_30d_count: number
  won_30d_mad: number
  lost_30d_count: number
  avg_deal_size_mad: number
  overdue_tasks: number
  upcoming_tasks_7d: number
}

export const crmApi = {
  // accounts
  listAccounts: (params?: {
    q?: string; tier?: string; lifecycle_stage?: string;
    account_type?: string; country?: string; owner_user_id?: string;
  }) => api.get<CrmAccount[]>('/crm/accounts', { params }),
  getAccount: (id: string) => api.get<CrmAccount>(`/crm/accounts/${id}`),
  createAccount: (data: Partial<CrmAccount>) => api.post<CrmAccount>('/crm/accounts', data),
  updateAccount: (id: string, data: Partial<CrmAccount>) =>
    api.patch<CrmAccount>(`/crm/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete<void>(`/crm/accounts/${id}`),
  account360: (id: string) => api.get<CrmAccount360>(`/crm/accounts/${id}/360`),
  // contacts
  listContacts: (accountId: string) =>
    api.get<CrmContact[]>(`/crm/accounts/${accountId}/contacts`),
  createContact: (accountId: string, data: Partial<CrmContact>) =>
    api.post<CrmContact>(`/crm/accounts/${accountId}/contacts`, data),
  updateContact: (id: string, data: Partial<CrmContact>) =>
    api.patch<CrmContact>(`/crm/contacts/${id}`, data),
  deleteContact: (id: string) => api.delete<void>(`/crm/contacts/${id}`),
  // activities
  listActivities: (accountId: string) =>
    api.get<CrmActivity[]>(`/crm/accounts/${accountId}/activities`),
  createActivity: (accountId: string, data: Partial<CrmActivity>) =>
    api.post<CrmActivity>(`/crm/accounts/${accountId}/activities`, data),
  // deals
  listDeals: (params?: { account_id?: string; stage?: string; owner_user_id?: string }) =>
    api.get<CrmDeal[]>('/crm/deals', { params }),
  createDeal: (accountId: string, data: Partial<CrmDeal>) =>
    api.post<CrmDeal>(`/crm/accounts/${accountId}/deals`, data),
  updateDeal: (id: string, data: Partial<CrmDeal>) =>
    api.patch<CrmDeal>(`/crm/deals/${id}`, data),
  winDeal: (id: string) => api.post<CrmDeal>(`/crm/deals/${id}/win`),
  loseDeal: (id: string, reason?: string) =>
    api.post<CrmDeal>(`/crm/deals/${id}/lose`, null, { params: reason ? { reason } : {} }),
  deleteDeal: (id: string) => api.delete<void>(`/crm/deals/${id}`),
  pipeline: (params?: { owner_user_id?: string }) =>
    api.get<CrmPipelineView>('/crm/pipeline', { params }),
  // tasks
  listTasks: (params?: { completed?: boolean; owner_user_id?: string; overdue?: boolean }) =>
    api.get<CrmTask[]>('/crm/tasks', { params }),
  createTask: (data: Partial<CrmTask> & { account_id?: string }) =>
    api.post<CrmTask>('/crm/tasks', data),
  updateTask: (id: string, data: Partial<CrmTask>) =>
    api.patch<CrmTask>(`/crm/tasks/${id}`, data),
  completeTask: (id: string) => api.post<CrmTask>(`/crm/tasks/${id}/complete`),
  deleteTask: (id: string) => api.delete<void>(`/crm/tasks/${id}`),
  // dashboard
  dashboard: () => api.get<CrmDashboardStats>('/crm/dashboard'),
}

// ── DMC Quote (DMC-style quote sheet + final program generator) ───────────
export interface DmcQuoteDay {
  id?: string
  quote_id?: string
  day_index: number
  date?: string | null
  cities?: string | null
  primary_city?: string | null
  km?: number
  hotel_name?: string | null
  hotel_category?: string | null
  room_type?: string | null
  basis?: string | null
  hotel_twin_mad?: number
  hotel_ss_mad?: number
  hotel_taxes_mad?: number
  hotel_upgrade_mad?: number
  hotel_water_mad?: number
  lunch_name?: string | null
  lunch_menu?: string | null
  lunch_pp_mad?: number
  dinner_name?: string | null
  dinner_menu?: string | null
  dinner_pp_mad?: number
  meal_water_mad?: number
  monuments_json?: any[] | null
  monuments_total_mad?: number
  activities_json?: any[] | null
  guide_day_mad?: number
  local_guide_mad?: number
  narrative?: string | null
}

export interface DmcQuote {
  id: string
  company_id?: string
  code?: string | null
  title: string
  client_name?: string | null
  client_reference?: string | null
  account_id?: string | null
  travel_period?: string | null
  start_date?: string | null
  end_date?: string | null
  nb_days: number
  nb_nights: number
  language: string
  currency_sell: string
  fx_to_mad: number
  markup_pct: number
  bus_cost_per_km: number
  fuel_factor: number
  foc_ratio?: string | null
  pax_brackets_json?: { brackets?: number[] } | null
  status: string
  inclusions?: string | null
  exclusions?: string | null
  terms?: string | null
  payment_terms?: string | null
  cancellation_policy?: string | null
  transportation_notes?: string | null
  guides_notes?: string | null
  notes?: string | null
  days?: DmcQuoteDay[]
}

export interface DmcQuoteSummary {
  id: string
  code?: string | null
  title: string
  client_name?: string | null
  client_reference?: string | null
  travel_period?: string | null
  status: string
  nb_days: number
  nb_nights: number
  currency_sell: string
  created_at?: string
}

export interface DmcQuoteCalc {
  quote_id: string
  currency_sell: string
  fx_to_mad: number
  markup_pct: number
  totals_mad: Record<string, number>
  brackets: { pax: number; foc_count: number; twin_pp_mad: number; twin_pp_sell: number; ss_pp_sell: number }[]
}

export interface DmcQuoteSendIn {
  to: string[]
  cc?: string[]
  subject?: string
  body?: string
  attach_docx?: boolean
  attach_xlsx?: boolean
}

export interface DmcQuoteVersionRow {
  id: string
  code?: string | null
  title: string
  version: number
  status: string
  is_locked: boolean
  parent_quote_id?: string | null
  created_at?: string
  sent_at?: string | null
  accepted_at?: string | null
}

export const dmcQuoteApi = {
  list:    (status?: string) => api.get<DmcQuoteSummary[]>('/dmc-quotes', { params: status ? { status } : {} }),
  get:     (id: string) => api.get<DmcQuote>(`/dmc-quotes/${id}`),
  create:  (data: Partial<DmcQuote>) => api.post<DmcQuote>('/dmc-quotes', data),
  update:  (id: string, data: Partial<DmcQuote>) => api.patch<DmcQuote>(`/dmc-quotes/${id}`, data),
  remove:  (id: string) => api.delete<void>(`/dmc-quotes/${id}`),
  upsertDay: (id: string, dayIndex: number, data: Partial<DmcQuoteDay>) =>
    api.put<DmcQuoteDay>(`/dmc-quotes/${id}/days/${dayIndex}`, data),
  calc:    (id: string) => api.get<DmcQuoteCalc>(`/dmc-quotes/${id}/calculate`),
  // Workflow
  send:    (id: string, data: DmcQuoteSendIn) =>
    api.post<{ ok: boolean; quote_id: string; status: string; send: any; attachments: string[] }>(
      `/dmc-quotes/${id}/send`, data),
  accept:  (id: string, data: Record<string, unknown> = {}) =>
    api.post<DmcQuote>(`/dmc-quotes/${id}/accept`, data),
  reject:  (id: string, reason?: string) =>
    api.post<DmcQuote>(`/dmc-quotes/${id}/reject`, { reason }),
  clone:   (id: string) => api.post<DmcQuote>(`/dmc-quotes/${id}/clone`, {}),
  versions:(id: string) => api.get<DmcQuoteVersionRow[]>(`/dmc-quotes/${id}/versions`),
  // Downloads
  programDocxUrl: (id: string) =>
    `${(api.defaults.baseURL || '').replace(/\/$/, '')}/dmc-quotes/${id}/program.docx`,
  quoteXlsxUrl: (id: string) =>
    `${(api.defaults.baseURL || '').replace(/\/$/, '')}/dmc-quotes/${id}/quote.xlsx`,
}

// ─── Travel Designer Pro ───────────────────────────────────────────
export type TDKind = 'hotel'|'restaurant'|'monument'|'transport'|'guide'|'activity'|'misc'
export interface TDItem {
  kind: TDKind
  item_id: string
  label: string
  city?: string | null
  qty: number
  unit_cost: number
  currency: string
  supplier?: string | null
  meta?: Record<string, any>
}
export interface TDDay {
  day_num: number
  city: string
  date?: string | null
  items: TDItem[]
}
export interface TDTotals {
  lines: number; days: number; total_cost: number; margin_pct: number;
  margin_value: number; public_total: number; per_pax: number; currency: string;
  by_kind: Record<string, number>; by_city: Record<string, number>;
}
export interface TDDraft {
  id: string; project_id: string | null; name: string; pax: number;
  start_date: string | null; currency: string; margin_pct: number;
  status: string; version: number; days: TDDay[]; totals: TDTotals;
  notes: string; last_saved_at: string | null;
}
export interface TDCatalogResp {
  kinds: string[]; items_total: number; cities: string[];
  catalog: Record<string, Array<Record<string, any>>>;
}

export const travelDesignerProApi = {
  catalog:  () => api.get<TDCatalogResp>('/travel-designer-pro/catalog'),
  drafts:   () => api.get<TDDraft[]>('/travel-designer-pro/drafts'),
  create:   (data: Partial<TDDraft>) => api.post<TDDraft>('/travel-designer-pro/drafts', data),
  get:      (id: string) => api.get<TDDraft>(`/travel-designer-pro/drafts/${id}`),
  patch:    (id: string, data: Partial<TDDraft>) => api.patch<TDDraft>(`/travel-designer-pro/drafts/${id}`, data),
  remove:   (id: string) => api.delete<void>(`/travel-designer-pro/drafts/${id}`),
  addDay:   (id: string, payload: { city: string; date?: string }) =>
    api.post<TDDraft>(`/travel-designer-pro/drafts/${id}/days`, payload),
  removeDay:(id: string, dayNum: number) =>
    api.delete<TDDraft>(`/travel-designer-pro/drafts/${id}/days/${dayNum}`),
  addItem:  (id: string, payload: { day_num: number; item_id: string; qty?: number }) =>
    api.post<TDDraft>(`/travel-designer-pro/drafts/${id}/items`, payload),
  moveItem: (id: string, payload: { from_day: number; to_day: number; item_index: number; new_index?: number }) =>
    api.post<TDDraft>(`/travel-designer-pro/drafts/${id}/items/move`, payload),
  removeItem:(id: string, payload: { day_num: number; item_index: number }) =>
    api.post<TDDraft>(`/travel-designer-pro/drafts/${id}/items/remove`, payload),
  recompute:(id: string) => api.post<{ id: string; totals: TDTotals }>(`/travel-designer-pro/drafts/${id}/recompute`, {}),
  saveVersion:(id: string) => api.post<{ id: string; version: number; saved_at: string }>(`/travel-designer-pro/drafts/${id}/save-version`, {}),
  promote:  (id: string) => api.post<{ id: string; status: string; promoted_at: string; summary: string; totals: TDTotals; demo_itinerary_id: string; demo_quotation_id: string }>(`/travel-designer-pro/drafts/${id}/promote`, {}),
  seedDemo: () => api.post<{ id: string; created: boolean; days?: number; totals?: TDTotals }>('/travel-designer-pro/seed-demo', {}),
}

// ─── B2B Portal (portal.stours.ma) ─────────────────────────────────────────
export interface B2BAgency {
  id: string; name: string; email: string; contact_name: string | null
  country: string | null; locale: string; tier: string; status: string
  commission_pct: number; notes: string; last_login_at: string | null
  created_at: string | null
}
export interface B2BQuotation {
  id: string; agency_id: string; agency_name?: string | null; agency_email?: string | null
  title: string; reference: string | null; pax: number; currency: string
  public_total: number; per_pax: number; margin_pct: number; status: string
  days: { day_num: number; city: string; summary: string }[]
  payload: { includes?: string[]; excludes?: string[] } & Record<string, any>
  public_token: string | null; public_url: string | null
  sent_at: string | null; viewed_at: string | null
  accepted_at: string | null; rejected_at: string | null; expires_at: string | null
  created_at: string | null; notes: string
}
export interface B2BTrackingEvent {
  id: string; agency_id: string; booking_id: string; booking_label: string | null
  kind: string; title: string; body: string; severity: string
  occurred_at: string | null; payload: Record<string, any>
}
export interface B2BActiveBooking {
  booking_id: string; booking_label: string | null; agency_id: string
  agency_name: string | null; events: number; last_event_at: string | null
  last_title: string | null; max_severity: string
}
export interface B2BSession {
  id: string; agency_id: string; agency_name: string | null
  purpose: string; target_id: string | null
  expires_at: string | null; used_at: string | null; last_seen_at: string | null
  created_at: string | null
}
export interface B2BMagicLinkResp {
  session_id: string; token: string; purpose: string; agency: B2BAgency
  public_url: string; expires_at: string | null
  demo_email_sent: boolean; demo_email_subject: string
}

export const b2bPortalApi = {
  dashboard:    () => api.get('/b2b-portal/dashboard'),
  seedDemo:     () => api.post('/b2b-portal/seed-demo', {}),
  agencies:     (params?: { status?: string; tier?: string }) =>
                  api.get<B2BAgency[]>('/b2b-portal/agencies', { params }),
  createAgency: (data: Partial<B2BAgency>) => api.post<B2BAgency>('/b2b-portal/agencies', data),
  patchAgency:  (id: string, data: Partial<B2BAgency>) =>
                  api.patch<B2BAgency>(`/b2b-portal/agencies/${id}`, data),
  quotations:   (params?: { status?: string; agency_id?: string }) =>
                  api.get<B2BQuotation[]>('/b2b-portal/quotations', { params }),
  createQuotation: (data: Partial<B2BQuotation>) =>
                  api.post<B2BQuotation>('/b2b-portal/quotations', data),
  sendQuotation:(id: string) =>
                  api.post<{ quotation: B2BQuotation; demo_email_sent_to: string; demo_email_subject: string }>(
                    `/b2b-portal/quotations/${id}/send`, {}),
  acceptQuotation:(id: string, note?: string) =>
                  api.post<B2BQuotation>(`/b2b-portal/quotations/${id}/accept`, { note }),
  rejectQuotation:(id: string, note?: string) =>
                  api.post<B2BQuotation>(`/b2b-portal/quotations/${id}/reject`, { note }),
  tracking:     (params?: { booking_id?: string; agency_id?: string }) =>
                  api.get<B2BTrackingEvent[]>('/b2b-portal/tracking', { params }),
  createTracking: (data: Partial<B2BTrackingEvent>) =>
                  api.post<B2BTrackingEvent>('/b2b-portal/tracking', data),
  activeBookings: () => api.get<B2BActiveBooking[]>('/b2b-portal/tracking/active'),
  sessions:     () => api.get<B2BSession[]>('/b2b-portal/sessions'),
  magicLink:    (data: { agency_id: string; purpose?: string; target_id?: string; expires_in_hours?: number }) =>
                  api.post<B2BMagicLinkResp>('/b2b-portal/sessions/magic-link', data),
  publicQuote:  (token: string) => api.get<B2BQuotation>(`/b2b-portal/public/quote/${token}`),
  publicTracking:(token: string) =>
                  api.get<{ booking: B2BQuotation; agency: B2BAgency; events: B2BTrackingEvent[] }>(
                    `/b2b-portal/public/tracking/${token}`),
  publicAccept: (token: string, note?: string) =>
                  api.post<B2BQuotation>(`/b2b-portal/public/quote/${token}/accept`, { note }),
  publicReject: (token: string, note?: string) =>
                  api.post<B2BQuotation>(`/b2b-portal/public/quote/${token}/reject`, { note }),
}
