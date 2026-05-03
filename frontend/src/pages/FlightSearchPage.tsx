import { useState } from 'react'
import {
  Plane, ChevronRight, Search, ArrowRight,
  Clock, DollarSign, ArrowUpDown, Filter,
  Star, ExternalLink, CheckCircle2, Plus,
  Calendar, Users, Sparkles, AlertCircle,
  RefreshCw, Luggage, Wifi, WifiOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useMutation } from '@tanstack/react-query'
import { flightSearchApi, type FlightResult as ApiFlight } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────
interface FlightResult {
  id: string
  airline: string
  airlineCode: string
  flightNumber: string
  departure: { airport: string; code: string; time: string; date: string }
  arrival: { airport: string; code: string; time: string; date: string }
  duration: string
  stops: number
  stopCities: string[]
  price: number
  currency: string
  cabinClass: string
  seatsLeft: number
  baggage: string
  recommended: boolean
}

interface SearchParams {
  origin: string
  destination: string
  departDate: string
  returnDate: string
  pax: number
  cabinClass: 'economy' | 'premium' | 'business' | 'first'
}

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_FLIGHTS: FlightResult[] = [
  { id: 'f1', airline: 'Royal Air Maroc', airlineCode: 'AT', flightNumber: 'AT 789', departure: { airport: 'Paris CDG', code: 'CDG', time: '08:30', date: '2026-06-10' }, arrival: { airport: 'Casablanca CMN', code: 'CMN', time: '11:15', date: '2026-06-10' }, duration: '2h45', stops: 0, stopCities: [], price: 245, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 8, baggage: '23kg inclus', recommended: true },
  { id: 'f2', airline: 'Air France', airlineCode: 'AF', flightNumber: 'AF 1498', departure: { airport: 'Paris CDG', code: 'CDG', time: '10:15', date: '2026-06-10' }, arrival: { airport: 'Casablanca CMN', code: 'CMN', time: '13:00', date: '2026-06-10' }, duration: '2h45', stops: 0, stopCities: [], price: 312, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 15, baggage: '23kg inclus', recommended: false },
  { id: 'f3', airline: 'Ryanair', airlineCode: 'FR', flightNumber: 'FR 4521', departure: { airport: 'Paris BVA', code: 'BVA', time: '06:00', date: '2026-06-10' }, arrival: { airport: 'Marrakech RAK', code: 'RAK', time: '08:50', date: '2026-06-10' }, duration: '2h50', stops: 0, stopCities: [], price: 89, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 3, baggage: 'Bagage cabine uniquement', recommended: false },
  { id: 'f4', airline: 'Transavia', airlineCode: 'TO', flightNumber: 'TO 3456', departure: { airport: 'Paris ORY', code: 'ORY', time: '14:30', date: '2026-06-10' }, arrival: { airport: 'Marrakech RAK', code: 'RAK', time: '17:20', date: '2026-06-10' }, duration: '2h50', stops: 0, stopCities: [], price: 129, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 12, baggage: '20kg en option', recommended: false },
  { id: 'f5', airline: 'Turkish Airlines', airlineCode: 'TK', flightNumber: 'TK 1819', departure: { airport: 'Paris CDG', code: 'CDG', time: '11:45', date: '2026-06-10' }, arrival: { airport: 'Casablanca CMN', code: 'CMN', time: '18:30', date: '2026-06-10' }, duration: '6h45', stops: 1, stopCities: ['Istanbul IST'], price: 198, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 22, baggage: '30kg inclus', recommended: false },
  { id: 'f6', airline: 'Royal Air Maroc', airlineCode: 'AT', flightNumber: 'AT 791', departure: { airport: 'Paris CDG', code: 'CDG', time: '16:00', date: '2026-06-10' }, arrival: { airport: 'Casablanca CMN', code: 'CMN', time: '18:45', date: '2026-06-10' }, duration: '2h45', stops: 0, stopCities: [], price: 275, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 5, baggage: '23kg inclus', recommended: false },
]

const RETURN_FLIGHTS: FlightResult[] = [
  { id: 'r1', airline: 'Royal Air Maroc', airlineCode: 'AT', flightNumber: 'AT 790', departure: { airport: 'Casablanca CMN', code: 'CMN', time: '09:00', date: '2026-06-20' }, arrival: { airport: 'Paris CDG', code: 'CDG', time: '13:30', date: '2026-06-20' }, duration: '2h30', stops: 0, stopCities: [], price: 255, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 10, baggage: '23kg inclus', recommended: true },
  { id: 'r2', airline: 'Air France', airlineCode: 'AF', flightNumber: 'AF 1499', departure: { airport: 'Casablanca CMN', code: 'CMN', time: '14:30', date: '2026-06-20' }, arrival: { airport: 'Paris CDG', code: 'CDG', time: '19:00', date: '2026-06-20' }, duration: '2h30', stops: 0, stopCities: [], price: 298, currency: 'EUR', cabinClass: 'Economy', seatsLeft: 18, baggage: '23kg inclus', recommended: false },
]

const fmt = (n: number) => n.toLocaleString('fr-FR')

