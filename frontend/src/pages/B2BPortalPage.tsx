/**
 * Portail B2B — cockpit interne STOURS pour gérer agences partenaires + devis + live tracking.
 *
 * 5 onglets : Dashboard · Agences · Devis · Tracking · Sessions
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Building2, Send, Eye, Check, X, Plus, Link as LinkIcon, MapPin,
  Camera, AlertTriangle, Clock, RefreshCw, Sparkles, Users, TrendingUp,
  Mail, Globe, Award,
} from 'lucide-react'
import {
  b2bPortalApi,
  type B2BAgency, type B2BQuotation, type B2BTrackingEvent,
  type B2BActiveBooking, type B2BSession, type B2BMagicLinkResp,
} from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-50 text-blue-700 border border-blue-200',
  viewed: 'bg-amber-50 text-amber-700 border border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  expired: 'bg-slate-50 text-slate-600 border border-slate-200',
}
const TIER_BADGE: Record<string, string> = {
  platinum: 'bg-violet-100 text-violet-800',
  gold: 'bg-amber-100 text-amber-800',
  standard: 'bg-slate-100 text-slate-700',
}
const SEV_COLOR: Record<string, string> = {
  info: 'border-slate-300 bg-white',
  success: 'border-emerald-300 bg-emerald-50',
  warning: 'border-amber-300 bg-amber-50',
  critical: 'border-rose-300 bg-rose-50',
}
const KIND_ICON: Record<string, any> = {
  status: Check, location: MapPin, photo: Camera,
  alert: AlertTriangle, note: Clock,
}

type Tab = 'dashboard' | 'agencies' | 'quotations' | 'tracking' | 'sessions'

export default function B2BPortalPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stats, setStats] = useState<any | null>(null)
  const [agencies, setAgencies] = useState<B2BAgency[]>([])
  const [quots, setQuots] = useState<B2BQuotation[]>([])
  const [active, setActive] = useState<B2BActiveBooking[]>([])
  const [trackings, setTrackings] = useState<B2BTrackingEvent[]>([])
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<B2BSession[]>([])
  const [magic, setMagic] = useState<B2BMagicLinkResp | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string>('')

  function flash(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 4000)
  }

  async function refresh() {
    setBusy(true)
    try {
      const [d, a, q, ab] = await Promise.all([
        b2bPortalApi.dashboard(), b2bPortalApi.agencies(),
        b2bPortalApi.quotations(), b2bPortalApi.activeBookings(),
      ])
      setStats(d.data); setAgencies(a.data); setQuots(q.data); setActive(ab.data)
      if (ab.data.length && !bookingId) setBookingId(ab.data[0].booking_id)
      const s = await b2bPortalApi.sessions()
      setSessions(s.data)
    } finally { setBusy(false) }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (bookingId) {
      b2bPortalApi.tracking({ booking_id: bookingId })
        .then(r => setTrackings(r.data.slice().sort((a, b) =>
          (a.occurred_at || '').localeCompare(b.occurred_at || ''))))
    }
  }, [bookingId])

  async function seedDemo() {
    setBusy(true)
    try {
      const r = await b2bPortalApi.seedDemo()
      flash(`${r.data.agencies_created} agences · ${r.data.quotations_created} devis · ${r.data.tracking_events_created} events`)
      await refresh()
    } finally { setBusy(false) }
  }

  async function sendMagicLink(agency_id: string) {
    const r = await b2bPortalApi.magicLink({ agency_id, purpose: 'login', expires_in_hours: 72 })
    setMagic(r.data); setTab('sessions')
    flash(`Magic-link émis · expire dans 72h`)
    refresh()
  }

  async function sendQuote(id: string) {
    const r = await b2bPortalApi.sendQuotation(id)
    flash(`Devis envoyé à ${r.data.demo_email_sent_to}`)
    refresh()
  }

  async function acceptQuote(id: string) {
    await b2bPortalApi.acceptQuotation(id, 'Accepté depuis cockpit interne')
    flash('Devis accepté'); refresh()
  }

  async function rejectQuote(id: string) {
    const note = window.prompt('Raison du rejet ?') || ''
    await b2bPortalApi.rejectQuotation(id, note)
    flash('Devis rejeté'); refresh()
  }

  async function publicLinkForQuote(q: B2BQuotation) {
    if (q.public_url) {
      navigator.clipboard?.writeText(q.public_url)
      flash('Lien public copié dans le presse-papier')
    } else {
      const r = await b2bPortalApi.magicLink({
        agency_id: q.agency_id, purpose: 'quote', target_id: q.id, expires_in_hours: 168,
      })
      setMagic(r.data); setTab('sessions')
    }
  }

  async function trackingLinkForBooking(b: B2BActiveBooking) {
    const r = await b2bPortalApi.magicLink({
      agency_id: b.agency_id, purpose: 'tracking', target_id: b.booking_id, expires_in_hours: 168,
    })
    setMagic(r.data); setTab('sessions')
  }

  const summary = useMemo(() => stats || {
    agencies_total: 0, agencies_active: 0, quotations_total: 0,
    conversion_pct: 0, pipeline_value: 0, won_value: 0,
    active_sessions: 0, active_bookings: 0,
  }, [stats])

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="text-blue-600" size={26} />
            Portail B2B — <span className="text-blue-600">portal.stours.ma</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Magic-link agences · devis interactifs · live tracking voyages
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={seedDemo} disabled={busy}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg flex items-center gap-1 disabled:opacity-50">
            <Sparkles size={15} /> Seed démo
          </button>
          <button onClick={refresh} disabled={busy}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-sm rounded-lg flex items-center gap-1">
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {feedback && (
        <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
          {feedback}
        </div>
      )}

      <nav className="flex gap-1 mb-6 border-b border-slate-200">
        {([
          ['dashboard', 'Dashboard'], ['agencies', `Agences (${agencies.length})`],
          ['quotations', `Devis (${quots.length})`],
          ['tracking', `Live tracking (${active.length})`],
          ['sessions', `Sessions (${sessions.length})`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <KpiCard icon={<Building2 size={20} />} label="Agences actives"
            value={`${summary.agencies_active}/${summary.agencies_total}`}
            sub={Object.entries(summary.agencies_by_tier || {}).map(([t, n]) => `${t}: ${n}`).join(' · ')} />
          <KpiCard icon={<TrendingUp size={20} />} label="Pipeline ouvert"
            value={fmt(summary.pipeline_value)}
            sub={`Won: ${fmt(summary.won_value)}`} />
          <KpiCard icon={<Check size={20} />} label="Conversion"
            value={`${summary.conversion_pct}%`}
            sub={`${summary.quotations_total} devis total`} />
          <KpiCard icon={<MapPin size={20} />} label="Voyages live"
            value={String(summary.active_bookings)}
            sub={`${summary.tracking_events_total} events trackés`} />
          <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Statuts devis</h3>
              <div className="space-y-2">
                {Object.entries(summary.quotations_by_status || {}).map(([s, n]) => (
                  <div key={s} className="flex items-center justify-between text-sm">
                    <span className={`px-2 py-1 rounded ${STATUS_BADGE[s] || 'bg-slate-100'}`}>{s}</span>
                    <span className="font-bold">{n as number}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Répartition tier</h3>
              <div className="space-y-2">
                {Object.entries(summary.agencies_by_tier || {}).map(([t, n]) => (
                  <div key={t} className="flex items-center justify-between text-sm">
                    <span className={`px-2 py-1 rounded ${TIER_BADGE[t] || 'bg-slate-100'} flex items-center gap-1`}>
                      <Award size={14} /> {t}
                    </span>
                    <span className="font-bold">{n as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'agencies' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3">Agence</th>
                <th className="px-4 py-3">Pays</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {agencies.map(a => (
                <tr key={a.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.contact_name}</div>
                  </td>
                  <td className="px-4 py-3">{a.country}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${TIER_BADGE[a.tier] || ''}`}>
                      <Award size={12} className="inline mr-1" />{a.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.commission_pct}%</td>
                  <td className="px-4 py-3 text-slate-500">{a.email}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => sendMagicLink(a.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1 ml-auto">
                      <LinkIcon size={12} /> Magic-link
                    </button>
                  </td>
                </tr>
              ))}
              {!agencies.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Aucune agence — clique « Seed démo »
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'quotations' && (
        <div className="space-y-3">
          {quots.map(q => (
            <div key={q.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{q.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[q.status]}`}>{q.status}</span>
                    {q.reference && <span className="text-xs text-slate-400">{q.reference}</span>}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                    <span><Building2 size={12} className="inline mr-1" />{q.agency_name}</span>
                    <span><Users size={12} className="inline mr-1" />{q.pax} PAX</span>
                    <span>{q.days.length} jours</span>
                    <span className="font-semibold text-slate-700">
                      {fmt(q.public_total, q.currency)} ({fmt(q.per_pax, q.currency)}/pax)
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {q.status === 'draft' && (
                    <button onClick={() => sendQuote(q.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1">
                      <Send size={12} /> Envoyer
                    </button>
                  )}
                  {q.public_url && (
                    <button onClick={() => publicLinkForQuote(q)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs flex items-center gap-1">
                      <LinkIcon size={12} /> Lien public
                    </button>
                  )}
                  {(q.status === 'sent' || q.status === 'viewed') && (
                    <>
                      <button onClick={() => acceptQuote(q.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs flex items-center gap-1">
                        <Check size={12} /> Accepter
                      </button>
                      <button onClick={() => rejectQuote(q.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs flex items-center gap-1">
                        <X size={12} /> Rejeter
                      </button>
                    </>
                  )}
                </div>
              </div>
              {q.viewed_at && (
                <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                  <Eye size={12} /> Vu par l'agence le {new Date(q.viewed_at).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
          ))}
          {!quots.length && (
            <div className="bg-white border rounded-xl p-12 text-center text-slate-400">
              Aucun devis B2B
            </div>
          )}
        </div>
      )}

      {tab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2">
            <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-2">
              Voyages actifs
            </h3>
            {active.map(b => (
              <button key={b.booking_id}
                onClick={() => setBookingId(b.booking_id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  bookingId === b.booking_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}>
                <div className="font-medium text-sm">{b.booking_label}</div>
                <div className="text-xs text-slate-500 mb-1">{b.agency_name}</div>
                <div className="text-xs text-slate-600">{b.events} events · dernier: {b.last_title}</div>
                <button onClick={(e) => { e.stopPropagation(); trackingLinkForBooking(b) }}
                  className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded flex items-center gap-1">
                  <LinkIcon size={11} /> Partager lien
                </button>
              </button>
            ))}
            {!active.length && (
              <div className="text-sm text-slate-400 p-4 bg-white border rounded-lg">
                Aucun voyage actif
              </div>
            )}
          </div>
          <div className="lg:col-span-2 bg-white border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Timeline événements</h3>
            <div className="space-y-3">
              {trackings.map(t => {
                const Icon = KIND_ICON[t.kind] || Clock
                return (
                  <div key={t.id} className={`flex gap-3 p-3 border-l-4 rounded-r-lg ${SEV_COLOR[t.severity]}`}>
                    <div className="mt-0.5"><Icon size={16} /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{t.title}</span>
                        <span className="text-xs text-slate-400">
                          {t.occurred_at && new Date(t.occurred_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      {t.body && <div className="text-xs text-slate-600 mt-0.5">{t.body}</div>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs h-fit ${
                      t.severity === 'critical' ? 'bg-rose-200 text-rose-800' :
                      t.severity === 'warning' ? 'bg-amber-200 text-amber-800' :
                      t.severity === 'success' ? 'bg-emerald-200 text-emerald-800' :
                      'bg-slate-200 text-slate-700'
                    }`}>{t.severity}</span>
                  </div>
                )
              })}
              {!trackings.length && (
                <div className="text-sm text-slate-400 text-center py-8">
                  Sélectionne un voyage à gauche
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="space-y-4">
          {magic && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                <LinkIcon size={16} /> Magic-link généré
              </div>
              <div className="text-sm space-y-1">
                <div><b>Agence :</b> {magic.agency.name} ({magic.agency.email})</div>
                <div><b>Purpose :</b> {magic.purpose}</div>
                <div><b>Email simulé :</b> {magic.demo_email_subject}</div>
                <div className="mt-2 px-3 py-2 bg-white border rounded font-mono text-xs break-all">
                  {magic.public_url}
                </div>
                <button onClick={() => navigator.clipboard?.writeText(magic.public_url)}
                  className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs">
                  Copier le lien
                </button>
              </div>
            </div>
          )}
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr className="text-left">
                  <th className="px-4 py-3">Agence</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Cible</th>
                  <th className="px-4 py-3">Émis</th>
                  <th className="px-4 py-3">Expire</th>
                  <th className="px-4 py-3">Vu</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b">
                    <td className="px-4 py-2">{s.agency_name}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{s.purpose}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {s.target_id ? s.target_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs">{s.created_at && new Date(s.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-xs">{s.expires_at && new Date(s.expires_at).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-xs">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
                {!sessions.length && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune session active
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub }:
  { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide mb-2">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n || 0)
}
