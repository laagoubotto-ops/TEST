import { useState, useRef } from 'react'
import {
  MapPin, Calendar, Users, Check, MessageSquare,
  ChevronRight, Star, ShieldCheck, Clock,
  Send, PenTool, CheckCircle2, FileText,
  Download, Eye, ThumbsUp, ThumbsDown, X,
  Navigation, AlertCircle, Sparkles, Copy, Link2
} from 'lucide-react'
import { clsx } from 'clsx'
import { clientPortalApi } from '@/lib/api'
import { ProjectPicker } from '@/components/projects/ProjectPicker'

// ── Types ──────────────────────────────────────────────────────────
interface DayItem {
  id: number
  title: string
  city: string
  description: string
  hotel: string
  meals: string
  activities: string[]
}

interface Comment {
  id: string
  dayId: number
  author: string
  text: string
  timestamp: string
  isClient: boolean
}

type ProposalStatus = 'pending' | 'viewed' | 'commented' | 'approved' | 'signed'

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_DAYS: DayItem[] = [
  { id: 1, title: 'Arrivée à Casablanca', city: 'Casablanca', description: 'Accueil à l\'aéroport Mohammed V, transfert à l\'hôtel. Tour panoramique de la ville.', hotel: 'Le Casablanca Hotel 5*', meals: 'Dîner', activities: ['Transfert aéroport', 'Tour panoramique', 'Mosquée Hassan II'] },
  { id: 2, title: 'Casablanca → Rabat → Chefchaouen', city: 'Chefchaouen', description: 'Route vers Rabat, visite de la Tour Hassan et le Mausolée Mohammed V. Continuation vers la perle bleue.', hotel: 'Lina Ryad & Spa 4*', meals: 'Petit-déjeuner, Déjeuner, Dîner', activities: ['Tour Hassan', 'Mausolée Mohammed V', 'Médina bleue'] },
  { id: 3, title: 'Chefchaouen → Fès', city: 'Fès', description: 'Matinée libre à Chefchaouen. Route vers Fès, la capitale spirituelle.', hotel: 'Riad Fes 5*', meals: 'Petit-déjeuner, Dîner', activities: ['Temps libre Chefchaouen', 'Route panoramique'] },
  { id: 4, title: 'Visite de Fès', city: 'Fès', description: 'Journée complète de visite de la médina, la plus grande zone piétonne du monde.', hotel: 'Riad Fes 5*', meals: 'Petit-déjeuner, Déjeuner, Dîner', activities: ['Médina de Fès', 'Tanneries Chouara', 'Médersa Bou Inania', 'Atelier poterie'] },
  { id: 5, title: 'Fès → Merzouga (Désert)', city: 'Merzouga', description: 'Route à travers le Moyen Atlas, cèdres de l\'Ifrane, gorges du Ziz.', hotel: 'Bivouac de Luxe', meals: 'Petit-déjeuner, Déjeuner, Dîner', activities: ['Col du Tizi n\'Talrhemt', 'Forêt de cèdres', 'Balade en dromadaire', 'Nuit sous les étoiles'] },
]

const MOCK_PRICING = {
  perPerson: 1850,
  currency: 'EUR',
  totalPax: 12,
  total: 22200,
  breakdown: [
    { category: 'Hébergement', amount: 8400, pct: 38 },
    { category: 'Transport', amount: 5500, pct: 25 },
    { category: 'Restauration', amount: 3800, pct: 17 },
    { category: 'Activités & Guides', amount: 2900, pct: 13 },
    { category: 'Frais de gestion', amount: 1600, pct: 7 },
  ]
}

