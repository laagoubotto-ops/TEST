import { useState, useMemo } from 'react'
import {
  Hotel, Compass, Utensils, Star, Bus, Landmark,
  Search, Filter, MapPin, DollarSign, TrendingUp,
  Crown, ChevronDown, RefreshCw, Eye, Sparkles,
  Mountain, ChefHat, Award,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { premiumCatalogsApi } from '@/lib/api'

const KIND_CONFIG: Record<string, { label: string; icon: typeof Hotel; color: string; bg: string }> = {
  hotel:      { label: 'Hôtels',      icon: Hotel,    color: 'text-blue-500',    bg: 'bg-blue-500/10' },
  guide:      { label: 'Guides',      icon: Compass,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  restaurant: { label: 'Restaurants',  icon: Utensils, color: 'text-orange-500',  bg: 'bg-orange-500/10' },
  activity:   { label: 'Activités',    icon: Star,     color: 'text-purple-500',  bg: 'bg-purple-500/10' },
  transport:  { label: 'Transport',    icon: Bus,      color: 'text-cyan-500',    bg: 'bg-cyan-500/10' },
  monument:   { label: 'Monuments',    icon: Landmark, color: 'text-amber-500',   bg: 'bg-amber-500/10' },
}

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  'ultra-premium': { label: 'Ultra Premium', cls: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white' },
  premium:         { label: 'Premium',       cls: 'bg-rihla/90 text-white' },
  standard:        { label: 'Standard',      cls: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300' },
}

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v))

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={11}
          className={i <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}
        />
      ))}
      <span className="ml-1 text-[11px] text-slate-500">{value.toFixed(1)}</span>
    </div>
  )
}

