import { useState, useMemo } from 'react'
import {
  Sliders, ChevronRight, TrendingUp, TrendingDown,
  Hotel, Utensils, Users as UsersIcon, MapPin, Bus,
  Sparkles, RefreshCw, Eye, Undo2, Save, AlertCircle,
  Minus, Plus, Star, ChevronDown, ChevronUp, Wifi
} from 'lucide-react'
import { clsx } from 'clsx'
import { useMutation } from '@tanstack/react-query'
import { whatIfApi } from '@/lib/api'
import { ProjectPicker } from '@/components/projects/ProjectPicker'

// ── Types ──────────────────────────────────────────────────────────
interface DayConfig {
  day: number
  city: string
  hotel: string
  hotelCategory: '3*' | '4*' | '5*'
  hotelPrice: number
  restaurant: string
  restoPrice: number
  guideIncluded: boolean
  guideCost: number
  activities: { name: string; price: number; included: boolean }[]
}

interface SimResult {
  totalPerPax: number
  totalGroup: number
  margin: number
  delta: number
  deltaPct: number
}

// ── Mock Data ──────────────────────────────────────────────────────
const HOTEL_OPTIONS: Record<string, { name: string; price: number }[]> = {
  '3*': [
    { name: 'Ibis Marrakech', price: 650 },
    { name: 'Atlas Médina', price: 720 },
  ],
  '4*': [
    { name: 'Mogador Agdal', price: 1200 },
    { name: 'Kenzi Menara Palace', price: 1400 },
  ],
  '5*': [
    { name: 'La Mamounia', price: 3500 },
    { name: 'Royal Mansour', price: 5200 },
    { name: 'Four Seasons', price: 4800 },
  ],
}

const initialDays: DayConfig[] = [
  { day: 1, city: 'Casablanca', hotel: 'Le Casablanca Hotel', hotelCategory: '4*', hotelPrice: 1400, restaurant: 'Rick\'s Café', restoPrice: 380, guideIncluded: true, guideCost: 800, activities: [{ name: 'Mosquée Hassan II', price: 120, included: true }, { name: 'Tour panoramique', price: 0, included: true }] },
  { day: 2, city: 'Rabat → Chefchaouen', hotel: 'Lina Ryad & Spa', hotelCategory: '4*', hotelPrice: 1200, restaurant: 'Casa Hassan', restoPrice: 250, guideIncluded: true, guideCost: 800, activities: [{ name: 'Tour Hassan', price: 0, included: true }, { name: 'Mausolée Mohammed V', price: 0, included: true }] },
  { day: 3, city: 'Fès', hotel: 'Riad Fes', hotelCategory: '5*', hotelPrice: 1950, restaurant: 'Dar Roumana', restoPrice: 420, guideIncluded: true, guideCost: 1000, activities: [{ name: 'Médina de Fès', price: 0, included: true }, { name: 'Tanneries', price: 50, included: true }, { name: 'Atelier poterie', price: 150, included: true }] },
  { day: 4, city: 'Fès → Merzouga', hotel: 'Bivouac de Luxe', hotelCategory: '5*', hotelPrice: 2800, restaurant: 'Dîner bédouin', restoPrice: 350, guideIncluded: true, guideCost: 800, activities: [{ name: 'Balade dromadaire', price: 200, included: true }, { name: 'Soirée étoiles', price: 0, included: true }] },
  { day: 5, city: 'Merzouga → Ouarzazate', hotel: 'Berbère Palace', hotelCategory: '4*', hotelPrice: 1100, restaurant: 'Chez Dimitri', restoPrice: 280, guideIncluded: true, guideCost: 800, activities: [{ name: 'Gorges du Todra', price: 0, included: true }, { name: 'Kasbah Aït Ben Haddou', price: 70, included: true }] },
  { day: 6, city: 'Ouarzazate → Marrakech', hotel: 'Movenpick Mansour', hotelCategory: '5*', hotelPrice: 1800, restaurant: 'Al Fassia', restoPrice: 450, guideIncluded: true, guideCost: 1000, activities: [{ name: 'Route du Tizi n\'Tichka', price: 0, included: true }, { name: 'Jemaa el-Fna', price: 0, included: true }] },
  { day: 7, city: 'Marrakech', hotel: 'Movenpick Mansour', hotelCategory: '5*', hotelPrice: 1800, restaurant: 'Comptoir Darna', restoPrice: 380, guideIncluded: true, guideCost: 1000, activities: [{ name: 'Jardin Majorelle', price: 100, included: true }, { name: 'Palais Bahia', price: 70, included: true }, { name: 'Hammam & Spa', price: 350, included: false }] },
  { day: 8, city: 'Marrakech (Départ)', hotel: '', hotelCategory: '4*', hotelPrice: 0, restaurant: '', restoPrice: 0, guideIncluded: false, guideCost: 0, activities: [{ name: 'Transfert aéroport', price: 0, included: true }] },
]

