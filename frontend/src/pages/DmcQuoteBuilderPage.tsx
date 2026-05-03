import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, FileSpreadsheet, Calculator, Save, Plus, Trash2,
  ChevronRight, Wifi, WifiOff, Building2,
  Hash, Calendar as CalendarIcon, DollarSign,
  Send, CheckCircle2, XCircle, Copy as CopyIcon, GitBranch, Lock,
} from 'lucide-react'
import clsx from 'clsx'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui'
import { dmcQuoteApi, type DmcQuote, type DmcQuoteDay, type DmcQuoteVersionRow } from '@/lib/api'

const fmt = (n: number, dp = 0) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: dp, minimumFractionDigits: dp }).format(n)

const DAY_FIELDS: { key: keyof DmcQuoteDay; label: string; type?: string; w?: string }[] = [
  { key: 'cities',           label: 'Villes',          w: 'w-32' },
  { key: 'km',               label: 'KM',     type: 'number', w: 'w-20' },
  { key: 'hotel_name',       label: 'Hôtel',           w: 'w-44' },
  { key: 'hotel_category',   label: 'Cat.',            w: 'w-16' },
  { key: 'basis',            label: 'Pension',         w: 'w-20' },
  { key: 'hotel_twin_mad',   label: '½ Twin',  type: 'number', w: 'w-24' },
  { key: 'hotel_ss_mad',     label: 'SS',      type: 'number', w: 'w-20' },
  { key: 'hotel_taxes_mad',  label: 'Taxes',   type: 'number', w: 'w-20' },
  { key: 'lunch_name',       label: 'Lunch',           w: 'w-32' },
  { key: 'lunch_pp_mad',     label: 'L. PP',   type: 'number', w: 'w-20' },
  { key: 'dinner_name',      label: 'Dîner',           w: 'w-32' },
  { key: 'dinner_pp_mad',    label: 'D. PP',   type: 'number', w: 'w-20' },
  { key: 'monuments_total_mad', label: 'Mon.', type: 'number', w: 'w-20' },
  { key: 'guide_day_mad',    label: 'Guide',   type: 'number', w: 'w-20' },
  { key: 'local_guide_mad',  label: 'LG',      type: 'number', w: 'w-20' },
]