export function PremiumCataloguesPage() {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['premium-catalogs'],
    queryFn: () => premiumCatalogsApi.list().then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['premium-catalogs-stats'],
    queryFn: () => premiumCatalogsApi.stats().then(r => r.data),
  })

  const { data: cities = [] } = useQuery({
    queryKey: ['premium-catalogs-cities'],
    queryFn: () => premiumCatalogsApi.cities().then(r => r.data),
  })

  const filtered = useMemo(() => {
    return items.filter((item: any) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (cityFilter !== 'all' && item.city !== cityFilter) return false
      if (tierFilter !== 'all' && item.tier !== tierFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !item.label.toLowerCase().includes(q) &&
          !item.city.toLowerCase().includes(q) &&
          !(item.supplier || '').toLowerCase().includes(q) &&
          !(item.category || '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [items, kindFilter, cityFilter, tierFilter, search])

  const groupedByKind = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const item of filtered) {
      if (!groups[item.kind]) groups[item.kind] = []
      groups[item.kind].push(item)
    }
    return groups
  }, [filtered])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <RefreshCw className="animate-spin text-rihla" size={40} />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Chargement des catalogues premium...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="text-rihla" size={22} />
              <h1 className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight">
                Catalogues Premium
              </h1>
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Hôtels · Guides · Restaurants · Activités · Transport · Monuments — {stats?.total || 0} références
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-lg text-[13px] w-72 focus:ring-2 focus:ring-rihla/30 focus:border-rihla outline-none transition-all text-slate-900 dark:text-cream"
              />
            </div>
            <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-cream shadow-sm' : 'text-slate-500'
                )}
              >Grille</button>
              <button
                onClick={() => setViewMode('table')}
                className={clsx('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-cream shadow-sm' : 'text-slate-500'
                )}
              >Table</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* KPI Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {Object.entries(KIND_CONFIG).map(([kind, cfg]) => {
              const count = stats.by_kind?.[kind] || 0
              return (
                <button
                  key={kind}
                  onClick={() => setKindFilter(kindFilter === kind ? 'all' : kind)}
                  className={clsx(
                    'p-3 rounded-lg border transition-all text-left',
                    kindFilter === kind
                      ? 'border-rihla bg-rihla/5 dark:bg-rihla/10 ring-2 ring-rihla/30'
                      : 'border-slate-200/80 dark:border-white/5 bg-white dark:bg-slate-900 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', cfg.bg, cfg.color)}>
                      <cfg.icon size={13} />
                    </div>
                    <span className="text-[18px] font-semibold text-slate-900 dark:text-cream">{count}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{cfg.label}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Toutes les villes</option>
            {cities.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
          >
            <option value="all">Tous les tiers</option>
            <option value="ultra-premium">Ultra Premium</option>
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
          </select>

          <div className="ml-auto text-[12px] text-slate-500">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            {kindFilter !== 'all' && ` · ${KIND_CONFIG[kindFilter]?.label}`}
          </div>
        </div>

        {/* Content */}
        {viewMode === 'grid' ? (
          <div className="space-y-8">
            {Object.entries(groupedByKind).map(([kind, kindItems]) => {
              const cfg = KIND_CONFIG[kind] || KIND_CONFIG.hotel
              return (
                <div key={kind}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={clsx('w-7 h-7 rounded-md flex items-center justify-center', cfg.bg, cfg.color)}>
                      <cfg.icon size={14} />
                    </div>
                    <h2 className="text-[16px] font-semibold text-slate-900 dark:text-cream">{cfg.label}</h2>
                    <span className="text-[12px] text-slate-400 ml-1">({kindItems.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {kindItems.map((item: any) => (
                      <CatalogCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Ville</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Catégorie</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Prix</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Tier</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Note</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => {
                  const cfg = KIND_CONFIG[item.kind] || KIND_CONFIG.hotel
                  const tier = TIER_BADGE[item.tier] || TIER_BADGE.standard
                  return (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className={clsx('w-6 h-6 rounded flex items-center justify-center', cfg.bg, cfg.color)}>
                          <cfg.icon size={12} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-cream">{item.label}</span>
                          {item.is_featured && <Sparkles size={12} className="text-amber-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          {item.city}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.category || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-cream">
                        {item.unit_cost > 0 ? `${fmt(item.unit_cost)} ${item.currency}` : 'Gratuit'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', tier.cls)}>{tier.label}</span>
                      </td>
                      <td className="px-4 py-3"><StarRating value={item.rating} /></td>
                      <td className="px-4 py-3 text-slate-500">{item.supplier || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 text-sm">Aucun résultat pour ces filtres</p>
          </div>
        )}
      </div>
    </div>
  )
}


function CatalogCard({ item }: { item: any }) {
  const cfg = KIND_CONFIG[item.kind] || KIND_CONFIG.hotel
  const tier = TIER_BADGE[item.tier] || TIER_BADGE.standard

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-white/5 p-4 hover:border-rihla/30 hover:shadow-md transition-all group">
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', cfg.bg, cfg.color)}>
          <cfg.icon size={15} />
        </div>
        <div className="flex items-center gap-1.5">
          {item.is_featured && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 rounded text-amber-600 text-[10px] font-semibold">
              <Sparkles size={10} /> Featured
            </span>
          )}
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', tier.cls)}>
            {tier.label}
          </span>
        </div>
      </div>

      {/* Label */}
      <h3 className="text-[14px] font-semibold text-slate-900 dark:text-cream mb-1 line-clamp-1 group-hover:text-rihla transition-colors">
        {item.label}
      </h3>

      {/* City + Category */}
      <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-3">
        <span className="flex items-center gap-1">
          <MapPin size={11} /> {item.city}
        </span>
        {item.category && (
          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[10px]">
            {item.category}
          </span>
        )}
      </div>

      {/* Meta info based on kind */}
      {item.meta && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {item.kind === 'guide' && item.meta.languages && (
            <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-[10px] text-emerald-600 font-medium">
              {item.meta.languages.join(' · ')}
            </span>
          )}
          {item.kind === 'guide' && item.meta.specialty && (
            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[10px] text-slate-600">
              {item.meta.specialty}
            </span>
          )}
          {item.kind === 'activity' && item.meta.duration_min && (
            <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-500/10 rounded text-[10px] text-purple-600 font-medium">
              {item.meta.duration_min} min
            </span>
          )}
          {item.kind === 'activity' && item.meta.difficulty && (
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
              item.meta.difficulty === 'easy' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' :
              item.meta.difficulty === 'moderate' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' :
              'bg-red-50 text-red-600 dark:bg-red-500/10'
            )}>
              {item.meta.difficulty}
            </span>
          )}
          {item.kind === 'restaurant' && item.meta.cuisine && (
            <span className="px-1.5 py-0.5 bg-orange-50 dark:bg-orange-500/10 rounded text-[10px] text-orange-600 font-medium">
              {item.meta.cuisine}
            </span>
          )}
          {item.kind === 'hotel' && item.meta.rooms && (
            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 rounded text-[10px] text-blue-600 font-medium">
              {item.meta.rooms} chambres
            </span>
          )}
          {item.kind === 'hotel' && item.meta.style && (
            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[10px] text-slate-600">
              {item.meta.style}
            </span>
          )}
          {item.kind === 'transport' && item.meta.vehicle && (
            <span className="px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-500/10 rounded text-[10px] text-cyan-600 font-medium">
              {item.meta.vehicle}
            </span>
          )}
          {item.kind === 'transport' && item.meta.capacity && (
            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-[10px] text-slate-600">
              {item.meta.capacity} PAX
            </span>
          )}
          {item.kind === 'monument' && item.meta.entry && (
            <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium',
              item.meta.entry === 'free' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' :
              'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
            )}>
              {item.meta.entry === 'free' ? 'Entrée libre' : item.meta.entry === 'incl' ? 'Entrée incluse' : 'Extérieur'}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: price + rating */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
        <span className="text-[15px] font-semibold text-slate-900 dark:text-cream">
          {item.unit_cost > 0 ? (
            <>{fmt(item.unit_cost)} <span className="text-[11px] text-slate-400 font-normal">{item.currency}</span></>
          ) : (
            <span className="text-emerald-500">Gratuit</span>
          )}
        </span>
        <StarRating value={item.rating} />
      </div>

      {/* Supplier */}
      {item.supplier && item.supplier !== '—' && (
        <p className="text-[11px] text-slate-400 mt-1.5">{item.supplier}</p>
      )}
    </div>
  )
}
