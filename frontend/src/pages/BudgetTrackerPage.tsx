import { useState, useMemo } from 'react'
import {
  BarChart2, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, AlertTriangle, CheckCircle2, Edit3,
  Save, PieChart, ArrowUpDown, Eye,
  Plus, FileSpreadsheet, Calendar, Wifi, WifiOff
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { budgetApi } from '@/lib/api'
import { ProjectPicker } from '@/components/projects/ProjectPicker'

// ── Types ──────────────────────────────────────────────────────────
interface BudgetLine {
  id: string
  category: string
  label: string
  estimated: number
  actual: number | null
  notes: string
  status: 'pending' | 'invoiced' | 'paid'
}

// ── Mock Data ──────────────────────────────────────────────────────
const initialLines: BudgetLine[] = [
  { id: '1', category: 'Hébergement', label: 'Riad Fes 5* — 3 nuits', estimated: 5850, actual: 5850, notes: '', status: 'paid' },
  { id: '2', category: 'Hébergement', label: 'Movenpick Marrakech — 2 nuits', estimated: 3600, actual: 3800, notes: 'Surclassement suite', status: 'paid' },
  { id: '3', category: 'Hébergement', label: 'Bivouac Merzouga — 1 nuit', estimated: 2800, actual: 2800, notes: '', status: 'paid' },
  { id: '4', category: 'Transport', label: 'Bus climatisé 50 places', estimated: 35000, actual: 35000, notes: '', status: 'invoiced' },
  { id: '5', category: 'Transport', label: 'Transferts aéroport (2x)', estimated: 3000, actual: 2800, notes: 'Négocié avec Horizon', status: 'paid' },
  { id: '6', category: 'Restauration', label: 'Déjeuners (7 jours)', estimated: 8400, actual: 8900, notes: '2 déjeuners supplémentaires', status: 'invoiced' },
  { id: '7', category: 'Restauration', label: 'Dîners gastronomiques (4)', estimated: 6000, actual: 5600, notes: '', status: 'paid' },
  { id: '8', category: 'Guides', label: 'Guide francophone (8 jours)', estimated: 6400, actual: 6400, notes: '', status: 'paid' },
  { id: '9', category: 'Guides', label: 'Guide local Fès', estimated: 1000, actual: 1200, notes: 'Extension visite médina', status: 'paid' },
  { id: '10', category: 'Activités', label: 'Entrées monuments', estimated: 2400, actual: 2400, notes: '', status: 'paid' },
  { id: '11', category: 'Activités', label: 'Balade dromadaires', estimated: 4000, actual: 4000, notes: '', status: 'invoiced' },
  { id: '12', category: 'Activités', label: 'Cours de cuisine', estimated: 3000, actual: null, notes: 'Annulé — météo', status: 'pending' },
  { id: '13', category: 'Divers', label: 'Pourboires guides/chauffeurs', estimated: 2000, actual: 2500, notes: 'Groupe très satisfait', status: 'paid' },
  { id: '14', category: 'Divers', label: 'Imprévu / urgences', estimated: 1500, actual: 800, notes: 'Pharmacie passager', status: 'paid' },
]

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR')

export function BudgetTrackerPage() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [mockLines, setMockLines] = useState<BudgetLine[]>(initialLines)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<number>(0)
  const [editNotes, setEditNotes] = useState('')
  const [viewMode, setViewMode] = useState<'detail' | 'category'>('detail')

  // Fetch live budget report when a project is selected
  const { data: liveReport, isFetching } = useQuery({
    queryKey: ['budget-report', projectId],
    queryFn: () => budgetApi.report(projectId!).then(r => r.data),
    enabled: !!projectId,
    retry: false,
  })

  // Map backend by_category to BudgetLine[] so the table keeps working.
  const liveLines: BudgetLine[] = useMemo(() => {
    if (!liveReport) return []
    const cats: any[] = (liveReport as any).by_category ?? []
    return cats.map((c: any, idx: number) => ({
      id: `live-${idx}`,
      category: c.category || 'Divers',
      label: c.label || c.category || '—',
      estimated: Number(c.estimated ?? 0),
      actual:    c.actual === undefined ? null : Number(c.actual ?? 0),
      notes: c.notes ?? '',
      status: (c.status === 'over' ? 'invoiced' : c.status === 'under' ? 'paid' : 'pending') as BudgetLine['status'],
    }))
  }, [liveReport])

  const usingLive = !!projectId && liveLines.length > 0
  const lines = usingLive ? liveLines : mockLines
  const setLines = usingLive ? (() => {}) : setMockLines

  const totalEstimated = lines.reduce((s, l) => s + l.estimated, 0)
  const totalActual = lines.reduce((s, l) => s + (l.actual ?? 0), 0)
  const pendingItems = lines.filter(l => l.actual === null).length
  const delta = totalActual - totalEstimated
  const deltaPct = totalEstimated > 0 ? (delta / totalEstimated) * 100 : 0

  const categories = [...new Set(lines.map(l => l.category))]
  const categoryData = categories.map(cat => {
    const catLines = lines.filter(l => l.category === cat)
    return {
      category: cat,
      estimated: catLines.reduce((s, l) => s + l.estimated, 0),
      actual: catLines.reduce((s, l) => s + (l.actual ?? 0), 0),
      count: catLines.length,
    }
  })

  const startEdit = (line: BudgetLine) => {
    setEditingId(line.id)
    setEditValue(line.actual ?? line.estimated)
    setEditNotes(line.notes)
  }

  const saveEdit = (id: string) => {
    setLines(prev => prev.map(l =>
      l.id === id ? { ...l, actual: editValue, notes: editNotes, status: 'invoiced' as const } : l
    ))
    setEditingId(null)
  }

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Hébergement': 'bg-blue-500',
      'Transport': 'bg-emerald-500',
      'Restauration': 'bg-amber-500',
      'Guides': 'bg-purple-500',
      'Activités': 'bg-pink-500',
      'Divers': 'bg-slate-500',
    }
    return colors[cat] || 'bg-slate-400'
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Finance <ChevronRight size={10} /> Budget Tracker
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <BarChart2 className="text-rihla" size={36} />
            Budget Tracker
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic flex items-center gap-2">
            Réel vs Estimé ·
            {usingLive
              ? <span className="inline-flex items-center gap-1 text-emerald-500 font-bold"><Wifi size={12} /> Données live depuis l'API</span>
              : <span className="inline-flex items-center gap-1 text-slate-400 font-bold"><WifiOff size={12} /> Données de démonstration</span>
            }
            {isFetching && <span className="text-xs text-slate-400">· chargement…</span>}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <ProjectPicker value={projectId} onChange={setProjectId} label="Projet source" className="w-72" />
          <button className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <FileSpreadsheet size={14} /> Export Rapport
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Budget Estimé</div>
          <div className="text-2xl font-black text-slate-900 dark:text-cream">{fmt(totalEstimated)} <span className="text-sm text-slate-400">MAD</span></div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Coût Réel</div>
          <div className="text-2xl font-black text-slate-900 dark:text-cream">{fmt(totalActual)} <span className="text-sm text-slate-400">MAD</span></div>
        </div>
        <div className={clsx("rounded-3xl border p-6 shadow-sm", delta > 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/20" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/20")}>
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Écart</div>
          <div className={clsx("text-2xl font-black flex items-center gap-2", delta > 0 ? "text-red-500" : "text-emerald-500")}>
            {delta > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            {delta >= 0 ? '+' : ''}{fmt(delta)} <span className="text-sm">({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
          <div className="text-[10px] font-black text-slate-400 uppercase mb-2">En attente</div>
          <div className="text-2xl font-black text-amber-500">{pendingItems} <span className="text-sm text-slate-400">postes</span></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: CATEGORY BREAKDOWN ──────────────────────────── */}
        <div className="col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <PieChart size={14} /> Par Catégorie
            </h3>
            <div className="space-y-4">
              {categoryData.map(cat => {
                const catDelta = cat.actual - cat.estimated
                return (
                  <div key={cat.category}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <div className={clsx("w-3 h-3 rounded-full", getCategoryColor(cat.category))} />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{cat.category}</span>
                      </div>
                      <span className={clsx("text-[10px] font-bold", catDelta > 0 ? "text-red-500" : catDelta < 0 ? "text-emerald-500" : "text-slate-400")}>
                        {catDelta >= 0 ? '+' : ''}{fmt(catDelta)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative">
                      <div className="h-full bg-slate-300 dark:bg-white/20 rounded-full absolute" style={{ width: `${(cat.estimated / totalEstimated) * 100}%` }} />
                      <div className={clsx("h-full rounded-full absolute opacity-80", getCategoryColor(cat.category))} style={{ width: `${(cat.actual / totalEstimated) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Estimé: {fmt(cat.estimated)}</span>
                      <span>Réel: {fmt(cat.actual)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-4 text-xs text-slate-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white/20" /> <span>Estimé</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rihla" /> <span>Réel</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: DETAIL TABLE ──────────────────────────────── */}
        <div className="col-span-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Eye size={16} className="text-rihla" /> Détail des postes
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('detail')} className={clsx("px-3 py-1 rounded-lg text-xs font-bold", viewMode === 'detail' ? "bg-rihla/10 text-rihla" : "text-slate-400")}>Détail</button>
                <button onClick={() => setViewMode('category')} className={clsx("px-3 py-1 rounded-lg text-xs font-bold", viewMode === 'category' ? "bg-rihla/10 text-rihla" : "text-slate-400")}>Catégorie</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5">
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Catégorie</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase">Poste</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase">Estimé</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase">Réel</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase">Écart</th>
                    <th className="px-6 py-3 text-center text-[10px] font-black text-slate-400 uppercase">Statut</th>
                    <th className="px-6 py-3 text-center text-[10px] font-black text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const lineD = (line.actual ?? 0) - line.estimated
                    const isEditing = editingId === line.id
                    return (
                      <tr key={line.id} className={clsx(i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-white/[0.02]", "hover:bg-rihla/5 transition-colors")}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className={clsx("w-2 h-2 rounded-full", getCategoryColor(line.category))} />
                            <span className="text-xs font-medium text-slate-500">{line.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{line.label}</div>
                          {line.notes && <div className="text-[10px] text-slate-400 mt-0.5 italic">{line.notes}</div>}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-xs">{fmt(line.estimated)}</td>
                        <td className="px-6 py-3 text-right">
                          {isEditing ? (
                            <input type="number" value={editValue} onChange={e => setEditValue(Number(e.target.value))} className="w-24 px-2 py-1 rounded-lg border border-rihla/30 text-right text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rihla/30" autoFocus />
                          ) : (
                            <span className="font-mono text-xs">{line.actual !== null ? fmt(line.actual) : <span className="text-slate-300 italic">—</span>}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {line.actual !== null && (
                            <span className={clsx("text-xs font-bold", lineD > 0 ? "text-red-500" : lineD < 0 ? "text-emerald-500" : "text-slate-400")}>
                              {lineD >= 0 ? '+' : ''}{fmt(lineD)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={clsx("px-2 py-0.5 rounded-lg text-[10px] font-bold", line.status === 'paid' ? "bg-emerald-100 text-emerald-700" : line.status === 'invoiced' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700")}>
                            {line.status === 'paid' ? 'Payé' : line.status === 'invoiced' ? 'Facturé' : 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {isEditing ? (
                            <button onClick={() => saveEdit(line.id)} className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600">
                              <Save size={12} />
                            </button>
                          ) : (
                            <button onClick={() => startEdit(line)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400">
                              <Edit3 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-white/5 font-black">
                    <td className="px-6 py-4" colSpan={2}>TOTAL</td>
                    <td className="px-6 py-4 text-right font-mono">{fmt(totalEstimated)}</td>
                    <td className="px-6 py-4 text-right font-mono">{fmt(totalActual)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={clsx(delta > 0 ? "text-red-500" : "text-emerald-500")}>
                        {delta >= 0 ? '+' : ''}{fmt(delta)}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
