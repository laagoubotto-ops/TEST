import { useState } from 'react'
import {
  Users, Building2, Truck, Compass, Search,
  Mail, Phone, CreditCard, ArrowUpDown,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { partnersApi, type Partner, type PartnerType } from '@/lib/api'
import { clsx } from 'clsx'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Users; color: string; bg: string }> = {
  customer: { label: 'Clients', icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  supplier: { label: 'Fournisseurs', icon: Truck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  guide:    { label: 'Guides', icon: Compass, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  employee: { label: 'Employés', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  sub_agent:{ label: 'Sous-agents', icon: Building2, color: 'text-orange-500', bg: 'bg-orange-500/10' },
}

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v))

export function PartnersPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners', typeFilter, search],
    queryFn: () => partnersApi.list({
      type: typeFilter !== 'all' ? typeFilter as PartnerType : undefined,
      search: search || undefined,
    }).then(r => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['partners-stats'],
    queryFn: () => partnersApi.stats().then(r => r.data),
  })

  const byType = (stats as any)?.by_type || {}

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-rihla" size={28} />
            Gestion des Partenaires
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {(stats as any)?.total || 0} partenaires actifs
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const count = byType[key] || 0
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
              className={clsx(
                'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all text-left',
                typeFilter === key
                  ? 'border-rihla/50 bg-rihla/5 ring-1 ring-rihla/30'
                  : 'border-slate-200 dark:border-white/10 hover:border-rihla/30',
              )}
            >
              <div className={clsx('rounded-lg p-2', cfg.bg)}>
                <Icon size={18} className={cfg.color} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{count}</p>
                <p className="text-xs text-slate-500">{cfg.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un partenaire..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-rihla/30 focus:border-rihla outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : partners.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Aucun partenaire trouvé</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-left text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Devise</th>
                <th className="px-4 py-3">
                  <span className="flex items-center gap-1">
                    <CreditCard size={12} /> Conditions
                  </span>
                </th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {partners.map(p => {
                const cfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.customer
                const Icon = cfg.icon
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.email && <span className="flex items-center gap-1"><Mail size={11} />{p.email}</span>}
                      {p.phone && <span className="flex items-center gap-1 mt-0.5"><Phone size={11} />{p.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">{p.currency}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.payment_terms_days && <span>Paiement: {p.payment_terms_days}j</span>}
                      {p.credit_limit && <span className="ml-2">Crédit: {fmt(p.credit_limit)} {p.currency}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-100 text-red-700'
                      )}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