// ── API → UI mapper ───────────────────────────────────────────────
const flightToUi = (f: ApiFlight): FlightResult => ({
  id: f.id,
  airline: f.airline,
  airlineCode: f.airline_code,
  flightNumber: f.flight_number,
  departure: f.departure,
  arrival: f.arrival,
  duration: f.duration,
  stops: f.stops,
  stopCities: f.stop_cities,
  price: f.price,
  currency: f.currency,
  cabinClass: f.cabin_class,
  seatsLeft: f.seats_left,
  baggage: f.baggage,
  recommended: f.recommended,
})

export function FlightSearchPage() {
  const [params, setParams] = useState<SearchParams>({
    origin: 'Paris (CDG)',
    destination: 'Casablanca (CMN)',
    departDate: '2026-06-10',
    returnDate: '2026-06-20',
    pax: 12,
    cabinClass: 'economy',
  })
  const [searched, setSearched] = useState(true)
  const [selectedOutbound, setSelectedOutbound] = useState<string | null>(null)
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'departure'>('price')
  const [directOnly, setDirectOnly] = useState(false)

  // Live search (API). Fallback to mock data if empty/not yet searched.
  const searchMut = useMutation({
    mutationFn: () => flightSearchApi.search({
      origin: params.origin,
      destination: params.destination,
      depart_date: params.departDate,
      return_date: params.returnDate || undefined,
      pax: params.pax,
      cabin_class: params.cabinClass,
    }).then(r => r.data),
  })

  const liveOutbound = searchMut.data?.outbound?.map(flightToUi) ?? []
  const liveInbound = searchMut.data?.inbound?.map(flightToUi) ?? []
  const isLive = liveOutbound.length > 0

  const flightsPool = isLive ? liveOutbound : MOCK_FLIGHTS
  const returnPool = isLive && liveInbound.length > 0 ? liveInbound : RETURN_FLIGHTS

  const sortedFlights = [...flightsPool]
    .filter(f => !directOnly || f.stops === 0)
    .sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price
      if (sortBy === 'duration') return a.duration.localeCompare(b.duration)
      return a.departure.time.localeCompare(b.departure.time)
    })

  const selectedOut = flightsPool.find(f => f.id === selectedOutbound)
  const selectedRet = returnPool.find(f => f.id === selectedReturn)
  const totalPerPax = (selectedOut?.price || 0) + (selectedRet?.price || 0)
  const totalGroup = totalPerPax * params.pax

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Intégrations <ChevronRight size={10} /> Recherche de Vols
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Plane className="text-rihla" size={36} />
            Recherche de Vols
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Trouvez les meilleures options vol + circuit pour vos clients
          </p>
        </div>
        <span className={clsx(
          "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
          isLive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-slate-100 dark:bg-white/10 text-slate-500",
        )}>
          {isLive ? <Wifi size={11} /> : <WifiOff size={11} />}
          {isLive ? 'Live' : 'Démo (mock)'}
        </span>
      </div>

      {/* ── SEARCH FORM ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
          <div className="grid grid-cols-6 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Origine</label>
              <input type="text" value={params.origin} onChange={e => setParams(p => ({ ...p, origin: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rihla/30" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Destination</label>
              <input type="text" value={params.destination} onChange={e => setParams(p => ({ ...p, destination: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rihla/30" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Aller</label>
              <input type="date" value={params.departDate} onChange={e => setParams(p => ({ ...p, departDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Retour</label>
              <input type="date" value={params.returnDate} onChange={e => setParams(p => ({ ...p, returnDate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Passagers</label>
              <input type="number" value={params.pax} onChange={e => setParams(p => ({ ...p, pax: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30" />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setSearched(true); searchMut.mutate() }}
                disabled={searchMut.isPending}
                className="w-full px-4 py-2.5 bg-rihla text-white rounded-xl text-sm font-black uppercase shadow-lg shadow-rihla/20 hover:bg-rihla/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {searchMut.isPending
                  ? <><RefreshCw size={16} className="animate-spin" /> Recherche…</>
                  : <><Search size={16} /> Rechercher</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: FILTERS ──────────────────────────────────────── */}
        <div className="col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Filtres
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={directOnly} onChange={() => setDirectOnly(!directOnly)} className="w-4 h-4 rounded border-slate-300 text-rihla focus:ring-rihla" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Vols directs uniquement</span>
              </label>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="text-[10px] font-black text-slate-400 uppercase mb-3">Trier par</div>
              {[
                { key: 'price', label: 'Prix', icon: DollarSign },
                { key: 'duration', label: 'Durée', icon: Clock },
                { key: 'departure', label: 'Heure départ', icon: Clock },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key as typeof sortBy)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all mb-1",
                    sortBy === s.key ? "bg-rihla/10 text-rihla font-bold" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <s.icon size={12} /> {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selection summary */}
          {(selectedOutbound || selectedReturn) && (
            <div className="bg-rihla/5 border border-rihla/20 rounded-3xl p-6">
              <h3 className="text-[10px] font-black text-rihla uppercase tracking-widest mb-4">Sélection Vol + Circuit</h3>
              {selectedOut && (
                <div className="mb-3">
                  <div className="text-[10px] text-slate-400 uppercase mb-1">Aller</div>
                  <div className="text-xs font-bold">{selectedOut.airline} — {selectedOut.flightNumber}</div>
                  <div className="text-xs text-slate-500">{selectedOut.departure.time} → {selectedOut.arrival.time}</div>
                  <div className="text-xs font-bold text-rihla">{selectedOut.price} €/pax</div>
                </div>
              )}
              {selectedRet && (
                <div className="mb-3">
                  <div className="text-[10px] text-slate-400 uppercase mb-1">Retour</div>
                  <div className="text-xs font-bold">{selectedRet.airline} — {selectedRet.flightNumber}</div>
                  <div className="text-xs text-slate-500">{selectedRet.departure.time} → {selectedRet.arrival.time}</div>
                  <div className="text-xs font-bold text-rihla">{selectedRet.price} €/pax</div>
                </div>
              )}
              <div className="pt-3 border-t border-rihla/20">
                <div className="flex justify-between text-xs">
                  <span>Total/pax :</span>
                  <span className="font-black text-rihla">{fmt(totalPerPax)} €</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span>Total groupe ({params.pax} pax) :</span>
                  <span className="font-black">{fmt(totalGroup)} €</span>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-3 bg-rihla text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-rihla/20 hover:bg-rihla/90 transition-all">
                <Plus size={14} className="inline mr-1" /> Ajouter au devis
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: RESULTS ──────────────────────────────────────── */}
        <div className="col-span-9 space-y-6">
          {/* Outbound */}
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-cream uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plane size={16} className="text-rihla" /> Vols Aller — {params.departDate}
            </h3>
            <div className="space-y-3">
              {sortedFlights.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedOutbound(f.id)}
                  className={clsx(
                    "w-full bg-white dark:bg-slate-900 rounded-2xl border p-5 text-left transition-all hover:shadow-md",
                    selectedOutbound === f.id ? "border-rihla shadow-lg shadow-rihla/10" : "border-slate-200 dark:border-white/10 shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-400">
                        {f.airlineCode}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">{f.airline}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{f.flightNumber}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-black text-slate-900 dark:text-cream">{f.departure.time}</div>
                        <div className="text-[10px] text-slate-400">{f.departure.code}</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] text-slate-400">{f.duration}</div>
                        <div className="w-20 h-px bg-slate-300 dark:bg-white/20 relative my-1">
                          <Plane size={10} className="absolute -top-1 right-0 text-slate-400" />
                        </div>
                        <div className="text-[10px] text-slate-400">{f.stops === 0 ? 'Direct' : `${f.stops} escale${f.stops > 1 ? 's' : ''}`}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-black text-slate-900 dark:text-cream">{f.arrival.time}</div>
                        <div className="text-[10px] text-slate-400">{f.arrival.code}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-rihla">{f.price} €</div>
                      <div className="text-[10px] text-slate-400">par personne</div>
                      {f.seatsLeft < 5 && <div className="text-[10px] text-red-500 font-bold mt-1">{f.seatsLeft} places restantes</div>}
                      {f.recommended && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-bold">
                          <Star size={8} /> Recommandé
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-white/5 text-[10px] text-slate-400">
                    <span><Luggage size={10} className="inline" /> {f.baggage}</span>
                    <span>Groupe ({params.pax} pax): <span className="font-bold text-slate-600 dark:text-slate-300">{fmt(f.price * params.pax)} €</span></span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Return flights */}
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-cream uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plane size={16} className="text-rihla rotate-180" /> Vols Retour — {params.returnDate}
            </h3>
            <div className="space-y-3">
              {RETURN_FLIGHTS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedReturn(f.id)}
                  className={clsx(
                    "w-full bg-white dark:bg-slate-900 rounded-2xl border p-5 text-left transition-all hover:shadow-md",
                    selectedReturn === f.id ? "border-rihla shadow-lg shadow-rihla/10" : "border-slate-200 dark:border-white/10 shadow-sm"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-sm font-black text-slate-600 dark:text-slate-400">{f.airlineCode}</div>
                      <div>
                        <div className="text-xs text-slate-500">{f.airline}</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{f.flightNumber}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-black">{f.departure.time}</div>
                        <div className="text-[10px] text-slate-400">{f.departure.code}</div>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-[10px] text-slate-400">{f.duration}</div>
                        <div className="w-20 h-px bg-slate-300 dark:bg-white/20 my-1" />
                        <div className="text-[10px] text-slate-400">Direct</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-black">{f.arrival.time}</div>
                        <div className="text-[10px] text-slate-400">{f.arrival.code}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-rihla">{f.price} €</div>
                      <div className="text-[10px] text-slate-400">par personne</div>
                      {f.recommended && (
                        <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[9px] font-bold">
                          <Star size={8} /> Recommandé
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400">
              <strong>Intégration API :</strong> Les résultats sont actuellement simulés. Connectez votre clé API Amadeus ou Skyscanner dans les paramètres pour obtenir les prix en temps réel.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
