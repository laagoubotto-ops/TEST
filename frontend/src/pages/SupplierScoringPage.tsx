import { useState } from 'react'
import {
  Award, ChevronRight, Star, TrendingUp,
  TrendingDown, AlertTriangle, ThumbsUp,
  Search, Filter, ArrowUpDown, Eye,
  BarChart3, MessageSquare, Clock,
  CheckCircle2, XCircle, Hotel, Utensils,
  Bus, Users, Shield
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { supplierScoresApi } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────
interface Supplier {
  id: string
  name: string
  type: 'hotel' | 'restaurant' | 'transport' | 'guide'
  city: string
  score: number
  trend: 'up' | 'down' | 'stable'
  totalReviews: number
  avgRating: number
  incidents: number
  reliability: number
  lastUsed: string
  contractActive: boolean
  metrics: {
    quality: number
    punctuality: number
    communication: number
    priceValue: number
  }
  recentReviews: { author: string; rating: number; comment: string; date: string }[]
}

// ── Mock Data ──────────────────────────────────────────────────────
const SUPPLIERS: Supplier[] = [
  {
    id: 's1', name: 'Riad Fes', type: 'hotel', city: 'Fès', score: 94,
    trend: 'up', totalReviews: 147, avgRating: 4.8, incidents: 1,
    reliability: 98, lastUsed: '2026-04-15', contractActive: true,
    metrics: { quality: 96, punctuality: 95, communication: 90, priceValue: 88 },
    recentReviews: [
      { author: 'Prestige Tours', rating: 5, comment: 'Service impeccable, le groupe était ravi.', date: '2026-04-15' },
      { author: 'US Adventure', rating: 5, comment: 'Beautiful riad, excellent breakfast.', date: '2026-03-28' },
    ]
  },
  {
    id: 's2', name: 'La Mamounia', type: 'hotel', city: 'Marrakech', score: 97,
    trend: 'stable', totalReviews: 312, avgRating: 4.9, incidents: 0,
    reliability: 100, lastUsed: '2026-04-20', contractActive: true,
    metrics: { quality: 99, punctuality: 97, communication: 95, priceValue: 78 },
    recentReviews: [
      { author: 'Luxury Escapes', rating: 5, comment: 'Expérience exceptionnelle. Palace magnifique.', date: '2026-04-20' },
    ]
  },
  {
    id: 's3', name: 'Dar Roumana', type: 'restaurant', city: 'Fès', score: 88,
    trend: 'up', totalReviews: 89, avgRating: 4.5, incidents: 2,
    reliability: 92, lastUsed: '2026-04-10', contractActive: true,
    metrics: { quality: 92, punctuality: 82, communication: 85, priceValue: 90 },
    recentReviews: [
      { author: 'Marie Lefebvre', rating: 4, comment: 'Très bon mais un peu d\'attente pour un groupe de 20.', date: '2026-04-10' },
    ]
  },
  {
    id: 's4', name: 'Hassan El Moudir', type: 'guide', city: 'Fès', score: 96,
    trend: 'up', totalReviews: 203, avgRating: 4.9, incidents: 0,
    reliability: 99, lastUsed: '2026-04-18', contractActive: true,
    metrics: { quality: 98, punctuality: 97, communication: 96, priceValue: 92 },
    recentReviews: [
      { author: 'Henderson Group', rating: 5, comment: 'Hassan is the best guide in Fes! Incredibly knowledgeable.', date: '2026-04-18' },
      { author: 'Groupe Durand', rating: 5, comment: 'Guide exceptionnel. Passionné et très professionnel.', date: '2026-04-05' },
    ]
  },
  {
    id: 's5', name: 'Atlas Voyages Transport', type: 'transport', city: 'Marrakech', score: 82,
    trend: 'down', totalReviews: 64, avgRating: 4.1, incidents: 5,
    reliability: 85, lastUsed: '2026-04-12', contractActive: true,
    metrics: { quality: 80, punctuality: 75, communication: 82, priceValue: 88 },
    recentReviews: [
      { author: 'Tour Operator X', rating: 3, comment: 'Le bus était propre mais le chauffeur a été en retard de 45 min.', date: '2026-04-12' },
    ]
  },
  {
    id: 's6', name: 'Bivouac Sahara Luxury', type: 'hotel', city: 'Merzouga', score: 91,
    trend: 'stable', totalReviews: 56, avgRating: 4.7, incidents: 1,
    reliability: 95, lastUsed: '2026-03-30', contractActive: true,
    metrics: { quality: 94, punctuality: 90, communication: 88, priceValue: 85 },
    recentReviews: [
      { author: 'Desert Dreams', rating: 5, comment: 'Expérience désert inoubliable. Tentes luxueuses.', date: '2026-03-30' },
    ]
  },
  {
    id: 's7', name: 'Restaurant La Sqala', type: 'restaurant', city: 'Casablanca', score: 73,
    trend: 'down', totalReviews: 45, avgRating: 3.8, incidents: 4,
    reliability: 78, lastUsed: '2026-03-15', contractActive: false,
    metrics: { quality: 75, punctuality: 68, communication: 70, priceValue: 82 },
    recentReviews: [
      { author: 'Groupe Martin', rating: 3, comment: 'Service lent pour les groupes. Qualité correcte mais pas exceptionnelle.', date: '2026-03-15' },
    ]
  },
]

const typeIcons: Record<string, typeof Hotel> = {
  hotel: Hotel,
  restaurant: Utensils,
  transport: Bus,
  guide: Users,
}

const typeColors: Record<string, string> = {
  hotel: 'bg-blue-500',
  restaurant: 'bg-amber-500',
  transport: 'bg-emerald-500',
  guide: 'bg-purple-500',
}

const typeLabels: Record<string, string> = {
  hotel: 'Hôtel',
  restaurant: 'Restaurant',
  transport: 'Transport',
  guide: 'Guide',
}

const getScoreColor = (score: number) => {
  if (score >= 90) return 'text-emerald-500'
  if (score >= 75) return 'text-amber-500'
  return 'text-red-500'
}

const getScoreBg = (score: number) => {
  if (score >= 90) return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/20'
  if (score >= 75) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/20'
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/20'
}

export function SupplierScoringPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'score' | 'reviews' | 'incidents'>('score')
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>('s1')

  // Fetch live supplier scores from backend. If the company has no data yet,
  // fall back to mock suppliers so the page remains demoable.
  const { data: liveScores } = useQuery({
    queryKey: ['supplier-scores'],
    queryFn: () => supplierScoresApi.list().then(r => r.data as Array<{
      partner_id: string
      partner_name: string
      partner_kind?: string | null
      total_score: number
      review_score: number
      incident_score: number
      tariff_score: number
      responsiveness_score: number
    }>),
    retry: false,
    staleTime: 30_000,
  })

  const mappedLive: Supplier[] = (liveScores ?? []).map(s => ({
    id: s.partner_id,
    name: s.partner_name,
    type: (s.partner_kind === 'restaurant' ? 'restaurant'
      : s.partner_kind === 'transport' ? 'transport'
      : s.partner_kind === 'guide' ? 'guide' : 'hotel') as Supplier['type'],
    city: '—',
    score: s.total_score,
    trend: 'stable',
    totalReviews: 0,
    avgRating: Math.round((s.review_score / 40) * 5 * 10) / 10,
    incidents: Math.max(0, 30 - s.incident_score),
    reliability: Math.round((s.responsiveness_score / 15) * 100),
    lastUsed: '—',
    contractActive: true,
    metrics: {
      quality:       Math.round((s.review_score / 40) * 100),
      punctuality:   Math.round((s.responsiveness_score / 15) * 100),
      communication: Math.round((s.responsiveness_score / 15) * 100),
      priceValue:    Math.round((s.tariff_score / 15) * 100),
    },
    recentReviews: [],
  }))

  const source: Supplier[] = mappedLive.length > 0 ? mappedLive : SUPPLIERS
  const filtered = source
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
      const matchType = !typeFilter || s.type === typeFilter
      return matchSearch && matchType
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score
      if (sortBy === 'reviews') return b.totalReviews - a.totalReviews
      return b.incidents - a.incidents
    })

  const selected = SUPPLIERS.find(s => s.id === selectedSupplier)

  const avgScore = Math.round(SUPPLIERS.reduce((s, sup) => s + sup.score, 0) / SUPPLIERS.length)
  const totalIncidents = SUPPLIERS.reduce((s, sup) => s + sup.incidents, 0)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Qualité <ChevronRight size={10} /> Scoring Fournisseurs
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Award className="text-rihla" size={36} />
            Scoring Fournisseurs
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Score qualité automatique basé sur les avis clients, incidents et fiabilité
          </p>
        </div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Fournisseurs actifs</div>
          <div className="text-3xl font-black text-slate-900 dark:text-cream">{SUPPLIERS.filter(s => s.contractActive).length}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Score moyen</div>
          <div className={clsx("text-3xl font-black", getScoreColor(avgScore))}>{avgScore}/100</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Total avis</div>
          <div className="text-3xl font-black text-rihla">{SUPPLIERS.reduce((s, sup) => s + sup.totalReviews, 0)}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Incidents signalés</div>
          <div className="text-3xl font-black text-red-500">{totalIncidents}</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: SUPPLIER LIST ──────────────────────────────── */}
        <div className="col-span-5 space-y-4">

          {/* Search & Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-rihla/30"
              />
            </div>
            <div className="flex gap-1">
              {['hotel', 'restaurant', 'transport', 'guide'].map(type => {
                const Icon = typeIcons[type]
                return (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                    className={clsx(
                      "p-2.5 rounded-xl transition-all",
                      typeFilter === type ? "bg-rihla text-white" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600"
                    )}
                    title={typeLabels[type]}
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Supplier cards */}
          {filtered.map(s => {
            const Icon = typeIcons[s.type]
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSupplier(s.id)}
                className={clsx(
                  "w-full bg-white dark:bg-slate-900 rounded-2xl border p-5 text-left transition-all hover:shadow-md",
                  selectedSupplier === s.id ? "border-rihla shadow-lg shadow-rihla/10" : "border-slate-200 dark:border-white/10 shadow-sm"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center text-white", typeColors[s.type])}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                        {!s.contractActive && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[8px] font-bold rounded">Inactif</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{s.city} · {typeLabels[s.type]} · {s.totalReviews} avis</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={clsx("text-2xl font-black", getScoreColor(s.score))}>{s.score}</div>
                    <div className="flex items-center justify-end gap-1 text-[10px]">
                      {s.trend === 'up' && <TrendingUp size={10} className="text-emerald-500" />}
                      {s.trend === 'down' && <TrendingDown size={10} className="text-red-500" />}
                      <span className="text-slate-400">/100</span>
                    </div>
                  </div>
                </div>

                {/* Mini metrics bar */}
                <div className="grid grid-cols-4 gap-1 mt-3">
                  {Object.entries(s.metrics).map(([key, val]) => (
                    <div key={key} className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full", val >= 90 ? "bg-emerald-500" : val >= 75 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${val}%` }} />
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── RIGHT: DETAIL ──────────────────────────────────────── */}
        <div className="col-span-7 space-y-6">
          {selected && (() => {
            const Icon = typeIcons[selected.type]
            return (
              <>
                {/* Score card */}
                <div className={clsx("rounded-3xl border p-8", getScoreBg(selected.score))}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx("w-16 h-16 rounded-2xl flex items-center justify-center text-white", typeColors[selected.type])}>
                        <Icon size={28} />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-cream">{selected.name}</h2>
                        <div className="text-sm text-slate-500 mt-1">{selected.city} · {typeLabels[selected.type]}</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={clsx("text-5xl font-black", getScoreColor(selected.score))}>{selected.score}</div>
                      <div className="text-xs text-slate-400 font-bold">/100</div>
                      <div className="flex items-center justify-center gap-1 mt-1 text-xs">
                        {selected.trend === 'up' && <><TrendingUp size={12} className="text-emerald-500" /><span className="text-emerald-500 font-bold">En hausse</span></>}
                        {selected.trend === 'down' && <><TrendingDown size={12} className="text-red-500" /><span className="text-red-500 font-bold">En baisse</span></>}
                        {selected.trend === 'stable' && <span className="text-slate-400 font-bold">Stable</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics detail */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart3 size={14} /> Métriques Détaillées
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'quality', label: 'Qualité service', icon: Star },
                      { key: 'punctuality', label: 'Ponctualité', icon: Clock },
                      { key: 'communication', label: 'Communication', icon: MessageSquare },
                      { key: 'priceValue', label: 'Rapport qualité/prix', icon: Shield },
                    ].map(m => {
                      const val = selected.metrics[m.key as keyof typeof selected.metrics]
                      return (
                        <div key={m.key} className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                              <m.icon size={14} className="text-rihla" /> {m.label}
                            </div>
                            <span className={clsx("text-lg font-black", getScoreColor(val))}>{val}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className={clsx("h-full rounded-full transition-all", val >= 90 ? "bg-emerald-500" : val >= 75 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Total Avis</div>
                      <div className="text-lg font-black text-slate-900 dark:text-cream">{selected.totalReviews}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Note Moy.</div>
                      <div className="text-lg font-black text-amber-500">{selected.avgRating}/5</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Incidents</div>
                      <div className={clsx("text-lg font-black", selected.incidents > 0 ? "text-red-500" : "text-emerald-500")}>{selected.incidents}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-black text-slate-400 uppercase">Fiabilité</div>
                      <div className="text-lg font-black text-rihla">{selected.reliability}%</div>
                    </div>
                  </div>
                </div>

                {/* Recent reviews */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare size={14} /> Avis Récents
                  </h3>
                  <div className="space-y-3">
                    {selected.recentReviews.map((rev, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{rev.author}</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} size={10} className={clsx(s <= rev.rating ? "text-amber-400 fill-amber-400" : "text-slate-300")} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{rev.comment}"</p>
                        <div className="text-[10px] text-slate-400 mt-2">{rev.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