const TRANSPORT_COST = 45000 // fixed for group
const MARGIN_DEFAULT = 20
const PAX_DEFAULT = 20

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')

export function WhatIfSimulatorPage() {
  const [days, setDays] = useState<DayConfig[]>(initialDays)
  const [pax, setPax] = useState(PAX_DEFAULT)
  const [marginPct, setMarginPct] = useState(MARGIN_DEFAULT)
  const [expandedDay, setExpandedDay] = useState<number | null>(1)
  const [history, setHistory] = useState<string[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)

  const simMut = useMutation({
    mutationFn: () => whatIfApi.simulate({
      project_id: projectId!,
      modifications: [],
      new_margin_pct: marginPct,
      new_pax_ranges: [{ min: pax, max: pax }],
      original_margin_pct: MARGIN_DEFAULT,
      original_pax_ranges: [{ min: PAX_DEFAULT, max: PAX_DEFAULT }],
    } as any).then(r => r.data),
  })

  const hotelSwapMut = useMutation({
    mutationFn: () => whatIfApi.hotelSwap({
      project_id: projectId!,
      from_category: '4*',
      to_category: '5*',
    } as any).then(r => r.data),
  })
  const marginAdjustMut = useMutation({
    mutationFn: () => whatIfApi.marginAdjust({
      project_id: projectId!,
      new_margin_pct: marginPct,
    } as any).then(r => r.data),
  })

  const runBackendSim = () => {
    if (!projectId) return
    simMut.mutate()
    setHistory(prev => [`API: simulate(pax=${pax}, margin=${marginPct}%)`, ...prev].slice(0, 10))
  }

  const baseline = useMemo(() => {
    let total = 0
    initialDays.forEach(d => {
      total += d.hotelPrice + d.restoPrice + (d.guideIncluded ? d.guideCost : 0)
      d.activities.forEach(a => { if (a.included) total += a.price })
    })
    total += TRANSPORT_COST / PAX_DEFAULT
    const sell = total * (1 + MARGIN_DEFAULT / 100)
    return { totalPerPax: sell, totalGroup: sell * PAX_DEFAULT }
  }, [])

  const current = useMemo<SimResult>(() => {
    let total = 0
    days.forEach(d => {
      total += d.hotelPrice + d.restoPrice + (d.guideIncluded ? d.guideCost : 0)
      d.activities.forEach(a => { if (a.included) total += a.price })
    })
    total += TRANSPORT_COST / pax
    const sell = total * (1 + marginPct / 100)
    const totalGroup = sell * pax
    const delta = sell - baseline.totalPerPax
    const deltaPct = baseline.totalPerPax > 0 ? ((delta / baseline.totalPerPax) * 100) : 0
    return { totalPerPax: sell, totalGroup, margin: marginPct, delta, deltaPct }
  }, [days, pax, marginPct, baseline])

  const updateDay = (dayNum: number, changes: Partial<DayConfig>) => {
    setDays(prev => prev.map(d => d.day === dayNum ? { ...d, ...changes } : d))
  }

  const toggleActivity = (dayNum: number, actIdx: number) => {
    setDays(prev => prev.map(d => {
      if (d.day !== dayNum) return d
      const acts = [...d.activities]
      acts[actIdx] = { ...acts[actIdx], included: !acts[actIdx].included }
      return { ...d, activities: acts }
    }))
  }

  const changeHotelCategory = (dayNum: number, cat: '3*' | '4*' | '5*') => {
    const options = HOTEL_OPTIONS[cat]
    if (!options || options.length === 0) return
    const hotel = options[0]
    const oldDay = days.find(d => d.day === dayNum)
    const desc = `J${dayNum}: Hôtel ${oldDay?.hotelCategory} → ${cat}`
    setHistory(prev => [desc, ...prev].slice(0, 10))
    updateDay(dayNum, { hotelCategory: cat, hotel: hotel.name, hotelPrice: hotel.price })
  }

  const toggleGuide = (dayNum: number) => {
    const oldDay = days.find(d => d.day === dayNum)
    const desc = `J${dayNum}: Guide ${oldDay?.guideIncluded ? 'retiré' : 'ajouté'}`
    setHistory(prev => [desc, ...prev].slice(0, 10))
    updateDay(dayNum, { guideIncluded: !oldDay?.guideIncluded })
  }

  const resetAll = () => {
    setDays(initialDays)
    setPax(PAX_DEFAULT)
    setMarginPct(MARGIN_DEFAULT)
    setHistory([])
  }

  const isUp = current.delta > 0
  const isDown = current.delta < 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Cotation <ChevronRight size={10} /> Simulation What-If
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Sliders className="text-rihla" size={36} />
            Simulation What-If
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Modifiez les paramètres et voyez l'impact en temps réel sur le prix/pax
          </p>
        </div>
        <div className="flex items-end gap-3">
          <ProjectPicker value={projectId} onChange={setProjectId} label="Projet pour simulation API" className="w-64" />
          <button
            onClick={runBackendSim}
            disabled={!projectId || simMut.isPending}
            className={clsx(
              "flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all",
              !projectId ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : simMut.isPending ? "bg-emerald-300 text-white cursor-wait"
              : "bg-emerald-600 text-white shadow-emerald-600/20 hover:-translate-y-0.5"
            )}
          >
            <Wifi size={14} /> {simMut.isPending ? 'Calcul…' : 'Simuler (API)'}
          </button>
          <button
            onClick={() => projectId && hotelSwapMut.mutate()}
            disabled={!projectId || hotelSwapMut.isPending}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow transition-all",
              !projectId ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : hotelSwapMut.isPending ? "bg-indigo-300 text-white cursor-wait"
              : "bg-indigo-600 text-white shadow-indigo-600/20 hover:-translate-y-0.5"
            )}
            title="Swap 4* → 5*"
          >
            <Wifi size={14} /> Swap Hôtel
          </button>
          <button
            onClick={() => projectId && marginAdjustMut.mutate()}
            disabled={!projectId || marginAdjustMut.isPending}
            className={clsx(
              "flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow transition-all",
              !projectId ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : marginAdjustMut.isPending ? "bg-amber-300 text-white cursor-wait"
              : "bg-amber-600 text-white shadow-amber-600/20 hover:-translate-y-0.5"
            )}
            title="Ajuster la marge"
          >
            <Wifi size={14} /> Marge {marginPct}%
          </button>
          <button onClick={resetAll} className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <Undo2 size={14} /> Réinitialiser
          </button>
        </div>
      </div>
      {simMut.data && (() => {
        const r: any = simMut.data
        const mod = r?.modified?.ranges?.[0] || r?.modified?.summary || r?.modified
        const orig = r?.original?.ranges?.[0] || r?.original?.summary || r?.original
        const modSell = Number(mod?.total_selling ?? mod?.selling_total ?? mod?.per_pax_selling ?? 0)
        const origSell = Number(orig?.total_selling ?? orig?.selling_total ?? orig?.per_pax_selling ?? 0)
        return (
          <div className="max-w-7xl mx-auto mb-6 rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
              <Wifi size={12} /> Résultat API what-if (backend)
            </div>
            <div className="flex gap-6 text-sm">
              <div>Original: <span className="font-black">{fmt(origSell)} MAD</span></div>
              <div>Modifié: <span className="font-black text-emerald-700 dark:text-emerald-300">{fmt(modSell)} MAD</span></div>
              <div>Δ: <span className="font-black">{fmt(modSell - origSell)} MAD</span></div>
              <div className="text-slate-500">Pax={pax} · Marge={marginPct}%</div>
            </div>
          </div>
        )
      })()}
      {simMut.error && (
        <div className="max-w-7xl mx-auto mb-6 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle size={14} /> {(simMut.error as any)?.response?.data?.detail || (simMut.error as any)?.message || 'Erreur simulation'}
        </div>
      )}
      {hotelSwapMut.data && (
        <div className="max-w-7xl mx-auto mb-6 rounded-2xl p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-300 dark:border-indigo-500/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-2">
            <Wifi size={12} /> Résultat swap hôtel (API)
          </div>
          <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">{JSON.stringify(hotelSwapMut.data, null, 2).slice(0, 400)}</pre>
        </div>
      )}
      {marginAdjustMut.data && (
        <div className="max-w-7xl mx-auto mb-6 rounded-2xl p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
            <Wifi size={12} /> Résultat ajustement marge (API)
          </div>
          <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">{JSON.stringify(marginAdjustMut.data, null, 2).slice(0, 400)}</pre>
        </div>
      )}

      {/* ── IMPACT BANNER ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className={clsx(
          "rounded-3xl p-6 flex items-center justify-between",
          current.delta === 0 ? "bg-slate-100 dark:bg-white/5" :
          isUp ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20" :
          "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/20"
        )}>
          <div className="flex items-center gap-6">
            <div className={clsx(
              "w-16 h-16 rounded-2xl flex items-center justify-center",
              current.delta === 0 ? "bg-slate-200 dark:bg-white/10" :
              isUp ? "bg-red-100 dark:bg-red-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"
            )}>
              {current.delta === 0 ? <RefreshCw size={24} className="text-slate-400" /> :
               isUp ? <TrendingUp size={24} className="text-red-500" /> :
               <TrendingDown size={24} className="text-emerald-500" />}
            </div>
            <div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Impact sur le prix</div>
              <div className={clsx("text-3xl font-black", current.delta === 0 ? "text-slate-400" : isUp ? "text-red-500" : "text-emerald-500")}>
                {current.delta >= 0 ? '+' : ''}{fmt(current.delta)} MAD/pax
              </div>
              <div className="text-xs text-slate-500 mt-1">
                ({current.deltaPct >= 0 ? '+' : ''}{current.deltaPct.toFixed(1)}% vs cotation initiale)
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase">Prix/Pax</div>
              <div className="text-2xl font-black text-slate-900 dark:text-cream">{fmt(current.totalPerPax)} <span className="text-sm text-slate-400">MAD</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase">Total Groupe</div>
              <div className="text-2xl font-black text-slate-900 dark:text-cream">{fmt(current.totalGroup)} <span className="text-sm text-slate-400">MAD</span></div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-400 uppercase">PAX</div>
              <div className="text-2xl font-black text-rihla">{pax}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: CONTROLS ──────────────────────────────────────── */}
        <div className="col-span-4 space-y-6">

          {/* Global controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Paramètres Globaux</h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  <span>Nombre de PAX</span>
                  <span className="text-rihla">{pax}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPax(Math.max(5, pax - 5))} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 transition-all"><Minus size={14} /></button>
                  <input type="range" min={5} max={50} step={5} value={pax} onChange={e => setPax(Number(e.target.value))} className="flex-1 accent-rihla" />
                  <button onClick={() => setPax(Math.min(50, pax + 5))} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center hover:bg-slate-200 transition-all"><Plus size={14} /></button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                  <span>Marge (%)</span>
                  <span className="text-rihla">{marginPct}%</span>
                </div>
                <input type="range" min={5} max={50} step={1} value={marginPct} onChange={e => setMarginPct(Number(e.target.value))} className="w-full accent-rihla" />
              </div>
            </div>
          </div>

          {/* Quick scenarios */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-rihla" /> Scénarios Rapides
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setDays(prev => prev.map(d => d.hotelPrice > 0 ? { ...d, hotelCategory: '4*' as const, hotelPrice: Math.min(d.hotelPrice, 1400) } : d))
                  setHistory(prev => ['Tous hôtels → 4*', ...prev])
                }}
                className="w-full text-left p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-all"
              >
                <Hotel size={14} className="inline mr-2" /> Passer tous les hôtels en 4*
              </button>
              <button
                onClick={() => {
                  setDays(prev => prev.map(d => ({ ...d, guideIncluded: false })))
                  setHistory(prev => ['Tous guides retirés', ...prev])
                }}
                className="w-full text-left p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-all"
              >
                <UsersIcon size={14} className="inline mr-2" /> Retirer tous les guides
              </button>
              <button
                onClick={() => {
                  setDays(prev => prev.map(d => ({ ...d, restoPrice: Math.round(d.restoPrice * 0.8) })))
                  setHistory(prev => ['Restos -20%', ...prev])
                }}
                className="w-full text-left p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-all"
              >
                <Utensils size={14} className="inline mr-2" /> Restauration -20%
              </button>
            </div>
          </div>

          {/* Change history */}
          {history.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Historique des modifications</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-rihla flex-shrink-0" />
                    {h}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: DAY-BY-DAY EDITOR ──────────────────────────────── */}
        <div className="col-span-8 space-y-4">
          {days.map(d => (
            <div key={d.day} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedDay(expandedDay === d.day ? null : d.day)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rihla/10 flex items-center justify-center text-rihla font-black text-sm">J{d.day}</div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{d.city}</div>
                    <div className="text-[10px] text-slate-400">
                      {d.hotel || 'Pas d\'hébergement'} · {d.guideIncluded ? 'Guide inclus' : 'Sans guide'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-cream">
                      {fmt(d.hotelPrice + d.restoPrice + (d.guideIncluded ? d.guideCost : 0) + d.activities.filter(a => a.included).reduce((s, a) => s + a.price, 0))} MAD
                    </div>
                    <div className="text-[10px] text-slate-400">coût jour</div>
                  </div>
                  {expandedDay === d.day ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {expandedDay === d.day && d.hotelPrice > 0 && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4">
                  {/* Hotel category */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Catégorie Hôtel</label>
                    <div className="flex gap-2">
                      {(['3*', '4*', '5*'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => changeHotelCategory(d.day, cat)}
                          className={clsx(
                            "flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            d.hotelCategory === cat
                              ? "bg-rihla text-white shadow-lg shadow-rihla/20"
                              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                          )}
                        >
                          <Star size={12} /> {cat}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{d.hotel} — {fmt(d.hotelPrice)} MAD/nuit</div>
                  </div>

                  {/* Guide toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Guide local</div>
                      <div className="text-[10px] text-slate-400">{fmt(d.guideCost)} MAD/jour</div>
                    </div>
                    <button
                      onClick={() => toggleGuide(d.day)}
                      className={clsx(
                        "w-12 h-6 rounded-full transition-all relative",
                        d.guideIncluded ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20"
                      )}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all",
                        d.guideIncluded ? "left-6" : "left-0.5"
                      )} />
                    </button>
                  </div>

                  {/* Activities */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Activités</label>
                    <div className="space-y-1">
                      {d.activities.map((act, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={act.included}
                              onChange={() => toggleActivity(d.day, i)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-rihla focus:ring-rihla"
                            />
                            <span className={clsx(act.included ? "text-slate-700 dark:text-slate-300" : "text-slate-400 line-through")}>{act.name}</span>
                          </label>
                          {act.price > 0 && <span className="text-[10px] font-mono text-slate-400">{fmt(act.price)} MAD</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
