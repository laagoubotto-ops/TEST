import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Building2, DollarSign, TrendingUp, Star, Search, Filter,
  Plus, ChevronRight, Globe2, Mail, Phone, Wifi, WifiOff,
  AlertCircle, CheckCircle2, Activity as ActivityIcon, Sparkles,
} from 'lucide-react'
import clsx from 'clsx'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui'
import {
  crmApi,
  type CrmAccount, type CrmTier, type CrmLifecycle, type CrmAccountType,
} from '@/lib/api'

// ── tier styling ──────────────────────────────────────────────────────────
const TIER_META: Record<CrmTier, { label: string; cls: string; icon: string }> = {
  platinum: { label: 'Platinum', cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30', icon: '◆' },
  gold:     { label: 'Gold',     cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',     icon: '★' },
  silver:   { label: 'Silver',   cls: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',          icon: '✦' },
  bronze:   { label: 'Bronze',   cls: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30', icon: '✧' },
}

const LIFECYCLE_META: Record<CrmLifecycle, { label: string; cls: string }> = {
  prospect:    { label: 'Prospect',     cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  lead:        { label: 'Lead',         cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  opportunity: { label: 'Opportunité',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  customer:    { label: 'Client',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  champion:    { label: 'Champion',     cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  at_risk:     { label: 'À risque',     cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
  dormant:     { label: 'Dormant',      cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
}

const ACCOUNT_TYPE_LABEL: Record<CrmAccountType, string> = {
  agency: 'Agence', tour_operator: 'TO', direct: 'Direct', corporate: 'Corporate', mice: 'MICE',
}

// ── mock fallback (kept identical to the previous mock) ───────────────────
const MOCK_ACCOUNTS: CrmAccount[] = [
  {
    id: 'mock-1', code: 'AG-001', name: 'Luxe Voyages International', account_type: 'agency',
    primary_email: 's.martin@luxevoyages.fr', primary_phone: '+33145678900',
    country: 'France', city: 'Paris', currency: 'EUR',
    tier: 'platinum', lifecycle_stage: 'champion', health_score: 92, nps_score: 68,
    description: 'Tour-opérateur premium français',
    tags: ['luxury','fr','b2b'], created_at: '', updated_at: '',
  } as CrmAccount,
  {
    id: 'mock-2', code: 'AG-002', name: 'Atlas Tours UK', account_type: 'tour_operator',
    primary_email: 'jsmith@atlastours.co.uk', country: 'United Kingdom', city: 'London',
    currency: 'GBP', tier: 'gold', lifecycle_stage: 'customer', health_score: 72,
    created_at: '', updated_at: '',
  } as CrmAccount,
  {
    id: 'mock-3', code: 'AG-004', name: 'Elite Destinations NY', account_type: 'agency',
    primary_email: 'sarah@elitedest.com', country: 'USA', city: 'New York',
    currency: 'USD', tier: 'platinum', lifecycle_stage: 'champion', health_score: 95,
    created_at: '', updated_at: '',
  } as CrmAccount,
]

// ── helpers ───────────────────────────────────────────────────────────────
const fmtMad = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))


export function CrmPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [tierF, setTierF] = useState<string>('')
  const [lifecycleF, setLifecycleF] = useState<string>('')
  const [typeF, setTypeF] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)

  // Live data
  const { data: liveAccounts = [], isFetching, isError } = useQuery({
    queryKey: ['crm', 'accounts', { search, tierF, lifecycleF, typeF }],
    queryFn: () => crmApi.listAccounts({
      q: search || undefined,
      tier: tierF || undefined,
      lifecycle_stage: lifecycleF || undefined,
      account_type: typeF || undefined,
    }).then(r => r.data),
    retry: 0,
  })
  const { data: dash } = useQuery({
    queryKey: ['crm', 'dashboard'],
    queryFn: () => crmApi.dashboard().then(r => r.data),
    retry: 0,
  })

  const isLive = !isError && liveAccounts.length > 0
  const accounts = isLive ? liveAccounts : MOCK_ACCOUNTS

  // KPIs
  const kpis = useMemo(() => {
    if (dash) {
      return {
        total: dash.total_accounts,
        revenue: dash.won_30d_mad,
        avgConv: dash.open_deals_count > 0
          ? Math.round((dash.won_30d_count / Math.max(1, dash.won_30d_count + dash.lost_30d_count + dash.open_deals_count)) * 100)
          : 0,
        platinum: dash.accounts_by_tier?.platinum ?? 0,
      }
    }
    return {
      total: accounts.length,
      revenue: 7220000,
      avgConv: 64,
      platinum: accounts.filter(a => a.tier === 'platinum').length,
    }
  }, [dash, accounts])

  // Quick-create modal mutation
  const createMut = useMutation({
    mutationFn: (data: Partial<CrmAccount>) => crmApi.createAccount(data).then(r => r.data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['crm'] })
      setShowCreate(false)
      navigate(`/crm/accounts/${created.id}`)
    },
  })

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-12">
      <PageHeader
        eyebrow="Intelligence Commerciale"
        title="CRM & Comptes"
        subtitle="Gérez vos agences B2B, prospects directs et MICE — pipeline, fiches 360°, tâches & rappels."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm/pipeline" className="btn btn-secondary btn-sm gap-2">
              <TrendingUp size={14} /> Pipeline
            </Link>
            <Link to="/crm/tasks" className="btn btn-secondary btn-sm gap-2">
              <CheckCircle2 size={14} /> Tâches
            </Link>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} /> Nouveau compte
            </button>
          </div>
        }
      />

      <div className="p-8 max-w-[1600px] mx-auto space-y-6">

        {/* live/mock badge */}
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            Réseau B2B & directs — pipeline & santé client.
          </p>
          <div className="flex items-center gap-2">
            {isFetching && <span className="text-[10px] text-slate-400">Chargement…</span>}
            <span className={clsx(
              'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5',
              isLive
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                : 'bg-slate-100 dark:bg-white/10 text-slate-500',
            )}>
              {isLive ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isLive ? 'Live · API' : 'Démo (mock)'}
            </span>
          </div>
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Comptes actifs"
            value={kpis.total}
            icon={Building2}
            variant="dark"
            sub="Réseau B2B"
          />
          <StatCard
            label="CA gagné (30j)"
            value={`${(kpis.revenue / 1000000).toFixed(2)}M MAD`}
            icon={DollarSign}
            variant="primary"
            sub="Deals fermés-gagnés"
          />
          <StatCard
            label="Pipeline pondéré"
            value={`${((dash?.weighted_pipeline_mad ?? 0) / 1000000).toFixed(2)}M MAD`}
            icon={TrendingUp}
            sub={`${dash?.open_deals_count ?? 0} deals ouverts`}
          />
          <StatCard
            label="Comptes Platinum"
            value={kpis.platinum}
            icon={Star}
            sub="Top tier"
          />
        </div>

        {/* Filters bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher: nom, email, pays…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[13px] text-slate-800 dark:text-cream focus:ring-2 focus:ring-rihla focus:border-rihla transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={13} className="text-slate-400" />
            <select value={tierF} onChange={(e) => setTierF(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] text-slate-700 dark:text-cream">
              <option value="">Tous les tiers</option>
              {(['platinum','gold','silver','bronze'] as CrmTier[]).map(t =>
                <option key={t} value={t}>{TIER_META[t].label}</option>)}
            </select>
            <select value={lifecycleF} onChange={(e) => setLifecycleF(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] text-slate-700 dark:text-cream">
              <option value="">Tous les statuts</option>
              {(Object.keys(LIFECYCLE_META) as CrmLifecycle[]).map(l =>
                <option key={l} value={l}>{LIFECYCLE_META[l].label}</option>)}
            </select>
            <select value={typeF} onChange={(e) => setTypeF(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[12px] text-slate-700 dark:text-cream">
              <option value="">Tous les types</option>
              {(Object.keys(ACCOUNT_TYPE_LABEL) as CrmAccountType[]).map(t =>
                <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
            </select>
            {(search || tierF || lifecycleF || typeF) && (
              <button
                onClick={() => { setSearch(''); setTierF(''); setLifecycleF(''); setTypeF('') }}
                className="text-[11px] text-rihla font-bold hover:underline"
              >Réinitialiser</button>
            )}
          </div>
        </div>

        {/* Accounts table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-[13px] font-bold text-slate-800 dark:text-cream flex items-center gap-2">
              <Building2 size={14} className="text-rihla" />
              Comptes
              <span className="text-[10px] text-slate-400 font-normal">({accounts.length})</span>
            </h3>
            {dash && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                <ActivityIcon size={12} className="text-amber-500" />
                {dash.overdue_tasks} tâches en retard · {dash.upcoming_tasks_7d} cette semaine
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3 text-left">Compte & Localisation</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-center">Santé</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {accounts.map((a) => {
                  const tierMeta = TIER_META[a.tier as CrmTier] ?? TIER_META.bronze
                  const lcMeta = LIFECYCLE_META[a.lifecycle_stage as CrmLifecycle] ?? LIFECYCLE_META.prospect
                  return (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/crm/accounts/${a.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-rihla/15 to-rihla/5 flex items-center justify-center font-bold text-rihla">
                            {a.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-cream">{a.name}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-1"><Globe2 size={11} /> {a.country ?? '—'}</span>
                              {a.primary_email && <span className="flex items-center gap-1"><Mail size={11} /> {a.primary_email}</span>}
                              {a.primary_phone && <span className="flex items-center gap-1"><Phone size={11} /> {a.primary_phone}</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase">
                          {ACCOUNT_TYPE_LABEL[a.account_type as CrmAccountType] ?? a.account_type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase',
                          tierMeta.cls,
                        )}>
                          <span>{tierMeta.icon}</span> {tierMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', lcMeta.cls)}>
                          {lcMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className={clsx(
                              'h-full rounded-full',
                              a.health_score >= 80 ? 'bg-emerald-500' :
                              a.health_score >= 60 ? 'bg-amber-500' : 'bg-rose-500',
                            )} style={{ width: `${a.health_score}%` }} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-cream w-7 text-right">
                            {a.health_score}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight size={16} className="inline text-slate-400 group-hover:text-rihla" />
                      </td>
                    </tr>
                  )
                })}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <AlertCircle size={32} />
                        <p className="text-[13px]">Aucun compte trouvé.</p>
                        <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm gap-2">
                          <Sparkles size={13} /> Créer le premier compte
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => createMut.mutate(data)}
          submitting={createMut.isPending}
        />
      )}
    </div>
  )
}


// ── CreateAccountModal ────────────────────────────────────────────────────
function CreateAccountModal({
  onClose, onSubmit, submitting,
}: {
  onClose: () => void
  onSubmit: (data: Partial<CrmAccount>) => void
  submitting: boolean
}) {
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<CrmAccountType>('agency')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [tier, setTier] = useState<CrmTier>('silver')
  const [lifecycle, setLifecycle] = useState<CrmLifecycle>('prospect')
  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] w-[560px] max-w-full p-6 shadow-2xl">
        <h3 className="text-lg font-extrabold text-slate-800 dark:text-cream mb-4 flex items-center gap-2">
          <Plus size={18} className="text-rihla" /> Nouveau compte
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nom *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] focus:ring-2 focus:ring-rihla" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</label>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as CrmAccountType)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]">
                {(Object.keys(ACCOUNT_TYPE_LABEL) as CrmAccountType[]).map(t =>
                  <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pays</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email principal</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tier</label>
              <select value={tier} onChange={(e) => setTier(e.target.value as CrmTier)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]">
                {(['bronze','silver','gold','platinum'] as CrmTier[]).map(t =>
                  <option key={t} value={t}>{TIER_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Statut</label>
              <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as CrmLifecycle)}
                className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]">
                {(Object.keys(LIFECYCLE_META) as CrmLifecycle[]).map(l =>
                  <option key={l} value={l}>{LIFECYCLE_META[l].label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn btn-secondary btn-sm">Annuler</button>
          <button
            disabled={!name.trim() || submitting}
            onClick={() => onSubmit({
              name: name.trim(),
              account_type: accountType,
              country: country || undefined,
              primary_email: email || undefined,
              tier, lifecycle_stage: lifecycle,
              currency: 'MAD',
            })}
            className="btn btn-primary btn-sm gap-2"
          >
            {submitting ? 'Création…' : 'Créer & Ouvrir'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-3">Le score santé (0-100) est mis à jour automatiquement par le moteur.</p>
        {fmtMad(0) /* keep import alive */}
      </div>
    </div>
  )
}