export function ClientPortalInteractivePage() {
  const [activeDay, setActiveDay] = useState(1)
  const [status, setStatus] = useState<ProposalStatus>('viewed')
  const [comments, setComments] = useState<Comment[]>([
    { id: '1', dayId: 2, author: 'Marie Lefebvre', text: 'Peut-on prévoir plus de temps à Chefchaouen ? Mes clients adorent cette ville.', timestamp: '2026-04-25 14:30', isClient: true },
    { id: '2', dayId: 2, author: 'Ahmed (S\'TOURS)', text: 'Bien sûr ! On peut ajouter une demi-journée supplémentaire. Je mets à jour l\'itinéraire.', timestamp: '2026-04-25 15:10', isClient: false },
  ])
  const [newComment, setNewComment] = useState('')
  const [showSignature, setShowSignature] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [signatureText, setSignatureText] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Live shareable link via backend
  const [projectId, setProjectId] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleGenerateLink = async () => {
    if (!projectId) return
    setGeneratingLink(true)
    setLinkError(null)
    setGeneratedLink(null)
    try {
      const res: any = await clientPortalApi.generateLink(projectId, { expires_days: 14 })
      const d = res.data ?? res
      const url = d?.portal_url || d?.url || d?.link || (d?.token ? `${window.location.origin}/portal/${d.token}` : null)
      setGeneratedLink(url || JSON.stringify(d))
    } catch (err: any) {
      setLinkError(err?.response?.data?.detail || err?.message || 'Erreur génération du lien')
    } finally {
      setGeneratingLink(false)
    }
  }

  const copyLink = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch { /* noop */ }
  }

  const addComment = () => {
    if (!newComment.trim()) return
    setComments(prev => [...prev, {
      id: Date.now().toString(),
      dayId: activeDay,
      author: 'Client',
      text: newComment,
      timestamp: new Date().toLocaleString('fr-FR'),
      isClient: true,
    }])
    setNewComment('')
    if (status === 'viewed') setStatus('commented')
  }

  const handleApprove = () => {
    setStatus('approved')
    setShowSignature(true)
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => {
    setIsDrawing(false)
    if (canvasRef.current) {
      setSignature(canvasRef.current.toDataURL())
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignature(null)
  }

  const handleSign = () => {
    setStatus('signed')
    setShowSignature(false)
  }

  const dayComments = comments.filter(c => c.dayId === activeDay)
  const currentDay = MOCK_DAYS.find(d => d.id === activeDay) || MOCK_DAYS[0]

  const statusConfig: Record<ProposalStatus, { label: string; color: string; icon: typeof Check }> = {
    pending:   { label: 'En attente de consultation', color: 'text-slate-400', icon: Clock },
    viewed:    { label: 'Consultée', color: 'text-blue-500', icon: Eye },
    commented: { label: 'Commentaires ajoutés', color: 'text-amber-500', icon: MessageSquare },
    approved:  { label: 'Approuvée', color: 'text-emerald-500', icon: ThumbsUp },
    signed:    { label: 'Signée électroniquement', color: 'text-emerald-600', icon: CheckCircle2 },
  }
  const st = statusConfig[status]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">

      {/* ── HEADER BAR ──────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/60">
            Portail Client Interactif · Proposition B2C
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold", st.color)}>
            <st.icon size={14} />
            {st.label}
          </div>
        </div>
      </div>

      {/* ── DMC SIDE BAR : générer le lien partageable via backend ─────── */}
      <div className="bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-500/30 px-8 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          <Link2 size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            Côté DMC — générer un lien partageable
          </span>
          <div className="flex-1 min-w-[220px]">
            <ProjectPicker value={projectId} onChange={setProjectId} compact label="projet" />
          </div>
          <button
            onClick={handleGenerateLink}
            disabled={!projectId || generatingLink}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              !projectId
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : generatingLink
                  ? "bg-emerald-300 text-white cursor-wait"
                  : "bg-emerald-600 text-white hover:-translate-y-0.5 shadow-lg shadow-emerald-600/20"
            )}
          >
            <Link2 size={12} /> {generatingLink ? 'Génération…' : 'Générer le lien'}
          </button>
          {generatedLink && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/30 rounded-xl max-w-lg">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 text-xs font-mono text-slate-700 dark:text-slate-200 bg-transparent focus:outline-none"
              />
              <button onClick={copyLink} className="text-emerald-600 hover:text-emerald-700 transition-colors">
                {linkCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
          {linkError && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-300">
              <AlertCircle size={12} /> {linkError}
            </div>
          )}
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-rihla text-[10px] font-black uppercase tracking-[0.3em] mb-4">
            <Sparkles size={12} /> Proposition Exclusive
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-3">Grand Tour des Villes Impériales</h1>
          <p className="text-white/50 text-sm mb-6">Réf: ST-2026-0489 · Préparée pour <span className="text-rihla font-bold">Prestige Tours Paris</span></p>
          <div className="flex gap-8">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Calendar size={16} className="text-rihla" /> 5 Jours / 4 Nuits
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Users size={16} className="text-rihla" /> 12 Personnes
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <MapPin size={16} className="text-rihla" /> Maroc
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 grid grid-cols-12 gap-8">

        {/* ── LEFT: ITINERARY + MAP ────────────────────────────────── */}
        <div className="col-span-8 space-y-6">

          {/* Map placeholder */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="h-48 bg-gradient-to-br from-emerald-900/20 to-blue-900/20 flex items-center justify-center relative">
              <Navigation size={32} className="text-rihla/40" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-slate-400 dark:text-white/30 font-bold">Carte Interactive — {MOCK_DAYS.length} étapes</span>
              </div>
              {/* Day markers */}
              <div className="absolute bottom-4 left-4 flex gap-2">
                {MOCK_DAYS.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDay(d.id)}
                    className={clsx(
                      "w-8 h-8 rounded-full text-xs font-black flex items-center justify-center transition-all",
                      activeDay === d.id
                        ? "bg-rihla text-white scale-110 shadow-lg shadow-rihla/30"
                        : "bg-white/80 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:scale-105"
                    )}
                  >
                    J{d.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Day detail */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Jour {currentDay.id} <ChevronRight size={10} /> {currentDay.city}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-cream tracking-tight mb-3">{currentDay.title}</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">{currentDay.description}</p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Hébergement</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{currentDay.hotel}</div>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Repas inclus</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{currentDay.meals}</div>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4">
                <div className="text-[10px] font-black text-slate-400 uppercase mb-2">Activités</div>
                <div className="text-sm font-bold text-rihla">{currentDay.activities.length} prévues</div>
              </div>
            </div>

            {/* Activities list */}
            <div className="space-y-2">
              {currentDay.activities.map((act, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-rihla/5 dark:bg-rihla/10 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-rihla/20 flex items-center justify-center text-rihla text-xs font-black">{i + 1}</div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{act}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-8 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 dark:text-cream uppercase tracking-wider mb-6 flex items-center gap-2">
              <MessageSquare size={16} className="text-rihla" /> Commentaires — Jour {activeDay}
            </h3>

            {dayComments.length === 0 && (
              <p className="text-slate-400 text-sm italic mb-4">Aucun commentaire pour ce jour. Ajoutez vos remarques ci-dessous.</p>
            )}

            <div className="space-y-4 mb-6">
              {dayComments.map(c => (
                <div key={c.id} className={clsx("flex gap-3", c.isClient ? "flex-row-reverse" : "")}>
                  <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                    c.isClient ? "bg-blue-500 text-white" : "bg-rihla text-white"
                  )}>
                    {c.author[0]}
                  </div>
                  <div className={clsx(
                    "max-w-md p-4 rounded-2xl text-sm",
                    c.isClient
                      ? "bg-blue-50 dark:bg-blue-900/20 text-slate-700 dark:text-blue-100"
                      : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300"
                  )}>
                    <div className="font-bold text-xs mb-1">{c.author}</div>
                    {c.text}
                    <div className="text-[10px] text-slate-400 mt-2">{c.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Ajouter un commentaire..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
              />
              <button
                onClick={addComment}
                className="px-4 py-3 bg-rihla text-white rounded-xl hover:bg-rihla/90 transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: PRICING + ACTIONS ──────────────────────────────── */}
        <div className="col-span-4 space-y-6">

          {/* Pricing card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Tarification</h3>
            <div className="text-center mb-6">
              <div className="text-4xl font-black text-slate-900 dark:text-cream">
                {MOCK_PRICING.perPerson.toLocaleString('fr-FR')} <span className="text-lg text-slate-400">{MOCK_PRICING.currency}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">par personne · {MOCK_PRICING.totalPax} pax</div>
              <div className="text-lg font-bold text-rihla mt-2">
                Total: {MOCK_PRICING.total.toLocaleString('fr-FR')} {MOCK_PRICING.currency}
              </div>
            </div>

            <div className="space-y-3">
              {MOCK_PRICING.breakdown.map(item => (
                <div key={item.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600 dark:text-slate-400">{item.category}</span>
                    <span className="font-bold">{item.amount.toLocaleString('fr-FR')} €</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-rihla/60 rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
              <Download size={16} /> Télécharger PDF
            </button>

            {status !== 'signed' && (
              <>
                <button
                  onClick={handleApprove}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                >
                  <ThumbsUp size={16} /> Approuver la Proposition
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-sm font-bold hover:bg-red-100 transition-all">
                  <ThumbsDown size={16} /> Demander des modifications
                </button>
              </>
            )}

            {status === 'signed' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 text-center">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
                <h4 className="font-black text-emerald-700 dark:text-emerald-400 text-sm uppercase">Proposition Signée</h4>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/60 mt-1">Signature enregistrée le {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            )}
          </div>

          {/* Day navigation */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Navigation</h3>
            <div className="space-y-2">
              {MOCK_DAYS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveDay(d.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all",
                    activeDay === d.id
                      ? "bg-rihla/10 text-rihla font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <div className={clsx(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0",
                    activeDay === d.id ? "bg-rihla text-white" : "bg-slate-100 dark:bg-white/10"
                  )}>
                    {d.id}
                  </div>
                  <div className="truncate">{d.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── E-SIGNATURE MODAL ────────────────────────────────────────── */}
      {showSignature && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-cream flex items-center gap-2">
                <PenTool size={20} className="text-rihla" /> Signature Électronique
              </h3>
              <button onClick={() => setShowSignature(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Nom complet</label>
                <input
                  type="text"
                  value={signatureText}
                  onChange={e => setSignatureText(e.target.value)}
                  placeholder="Marie Lefebvre"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Notes (optionnel)</label>
                <textarea
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  placeholder="Remarques sur l'approbation..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Dessinez votre signature</label>
                <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl overflow-hidden relative">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={120}
                    className="w-full cursor-crosshair bg-white dark:bg-slate-800"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                  />
                  {!signature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                      Signez ici...
                    </div>
                  )}
                </div>
                <button onClick={clearSignature} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
                  Effacer
                </button>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                En signant, vous acceptez les termes de la proposition et les conditions générales de S'TOURS DMC.
              </div>

              <button
                onClick={handleSign}
                disabled={!signatureText || !signature}
                className={clsx(
                  "w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
                  signatureText && signature
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                <CheckCircle2 size={16} className="inline mr-2" />
                Signer et Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
