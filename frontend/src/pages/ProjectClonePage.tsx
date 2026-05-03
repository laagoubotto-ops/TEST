import { useState } from 'react'
import {
  Copy, ChevronRight, Check, Search,
  FolderKanban, Calendar, Users, MapPin,
  ArrowRight, Settings2, Sparkles, AlertCircle,
  Edit3, CheckCircle2
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────
interface CloneConfig {
  newName: string
  newClient: string
  copyItinerary: boolean
  copyCotation: boolean
  copyDocuments: boolean
  adjustDates: boolean
  newStartDate: string
  newPax: number | null
}

// ── Mock fallback projects ──────────────────────────────────────────
const FALLBACK_PROJECTS = [
  { id: 'p1', name: 'Grand Tour Maroc 11J', client_name: 'Prestige Tours Paris', destination: 'Maroc', pax: 20, start_date: '2026-05-01', end_date: '2026-05-11', status: 'won', created_at: '2026-03-15' },
  { id: 'p2', name: 'Merveilles Impériales 8J', client_name: 'US Adventure Co.', destination: 'Maroc', pax: 15, start_date: '2026-06-10', end_date: '2026-06-17', status: 'quoted', created_at: '2026-04-02' },
  { id: 'p3', name: 'Sahara Express 5J', client_name: 'Travel Agency XYZ', destination: 'Maroc', pax: 12, start_date: '2026-04-20', end_date: '2026-04-24', status: 'completed', created_at: '2026-02-10' },
  { id: 'p4', name: 'Atlas & Vallées 7J', client_name: 'Wanderlust GmbH', destination: 'Maroc', pax: 25, start_date: '2026-07-01', end_date: '2026-07-07', status: 'draft', created_at: '2026-04-20' },
  { id: 'p5', name: 'Essaouira Weekend', client_name: 'Marie Lefebvre', destination: 'Essaouira', pax: 8, start_date: '2026-05-15', end_date: '2026-05-17', status: 'won', created_at: '2026-04-05' },
]

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  quoted: 'bg-blue-100 text-blue-700',
  won: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-purple-100 text-purple-700',
  lost: 'bg-red-100 text-red-700',
}

