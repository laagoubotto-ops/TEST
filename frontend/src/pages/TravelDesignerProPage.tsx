/**
 * Travel Designer Pro — drag-drop catalogue → itinéraire jour-par-jour.
 *
 * S1 → catalogue par kind (hôtels, restos, monuments, transport, guides, activités)
 * S2 → days éditables (add/remove + drag d'item entre days)
 * S3 → recompute totals (cost / margin / public / per_pax) + breakdown by_kind/by_city
 * S4 → save versions (V1, V2…) + statut draft|published
 * S5 → promote to Itinerary + Quotation (demo)
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Save, FileCheck2, RefreshCw, Hotel as HotelIcon, UtensilsCrossed,
  Landmark, Bus, UserCircle2, Sparkles, Calendar, Users, Coins, MapPin,
  GripVertical, Search, X,
} from 'lucide-react'
import { travelDesignerProApi, type TDDraft, type TDCatalogResp } from '@/lib/api'

const KIND_ICONS: Record<string, any> = {
  hotels: HotelIcon, restaurants: UtensilsCrossed, monuments: Landmark,
  transport: Bus, guides: UserCircle2, activities: Sparkles,
}
const KIND_COLORS: Record<string, string> = {
  hotels: 'bg-rose-50 text-rose-700 border-rose-200',
  restaurants: 'bg-amber-50 text-amber-700 border-amber-200',
  monuments: 'bg-violet-50 text-violet-700 border-violet-200',
  transport: 'bg-blue-50 text-blue-700 border-blue-200',
  guides: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  activities: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  hotel: 'bg-rose-50 text-rose-700 border-rose-200',
  restaurant: 'bg-amber-50 text-amber-700 border-amber-200',
  monument: 'bg-violet-50 text-violet-700 border-violet-200',
  guide: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  activity: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  misc: 'bg-slate-50 text-slate-700 border-slate-200',
}
const KIND_LABEL: Record<string, string> = {
  hotels: 'Hôtels', restaurants: 'Restaurants', monuments: 'Monuments',
  transport: 'Transport', guides: 'Guides', activities: 'Activités',
}

function fmt(v: number, cur = 'MAD') {
  if (v == null) return '—'
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)} ${cur}`
}

export default function TravelDesignerProPage() {
  const [drafts, setDrafts] = useState<TDDraft[]>([])
  const [active, setActive] = useState<TDDraft | null>(null)
  const [catalog, setCatalog] = useState<TDCatalogResp | null>(null)
  const [activeKind, setActiveKind] = useState<string>('hotels')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string>('')
  const [promoted, setPromoted] = useState<any | null>(null)
  const dragData = useRef<{ item_id: string; from_day?: number; index?: number } | null>(null)

  const loadDrafts = async () => {
    const list = (await travelDesignerProApi.drafts()).data
    setDrafts(list)
    if (!active && list[0]) setActive(list[0])
  }

  useEffect(() => {
    travelDesignerProApi.catalog().then(r => setCatalog(r.data))
    loadDrafts()
  }, [])

  useEffect(() => {
    if (active) {
      // resync from server when switching
      travelDesignerProApi.get(active.id).then(r => setActive(r.data)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const refresh = async () => {
    if (!active) return
    const fresh = (await travelDesignerProApi.get(active.id)).data
    setActive(fresh)
  }

  const seedDemo = async () => {
    setBusy(true)
    try {
      (await travelDesignerProApi.seedDemo()).data
      await loadDrafts()
      setFeedback('Brouillon démo créé')
    } finally { setBusy(false) }
  }

  const newDraft = async () => {
    setBusy(true)
    try {
      const d = (await travelDesignerProApi.create({ name: 'Nouveau circuit', pax: 10, currency: 'MAD', margin_pct: 15 })).data
      await loadDrafts()
      setActive(d)
    } finally { setBusy(false) }
  }

  const addDay = async () => {
    if (!active) return
    setBusy(true)
    try {
      const d = (await travelDesignerProApi.addDay(active.id, { city: 'Marrakech' })).data
      setActive(d)
    } finally { setBusy(false) }
  }

  const removeDay = async (dayNum: number) => {
    if (!active) return
    setBusy(true)
    try {
      const d = (await travelDesignerProApi.removeDay(active.id, dayNum)).data
      setActive(d)
    } finally { setBusy(false) }
  }

  const onDragStartCatalog = (item_id: string) => {
    dragData.current = { item_id }
  }
  const onDragStartItem = (from_day: number, index: number) => {
    dragData.current = { item_id: '', from_day, index }
  }
  const onDropDay = async (day_num: number) => {
    if (!active || !dragData.current) return
    const data = dragData.current
    dragData.current = null
    setBusy(true)
    try {
      let d: TDDraft
      if (data.item_id) {
        d = (await travelDesignerProApi.addItem(active.id, { day_num, item_id: data.item_id, qty: 1 })).data
      } else if (data.from_day != null && data.index != null) {
        d = (await travelDesignerProApi.moveItem(active.id, {
          from_day: data.from_day, to_day: day_num, item_index: data.index,
        })).data
      } else { return }
      setActive(d)
    } finally { setBusy(false) }
  }

  const removeItem = async (day_num: number, item_index: number) => {
    if (!active) return
    setBusy(true)
    try {
      const d = (await travelDesignerProApi.removeItem(active.id, { day_num, item_index })).data
      setActive(d)
    } finally { setBusy(false) }
  }

  const recompute = async () => {
    if (!active) return
    setBusy(true)
    try {
      (await travelDesignerProApi.recompute(active.id)).data
      await refresh()
      setFeedback('Totaux recalculés')
    } finally { setBusy(false) }
  }

  const saveVersion = async () => {
    if (!active) return
    setBusy(true)
    try {
      const r = (await travelDesignerProApi.saveVersion(active.id)).data
      await refresh()
      setFeedback(`Sauvegardé en V${r.version}`)
    } finally { setBusy(false) }
  }

  const promote = async () => {
    if (!active) return
    setBusy(true)
    try {
      const r = (await travelDesignerProApi.promote(active.id)).data
      setPromoted(r)
      await refresh()
      setFeedback('Promu en Itinerary + Quotation')
    } finally { setBusy(false) }
  }

  const updateMeta = async (patch: Partial<TDDraft>) => {
    if (!active) return
    const d = (await travelDesignerProApi.patch(active.id, patch)).data
    setActive(d)
    setDrafts(prev => prev.map(p => p.id === d.id ? d : p))
  }

  // ─ Catalogue rendering ───────────────────────────────────────────
  const catalogItems = useMemo(() => {
    if (!catalog) return []
    const arr = catalog.catalog[activeKind] || []
    if (!search.trim()) return arr
    const q = search.toLowerCase()
    return arr.filter(it => (it.label + ' ' + (it.city || '')).toLowerCase().includes(q))
  }, [catalog, activeKind, search])

  return (
    <div className="p-6 space-y-4 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">Travel Designer Pro</h1>
          <p className="text-sm text-slate-500">
            Drag-drop catalogue (hôtels · restos · monuments · transport · guides · activités) → itinéraire jour-par-jour avec persistence et promote en Itinerary + Quotation.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={seedDemo} disabled={busy} className="px-3 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2">
            <Sparkles size={14} /> Seed démo
          </button>
          <button onClick={newDraft} disabled={busy} className="px-3 py-2 text-sm font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2">
            <Plus size={14} /> Nouveau brouillon
          </button>
        </div>
      </div>

      {feedback && (
        <div className="text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 inline-block">
          {feedback}
        </div>
      )}

      {/* 3-column layout: catalogue / canvas / sidebar */}
      <div className="grid grid-cols-12 gap-4">
        {/* ══════════ Catalogue (S1) ══════════ */}
        <aside className="col-span-3 bg-white border border-slate-200 rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">Catalogue</h2>
          {/* Kind tabs */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            {catalog?.kinds.map(k => {
              const Icon = KIND_ICONS[k] ?? Sparkles
              const active = activeKind === k
              return (
                <button key={k} onClick={() => setActiveKind(k)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold rounded-lg border transition ${active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                  <Icon size={12} /> {KIND_LABEL[k] || k}
                </button>
              )
            })}
          </div>

          <div className="relative mb-3">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-7 pr-2 py-2 text-xs rounded-lg border border-slate-200 focus:border-slate-400 outline-none" />
          </div>

          <div className="space-y-1.5">
            {catalogItems.map(it => (
              <div key={it.id}
                draggable
                onDragStart={() => onDragStartCatalog(it.id)}
                className={`p-2.5 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-sm transition ${KIND_COLORS[activeKind] || 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start gap-2">
                  <GripVertical size={12} className="mt-0.5 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold leading-tight">{it.label}</div>
                    {it.city && <div className="text-[10px] opacity-70 truncate"><MapPin size={9} className="inline -mt-0.5" /> {it.city}</div>}
                    <div className="text-[10px] font-mono mt-0.5">{fmt(it.unit_cost, it.currency || 'MAD')}</div>
                  </div>
                </div>
              </div>
            ))}
            {catalogItems.length === 0 && (
              <div className="text-xs text-slate-400 italic text-center py-4">Aucun item</div>
            )}
          </div>
        </aside>

        {/* ══════════ Canvas central ══════════ */}
        <main className="col-span-6 space-y-3">
          {/* Drafts picker */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2 overflow-x-auto">
            {drafts.map(d => (
              <button key={d.id} onClick={() => setActive(d)}
                className={`px-3 py-2 text-xs font-bold rounded-lg whitespace-nowrap border transition ${active?.id === d.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                {d.name}
                <span className="ml-1.5 text-[10px] opacity-70">V{d.version}</span>
              </button>
            ))}
            {drafts.length === 0 && <div className="text-xs text-slate-400 italic">Aucun brouillon — clique « Seed démo » ou « Nouveau brouillon »</div>}
          </div>

          {!active ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-sm text-slate-400">
              Sélectionne un brouillon ou crée-en un nouveau pour démarrer.
            </div>
          ) : (
            <>
              {/* Meta editor */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Nom</label>
                  <input value={active.name}
                    onChange={e => setActive({ ...active, name: e.target.value })}
                    onBlur={() => updateMeta({ name: active.name })}
                    className="w-full px-2 py-1.5 text-sm font-bold border border-slate-200 rounded-lg focus:border-slate-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500"><Users size={10} className="inline" /> PAX</label>
                  <input type="number" value={active.pax}
                    onChange={e => setActive({ ...active, pax: parseInt(e.target.value || '1', 10) })}
                    onBlur={() => updateMeta({ pax: active.pax })}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-slate-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500"><Calendar size={10} className="inline" /> Début</label>
                  <input type="date" value={active.start_date || ''}
                    onChange={e => setActive({ ...active, start_date: e.target.value })}
                    onBlur={() => updateMeta({ start_date: active.start_date })}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-slate-400 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500"><Coins size={10} className="inline" /> Marge %</label>
                  <input type="number" step="0.5" value={active.margin_pct}
                    onChange={e => setActive({ ...active, margin_pct: parseFloat(e.target.value || '0') })}
                    onBlur={() => updateMeta({ margin_pct: active.margin_pct })}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-slate-400 outline-none" />
                </div>
              </div>

              {/* Days canvas */}
              <div className="space-y-3">
                {(active.days || []).map(day => (
                  <div key={day.day_num}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDropDay(day.day_num)}
                    className="bg-white border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-3 transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black">JOUR {day.day_num}</div>
                        <input value={day.city}
                          onChange={e => {
                            const newDays = active.days.map(d => d.day_num === day.day_num ? { ...d, city: e.target.value } : d)
                            setActive({ ...active, days: newDays })
                          }}
                          onBlur={() => updateMeta({ days: active.days })}
                          className="px-2 py-1 text-sm font-bold border border-transparent hover:border-slate-200 rounded-md focus:border-slate-300 outline-none" />
                        {day.date && <span className="text-[10px] text-slate-400 font-mono">{day.date}</span>}
                        <span className="text-[10px] text-slate-400">· {(day.items || []).length} items</span>
                      </div>
                      <button onClick={() => removeDay(day.day_num)}
                        className="text-slate-300 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {(day.items || []).length === 0 ? (
                      <div className="text-[11px] text-slate-300 italic text-center py-3 border border-dashed border-slate-200 rounded-lg">
                        Glisse des items du catalogue ici…
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {(day.items || []).map((it, idx) => (
                          <div key={idx}
                            draggable
                            onDragStart={() => onDragStartItem(day.day_num, idx)}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing ${KIND_COLORS[it.kind] || 'bg-slate-50 border-slate-200'}`}>
                            <GripVertical size={10} className="opacity-50" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold leading-tight truncate">{it.label}</div>
                              <div className="text-[10px] opacity-70">
                                {it.kind} {it.city ? `· ${it.city}` : ''} {it.supplier ? `· ${it.supplier}` : ''}
                              </div>
                            </div>
                            <div className="text-[11px] font-mono font-bold flex-shrink-0">
                              {fmt(it.unit_cost * it.qty, it.currency)}
                            </div>
                            <button onClick={() => removeItem(day.day_num, idx)}
                              className="text-slate-300 hover:text-red-500 transition flex-shrink-0">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={addDay}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-sm font-bold text-slate-500 hover:border-slate-900 hover:text-slate-900 hover:bg-white transition flex items-center justify-center gap-2">
                  <Plus size={16} /> Ajouter un jour
                </button>
              </div>
            </>
          )}
        </main>

        {/* ══════════ Sidebar (totaux + actions) ══════════ */}
        <aside className="col-span-3 space-y-3">
          {active && (
            <>
              {/* Totals */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-2">Cotation en cours</div>
                <div className="text-3xl font-black">{fmt(active.totals?.public_total || 0, active.currency)}</div>
                <div className="text-[11px] opacity-80 mt-0.5">{fmt(active.totals?.per_pax || 0, active.currency)} / PAX · {active.pax} PAX</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="opacity-70">Coût</div>
                    <div className="font-bold">{fmt(active.totals?.total_cost || 0, active.currency)}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="opacity-70">Marge {active.totals?.margin_pct || 0}%</div>
                    <div className="font-bold">{fmt(active.totals?.margin_value || 0, active.currency)}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="opacity-70">Lignes</div>
                    <div className="font-bold">{active.totals?.lines || 0}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2">
                    <div className="opacity-70">Jours</div>
                    <div className="font-bold">{active.totals?.days || 0}</div>
                  </div>
                </div>
              </div>

              {/* By kind */}
              {active.totals?.by_kind && Object.keys(active.totals.by_kind).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Répartition par catégorie</div>
                  <div className="space-y-1.5">
                    {Object.entries(active.totals.by_kind).map(([k, v]) => {
                      const total = active.totals?.total_cost || 1
                      const pct = ((v as number) / total) * 100
                      return (
                        <div key={k}>
                          <div className="flex justify-between text-[11px] mb-0.5">
                            <span className="font-bold capitalize">{k}</span>
                            <span className="font-mono text-slate-500">{fmt(v as number, active.currency)} · {pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${KIND_COLORS[k]?.split(' ')[0]?.replace('bg-', 'bg-') || 'bg-slate-400'}`}
                              style={{ width: `${pct}%`, opacity: 0.7 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Actions</div>
                <button onClick={recompute} disabled={busy}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-2">
                  <RefreshCw size={12} /> Recalculer
                </button>
                <button onClick={saveVersion} disabled={busy}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center gap-2">
                  <Save size={12} /> Sauvegarder version (V{active.version})
                </button>
                <button onClick={promote} disabled={busy}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <FileCheck2 size={12} /> Promouvoir → Itinerary + Quotation
                </button>
                <div className="text-[10px] text-slate-400 mt-2 px-1">
                  Statut : <span className="font-bold text-slate-600">{active.status}</span>
                  {active.last_saved_at && <> · sauvegardé {new Date(active.last_saved_at).toLocaleString('fr-FR')}</>}
                </div>
              </div>

              {promoted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs">
                  <div className="font-bold text-emerald-800 mb-1">Promu avec succès</div>
                  <div className="text-emerald-700">{promoted.summary}</div>
                  <div className="font-mono text-[10px] mt-1 text-emerald-600">
                    itinerary: {promoted.demo_itinerary_id}<br/>
                    quotation: {promoted.demo_quotation_id}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
