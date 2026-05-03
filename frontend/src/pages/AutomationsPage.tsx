import { useEffect, useMemo, useState } from 'react'
import {
  Zap, Play, RefreshCw, CheckCircle2, AlertCircle, Mail, ListChecks,
  Bell, ArrowRightCircle, Clock, FileText, Database, ChevronRight,
} from 'lucide-react'
import {
  automationsApi,
  type AutomationDashboard,
  type AutomationRule,
  type AutomationRun,
} from '@/lib/api'

const ACTION_ICON: Record<string, any> = {
  email: Mail,
  task: ListChecks,
  notify: Bell,
  status_change: ArrowRightCircle,
  voucher: FileText,
}

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  skipped: 'bg-slate-50 text-slate-600 border-slate-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

type Tab = 'dashboard' | 'rules' | 'runs' | 'simulator'

export function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dash, setDash] = useState<AutomationDashboard | null>(null)
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [eventName, setEventName] = useState('inquiry.received')
  const [eventPayload, setEventPayload] = useState(
    '{"project_name":"Honeymoon Marrakech 7D","client_email":"lovers@example.com","owner_email":"amine@stours.ma"}'
  )
  const [lastTrigger, setLastTrigger] = useState<{ fired: number; rules: string[] } | null>(null)

  async function refresh() {
    const [d, rl, rn] = await Promise.all([
      automationsApi.dashboard(),
      automationsApi.rules(),
      automationsApi.runs({ limit: 100 }),
    ])
    setDash(d.data)
    setRules(rl.data)
    setRuns(rn.data)
  }

  useEffect(() => { void refresh() }, [])

  const seed = async () => {
    setBusy(true)
    try { await automationsApi.seedDemo(); await refresh() } finally { setBusy(false) }
  }

  const cron = async () => {
    setBusy(true)
    try {
      const res = await automationsApi.cronTick()
      setLastTrigger({ fired: res.data.rules_fired, rules: [] })
      await refresh()
    } finally { setBusy(false) }
  }

  const toggle = async (key: string, enabled: boolean) => {
    await automationsApi.toggle(key, enabled)
    await refresh()
  }

  const runOne = async (key: string) => {
    setBusy(true)
    try { await automationsApi.runRule(key, {}); await refresh() } finally { setBusy(false) }
  }

  const triggerEvent = async () => {
    setBusy(true)
    try {
      let payload: any = {}
      try { payload = JSON.parse(eventPayload || '{}') } catch { /* ignore */ }
      const res = await automationsApi.trigger(eventName, payload)
      setLastTrigger({ fired: res.data.fired_rules, rules: res.data.runs.map((r: any) => `${r.rule_key} ${r.rule_name}`) })
      await refresh()
    } finally { setBusy(false) }
  }

  const groupedRules = useMemo(() => {
    const enabled = rules.filter(r => r.enabled)
    return { enabled, all: rules }
  }, [rules])

  const eventCatalog = [
    { event: 'inquiry.received', label: 'A1+A2 — Demande client reçue' },
    { event: 'quote.sent', label: 'A3+A4+A5 — Devis envoyé' },
    { event: 'deal.won', label: 'A6 — Deal gagné' },
    { event: 'supplier_payment_due', label: 'A7 — Échéance fournisseur J-3' },
    { event: 'project.start_date', label: 'A8 — Départ J-7' },
    { event: 'project.completed', label: 'A9 — Fin de voyage' },
    { event: 'task.overdue', label: 'A10 — Tâche en retard' },
    { event: 'account.at_risk', label: 'A11 — Compte à risque' },
    { event: 'payment.received', label: 'A12 — Paiement reçu' },
  ]

  return (
    <div className="px-6 py-6 max-w-[1500px] mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="text-rihla" size={20} />
            <h1 className="text-xl font-bold text-slate-900 dark:text-cream">Engine d'automatisations · A1-A12</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Auto-réponses, follow-ups, NPS, alertes — déclenchés sur événements ou cron quotidien.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={seed} disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-white border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <Database size={14} /> Seeder démo
          </button>
          <button onClick={cron} disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-rihla text-white hover:bg-rihla-dark inline-flex items-center gap-1.5">
            <Clock size={14} /> Cron tick
          </button>
          <button onClick={refresh} disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md bg-white border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-1.5">
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Rafraîchir
          </button>
        </div>
      </header>

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          ['dashboard', 'Vue exécutive'],
          ['rules', 'Règles A1-A12'],
          ['runs', 'Historique runs'],
          ['simulator', 'Simulateur événements'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? 'border-rihla text-rihla' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && dash && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Kpi label="Règles actives" value={`${dash.enabled} / ${dash.total_rules}`} icon={<Zap size={16} />} tone="rihla" />
            <Kpi label="Runs sur 24h" value={String(dash.runs_24h)} icon={<Play size={16} />} tone="emerald" />
            <Kpi label="Taux de succès" value={`${dash.success_rate_pct}%`} icon={<CheckCircle2 size={16} />} tone="emerald" />
            <Kpi label="Erreurs 24h" value={String(dash.errors_24h)} icon={<AlertCircle size={16} />}
                 tone={dash.errors_24h > 0 ? 'red' : 'slate'} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Top règles déclenchées</h3>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr><th className="text-left pb-2">Clé</th><th className="text-left">Règle</th><th className="text-right">Fires</th><th className="text-right">État</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dash.top_rules.map(r => (
                    <tr key={r.key}>
                      <td className="py-2 font-mono font-semibold text-rihla">{r.key}</td>
                      <td>{r.name}</td>
                      <td className="text-right font-medium">{r.fire_count}</td>
                      <td className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BADGE[r.last_status || 'success']}`}>
                          {r.last_status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gradient-to-br from-rihla/10 to-rihla/5 border border-rihla/20 rounded-lg p-5">
              <h3 className="text-sm font-semibold mb-3">Performance globale</h3>
              <div className="space-y-2 text-sm">
                <Row k="Total fires" v={String(dash.fires_total)} />
                <Row k="Runs / 24h" v={String(dash.runs_24h)} />
                <Row k="Erreurs / 24h" v={String(dash.errors_24h)} />
                <Row k="Succès" v={`${dash.success_rate_pct}%`} />
                <Row k="Désactivées" v={String(dash.disabled)} />
              </div>
              {lastTrigger && (
                <div className="mt-4 p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  ✓ Dernier déclenchement : {lastTrigger.fired} règle(s) firées
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="grid grid-cols-2 gap-4">
          {rules.map(r => (
            <div key={r.key} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-rihla font-bold text-sm bg-rihla/10 px-2 py-0.5 rounded">{r.key}</span>
                  <h3 className="font-semibold text-sm text-slate-900">{r.name}</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={r.enabled}
                         onChange={(e) => toggle(r.key, e.target.checked)} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer
                                  peer-checked:after:translate-x-full peer-checked:after:border-white
                                  after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                  after:bg-white after:border-slate-300 after:border after:rounded-full
                                  after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">{r.description}</p>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono">{r.trigger}</span>
                  <span>·</span>
                  <span className="font-medium">{r.delay_label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{r.fire_count} runs</span>
                  <button onClick={() => runOne(r.key)} disabled={busy}
                    className="text-xs px-2 py-1 rounded bg-rihla/10 text-rihla hover:bg-rihla/20 inline-flex items-center gap-1">
                    <Play size={11} /> Tester
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'runs' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Heure</th>
                  <th className="text-left">Règle</th>
                  <th className="text-left">Trigger</th>
                  <th className="text-right">Actions</th>
                  <th className="text-right">ms</th>
                  <th className="text-right pr-3">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map(r => (
                  <tr key={r.id} onClick={() => setSelectedRun(r)}
                      className={`cursor-pointer hover:bg-rihla/5 ${selectedRun?.id === r.id ? 'bg-rihla/10' : ''}`}>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {r.started_at ? new Date(r.started_at).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td>
                      <span className="font-mono text-rihla font-bold mr-2">{r.rule_key}</span>
                      <span className="text-slate-700">{r.rule_name}</span>
                    </td>
                    <td className="text-xs font-mono text-slate-500">{r.trigger}</td>
                    <td className="text-right">{r.actions_count}</td>
                    <td className="text-right">{r.duration_ms}</td>
                    <td className="text-right pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_BADGE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Aucun run — clique sur "Seeder démo" puis "Cron tick"</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <ChevronRight size={14} /> Détail du run
            </h3>
            {!selectedRun && <p className="text-xs text-slate-400">Sélectionne un run dans la table pour voir les actions exécutées.</p>}
            {selectedRun && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-slate-500 mb-0.5">Règle</div>
                  <div className="font-semibold">{selectedRun.rule_key} — {selectedRun.rule_name}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Résumé</div>
                  <div className="text-slate-700">{selectedRun.summary || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Actions ({selectedRun.output?.actions?.length || 0})</div>
                  <div className="space-y-2">
                    {selectedRun.output?.actions?.map((a: any, i: number) => {
                      const Icon = ACTION_ICON[a.kind] || Zap
                      return (
                        <div key={i} className="border border-slate-200 rounded p-2 bg-slate-50">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800 mb-1">
                            <Icon size={12} className="text-rihla" />
                            <span className="capitalize">{a.kind?.replace('_', ' ')}</span>
                          </div>
                          {a.kind === 'email' && (
                            <div className="space-y-0.5">
                              <div><b>To :</b> {a.to}</div>
                              <div><b>Sujet :</b> {a.subject}</div>
                              <div className="text-slate-600 italic">{a.preview}</div>
                            </div>
                          )}
                          {a.kind === 'task' && (
                            <div className="space-y-0.5">
                              <div><b>Titre :</b> {a.title}</div>
                              <div><b>Owner :</b> {a.owner} · <b>Priority :</b> {a.priority}</div>
                              <div className="text-slate-600">Due : {a.due_at && new Date(a.due_at).toLocaleString('fr-FR')}</div>
                            </div>
                          )}
                          {a.kind === 'notify' && (
                            <div><b>Channel :</b> {a.channel}<br/>{a.message}</div>
                          )}
                          {a.kind === 'status_change' && (
                            <div><b>{a.entity}</b> #{a.entity_id} → <b>{a.new_status}</b><br/>{a.reason}</div>
                          )}
                          {a.kind === 'voucher' && (
                            <div><b>Voucher :</b> {a.voucher_no}<br/><b>URL :</b> {a.url}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'simulator' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-sm mb-3">Catalogue d'événements</h3>
            <div className="space-y-2">
              {eventCatalog.map(e => (
                <button key={e.event} onClick={() => setEventName(e.event)}
                  className={`w-full text-left p-2.5 rounded-md border text-sm transition-colors ${
                    eventName === e.event ? 'border-rihla bg-rihla/10' : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                  <div className="font-mono text-xs text-slate-500">{e.event}</div>
                  <div className="font-medium">{e.label}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-sm mb-3">Tirer un événement</h3>
            <label className="block text-xs text-slate-500 mb-1">Événement</label>
            <input value={eventName} onChange={e => setEventName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono mb-3" />
            <label className="block text-xs text-slate-500 mb-1">Payload JSON</label>
            <textarea value={eventPayload} onChange={e => setEventPayload(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono mb-3" />
            <button onClick={triggerEvent} disabled={busy}
              className="w-full py-2 bg-rihla text-white rounded-md hover:bg-rihla-dark inline-flex items-center justify-center gap-1.5">
              <Play size={14} /> Déclencher
            </button>
            {lastTrigger && (
              <div className="mt-3 p-3 rounded bg-emerald-50 border border-emerald-200">
                <div className="text-sm font-semibold text-emerald-800">{lastTrigger.fired} règle(s) firée(s)</div>
                {lastTrigger.rules.map((r, i) => (
                  <div key={i} className="text-xs text-emerald-700">· {r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: any; tone: 'rihla' | 'emerald' | 'red' | 'slate' }) {
  const tones: Record<string, string> = {
    rihla: 'from-rihla/15 to-rihla/5 border-rihla/30 text-rihla',
    emerald: 'from-emerald-50 to-emerald-50/50 border-emerald-200 text-emerald-700',
    red: 'from-red-50 to-red-50/50 border-red-200 text-red-700',
    slate: 'from-slate-50 to-slate-50/50 border-slate-200 text-slate-700',
  }
  return (
    <div className={`p-4 rounded-lg border bg-gradient-to-br ${tones[tone]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  )
}

export default AutomationsPage
