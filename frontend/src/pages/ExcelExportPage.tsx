import { useState } from 'react'
import {
  FileSpreadsheet, Download, ChevronRight, Check,
  Table2, BarChart3, Layers, Settings2, Eye,
  ArrowUpDown, Filter, Sparkles, AlertCircle, Wifi
} from 'lucide-react'
import { clsx } from 'clsx'
import { excelExportApi } from '@/lib/api'
import { ProjectPicker } from '@/components/projects/ProjectPicker'

// ── Types ──────────────────────────────────────────────────────────
interface ExportConfig {
  includeBreakdown: boolean
  includeComparison: boolean
  includeCharts: boolean
  models: string[]
  paxRanges: number[]
  currency: string
  language: 'fr' | 'en'
}

interface CotationModel {
  id: string
  name: string
  description: string
  margin: number
  color: string
}

interface CategoryBreakdown {
  category: string
  model1: number
  model2: number
  model3: number
  model4: number
}

// ── Mock Data ──────────────────────────────────────────────────────
const MODELS: CotationModel[] = [
  { id: 'eco', name: 'Économique', description: 'Hôtels 3*, transport standard', margin: 15, color: 'bg-blue-500' },
  { id: 'std', name: 'Standard', description: 'Hôtels 4*, bus climatisé', margin: 20, color: 'bg-emerald-500' },
  { id: 'prem', name: 'Premium', description: 'Hôtels 5*, véhicule privé', margin: 25, color: 'bg-amber-500' },
  { id: 'lux', name: 'Luxe', description: 'Riads d\'exception, chauffeur dédié', margin: 30, color: 'bg-purple-500' },
]

const PAX_OPTIONS = [10, 15, 20, 25, 30, 35, 40]

const CATEGORIES: CategoryBreakdown[] = [
  { category: 'Hébergement', model1: 4200, model2: 6800, model3: 9500, model4: 14200 },
  { category: 'Transport', model1: 3200, model2: 4500, model3: 6200, model4: 8800 },
  { category: 'Restauration', model1: 2800, model2: 3500, model3: 4800, model4: 7200 },
  { category: 'Guides', model1: 1500, model2: 1800, model3: 2200, model4: 3500 },
  { category: 'Activités', model1: 1800, model2: 2600, model3: 3800, model4: 5500 },
  { category: 'Monuments', model1: 800, model2: 800, model3: 1200, model4: 1200 },
]

const GRID_DATA = [
  { pax: 10, eco: 1420, std: 1950, prem: 2840, lux: 4200 },
  { pax: 15, eco: 1180, std: 1620, prem: 2360, lux: 3500 },
  { pax: 20, eco: 1050, std: 1440, prem: 2100, lux: 3100 },
  { pax: 25, eco: 980, std: 1340, prem: 1950, lux: 2900 },
  { pax: 30, eco: 920, std: 1260, prem: 1840, lux: 2720 },
  { pax: 35, eco: 880, std: 1200, prem: 1750, lux: 2600 },
]

const fmt = (n: number) => n.toLocaleString('fr-FR')

