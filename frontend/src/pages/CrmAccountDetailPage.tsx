import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Mail, Phone, Globe2, MapPin, Building2, Star, TrendingUp,
  Plus, Edit3, Trash2, MessageSquare, PhoneCall, Calendar as CalIcon,
  CheckCircle2, Clock, AlertTriangle, Heart, Users, FileText, ListChecks,
  Activity as ActivityIcon, Mail as MailIcon, Sparkles, MoreVertical, Send,
} from 'lucide-react'
import clsx from 'clsx'

import { PageHeader } from '@/components/layout/PageHeader'
import {
  crmApi,
  type CrmAccount, type CrmContact, type CrmActivity,
  type CrmDeal, type CrmTask,
  type CrmTier, type CrmLifecycle, type CrmAccountType,
  type CrmDealStage,
} from '@/lib/api'

const TIER_META: Record<CrmTier, { label: string; cls: string }> = {
  platinum: { label: 'Platinum', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  gold:     { label: 'Gold',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  silver:   { label: 'Silver',   cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
  bronze:   { label: 'Bronze',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
}
const LIFECYCLE_LABEL: Record<CrmLifecycle, string> = {
  prospect: 'Prospect', lead: 'Lead', opportunity: 'Opportunité',
  customer: 'Client', champion: 'Champion', at_risk: 'À risque', dormant: 'Dormant',
}
const TYPE_LABEL: Record<CrmAccountType, string> = {
  agency: 'Agence', tour_operator: 'Tour Operator', direct: 'Direct',
  corporate: 'Corporate', mice: 'MICE',
}
const STAGE_LABEL: Record<CrmDealStage, string> = {
  qualification: 'Qualification', proposal: 'Proposition',
  negotiation: 'Négociation', won: 'Gagné', lost: 'Perdu',
}
const STAGE_CLS: Record<CrmDealStage, string> = {
  qualification: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  proposal:      'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  negotiation:   'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  won:           'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  lost:          'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}
const ACTIVITY_ICON = {
  call: PhoneCall, meeting: CalIcon, email: MailIcon, whatsapp: MessageSquare,
  note: FileText, proposal_sent: FileText, won: CheckCircle2,
  lost: AlertTriangle, stage_change: ActivityIcon, task_done: CheckCircle2,
} as const

const fmtMad = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

type Tab = 'overview' | 'contacts' | 'activities' | 'deals' | 'tasks' | 'notes'


export function CrmAccountDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const { data: view, isLoading, error } = useQuery({
    queryKey: ['crm', 'account', id, '360'],
    queryFn: () => crmApi.account360(id).then(r => r.data),
    enabled: !!id,
    retry: 0,
  })

  const updateMut = useMutation({
    mutationFn: (data: Partial<CrmAccount>) => crmApi.updateAccount(id, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const logActivityMut = useMutation({
    mutationFn: (data: Partial<CrmActivity>) => crmApi.createActivity(id, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const createTaskMut = useMutation({
    mutationFn: (data: Partial<CrmTask>) => crmApi.createTask({ ...data, account_id: id }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const completeTaskMut = useMutation({
    mutationFn: (taskId: string) => crmApi.completeTask(taskId).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const createContactMut = useMutation({
    mutationFn: (data: Partial<CrmContact>) => crmApi.createContact(id, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const createDealMut = useMutation({
    mutationFn: (data: Partial<CrmDeal>) => crmApi.createDeal(id, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const winDealMut = useMutation({
    mutationFn: (dealId: string) => crmApi.winDeal(dealId).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })
  const loseDealMut = useMutation({
    mutationFn: ({ dealId, reason }: { dealId: string; reason?: string }) =>
      crmApi.loseDeal(dealId, reason).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'account', id] }),
  })

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center text-slate-400">
        <div className="animate-pulse">Chargement…</div>
      </div>
    )
  }
  if (error || !view) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="text-rose-500" size={32} />
        <p className="text-slate-600 dark:text-cream">Compte introuvable</p>
        <Link to="/crm" className="btn btn-primary btn-sm">Retour au CRM</Link>
      </div>
    )
  }

  const { account: a, contacts, activities, deals, tasks, stats } = view
  const tier = TIER_META[a.tier as CrmTier] ?? TIER_META.bronze

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-12">
      <PageHeader
        eyebrow={`CRM · ${TYPE_LABEL[a.account_type as CrmAccountType] ?? a.account_type}`}
        title={a.name}
        subtitle={a.description ?? a.legal_name ?? '—'}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/crm')} className="btn btn-secondary btn-sm gap-2">
              <ArrowLeft size={14} /> CRM
            </button>
            <QuickAction icon={PhoneCall} label="Log appel"
              onClick={() => logActivityMut.mutate({ type: 'call', title: 'Appel téléphonique' })}
              loading={logActivityMut.isPending} />
            <QuickAction icon={MailIcon} label="Log email"
              onClick={() => logActivityMut.mutate({ type: 'email', title: 'Email envoyé' })}
              loading={logActivityMut.isPending} />
            <QuickAction icon={MessageSquare} label="Note"
              onClick={() => {
                const text = window.prompt('Note rapide')
                if (text) logActivityMut.mutate({ type: 'note', title: 'Note', description: text })
              }}
              loading={logActivityMut.isPending} />
          </div>
        }
      />

      <div className="p-8 max-w-[1600px] mx-auto space-y-6">

        {/* HEADER CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-[20px] bg-gradient-to-br from-rihla via-amber-500 to-amber-300 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg">
                {a.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{a.code ?? '—'}</p>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-cream">{a.name}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-[12px] text-slate-500 dark:text-slate-400">
                  {a.country && <span className="flex items-center gap-1"><Globe2 size={12} /> {a.country}{a.city ? ` · ${a.city}` : ''}</span>}
                  {a.primary_email && <a href={`mailto:${a.primary_email}`} className="flex items-center gap-1 hover:text-rihla"><Mail size={12} /> {a.primary_email}</a>}
                  {a.primary_phone && <a href={`tel:${a.primary_phone}`} className="flex items-center gap-1 hover:text-rihla"><Phone size={12} /> {a.primary_phone}</a>}
                  {a.website && <a href={a.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-rihla"><Globe2 size={12} /> {a.website}</a>}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', tier.cls)}>
                    {tier.label}
                  </span>
                  <select
                    value={a.lifecycle_stage}
                    onChange={(e) => updateMut.mutate({ lifecycle_stage: e.target.value as CrmLifecycle })}
                    className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-cream uppercase border-0 cursor-pointer"
                  >
                    {(Object.keys(LIFECYCLE_LABEL) as CrmLifecycle[]).map(l =>
                      <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* HEALTH METER */}
            <div className="text-center">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
                  <circle cx="50" cy="50" r="42" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="9" fill="none" />
                  <circle cx="50" cy="50" r="42" stroke="currentColor"
                    className={clsx(
                      a.health_score >= 80 ? 'text-emerald-500' :
                      a.health_score >= 60 ? 'text-amber-500' : 'text-rose-500',
                    )}
                    strokeWidth="9" fill="none" strokeLinecap="round"
                    strokeDasharray={`${(a.health_score / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Heart size={14} className="text-rose-400" />
                  <p className="text-2xl font-extrabold text-slate-800 dark:text-cream">{a.health_score}</p>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Santé</p>
            </div>
          </div>

          {/* QUICK STATS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
            <KPI label="Pipeline" value={`${(stats.pipeline_value_mad / 1000).toFixed(0)}K MAD`} icon={TrendingUp} accent="primary" />
            <KPI label="CA gagné" value={`${(stats.won_revenue_mad / 1000).toFixed(0)}K MAD`} icon={Star} accent="emerald" />
            <KPI label="Conversion" value={`${stats.conversion_rate}%`} icon={ActivityIcon} accent="amber" />
            <KPI label="Deals ouverts" value={stats.open_deals} icon={Building2} accent="sky" />
            <KPI label="Tâches" value={stats.open_tasks} icon={ListChecks} accent="violet" />
          </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
          {(
            [
              ['overview', 'Aperçu', Sparkles],
              ['contacts', `Contacts (${contacts.length})`, Users],
              ['activities', `Activité (${activities.length})`, ActivityIcon],
              ['deals', `Deals (${deals.length})`, TrendingUp],
              ['tasks', `Tâches (${tasks.length})`, ListChecks],
              ['notes', 'Préférences', Edit3],
            ] as [Tab, string, typeof Sparkles][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                'px-4 py-2 text-[12px] font-bold flex items-center gap-2 border-b-2 -mb-px transition-colors',
                tab === key
                  ? 'border-rihla text-rihla'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-cream',
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {tab === 'overview' && (
          <OverviewTab account={a} activities={activities} deals={deals} tasks={tasks} contacts={contacts} />
        )}
        {tab === 'contacts' && (
          <ContactsTab
            contacts={contacts}
            onCreate={(d) => createContactMut.mutate(d)}
            creating={createContactMut.isPending}
          />
        )}
        {tab === 'activities' && (
          <ActivitiesTab activities={activities} />
        )}
        {tab === 'deals' && (
          <DealsTab
            deals={deals}
            onCreate={(d) => createDealMut.mutate(d)}
            onWin={(dealId) => winDealMut.mutate(dealId)}
            onLose={(dealId, reason) => loseDealMut.mutate({ dealId, reason })}
            creating={createDealMut.isPending}
          />
        )}
        {tab === 'tasks' && (
          <TasksTab
            tasks={tasks}
            onCreate={(d) => createTaskMut.mutate(d)}
            onComplete={(taskId) => completeTaskMut.mutate(taskId)}
            creating={createTaskMut.isPending}
          />
        )}
        {tab === 'notes' && (
          <NotesTab account={a} onSave={(d) => updateMut.mutate(d)} saving={updateMut.isPending} />
        )}
      </div>
    </div>
  )
}


// ── Sub-components ────────────────────────────────────────────────────────
function QuickAction({
  icon: Icon, label, onClick, loading,
}: { icon: typeof Sparkles; label: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="btn btn-secondary btn-sm gap-2"
    >
      <Icon size={13} /> {label}
    </button>
  )
}

function KPI({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string | number; icon: typeof Sparkles
  accent: 'primary' | 'emerald' | 'amber' | 'sky' | 'violet'
}) {
  const accentCls = {
    primary: 'text-rihla bg-rihla/10',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300',
    sky: 'text-sky-600 bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300',
    violet: 'text-violet-600 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300',
  }[accent]
  return (
    <div className="flex items-center gap-3">
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', accentCls)}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-extrabold text-slate-800 dark:text-cream">{value}</p>
      </div>
    </div>
  )
}

function OverviewTab({
  account, activities, deals, tasks, contacts,
}: {
  account: CrmAccount
  activities: CrmActivity[]; deals: CrmDeal[]; tasks: CrmTask[]; contacts: CrmContact[]
}) {
  const recentActivities = activities.slice(0, 6)
  const openDeals = deals.filter(d => ['qualification', 'proposal', 'negotiation'].includes(d.stage))
  const openTasks = tasks.slice(0, 4)
  const primary = contacts.find(c => c.is_primary)
  const prefs = (account.preferences ?? {}) as Record<string, unknown>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card title="Deals ouverts" icon={TrendingUp}>
          {openDeals.length === 0 && <Empty msg="Aucun deal ouvert" />}
          <div className="space-y-2">
            {openDeals.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl">
                <div>
                  <p className="font-bold text-[13px] text-slate-800 dark:text-cream">{d.title}</p>
                  <p className="text-[11px] text-slate-400">{STAGE_LABEL[d.stage]} · {d.probability}% · close {fmtDate(d.expected_close_date)}</p>
                </div>
                <p className="font-extrabold text-rihla">{fmtMad(d.amount_mad)} MAD</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Activité récente" icon={ActivityIcon}>
          {recentActivities.length === 0 && <Empty msg="Aucune activité" />}
          <ol className="space-y-3">
            {recentActivities.map(ev => {
              const Icon = (ACTIVITY_ICON as any)[ev.type] ?? FileText
              return (
                <li key={ev.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-rihla/10 text-rihla flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-slate-800 dark:text-cream">{ev.title}</p>
                    {ev.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ev.description}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(ev.occurred_at)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Contact principal" icon={Users}>
          {primary ? (
            <div>
              <p className="font-bold text-slate-800 dark:text-cream">{primary.first_name} {primary.last_name ?? ''}</p>
              <p className="text-[11px] text-slate-400 mb-2">{primary.title ?? '—'}</p>
              {primary.email && <p className="text-[12px] flex items-center gap-2"><Mail size={12} className="text-slate-400" /> {primary.email}</p>}
              {primary.phone && <p className="text-[12px] flex items-center gap-2"><Phone size={12} className="text-slate-400" /> {primary.phone}</p>}
            </div>
          ) : (
            <Empty msg="Pas de contact principal" />
          )}
        </Card>

        <Card title={`Tâches à venir (${openTasks.length})`} icon={ListChecks}>
          {openTasks.length === 0 && <Empty msg="Aucune tâche" />}
          <ul className="space-y-2">
            {openTasks.map(t => (
              <li key={t.id} className="flex items-start gap-2">
                <Clock size={14} className="text-amber-500 mt-1 shrink-0" />
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-slate-800 dark:text-cream">{t.title}</p>
                  {t.due_date && <p className="text-[10px] text-slate-400">{fmtDateTime(t.due_date)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Préférences" icon={Sparkles}>
          {Object.keys(prefs).length === 0 ? <Empty msg="Aucune préférence" /> : (
            <ul className="space-y-1.5">
              {Object.entries(prefs).map(([k, v]) => (
                <li key={k} className="text-[12px]">
                  <span className="text-slate-400">{k}:</span>{' '}
                  <span className="font-bold text-slate-700 dark:text-cream">{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function ContactsTab({
  contacts, onCreate, creating,
}: {
  contacts: CrmContact[]
  onCreate: (d: Partial<CrmContact>) => void
  creating: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [fn, setFn] = useState('')
  const [ln, setLn] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((v) => !v)} className="btn btn-primary btn-sm gap-2">
          <Plus size={14} /> Ajouter un contact
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input value={fn} onChange={e => setFn(e.target.value)} placeholder="Prénom *"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={ln} onChange={e => setLn(e.target.value)} placeholder="Nom"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Fonction"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Annuler</button>
            <button
              disabled={!fn.trim() || creating}
              onClick={() => {
                onCreate({ first_name: fn, last_name: ln || null, title: title || null, email: email || null, phone: phone || null })
                setFn(''); setLn(''); setTitle(''); setEmail(''); setPhone('')
                setShowForm(false)
              }}
              className="btn btn-primary btn-sm gap-2"
            >
              {creating ? 'Ajout…' : <><Send size={13}/> Ajouter</>}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 font-bold uppercase text-[10px]">
            <tr>
              <th className="px-6 py-3 text-left">Nom</th>
              <th className="px-6 py-3 text-left">Fonction</th>
              <th className="px-6 py-3 text-left">Coordonnées</th>
              <th className="px-6 py-3 text-center">Rôle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {contacts.map(c => (
              <tr key={c.id}>
                <td className="px-6 py-3 font-bold text-slate-800 dark:text-cream">
                  {c.first_name} {c.last_name ?? ''}
                </td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{c.title ?? '—'}</td>
                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col gap-0.5">
                    {c.email && <span className="flex items-center gap-1 text-[12px]"><Mail size={11} /> {c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1 text-[12px]"><Phone size={11} /> {c.phone}</span>}
                  </div>
                </td>
                <td className="px-6 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    {c.is_primary && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rihla/15 text-rihla">Principal</span>}
                    {c.is_decision_maker && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Décideur</span>}
                  </div>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-[12px]">Aucun contact.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActivitiesTab({ activities }: { activities: CrmActivity[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6">
      <ol className="space-y-4">
        {activities.map(ev => {
          const Icon = (ACTIVITY_ICON as any)[ev.type] ?? FileText
          return (
            <li key={ev.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-rihla/10 text-rihla flex items-center justify-center shrink-0">
                <Icon size={16} />
              </div>
              <div className="flex-1 pb-4 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800 dark:text-cream">{ev.title}</p>
                  <p className="text-[11px] text-slate-400">{fmtDateTime(ev.occurred_at)}</p>
                </div>
                {ev.description && <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">{ev.description}</p>}
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{ev.type}</p>
              </div>
            </li>
          )
        })}
        {activities.length === 0 && <Empty msg="Aucune activité" />}
      </ol>
    </div>
  )
}

function DealsTab({
  deals, onCreate, onWin, onLose, creating,
}: {
  deals: CrmDeal[]
  onCreate: (d: Partial<CrmDeal>) => void
  onWin: (id: string) => void
  onLose: (id: string, reason?: string) => void
  creating: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState<CrmDealStage>('qualification')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary btn-sm gap-2">
          <Plus size={14} /> Nouveau deal
        </button>
      </div>
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre *"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="Montant MAD"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <select value={stage} onChange={e => setStage(e.target.value as CrmDealStage)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]">
              {(['qualification', 'proposal', 'negotiation'] as CrmDealStage[]).map(s =>
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Annuler</button>
            <button
              disabled={!title.trim() || creating}
              onClick={() => {
                onCreate({ title, stage, amount_mad: Number(amount) || 0 })
                setTitle(''); setAmount(''); setStage('qualification'); setShowForm(false)
              }}
              className="btn btn-primary btn-sm"
            >{creating ? 'Création…' : 'Créer'}</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 font-bold uppercase text-[10px]">
            <tr>
              <th className="px-6 py-3 text-left">Deal</th>
              <th className="px-4 py-3 text-left">Étape</th>
              <th className="px-4 py-3 text-center">Probabilité</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-center">Échéance</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {deals.map(d => (
              <tr key={d.id}>
                <td className="px-6 py-3">
                  <p className="font-bold text-slate-800 dark:text-cream">{d.title}</p>
                  {d.destination && <p className="text-[10px] text-slate-400">{d.destination}{d.pax ? ` · ${d.pax} pax` : ''}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold', STAGE_CLS[d.stage])}>
                    {STAGE_LABEL[d.stage]}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-[12px] font-bold text-slate-700 dark:text-cream">{d.probability}%</span>
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-rihla">{fmtMad(d.amount_mad)} MAD</td>
                <td className="px-4 py-3 text-center text-[11px] text-slate-500">{fmtDate(d.expected_close_date)}</td>
                <td className="px-4 py-3 text-center">
                  {['qualification', 'proposal', 'negotiation'].includes(d.stage) ? (
                    <div className="flex justify-center gap-1">
                      <button onClick={() => onWin(d.id)} title="Gagné"
                        className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => onLose(d.id, window.prompt('Raison de la perte ?') ?? undefined)} title="Perdu"
                        className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <MoreVertical size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-[12px]">Aucun deal.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TasksTab({
  tasks, onCreate, onComplete, creating,
}: {
  tasks: CrmTask[]
  onCreate: (d: Partial<CrmTask>) => void
  onComplete: (id: string) => void
  creating: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary btn-sm gap-2">
          <Plus size={14} /> Nouvelle tâche
        </button>
      </div>
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre *"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <input value={due} onChange={e => setDue(e.target.value)} type="datetime-local"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
            <select value={priority} onChange={e => setPriority(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]">
              <option value="low">Faible</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Annuler</button>
            <button
              disabled={!title.trim() || creating}
              onClick={() => {
                onCreate({ title, priority, due_date: due ? new Date(due).toISOString() : undefined })
                setTitle(''); setDue(''); setPriority('normal'); setShowForm(false)
              }}
              className="btn btn-primary btn-sm"
            >{creating ? 'Création…' : 'Créer'}</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-2">
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {tasks.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date()
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                <button onClick={() => onComplete(t.id)} className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:bg-rihla hover:border-rihla transition-all" />
                <div className="flex-1">
                  <p className="font-bold text-[13px] text-slate-800 dark:text-cream">{t.title}</p>
                  {t.due_date && (
                    <p className={clsx(
                      'text-[11px] flex items-center gap-1 mt-0.5',
                      overdue ? 'text-rose-600 font-bold' : 'text-slate-500',
                    )}>
                      <Clock size={11} /> {fmtDateTime(t.due_date)}
                      {overdue && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">EN RETARD</span>}
                    </p>
                  )}
                </div>
                <span className={clsx(
                  'px-2 py-1 rounded-full text-[10px] font-bold uppercase',
                  t.priority === 'urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' :
                  t.priority === 'high'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                  t.priority === 'low'    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
                )}>{t.priority}</span>
              </li>
            )
          })}
          {tasks.length === 0 && <li className="px-3 py-8 text-center text-slate-400 text-[12px]">Aucune tâche en cours.</li>}
        </ul>
      </div>
    </div>
  )
}

function NotesTab({
  account, onSave, saving,
}: {
  account: CrmAccount
  onSave: (d: Partial<CrmAccount>) => void
  saving: boolean
}) {
  const [description, setDescription] = useState(account.description ?? '')
  const [taxId, setTaxId] = useState(account.tax_id ?? '')
  const [paymentTerms, setPaymentTerms] = useState(account.payment_terms_days ?? 30)
  const [creditLimit, setCreditLimit] = useState(account.credit_limit ?? 0)
  const [address, setAddress] = useState(account.address ?? '')

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 space-y-4">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description / Notes</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
          className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Adresse</label>
        <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
          className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">N° fiscal</label>
          <input value={taxId} onChange={e => setTaxId(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Délai paiement (jours)</label>
          <input type="number" value={paymentTerms} onChange={e => setPaymentTerms(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plafond crédit (MAD)</label>
          <input type="number" value={creditLimit} onChange={e => setCreditLimit(Number(e.target.value))}
            className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px]" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button
          disabled={saving}
          onClick={() => onSave({
            description, address, tax_id: taxId || null,
            payment_terms_days: paymentTerms, credit_limit: creditLimit,
          })}
          className="btn btn-primary btn-sm gap-2"
        >
          {saving ? 'Enregistrement…' : <><CheckCircle2 size={13}/> Enregistrer</>}
        </button>
      </div>
    </div>
  )
}

function Card({
  title, icon: Icon, children,
}: { title: string; icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] p-5">
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-700 dark:text-cream mb-4 flex items-center gap-2">
        <Icon size={14} className="text-rihla" /> {title}
      </h3>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-[12px] text-slate-400 text-center py-3">{msg}</p>
}

export default CrmAccountDetailPage
// keep imports alive
void MapPin
