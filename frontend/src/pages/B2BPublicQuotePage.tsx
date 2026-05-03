/**
 * Public quote viewer — accessible by magic-link token, no auth.
 * Path: /portal/quote/:token
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, X, Clock, Building2, Users, MapPin } from 'lucide-react'
import { b2bPortalApi, type B2BQuotation } from '@/lib/api'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
}

export default function B2BPublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const [quote, setQuote] = useState<B2BQuotation | null>(null)
  const [error, setError] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) return
    b2bPortalApi.publicQuote(token)
      .then(r => setQuote(r.data))
      .catch(e => setError(e?.response?.data?.detail || 'Lien invalide ou expiré'))
  }, [token])

  async function accept() {
    if (!token) return
    setBusy(true)
    try {
      const r = await b2bPortalApi.publicAccept(token, 'Accepté depuis portail B2B')
      setQuote(r.data)
    } finally { setBusy(false) }
  }
  async function reject() {
    if (!token) return
    const note = window.prompt('Raison du rejet ?') || ''
    setBusy(true)
    try {
      const r = await b2bPortalApi.publicReject(token, note)
      setQuote(r.data)
    } finally { setBusy(false) }
  }

  if (error) return <CenterMsg>{error}</CenterMsg>
  if (!quote) return <CenterMsg>Chargement…</CenterMsg>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">portal.stours.ma</div>
            <h1 className="text-xl font-bold text-slate-800">S'TOURS · Portail B2B</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${STATUS_BADGE[quote.status]}`}>
            {quote.status}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold mb-1">{quote.title}</h2>
          <div className="text-sm text-slate-500 mb-4">
            {quote.reference} · pour {quote.agency_name}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={<Users size={16} />} label="PAX" value={String(quote.pax)} />
            <Stat icon={<Clock size={16} />} label="Jours" value={String(quote.days.length)} />
            <Stat icon={<Building2 size={16} />} label="Total" value={fmt(quote.public_total, quote.currency)} />
            <Stat icon={<MapPin size={16} />} label="Par PAX" value={fmt(quote.per_pax, quote.currency)} />
          </div>
        </section>

        <section className="bg-white border rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4">Programme jour par jour</h3>
          <div className="space-y-3">
            {quote.days.map(d => (
              <div key={d.day_num} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="font-bold text-blue-600 w-16">JOUR {d.day_num}</div>
                <div className="flex-1">
                  <div className="font-semibold">{d.city}</div>
                  <div className="text-sm text-slate-600">{d.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {(quote.payload?.includes || quote.payload?.excludes) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quote.payload?.includes && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <h4 className="font-semibold text-emerald-800 mb-2">Inclus</h4>
                <ul className="text-sm space-y-1">
                  {quote.payload.includes.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <Check size={14} className="text-emerald-600 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {quote.payload?.excludes && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                <h4 className="font-semibold text-rose-800 mb-2">Non inclus</h4>
                <ul className="text-sm space-y-1">
                  {quote.payload.excludes.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <X size={14} className="text-rose-600 mt-0.5" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {(quote.status === 'sent' || quote.status === 'viewed') && (
          <section className="bg-white border rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4 sticky bottom-4">
            <div>
              <div className="font-semibold">Confirmer ce devis ?</div>
              <div className="text-xs text-slate-500">Cette action verrouille le tarif et lance les réservations.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={reject} disabled={busy}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-1">
                <X size={16} /> Rejeter
              </button>
              <button onClick={accept} disabled={busy}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1">
                <Check size={16} /> Accepter
              </button>
            </div>
          </section>
        )}
        {quote.status === 'accepted' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-800">
            <Check className="inline mr-2" /> Devis accepté · Merci ! L'équipe S'TOURS vous contacte sous 24h.
          </div>
        )}
        {quote.status === 'rejected' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-800">
            <X className="inline mr-2" /> Devis rejeté · n'hésitez pas à demander un ajustement.
          </div>
        )}
      </main>
    </div>
  )
}

function Stat({ icon, label, value }: any) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500 flex items-center gap-1">{icon} {label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  )
}
function CenterMsg({ children }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border rounded-xl p-8 max-w-md text-center">
        {children}
      </div>
    </div>
  )
}
function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n || 0)
}