export function ExcelExportPage() {
  const [config, setConfig] = useState<ExportConfig>({
    includeBreakdown: true,
    includeComparison: true,
    includeCharts: false,
    models: ['eco', 'std', 'prem', 'lux'],
    paxRanges: [10, 15, 20, 25, 30, 35],
    currency: 'EUR',
    language: 'fr',
  })
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [previewMode, setPreviewMode] = useState<'grid' | 'breakdown' | 'comparison'>('grid')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const toggleModel = (id: string) => {
    setConfig(prev => ({
      ...prev,
      models: prev.models.includes(id) ? prev.models.filter(m => m !== id) : [...prev.models, id]
    }))
  }

  const togglePax = (pax: number) => {
    setConfig(prev => ({
      ...prev,
      paxRanges: prev.paxRanges.includes(pax) ? prev.paxRanges.filter(p => p !== pax) : [...prev.paxRanges, pax].sort((a, b) => a - b)
    }))
  }

  const handleRealXlsxExport = async () => {
    if (!projectId) return
    setExporting(true)
    setExportError(null)
    try {
      const res = await excelExportApi.quotation(projectId)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `cotation_${projectId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setExported(true)
      setTimeout(() => setExported(false), 3000)
    } catch (err: any) {
      setExportError(err?.response?.data?.detail || err?.message || 'Erreur export')
    } finally {
      setExporting(false)
    }
  }

  const handleExport = () => {
    setExporting(true)
    // Simulate CSV generation and download
    setTimeout(() => {
      const headers = ['PAX', ...config.models.map(m => MODELS.find(mod => mod.id === m)?.name || m)]
      const rows = GRID_DATA
        .filter(r => config.paxRanges.includes(r.pax))
        .map(r => [r.pax, ...(config.models.map(m => (r as Record<string, number>)[m]))])

      let csv = headers.join(';') + '\n'
      rows.forEach(row => { csv += row.join(';') + '\n' })

      if (config.includeBreakdown) {
        csv += '\n\nDÉCOMPOSITION PAR CATÉGORIE\n'
        csv += ['Catégorie', ...config.models.map(m => MODELS.find(mod => mod.id === m)?.name || m)].join(';') + '\n'
        CATEGORIES.forEach(cat => {
          const vals = config.models.map((_m, i) => (cat as unknown as Record<string, number>)[`model${i + 1}`] || 0)
          csv += [cat.category, ...vals].join(';') + '\n'
        })
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cotation_avancee_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)

      setExporting(false)
      setExported(true)
      setTimeout(() => setExported(false), 3000)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Cotation <ChevronRight size={10} /> Export Excel Avancé
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <FileSpreadsheet className="text-emerald-500" size={36} />
            Export Excel Cotation
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Grille tarifaire complète · 4 modèles · Décomposition par catégorie
          </p>
        </div>
        <div className="flex items-end gap-3">
          <ProjectPicker value={projectId} onChange={setProjectId} label="Projet à exporter" className="w-64" />
          {projectId ? (
            <button
              onClick={handleRealXlsxExport}
              disabled={exporting}
              className={clsx(
                "flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl transition-all",
                exporting ? "bg-slate-300 text-slate-500 cursor-wait"
                : exported ? "bg-emerald-500 text-white"
                : "bg-emerald-600 text-white shadow-emerald-600/20 hover:-translate-y-0.5"
              )}
              title="Télécharge l'Excel réel de la cotation du projet sélectionné"
            >
              {exporting ? <><Settings2 size={16} className="animate-spin" /> Génération...</>
              : exported ? <><Check size={16} /> Téléchargé !</>
              : <><Wifi size={16} /> Exporter .xlsx réel</>}
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={exporting || config.models.length === 0}
              className={clsx(
                "flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl transition-all",
                exporting ? "bg-slate-300 text-slate-500 cursor-wait"
                : exported ? "bg-emerald-500 text-white"
                : "bg-rihla text-white shadow-rihla/20 hover:-translate-y-0.5"
              )}
              title="Démo : export CSV de la grille tarifaire (sélectionne un projet pour export .xlsx réel)"
            >
              {exporting ? <><Settings2 size={16} className="animate-spin" /> Génération...</>
              : exported ? <><Check size={16} /> Téléchargé !</>
              : <><Download size={16} /> Exporter CSV (démo)</>}
            </button>
          )}
        </div>
      </div>
      {exportError && (
        <div className="max-w-7xl mx-auto mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">
          <AlertCircle size={14} /> {exportError}
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: CONFIGURATION ──────────────────────────────────── */}
        <div className="col-span-3 space-y-6">

          {/* Models selection */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Layers size={14} /> Modèles à inclure
            </h3>
            <div className="space-y-2">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                    config.models.includes(m.id)
                      ? "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                      : "opacity-50 hover:opacity-80"
                  )}
                >
                  <div className={clsx("w-3 h-3 rounded-full", m.color)} />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-[10px] text-slate-400">{m.description}</div>
                  </div>
                  {config.models.includes(m.id) && <Check size={14} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* PAX Ranges */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ArrowUpDown size={14} /> Tranches PAX
            </h3>
            <div className="flex flex-wrap gap-2">
              {PAX_OPTIONS.map(pax => (
                <button
                  key={pax}
                  onClick={() => togglePax(pax)}
                  className={clsx(
                    "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                    config.paxRanges.includes(pax)
                      ? "bg-rihla text-white"
                      : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {pax} pax
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Settings2 size={14} /> Options d'export
            </h3>
            <div className="space-y-3">
              {[
                { key: 'includeBreakdown', label: 'Décomposition par catégorie' },
                { key: 'includeComparison', label: 'Comparaison variantes' },
                { key: 'includeCharts', label: 'Graphiques intégrés' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(config as unknown as Record<string, boolean>)[opt.key]}
                    onChange={() => setConfig(prev => ({ ...prev, [opt.key]: !(prev as unknown as Record<string, boolean>)[opt.key] }))}
                    className="w-4 h-4 rounded border-slate-300 text-rihla focus:ring-rihla"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{opt.label}</span>
                </label>
              ))}

              <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Devise</label>
                <select
                  value={config.currency}
                  onChange={e => setConfig(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="MAD">MAD (د.م)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: PREVIEW ──────────────────────────────────────── */}
        <div className="col-span-9 space-y-6">

          {/* Preview tabs */}
          <div className="flex gap-2">
            {[
              { key: 'grid', label: 'Grille Tarifaire', icon: Table2 },
              { key: 'breakdown', label: 'Décomposition', icon: BarChart3 },
              { key: 'comparison', label: 'Comparaison', icon: Layers },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setPreviewMode(tab.key as typeof previewMode)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all",
                  previewMode === tab.key
                    ? "bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {/* Grid preview */}
          {previewMode === 'grid' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Eye size={16} className="text-rihla" /> Aperçu — Grille par PAX (€/personne)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase">PAX</th>
                      {config.models.map(mId => {
                        const m = MODELS.find(mod => mod.id === mId)
                        return m ? (
                          <th key={mId} className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase">
                            <div className="flex items-center justify-end gap-2">
                              <div className={clsx("w-2 h-2 rounded-full", m.color)} />
                              {m.name}
                            </div>
                          </th>
                        ) : null
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {GRID_DATA
                      .filter(r => config.paxRanges.includes(r.pax))
                      .map((row, i) => (
                        <tr key={row.pax} className={clsx(i % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-slate-50/50 dark:bg-white/[0.02]")}>
                          <td className="px-6 py-4 font-black text-slate-900 dark:text-cream">{row.pax} pax</td>
                          {config.models.map(mId => (
                            <td key={mId} className="px-6 py-4 text-right font-mono font-bold">
                              {fmt((row as Record<string, number>)[mId] || 0)} €
                            </td>
                          ))}
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Breakdown preview */}
          {previewMode === 'breakdown' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 size={16} className="text-rihla" /> Décomposition par Catégorie (MAD)
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {CATEGORIES.map(cat => {
                  const max = Math.max(cat.model1, cat.model2, cat.model3, cat.model4)
                  return (
                    <div key={cat.category}>
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">{cat.category}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {MODELS.filter(m => config.models.includes(m.id)).map((m, i) => {
                          const val = (cat as unknown as Record<string, number>)[`model${i + 1}`] || 0
                          return (
                            <div key={m.id} className="relative">
                              <div className="h-8 bg-slate-100 dark:bg-white/5 rounded-lg overflow-hidden">
                                <div
                                  className={clsx("h-full rounded-lg opacity-80", m.color)}
                                  style={{ width: `${(val / max) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-slate-500 mt-1 block">{fmt(val)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Comparison preview */}
          {previewMode === 'comparison' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-rihla" /> Comparaison Variantes (20 pax)
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {MODELS.filter(m => config.models.includes(m.id)).map(m => {
                    const row = GRID_DATA.find(r => r.pax === 20)
                    const price = row ? (row as Record<string, number>)[m.id] || 0 : 0
                    return (
                      <div key={m.id} className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 text-center relative overflow-hidden">
                        <div className={clsx("absolute top-0 left-0 right-0 h-1", m.color)} />
                        <div className={clsx("w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-white", m.color)}>
                          <Sparkles size={16} />
                        </div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">{m.name}</h4>
                        <p className="text-[10px] text-slate-400 mb-4">{m.description}</p>
                        <div className="text-2xl font-black text-slate-900 dark:text-cream">{fmt(price)} €</div>
                        <div className="text-[10px] text-slate-400 mt-1">par personne</div>
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                          <div className="text-xs text-slate-500">Marge: <span className="font-bold text-rihla">{m.margin}%</span></div>
                          <div className="text-xs text-slate-500">Total groupe: <span className="font-bold">{fmt(price * 20)} €</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400">
              <strong>Format d'export :</strong> Le fichier sera généré au format CSV (compatible Excel/Google Sheets) avec les onglets sélectionnés.
              Les colonnes sont séparées par des points-virgules pour une compatibilité optimale avec Excel en français.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