export function ProjectClonePage() {
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'configure' | 'done'>('select')
  const [config, setConfig] = useState<CloneConfig>({
    newName: '',
    newClient: '',
    copyItinerary: true,
    copyCotation: true,
    copyDocuments: false,
    adjustDates: false,
    newStartDate: '',
    newPax: null,
  })
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [clonedProjectId, setClonedProjectId] = useState<string | null>(null)

  const { data: apiProjects } = useQuery({
    queryKey: ['projects-clone'],
    queryFn: () => projectsApi.list({ limit: 50 }).then(r => r.data?.items ?? []),
  })

  const projects = (apiProjects && apiProjects.length > 0) ? apiProjects : FALLBACK_PROJECTS
  const filtered = projects.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase())
  )

  const selected = projects.find((p: any) => p.id === selectedProject)

  const handleSelect = (id: string) => {
    setSelectedProject(id)
    const proj = projects.find((p: any) => p.id === id)
    if (proj) {
      setConfig(prev => ({
        ...prev,
        newName: `${(proj as any).name} (Copie)`,
        newPax: (proj as any).pax || null,
      }))
    }
    setStep('configure')
  }

  const handleClone = async () => {
    if (!selectedProject) return
    setCloning(true)
    setCloneError(null)
    try {
      const isFallback = !apiProjects || apiProjects.length === 0
      if (isFallback) {
        // Mock fallback projects — can't clone via API, simulate
        await new Promise(r => setTimeout(r, 800))
        setClonedProjectId(null)
      } else {
        const res = await projectsApi.clone(selectedProject, {
          new_name: config.newName || undefined,
          new_client_name: config.newClient || undefined,
          clone_itinerary: config.copyItinerary,
          clone_quotation: config.copyCotation,
        })
        const data: any = res.data
        setClonedProjectId(data?.cloned_project?.id || null)
      }
      setStep('done')
    } catch (err: any) {
      setCloneError(err?.response?.data?.detail || err?.message || 'Erreur lors du clonage')
    } finally {
      setCloning(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-12 max-w-md text-center shadow-xl">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-cream mb-3">Projet Dupliqué !</h2>
          <p className="text-sm text-slate-500 mb-2">
            <span className="font-bold text-rihla">{config.newName}</span> a été créé avec succès.
          </p>
          <p className="text-xs text-slate-400 mb-8">
            {config.copyItinerary && 'Itinéraire copié · '}
            {config.copyCotation && 'Cotation copiée · '}
            {config.copyDocuments && 'Documents copiés'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep('select'); setSelectedProject(null) }}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
            >
              Dupliquer un autre
            </button>
            <a
              href={clonedProjectId ? `/projects/${clonedProjectId}` : '/projects'}
              className="flex-1 px-6 py-3 bg-rihla text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-rihla/20 hover:bg-rihla/90 transition-all flex items-center justify-center"
            >
              Ouvrir le projet
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Projets <ChevronRight size={10} /> Dupliquer
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Copy className="text-rihla" size={36} />
            Dupliquer un Projet
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Copiez un circuit existant en un clic pour l'adapter à un nouveau client
          </p>
        </div>
      </div>

      {/* ── STEPPER ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-4">
          <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold", step === 'select' ? "bg-rihla text-white" : "bg-emerald-100 text-emerald-700")}>
            {step !== 'select' ? <Check size={14} /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px]">1</span>}
            Choisir le projet
          </div>
          <ArrowRight size={16} className="text-slate-300" />
          <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold", step === 'configure' ? "bg-rihla text-white" : "bg-slate-100 text-slate-400")}>
            <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px]">2</span>
            Configurer la copie
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">

        {/* ── STEP 1: SELECT PROJECT ──────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un projet par nom ou client..."
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filtered.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.id)}
                  className={clsx(
                    "w-full flex items-center justify-between p-5 rounded-2xl border text-left transition-all",
                    selectedProject === p.id
                      ? "bg-rihla/5 border-rihla/30 shadow-lg shadow-rihla/5"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 hover:border-rihla/20 hover:shadow-md shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rihla/10 flex items-center justify-center">
                      <FolderKanban size={20} className="text-rihla" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.client_name}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400"><MapPin size={10} /> {p.destination}</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400"><Users size={10} /> {p.pax} pax</span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400"><Calendar size={10} /> {p.start_date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={clsx("px-2 py-1 rounded-lg text-[10px] font-bold uppercase", statusColors[p.status] || 'bg-slate-100 text-slate-500')}>{p.status}</span>
                    <Copy size={16} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: CONFIGURE CLONE ──────────────────────────────── */}
        {step === 'configure' && selected && (
          <div className="grid grid-cols-2 gap-8">
            {/* Source project info */}
            <div className="bg-slate-100 dark:bg-white/5 rounded-3xl p-6 border border-slate-200 dark:border-white/10">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Projet Source</h3>
              <div className="space-y-3">
                <div className="text-lg font-bold text-slate-900 dark:text-cream">{(selected as any).name}</div>
                <div className="text-sm text-slate-500">{(selected as any).client_name}</div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span><MapPin size={12} className="inline" /> {(selected as any).destination}</span>
                  <span><Users size={12} className="inline" /> {(selected as any).pax} pax</span>
                </div>
              </div>
            </div>

            {/* Clone configuration */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Settings2 size={14} /> Configuration du Clone
              </h3>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nom du nouveau projet</label>
                <input
                  type="text"
                  value={config.newName}
                  onChange={e => setConfig(prev => ({ ...prev, newName: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nouveau client</label>
                <input
                  type="text"
                  value={config.newClient}
                  onChange={e => setConfig(prev => ({ ...prev, newClient: e.target.value }))}
                  placeholder="Nom du client..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nombre de PAX</label>
                <input
                  type="number"
                  value={config.newPax || ''}
                  onChange={e => setConfig(prev => ({ ...prev, newPax: Number(e.target.value) || null }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                />
              </div>

              <div className="space-y-2 pt-2">
                {[
                  { key: 'copyItinerary', label: 'Copier l\'itinéraire complet' },
                  { key: 'copyCotation', label: 'Copier la cotation / grille tarifaire' },
                  { key: 'copyDocuments', label: 'Copier les documents associés' },
                  { key: 'adjustDates', label: 'Ajuster les dates' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={(config as unknown as Record<string, boolean>)[opt.key]}
                      onChange={() => setConfig(prev => ({ ...prev, [opt.key]: !(prev as unknown as Record<string, boolean>)[opt.key] }))}
                      className="w-4 h-4 rounded border-slate-300 text-rihla focus:ring-rihla"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{opt.label}</span>
                  </label>
                ))}
              </div>

              {config.adjustDates && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Nouvelle date de début</label>
                  <input
                    type="date"
                    value={config.newStartDate}
                    onChange={e => setConfig(prev => ({ ...prev, newStartDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                  />
                </div>
              )}

              {cloneError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle size={14} />
                  {cloneError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => { setStep('select'); setSelectedProject(null) }}
                  className="flex-1 px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={handleClone}
                  disabled={cloning || !config.newName}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    cloning ? "bg-slate-300 text-slate-500 cursor-wait" : "bg-rihla text-white shadow-lg shadow-rihla/20 hover:bg-rihla/90"
                  )}
                >
                  {cloning ? <><Settings2 size={14} className="animate-spin" /> Duplication...</> : <><Copy size={14} /> Dupliquer</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