// ── List ───────────────────────────────────────────────────────────────────
export function DmcQuoteListPage() {
  const navigate = useNavigate()
  const { data = [], isError, isFetching } = useQuery({
    queryKey: ['dmcq', 'list'],
    queryFn: async () => (await dmcQuoteApi.list()).data,
    retry: 1,
  })

  const live = !isError
  const stats = useMemo(() => ({
    total: data.length,
    drafts: data.filter(q => q.status === 'draft').length,
    sent: data.filter(q => q.status === 'sent').length,
    accepted: data.filter(q => q.status === 'accepted').length,
  }), [data])

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Devis DMC — Cotations"
        subtitle="Cotations style DMC avec génération automatique du programme final (DOCX) et de la feuille de devis interne (XLSX)"
        actions={
          <div className="flex items-center gap-3">
            <span className={clsx(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
              live ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'
            )}>
              {live ? <Wifi size={12}/> : <WifiOff size={12}/>}
              {live ? 'Live · API' : 'Hors ligne'}
            </span>
            <Link to="/dmc-quotes/new" className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
              <Plus size={14}/> Nouveau devis
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total devis" value={stats.total} icon={FileText}/>
        <StatCard label="Brouillons" value={stats.drafts} icon={FileSpreadsheet}/>
        <StatCard label="Envoyés" value={stats.sent} icon={ChevronRight}/>
        <StatCard label="Acceptés" value={stats.accepted} icon={DollarSign}/>
      </div>

      <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-700">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3">Jours</th>
              <th className="px-4 py-3">Devise</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map(q => (
              <tr key={q.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  onClick={() => navigate(`/dmc-quotes/${q.id}`)}>
                <td className="px-4 py-3 font-mono text-xs">{q.code || '—'}</td>
                <td className="px-4 py-3 font-medium">{q.title}</td>
                <td className="px-4 py-3">{q.client_name || '—'}</td>
                <td className="px-4 py-3">{q.travel_period || '—'}</td>
                <td className="px-4 py-3">{q.nb_days}j / {q.nb_nights}n</td>
                <td className="px-4 py-3 font-mono text-xs">{q.currency_sell}</td>
                <td className="px-4 py-3">
                  <span className={clsx(
                    'rounded-full border px-2 py-0.5 text-xs',
                    q.status === 'accepted' && 'border-emerald-300 bg-emerald-50 text-emerald-700',
                    q.status === 'sent' && 'border-sky-300 bg-sky-50 text-sky-700',
                    q.status === 'draft' && 'border-slate-300 bg-slate-50 text-slate-700',
                  )}>{q.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400"><ChevronRight size={16}/></td>
              </tr>
            ))}
            {!isFetching && data.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Aucun devis. <Link to="/dmc-quotes/new" className="text-rose-600 underline">Créer un devis</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ── Editor ─────────────────────────────────────────────────────────────────
export function DmcQuoteBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: quote, isError } = useQuery({
    queryKey: ['dmcq', id],
    queryFn: async () => (await dmcQuoteApi.get(id!)).data,
    enabled: !isNew,
  })
  const { data: calc } = useQuery({
    queryKey: ['dmcq', id, 'calc'],
    queryFn: async () => (await dmcQuoteApi.calc(id!)).data,
    enabled: !isNew && !isError,
  })

  // Local edit buffer for header + days
  const [draft, setDraft] = useState<Partial<DmcQuote>>({})
  const [days, setDays] = useState<DmcQuoteDay[]>([])
  useEffect(() => {
    if (quote) {
      setDraft(quote)
      setDays(quote.days || [])
    } else if (isNew) {
      setDraft({
        title: 'Nouveau circuit DMC',
        currency_sell: 'USD',
        fx_to_mad: 10.25,
        markup_pct: 8,
        bus_cost_per_km: 8.5,
        nb_days: 0,
        nb_nights: 0,
        language: 'en',
        pax_brackets_json: { brackets: [10, 15, 20, 25, 30, 35] },
      })
      setDays([])
    }
  }, [quote, isNew])

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const res = await dmcQuoteApi.create({ ...draft, days } as any)
        return res.data
      }
      const res = await dmcQuoteApi.update(id!, { ...draft, days } as any)
      return res.data
    },
    onSuccess: (q) => {
      qc.invalidateQueries({ queryKey: ['dmcq'] })
      if (isNew && q?.id) navigate(`/dmc-quotes/${q.id}`)
    },
  })

  // Workflow state
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendCc, setSendCc] = useState('')
  const [sendSubject, setSendSubject] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [attachDocx, setAttachDocx] = useState(true)
  const [attachXlsx, setAttachXlsx] = useState(true)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const { data: versions = [] } = useQuery<DmcQuoteVersionRow[]>({
    queryKey: ['dmcq', id, 'versions'],
    queryFn: async () => (await dmcQuoteApi.versions(id!)).data,
    enabled: !isNew && !isError,
  })

  const sendMut = useMutation({
    mutationFn: async () => {
      const res = await dmcQuoteApi.send(id!, {
        to: sendTo.split(',').map(s => s.trim()).filter(Boolean),
        cc: sendCc ? sendCc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        subject: sendSubject || undefined,
        body: sendBody || undefined,
        attach_docx: attachDocx,
        attach_xlsx: attachXlsx,
      })
      return res.data
    },
    onSuccess: (r) => {
      setSendResult(`OK — statut: ${r.send?.status || '?'} · ${r.attachments.length} pièce(s) jointe(s)`)
      qc.invalidateQueries({ queryKey: ['dmcq'] })
      setTimeout(() => setShowSendModal(false), 1500)
    },
    onError: (e: any) => setSendResult(`Erreur: ${e?.message || 'Échec'}`),
  })

  const acceptMut = useMutation({
    mutationFn: async () => (await dmcQuoteApi.accept(id!)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dmcq'] }),
  })

  const rejectMut = useMutation({
    mutationFn: async (reason?: string) => (await dmcQuoteApi.reject(id!, reason)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dmcq'] }),
  })

  const cloneMut = useMutation({
    mutationFn: async () => (await dmcQuoteApi.clone(id!)).data,
    onSuccess: (q) => {
      qc.invalidateQueries({ queryKey: ['dmcq'] })
      if (q?.id) navigate(`/dmc-quotes/${q.id}`)
    },
  })

  const addDay = () => {
    const next = days.length + 1
    setDays([...days, {
      day_index: next, primary_city: '', cities: '', km: 0,
      hotel_name: '', hotel_category: '4*', room_type: 'STANDARD', basis: 'HB',
      hotel_twin_mad: 0, hotel_ss_mad: 0, hotel_taxes_mad: 0,
      lunch_name: '', lunch_pp_mad: 0, dinner_name: '', dinner_pp_mad: 0,
      monuments_json: [], monuments_total_mad: 0, guide_day_mad: 0, local_guide_mad: 0,
    }])
  }

  const updateDay = (idx: number, field: keyof DmcQuoteDay, value: any) => {
    const next = [...days]
    ;(next[idx] as any)[field] = value
    setDays(next)
  }

  const removeDay = (idx: number) => {
    const next = days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day_index: i + 1 }))
    setDays(next)
  }

  const totals = calc?.totals_mad
  const brackets = calc?.brackets || []

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={draft.title || 'Devis DMC'}
        subtitle={[draft.code || 'Brouillon', draft.client_name, draft.travel_period].filter(Boolean).join(' · ')}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/dmc-quotes" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
              ← Liste
            </Link>
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              <Save size={14}/> {isNew ? 'Créer' : 'Enregistrer'}
            </button>
            {!isNew && (
              <>
                <a
                  href={dmcQuoteApi.programDocxUrl(id!) + `?token=${localStorage.getItem('access_token') || ''}`}
                  download
                  onClick={(e) => {
                    e.preventDefault()
                    const url = dmcQuoteApi.programDocxUrl(id!)
                    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
                      .then(r => r.blob()).then(b => {
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(b)
                        a.download = `${(draft.title || 'program').replace(/[^a-z0-9]/gi, '_')}.docx`
                        a.click()
                      })
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
                >
                  <FileText size={14}/> Programme final (DOCX)
                </a>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    const url = dmcQuoteApi.quoteXlsxUrl(id!)
                    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
                      .then(r => r.blob()).then(b => {
                        const a = document.createElement('a')
                        a.href = URL.createObjectURL(b)
                        a.download = `${(draft.title || 'quote').replace(/[^a-z0-9]/gi, '_')}_quote.xlsx`
                        a.click()
                      })
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                >
                  <FileSpreadsheet size={14}/> Devis interne (XLSX)
                </a>
              </>
            )}
          </div>
        }
      />

      {/* Header form */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold uppercase text-slate-500">Informations générales</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input label="Titre" value={draft.title || ''} onChange={(v) => setDraft({ ...draft, title: v })}/>
          <Input label="Code" value={draft.code || ''} onChange={(v) => setDraft({ ...draft, code: v })}/>
          <Input label="Client" value={draft.client_name || ''} onChange={(v) => setDraft({ ...draft, client_name: v })}/>
          <Input label="Référence client" value={draft.client_reference || ''} onChange={(v) => setDraft({ ...draft, client_reference: v })}/>
          <Input label="Période voyage" value={draft.travel_period || ''} onChange={(v) => setDraft({ ...draft, travel_period: v })} placeholder="NOV 2026"/>
          <Input label="Langue" value={draft.language || 'en'} onChange={(v) => setDraft({ ...draft, language: v })}/>
          <Input label="Devise vente" value={draft.currency_sell || 'USD'} onChange={(v) => setDraft({ ...draft, currency_sell: v })}/>
          <Input label="FX → MAD" type="number" value={String(draft.fx_to_mad ?? 10.25)} onChange={(v) => setDraft({ ...draft, fx_to_mad: Number(v) })}/>
          <Input label="Markup %" type="number" value={String(draft.markup_pct ?? 8)} onChange={(v) => setDraft({ ...draft, markup_pct: Number(v) })}/>
          <Input label="Bus MAD/km" type="number" value={String(draft.bus_cost_per_km ?? 8.5)} onChange={(v) => setDraft({ ...draft, bus_cost_per_km: Number(v) })}/>
          <Input label="Nb jours" type="number" value={String(draft.nb_days ?? 0)} onChange={(v) => setDraft({ ...draft, nb_days: Number(v) })}/>
          <Input label="Nb nuits" type="number" value={String(draft.nb_nights ?? 0)} onChange={(v) => setDraft({ ...draft, nb_nights: Number(v) })}/>
        </div>
      </div>

      {/* Workflow panel */}
      {!isNew && quote && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold uppercase text-slate-500">Workflow & Versionning</h3>
              <span className={clsx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                quote.status === 'draft' && 'bg-slate-100 text-slate-700',
                quote.status === 'sent' && 'bg-sky-100 text-sky-700',
                quote.status === 'accepted' && 'bg-emerald-100 text-emerald-700',
                quote.status === 'rejected' && 'bg-rose-100 text-rose-700',
              )}>
                {quote.status?.toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <GitBranch size={12}/> V{(quote as any).version || 1}
              </span>
              {(quote as any).is_locked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <Lock size={11}/> Verrouillé
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={(quote as any).is_locked || sendMut.isPending}
                onClick={() => setShowSendModal(true)}
                className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-40"
                title={(quote as any).is_locked ? 'Devis verrouillé : clonez en V2 pour modifier puis envoyer' : 'Envoyer par email Microsoft 365'}
              >
                <Send size={12}/> Envoyer (M365)
              </button>
              <button
                disabled={quote.status !== 'sent' || acceptMut.isPending}
                onClick={() => acceptMut.mutate()}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <CheckCircle2 size={12}/> Accepter (→ Project Won)
              </button>
              <button
                disabled={quote.status === 'rejected' || rejectMut.isPending}
                onClick={() => {
                  const r = window.prompt('Raison du refus (optionnel)') || undefined
                  rejectMut.mutate(r)
                }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-40"
              >
                <XCircle size={12}/> Refuser
              </button>
              <button
                disabled={cloneMut.isPending}
                onClick={() => cloneMut.mutate()}
                className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                title="Cloner en V2 modifiable (V1 reste immuable)"
              >
                <CopyIcon size={12}/> Cloner V{((quote as any).version || 1) + 1}
              </button>
            </div>
          </div>

          {/* Versions chain */}
          {versions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Verrou</th>
                    <th className="px-3 py-2">Créé</th>
                    <th className="px-3 py-2">Envoyé</th>
                    <th className="px-3 py-2">Accepté</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map(v => (
                    <tr key={v.id} className={clsx(
                      'border-t border-slate-100 dark:border-slate-800',
                      v.id === id && 'bg-rose-50 dark:bg-rose-500/10'
                    )}>
                      <td className="px-3 py-2 font-bold">V{v.version}</td>
                      <td className="px-3 py-2 font-mono">{v.code || '—'}</td>
                      <td className="px-3 py-2 uppercase">{v.status}</td>
                      <td className="px-3 py-2">{v.is_locked ? <Lock size={12} className="text-amber-600"/> : '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{v.created_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 text-slate-500">{v.sent_at?.slice(0, 16).replace('T', ' ') || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{v.accepted_at?.slice(0, 16).replace('T', ' ') || '—'}</td>
                      <td className="px-3 py-2">
                        {v.id !== id && (
                          <Link to={`/dmc-quotes/${v.id}`} className="text-rose-600 hover:underline">Ouvrir</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Envoyer le devis par Microsoft 365</h3>
            <div className="space-y-3">
              <Input label="À (séparer par virgules)" value={sendTo} onChange={setSendTo} placeholder="client@agence.com"/>
              <Input label="CC (optionnel)" value={sendCc} onChange={setSendCc}/>
              <Input label="Sujet (optionnel)" value={sendSubject} onChange={setSendSubject} placeholder={`Devis ${draft.code || draft.title}`}/>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase text-slate-500">Message</span>
                <textarea
                  value={sendBody} onChange={(e) => setSendBody(e.target.value)} rows={4}
                  placeholder="Bonjour, veuillez trouver ci-joint notre proposition…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-rose-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={attachDocx} onChange={(e) => setAttachDocx(e.target.checked)}/> Programme final (DOCX)</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={attachXlsx} onChange={(e) => setAttachXlsx(e.target.checked)}/> Devis interne (XLSX)</label>
              </div>
              {sendResult && (
                <div className={clsx('rounded-lg px-3 py-2 text-xs',
                  sendResult.startsWith('OK') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                )}>{sendResult}</div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setShowSendModal(false); setSendResult(null) }} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600">Annuler</button>
              <button
                disabled={!sendTo.trim() || sendMut.isPending}
                onClick={() => sendMut.mutate()}
                className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <Send size={14}/> {sendMut.isPending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Days editor */}
      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Itinéraire jour par jour ({days.length} jours)</h3>
          <button onClick={addDay} className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
            <Plus size={12}/> Ajouter un jour
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left uppercase text-slate-500 dark:border-slate-700">
                <th className="px-1 py-2 w-12">J</th>
                {DAY_FIELDS.map(f => <th key={f.key} className={clsx('px-1 py-2', f.w)}>{f.label}</th>)}
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-1 py-1 font-bold text-rose-600">J{d.day_index}</td>
                  {DAY_FIELDS.map(f => (
                    <td key={f.key} className={clsx('px-1 py-1', f.w)}>
                      <input
                        type={f.type || 'text'}
                        value={(d as any)[f.key] ?? ''}
                        onChange={(e) => updateDay(idx, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                        className="w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs focus:border-rose-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button onClick={() => removeDay(idx)} className="text-rose-500 hover:text-rose-700">
                      <Trash2 size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr><td colSpan={DAY_FIELDS.length + 2} className="px-4 py-8 text-center text-slate-500">Aucun jour. Cliquez sur "Ajouter un jour" pour commencer.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing brackets */}
      {!isNew && totals && (
        <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Calculator size={18} className="text-rose-600"/>
            <h3 className="text-sm font-semibold uppercase text-slate-500">Pricing — Estimate offer</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7 mb-5">
            <KpiBox label="Hôtels (MAD)" value={fmt(totals.hotels)}/>
            <KpiBox label="Restaurants (MAD)" value={fmt(totals.restaurants)}/>
            <KpiBox label="Monuments (MAD)" value={fmt(totals.monuments)}/>
            <KpiBox label="Guides (MAD)" value={fmt(totals.guide)}/>
            <KpiBox label="Bus (MAD)" value={fmt(totals.bus)}/>
            <KpiBox label="Tips (MAD)" value={fmt(totals.tips)}/>
            <KpiBox label="Total fixe groupe (MAD)" value={fmt(totals.total_group_fixed)} highlight/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-rose-600 text-white">
                  <th className="px-3 py-2 text-left">BASIS</th>
                  <th className="px-3 py-2 text-right">PRIX / PERS. TWIN ({calc?.currency_sell})</th>
                  <th className="px-3 py-2 text-right">SUPPL. SINGLE ({calc?.currency_sell})</th>
                </tr>
              </thead>
              <tbody>
                {brackets.map(b => (
                  <tr key={b.pax} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-medium">{b.pax} + {b.foc_count} FOC</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(b.twin_pp_sell, 0)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(b.ss_pp_sell, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


// ── helpers ────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-rose-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
      />
    </label>
  )
}

function KpiBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={clsx(
      'rounded-lg border px-3 py-2 text-center',
      highlight
        ? 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
    )}>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className={clsx('font-mono text-sm font-bold', highlight && 'text-rose-700 dark:text-rose-300')}>{value}</div>
    </div>
  )
}
