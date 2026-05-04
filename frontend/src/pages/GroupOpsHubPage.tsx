import { useState, useMemo } from 'react'
import {
  Users, ChevronRight, MapPin, Hotel, Utensils, Compass, Phone,
  MessageCircle, AlertTriangle, CheckCircle2, Clock, Star,
  Send, ShieldAlert, Navigation, Eye, UserCheck, Zap,
  RefreshCw, Calendar, FileText, ArrowRight, Activity,
  ThumbsUp, ThumbsDown, AlertCircle, Headphones, Shield,
  Wifi, WifiOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fieldOpsApi } from '@/lib/api'

// ── Types ──────────────────────────────────────────────────────────
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated'
type TaskStatus = 'pending' | 'confirmed' | 'issue' | 'completed'
type ActorRole = 'guide' | 'travel_designer' | 'client' | 'hotel' | 'restaurant'

interface GroupMember {
  id: string
  name: string
  role: ActorRole
  phone: string
  avatar: string
  status: 'online' | 'offline' | 'busy'
  location?: string
}

interface DayPlan {
  day: number
  date: string
  city: string
  hotel: { name: string; stars: number; status: TaskStatus; contact: string; phone: string; confirmationRef?: string }
  restaurant: { name: string; type: string; status: TaskStatus; contact: string; phone: string; pax: number; menuType: string }
  guide: { name: string; status: TaskStatus; phone: string; specialty: string }
  activities: { name: string; time: string; status: TaskStatus }[]
  clientSatisfaction?: 'happy' | 'neutral' | 'unhappy'
  notes: string[]
}

interface Incident {
  id: string
  day: number
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  reportedBy: string
  reportedAt: string
  assignedTo: string
  resolution?: string
  category: 'hotel' | 'restaurant' | 'transport' | 'guide' | 'client' | 'other'
}

interface Message {
  id: string
  from: string
  role: ActorRole
  text: string
  time: string
  day?: number
  isAlert?: boolean
}

// ── Mock Data ──────────────────────────────────────────────────────
const PROJECT = {
  id: 'PRJ-2024-087',
  name: 'Grand Tour Maroc 11J',
  client: 'Prestige Tours Paris',
  groupLeader: 'Jean-Pierre Moreau',
  pax: 18,
  startDate: '2024-11-15',
  endDate: '2024-11-25',
  status: 'active' as const,
}

const TEAM: GroupMember[] = [
  { id: 'td1', name: 'Sarah Benali', role: 'travel_designer', phone: '+212 661 00 11 22', avatar: 'SB', status: 'online', location: 'Bureau Casablanca' },
  { id: 'g1', name: 'Ahmed El Mansouri', role: 'guide', phone: '+212 661 22 33 44', avatar: 'AE', status: 'online', location: 'Avec le groupe - Fès' },
  { id: 'c1', name: 'Jean-Pierre Moreau', role: 'client', phone: '+33 6 12 34 56 78', avatar: 'JM', status: 'online', location: 'Hôtel Palais Faraj - Fès' },
  { id: 'h1', name: 'Rachid Alaoui', role: 'hotel', phone: '+212 535 67 89 00', avatar: 'RA', status: 'online', location: 'Palais Faraj Fès' },
  { id: 'r1', name: 'Karim Bennani', role: 'restaurant', phone: '+212 535 12 34 56', avatar: 'KB', status: 'busy', location: 'Dar Saada - Fès' },
]

const DAYS: DayPlan[] = [
  {
    day: 1, date: '2024-11-15', city: 'Casablanca',
    hotel: { name: 'Sofitel Casablanca', stars: 5, status: 'completed', contact: 'M. Tazi', phone: '+212 522 42 42 42', confirmationRef: 'SOF-8821' },
    restaurant: { name: 'Rick\'s Café', type: 'Dîner', status: 'completed', contact: 'Mme Kriger', phone: '+212 522 27 42 07', pax: 18, menuType: 'Menu Découverte' },
    guide: { name: 'Ahmed El Mansouri', status: 'completed', phone: '+212 661 22 33 44', specialty: 'Histoire moderne' },
    activities: [{ name: 'Mosquée Hassan II', time: '10:00', status: 'completed' }, { name: 'Corniche Tour', time: '15:00', status: 'completed' }],
    clientSatisfaction: 'happy',
    notes: ['Arrivée groupe OK, transfert aéroport sans retard', 'Client satisfait du welcome drink'],
  },
  {
    day: 2, date: '2024-11-16', city: 'Rabat',
    hotel: { name: 'La Tour Hassan Palace', stars: 5, status: 'completed', contact: 'M. Fassi', phone: '+212 537 23 90 00', confirmationRef: 'THP-4412' },
    restaurant: { name: 'Dar Rbatia', type: 'Déjeuner', status: 'completed', contact: 'Chef Mourad', phone: '+212 537 70 23 45', pax: 18, menuType: 'Tajine Royal' },
    guide: { name: 'Ahmed El Mansouri', status: 'completed', phone: '+212 661 22 33 44', specialty: 'Architecture impériale' },
    activities: [{ name: 'Tour Hassan & Mausolée', time: '09:30', status: 'completed' }, { name: 'Kasbah des Oudayas', time: '14:00', status: 'completed' }],
    clientSatisfaction: 'happy',
    notes: ['Guide excellent selon les retours clients', 'Photo de groupe réussie au Mausolée'],
  },
  {
    day: 3, date: '2024-11-17', city: 'Chefchaouen',
    hotel: { name: 'Lina Ryad & Spa', stars: 4, status: 'completed', contact: 'Mme Chraibi', phone: '+212 539 98 71 20', confirmationRef: 'LRS-7789' },
    restaurant: { name: 'Aladdin', type: 'Déjeuner', status: 'completed', contact: 'M. Riffi', phone: '+212 539 98 68 06', pax: 18, menuType: 'Menu Rif' },
    guide: { name: 'Ahmed El Mansouri', status: 'completed', phone: '+212 661 22 33 44', specialty: 'Photographie & Médinas' },
    activities: [{ name: 'Médina bleue', time: '10:00', status: 'completed' }, { name: 'Cascade d\'Akchour', time: '14:30', status: 'completed' }],
    clientSatisfaction: 'happy',
    notes: ['Clients enchantés par la médina bleue', 'Demande de temps libre supplémentaire accordée'],
  },
  {
    day: 4, date: '2024-11-18', city: 'Fès',
    hotel: { name: 'Palais Faraj', stars: 5, status: 'confirmed', contact: 'M. Alaoui', phone: '+212 535 67 89 00', confirmationRef: 'PFR-3345' },
    restaurant: { name: 'Dar Saada', type: 'Déjeuner', status: 'issue', contact: 'M. Bennani', phone: '+212 535 12 34 56', pax: 18, menuType: 'Pastilla & Méchoui' },
    guide: { name: 'Ahmed El Mansouri', status: 'confirmed', phone: '+212 661 22 33 44', specialty: 'Culture & Médina' },
    activities: [{ name: 'Médina de Fès', time: '09:00', status: 'confirmed' }, { name: 'Tanneries Chouara', time: '11:30', status: 'confirmed' }, { name: 'Fondouk Nejjarine', time: '15:00', status: 'pending' }],
    clientSatisfaction: 'neutral',
    notes: ['Restaurant Dar Saada a un problème de capacité pour 18 PAX', 'Guide recommande alternative: Dar Tajine El Fasi'],
  },
  {
    day: 5, date: '2024-11-19', city: 'Fès → Midelt',
    hotel: { name: 'Kasbah Asmaa', stars: 3, status: 'confirmed', contact: 'M. Hamidi', phone: '+212 535 58 04 04' },
    restaurant: { name: 'Complexe Taddert', type: 'Déjeuner', status: 'confirmed', contact: 'M. Ouahbi', phone: '+212 535 56 00 12', pax: 18, menuType: 'Truite du Moyen Atlas' },
    guide: { name: 'Ahmed El Mansouri', status: 'confirmed', phone: '+212 661 22 33 44', specialty: 'Atlas & Nature' },
    activities: [{ name: 'Cèdres d\'Ifrane', time: '10:30', status: 'confirmed' }, { name: 'Sources Oum Er-Rbia', time: '14:00', status: 'pending' }],
    notes: [],
  },
  {
    day: 6, date: '2024-11-20', city: 'Merzouga',
    hotel: { name: 'Bivouac Luxury Sahara', stars: 4, status: 'confirmed', contact: 'M. Sahraoui', phone: '+212 661 88 99 00' },
    restaurant: { name: 'Bivouac (inclus)', type: 'Dîner', status: 'confirmed', contact: 'M. Sahraoui', phone: '+212 661 88 99 00', pax: 18, menuType: 'Méchoui Nomade' },
    guide: { name: 'Ahmed El Mansouri', status: 'confirmed', phone: '+212 661 22 33 44', specialty: 'Désert & Astronomie' },
    activities: [{ name: 'Dromadaires Erg Chebbi', time: '16:00', status: 'confirmed' }, { name: 'Coucher de soleil dunes', time: '18:00', status: 'confirmed' }],
    notes: ['Vérifier météo désert', 'Prévoir couvertures supplémentaires si froid'],
  },
]

const INCIDENTS: Incident[] = [
  {
    id: 'INC-001', day: 4, severity: 'medium', status: 'open',
    title: 'Restaurant Dar Saada — capacité insuffisante',
    description: 'Le restaurant confirme ne pouvoir accueillir que 12 personnes au lieu de 18. Le guide recommande de splitter en 2 services ou de passer chez Dar Tajine El Fasi qui a la capacité.',
    reportedBy: 'Ahmed El Mansouri (Guide)', reportedAt: '17 Nov 10:45',
    assignedTo: 'Sarah Benali (Travel Designer)', category: 'restaurant',
  },
  {
    id: 'INC-002', day: 3, severity: 'low', status: 'resolved',
    title: 'Client demande régime sans gluten non prévu',
    description: 'Mme Dupont (passagère #7) signale une intolérance au gluten non déclarée lors de la réservation. Le guide a informé le restaurant.',
    reportedBy: 'Jean-Pierre Moreau (Client)', reportedAt: '16 Nov 19:30',
    assignedTo: 'Ahmed El Mansouri (Guide)',
    resolution: 'Restaurant Aladdin a adapté le menu. Guide a confirmé auprès de la cliente.',
    category: 'client',
  },
]

const MESSAGES: Message[] = [
  { id: 'm1', from: 'Ahmed El Mansouri', role: 'guide', text: 'Bonjour Sarah, le groupe est arrivé au riad. Tout va bien, J4 commence !', time: '08:15', day: 4 },
  { id: 'm2', from: 'Sarah Benali', role: 'travel_designer', text: 'Parfait Ahmed ! N\'oublie pas la visite tanneries à 11h30. Le client a demandé plus de temps libre dans la médina cet après-midi.', time: '08:22', day: 4 },
  { id: 'm3', from: 'Ahmed El Mansouri', role: 'guide', text: 'Problème : Dar Saada dit qu\'ils ne peuvent prendre que 12 PAX au lieu de 18 pour le déjeuner. Je suggère Dar Tajine El Fasi comme alternative, ils ont la capacité.', time: '10:45', day: 4, isAlert: true },
  { id: 'm4', from: 'Sarah Benali', role: 'travel_designer', text: 'J\'appelle Dar Tajine El Fasi maintenant. Tu peux confirmer que le menu Pastilla est ok pour le groupe ? On a 2 végétariens et 1 sans gluten.', time: '10:52', day: 4 },
  { id: 'm5', from: 'Karim Bennani', role: 'restaurant', text: 'Mme Benali, nous pouvons accueillir 18 personnes. Menu Pastilla avec options végétariennes et sans gluten. Arrivée prévue à quelle heure ?', time: '11:05', day: 4 },
  { id: 'm6', from: 'Sarah Benali', role: 'travel_designer', text: 'Arrivée vers 13h00. Merci Karim ! Ahmed, on bascule sur Dar Tajine El Fasi pour le déjeuner. J\'ai confirmé les régimes spéciaux.', time: '11:08', day: 4 },
  { id: 'm7', from: 'Jean-Pierre Moreau', role: 'client', text: 'Merci pour la réactivité ! La médina est magnifique. Possible d\'avoir un guide supplémentaire pour un sous-groupe qui veut visiter les ateliers d\'artisanat ?', time: '11:30', day: 4 },
  { id: 'm8', from: 'Sarah Benali', role: 'travel_designer', text: 'Bien sûr Jean-Pierre ! Je contacte notre guide local spécialisé artisanat. Il peut rejoindre votre sous-groupe à 15h au Fondouk Nejjarine.', time: '11:35', day: 4 },
]

const ROLE_COLORS: Record<ActorRole, { bg: string; text: string; border: string; dot: string }> = {
  guide: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500' },
  travel_designer: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-500/20', dot: 'bg-blue-500' },
  client: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20', dot: 'bg-purple-500' },
  hotel: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-500' },
  restaurant: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/20', dot: 'bg-orange-500' },
}

const ROLE_LABELS: Record<ActorRole, string> = {
  guide: 'Guide',
  travel_designer: 'Travel Designer',
  client: 'Responsable Groupe',
  hotel: 'Hôtel',
  restaurant: 'Restaurant',
}

const SEVERITY_COLORS: Record<IncidentSeverity, { bg: string; text: string }> = {
  low: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
  high: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
  critical: { bg: 'bg-red-200 dark:bg-red-500/30', text: 'text-red-900 dark:text-red-300' },
}

// ── Component ──────────────────────────────────────────────────────
export function GroupOpsHubPage() {
  const [activeDay, setActiveDay] = useState(4)
  const [view, setView] = useState<'timeline' | 'incidents' | 'chat'>('timeline')
  const [newMessage, setNewMessage] = useState('')
  const [messages, setMessages] = useState(MESSAGES)
  const [incidents, setIncidents] = useState(INCIDENTS)
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null)
  const [showQuickAction, setShowQuickAction] = useState(false)

  // Live tasks from backend (current user's field tasks)
  const { data: liveTasks, isFetching: tasksFetching, refetch: refetchTasks } = useQuery({
    queryKey: ['field-tasks-me'],
    queryFn: () => fieldOpsApi.getTasks().then(r => r.data as any[]),
    retry: false,
    staleTime: 30_000,
  })

  const incidentMut = useMutation({
    mutationFn: (payload: { message: string; severity: 'low' | 'medium' | 'high' | 'critical' }) =>
      fieldOpsApi.reportIncident(payload.message, payload.severity).then(r => r.data),
  })

  const [incidentMsg, setIncidentMsg] = useState('')
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const reportIncidentLive = () => {
    if (!incidentMsg.trim()) return
    incidentMut.mutate({ message: incidentMsg, severity: incidentSeverity }, {
      onSuccess: () => { setIncidentMsg(''); refetchTasks() },
    })
  }

  const currentDay = DAYS.find(d => d.day === activeDay)
  const dayMessages = messages.filter(m => m.day === activeDay)
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'escalated')

  const completedDays = DAYS.filter(d =>
    d.hotel.status === 'completed' && d.restaurant.status === 'completed' && d.guide.status === 'completed'
  ).length
  const progressPct = Math.round((completedDays / DAYS.length) * 100)

  const satisfaction = useMemo(() => {
    const rated = DAYS.filter(d => d.clientSatisfaction)
    const happy = rated.filter(d => d.clientSatisfaction === 'happy').length
    return rated.length > 0 ? Math.round((happy / rated.length) * 100) : 0
  }, [])

  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    setMessages(prev => [...prev, {
      id: `m${Date.now()}`,
      from: 'Sarah Benali',
      role: 'travel_designer' as ActorRole,
      text: newMessage,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      day: activeDay,
    }])
    setNewMessage('')
  }

  const handleResolveIncident = (incidentId: string, resolution: string) => {
    setIncidents(prev => prev.map(i =>
      i.id === incidentId ? { ...i, status: 'resolved' as IncidentStatus, resolution } : i
    ))
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Opérations <ChevronRight size={10} /> Gestion de Groupe
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Users className="text-rihla" size={36} />
            Centre de Coordination Groupe
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic flex items-center gap-2">
            {PROJECT.name} · {PROJECT.client} · {PROJECT.pax} PAX
            {liveTasks && liveTasks.length > 0
              ? <span className="inline-flex items-center gap-1 text-emerald-500 font-bold ml-2"><Wifi size={12} /> {liveTasks.length} tâches live</span>
              : <span className="inline-flex items-center gap-1 text-slate-400 font-bold ml-2"><WifiOff size={12} /> Tâches mock</span>}
            {tasksFetching && <span className="text-xs text-slate-400">· chargement…</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {openIncidents.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl animate-pulse">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-xs font-bold text-red-600 dark:text-red-400">{openIncidents.length} incident(s) ouvert(s)</span>
            </div>
          )}
          <button
            onClick={() => setShowQuickAction(!showQuickAction)}
            className="flex items-center gap-2 px-6 py-3 bg-rihla text-white rounded-2xl text-sm font-black shadow-xl shadow-rihla/20 hover:-translate-y-0.5 transition-all"
          >
            <Zap size={16} /> Action Rapide
          </button>
        </div>
      </div>

      {/* ── LIVE API: my field tasks + incident reporter ───────────── */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-12 gap-4">
        <div className="col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-2">
              <Wifi size={12} /> Mes tâches terrain (API)
            </div>
            <button onClick={() => refetchTasks()} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RefreshCw size={11} /> Rafraîchir
            </button>
          </div>
          {liveTasks && liveTasks.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {liveTasks.slice(0, 8).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-white/5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-mono text-[10px] text-slate-400">{t.task_type || '—'}</span>
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    t.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                    : t.status === 'in_progress' ? 'bg-sky-100 text-sky-700'
                    : 'bg-slate-100 text-slate-500'
                  )}>{t.status || 'pending'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">
              Aucune tâche terrain assignée à ton compte. {tasksFetching ? 'Chargement…' : 'Les guides et chauffeurs verront ici leurs tâches du jour.'}
            </div>
          )}
        </div>
        <div className="col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 p-4 shadow-sm">
          <div className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ShieldAlert size={12} /> Signaler un incident (API live)
          </div>
          <div className="space-y-2">
            <input
              value={incidentMsg}
              onChange={e => setIncidentMsg(e.target.value)}
              placeholder="Ex. Retard bus 30min à Merzouga"
              className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
            />
            <div className="flex items-center gap-2">
              <select
                value={incidentSeverity}
                onChange={e => setIncidentSeverity(e.target.value as any)}
                className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="critical">Critique</option>
              </select>
              <button
                onClick={reportIncidentLive}
                disabled={!incidentMsg.trim() || incidentMut.isPending}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                  !incidentMsg.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : incidentMut.isPending ? 'bg-amber-300 text-white cursor-wait'
                  : 'bg-amber-600 text-white hover:-translate-y-0.5'
                )}
              >
                {incidentMut.isPending ? 'Envoi…' : 'Signaler'}
              </button>
            </div>
            {incidentMut.isSuccess && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} /> Incident enregistré (ID : {(incidentMut.data as any)?.id})
              </div>
            )}
            {incidentMut.error && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-600">
                <AlertCircle size={12} /> {(incidentMut.error as any)?.response?.data?.detail || (incidentMut.error as any)?.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK ACTION PANEL ─────────────────────────────────────── */}
      {showQuickAction && (
        <div className="max-w-7xl mx-auto mb-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-xl">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Actions du Travel Designer</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Hotel, label: 'Changer Hôtel', desc: 'Modifier la réservation', color: 'text-blue-500' },
              { icon: Utensils, label: 'Changer Restaurant', desc: 'Alternative restauration', color: 'text-orange-500' },
              { icon: Compass, label: 'Affecter Guide', desc: 'Ajouter/remplacer guide', color: 'text-emerald-500' },
              { icon: AlertTriangle, label: 'Signaler Incident', desc: 'Ouvrir un ticket', color: 'text-red-500' },
              { icon: Calendar, label: 'Modifier Planning', desc: 'Ajuster le programme', color: 'text-purple-500' },
              { icon: MessageCircle, label: 'Contacter Client', desc: 'Message au responsable', color: 'text-indigo-500' },
              { icon: Phone, label: 'Appeler Fournisseur', desc: 'Contact direct', color: 'text-amber-500' },
              { icon: FileText, label: 'Générer Voucher', desc: 'Bon de prestation', color: 'text-slate-500' },
            ].map(action => (
              <button
                key={action.label}
                className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-left"
              >
                <action.icon size={20} className={action.color} />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{action.label}</div>
                  <div className="text-[10px] text-slate-400">{action.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI BAR ────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Progression', value: `${progressPct}%`, sub: `${completedDays}/${DAYS.length} jours`, icon: Activity, color: 'text-rihla' },
          { label: 'Satisfaction', value: `${satisfaction}%`, sub: 'Groupe satisfait', icon: ThumbsUp, color: 'text-emerald-500' },
          { label: 'Incidents', value: `${openIncidents.length}`, sub: `${incidents.filter(i => i.status === 'resolved').length} résolus`, icon: ShieldAlert, color: openIncidents.length > 0 ? 'text-red-500' : 'text-emerald-500' },
          { label: 'Équipe Active', value: `${TEAM.filter(t => t.status === 'online').length}`, sub: `${TEAM.length} membres`, icon: UserCheck, color: 'text-blue-500' },
          { label: 'Jour en cours', value: `J${activeDay}`, sub: currentDay?.city || '', icon: MapPin, color: 'text-purple-500' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
              <kpi.icon size={14} className={kpi.color} />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</div>
            <div className="text-[10px] text-slate-400 font-medium">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">

        {/* ── LEFT: DAY TIMELINE ──────────────────────────────────── */}
        <div className="col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar size={12} /> Planning
            </h3>
            <div className="space-y-1">
              {DAYS.map(d => {
                const allDone = d.hotel.status === 'completed' && d.restaurant.status === 'completed' && d.guide.status === 'completed'
                const hasIssue = d.hotel.status === 'issue' || d.restaurant.status === 'issue' || d.guide.status === 'issue'
                return (
                  <button
                    key={d.day}
                    onClick={() => setActiveDay(d.day)}
                    className={clsx(
                      "w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all text-xs",
                      activeDay === d.day
                        ? "bg-rihla/10 dark:bg-rihla/20 border border-rihla/30"
                        : "hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    <div className={clsx(
                      "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black",
                      allDone ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" :
                      hasIssue ? "bg-red-100 dark:bg-red-500/20 text-red-600" :
                      "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                    )}>
                      {d.day}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{d.city}</div>
                    </div>
                    {hasIssue && <AlertCircle size={10} className="text-red-500 flex-shrink-0" />}
                    {allDone && <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-4 shadow-sm mt-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users size={12} /> Équipe
            </h3>
            <div className="space-y-2">
              {TEAM.map(m => {
                const rc = ROLE_COLORS[m.role]
                return (
                  <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    <div className="relative">
                      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black", rc.bg, rc.text)}>
                        {m.avatar}
                      </div>
                      <div className={clsx("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900",
                        m.status === 'online' ? 'bg-emerald-500' : m.status === 'busy' ? 'bg-amber-500' : 'bg-slate-300'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{m.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{ROLE_LABELS[m.role]}</div>
                    </div>
                    <button className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
                      <Phone size={10} className="text-slate-400" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CENTER: MAIN CONTENT ───────────────────────────────── */}
        <div className="col-span-7">

          {/* View Tabs */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'timeline' as const, label: 'Jour en Détail', icon: Eye },
              { key: 'incidents' as const, label: `Incidents (${incidents.length})`, icon: ShieldAlert },
              { key: 'chat' as const, label: 'Communication', icon: MessageCircle },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
                  view === tab.key
                    ? "bg-rihla text-white shadow-lg shadow-rihla/20"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-rihla/30"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── VIEW: TIMELINE ──────────────────────────────────── */}
          {view === 'timeline' && currentDay && (
            <div className="space-y-4">

              {/* Day Header */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                      Jour {currentDay.day} — {currentDay.city}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">{currentDay.date}</p>
                  </div>
                  {currentDay.clientSatisfaction && (
                    <div className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold",
                      currentDay.clientSatisfaction === 'happy' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' :
                      currentDay.clientSatisfaction === 'neutral' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' :
                      'bg-red-50 dark:bg-red-500/10 text-red-600'
                    )}>
                      {currentDay.clientSatisfaction === 'happy' ? <ThumbsUp size={14} /> :
                       currentDay.clientSatisfaction === 'neutral' ? <AlertCircle size={14} /> :
                       <ThumbsDown size={14} />}
                      {currentDay.clientSatisfaction === 'happy' ? 'Satisfait' :
                       currentDay.clientSatisfaction === 'neutral' ? 'Neutre' : 'Insatisfait'}
                    </div>
                  )}
                </div>
              </div>

              {/* Hotel Card */}
              <div className={clsx(
                "bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-sm",
                currentDay.hotel.status === 'issue'
                  ? "border-red-200 dark:border-red-500/30"
                  : "border-slate-200 dark:border-white/10"
              )}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Hotel size={22} className="text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{currentDay.hotel.name}</h3>
                      <div className="flex gap-0.5">
                        {Array.from({ length: currentDay.hotel.stars }).map((_, i) => (
                          <Star key={i} size={10} className="text-rihla fill-rihla" />
                        ))}
                      </div>
                      <StatusBadge status={currentDay.hotel.status} />
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><UserCheck size={10} /> {currentDay.hotel.contact}</span>
                      <span className="flex items-center gap-1"><Phone size={10} /> {currentDay.hotel.phone}</span>
                      {currentDay.hotel.confirmationRef && (
                        <span className="flex items-center gap-1"><FileText size={10} /> Réf: {currentDay.hotel.confirmationRef}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 hover:bg-blue-100 transition-all">
                      <Phone size={14} />
                    </button>
                    <button className="p-2 rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-slate-100 transition-all">
                      <MessageCircle size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Restaurant Card */}
              <div className={clsx(
                "bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-sm",
                currentDay.restaurant.status === 'issue'
                  ? "border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5"
                  : "border-slate-200 dark:border-white/10"
              )}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Utensils size={22} className="text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{currentDay.restaurant.name}</h3>
                      <span className="text-[9px] bg-orange-100 dark:bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full font-bold">{currentDay.restaurant.type}</span>
                      <StatusBadge status={currentDay.restaurant.status} />
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><UserCheck size={10} /> {currentDay.restaurant.contact}</span>
                      <span className="flex items-center gap-1"><Phone size={10} /> {currentDay.restaurant.phone}</span>
                      <span className="flex items-center gap-1"><Users size={10} /> {currentDay.restaurant.pax} PAX</span>
                      <span className="flex items-center gap-1"><FileText size={10} /> {currentDay.restaurant.menuType}</span>
                    </div>
                    {currentDay.restaurant.status === 'issue' && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertTriangle size={10} /> Problème de capacité — 12 places au lieu de 18
                        </p>
                        <p className="text-[10px] text-red-500 mt-1">
                          Alternative proposée par le guide : Dar Tajine El Fasi
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 hover:bg-orange-100 transition-all">
                      <Phone size={14} />
                    </button>
                    <button className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 hover:bg-orange-100 transition-all">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Guide Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Compass size={22} className="text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{currentDay.guide.name}</h3>
                      <StatusBadge status={currentDay.guide.status} />
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-1">
                      <span className="flex items-center gap-1"><Phone size={10} /> {currentDay.guide.phone}</span>
                      <span className="flex items-center gap-1"><Star size={10} /> {currentDay.guide.specialty}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 hover:bg-emerald-100 transition-all">
                      <Phone size={14} />
                    </button>
                    <button className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 hover:bg-emerald-100 transition-all">
                      <Navigation size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Activities */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Star size={12} /> Activités du jour
                </h3>
                <div className="space-y-2">
                  {currentDay.activities.map((act, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                      <div className="text-xs font-black text-slate-500 w-12">{act.time}</div>
                      <div className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">{act.name}</div>
                      <StatusBadge status={act.status} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Notes */}
              {currentDay.notes.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/5 rounded-3xl border border-amber-200 dark:border-amber-500/20 p-5">
                  <h3 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={12} /> Notes du jour
                  </h3>
                  <div className="space-y-2">
                    {currentDay.notes.map((note, i) => (
                      <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <ArrowRight size={10} className="mt-0.5 flex-shrink-0" /> {note}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── VIEW: INCIDENTS ─────────────────────────────────── */}
          {view === 'incidents' && (
            <div className="space-y-4">
              {incidents.map(inc => {
                const sev = SEVERITY_COLORS[inc.severity]
                return (
                  <div
                    key={inc.id}
                    className={clsx(
                      "bg-white dark:bg-slate-900 rounded-3xl border p-5 shadow-sm transition-all",
                      inc.status === 'open' ? "border-red-200 dark:border-red-500/30" :
                      inc.status === 'resolved' ? "border-emerald-200 dark:border-emerald-500/30 opacity-70" :
                      "border-slate-200 dark:border-white/10"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
                        inc.status === 'resolved' ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"
                      )}>
                        {inc.status === 'resolved' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <ShieldAlert size={20} className="text-red-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</h3>
                          <span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase", sev.bg, sev.text)}>
                            {inc.severity}
                          </span>
                          <span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-bold",
                            inc.status === 'open' ? "bg-red-100 dark:bg-red-500/20 text-red-600" :
                            inc.status === 'resolved' ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600" :
                            "bg-amber-100 dark:bg-amber-500/20 text-amber-600"
                          )}>
                            {inc.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{inc.description}</p>
                        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                          <span>Jour {inc.day}</span>
                          <span>Signalé par: {inc.reportedBy}</span>
                          <span>À: {inc.reportedAt}</span>
                          <span>Assigné: {inc.assignedTo}</span>
                        </div>
                        {inc.resolution && (
                          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
                            <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Résolution
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{inc.resolution}</p>
                          </div>
                        )}
                        {inc.status === 'open' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleResolveIncident(inc.id, 'Alternative restaurant confirmé. Groupe redirigé vers Dar Tajine El Fasi.')}
                              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-600 transition-all"
                            >
                              <CheckCircle2 size={12} /> Marquer comme résolu
                            </button>
                            <button className="flex items-center gap-1.5 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 border border-red-200 dark:border-red-500/20 rounded-xl text-[10px] font-bold">
                              <ArrowRight size={12} /> Escalader
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── VIEW: CHAT ──────────────────────────────────────── */}
          {view === 'chat' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col" style={{ height: 600 }}>

              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Headphones size={16} className="text-rihla" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Communication Groupe — Jour {activeDay}</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <div className="flex -space-x-2">
                    {TEAM.slice(0, 4).map(m => (
                      <div key={m.id} className={clsx("w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white dark:border-slate-900",
                        ROLE_COLORS[m.role].bg, ROLE_COLORS[m.role].text
                      )}>
                        {m.avatar}
                      </div>
                    ))}
                  </div>
                  <span>{TEAM.length} participants</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {dayMessages.map(msg => {
                  const rc = ROLE_COLORS[msg.role]
                  const isDesigner = msg.role === 'travel_designer'
                  return (
                    <div key={msg.id} className={clsx("flex gap-3", isDesigner && "flex-row-reverse")}>
                      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0", rc.bg, rc.text)}>
                        {msg.from.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div className={clsx("max-w-[70%]", isDesigner && "text-right")}>
                        <div className="flex items-center gap-2 mb-1" style={{ justifyContent: isDesigner ? 'flex-end' : 'flex-start' }}>
                          <span className="text-[10px] font-bold text-slate-900 dark:text-white">{msg.from}</span>
                          <span className={clsx("text-[8px] px-1.5 py-0.5 rounded-full font-bold", rc.bg, rc.text)}>
                            {ROLE_LABELS[msg.role]}
                          </span>
                          <span className="text-[9px] text-slate-400">{msg.time}</span>
                        </div>
                        <div className={clsx(
                          "px-4 py-3 rounded-2xl text-xs",
                          msg.isAlert
                            ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300"
                            : isDesigner
                              ? "bg-rihla/10 dark:bg-rihla/20 text-slate-800 dark:text-slate-200"
                              : "bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300"
                        )}>
                          {msg.isAlert && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mb-1">
                              <AlertTriangle size={10} /> ALERTE
                            </div>
                          )}
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input */}
              <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10">
                <div className="flex gap-3">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Message au groupe (en tant que Travel Designer)..."
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:ring-2 focus:ring-rihla/30 focus:border-rihla outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="px-5 py-3 bg-rihla text-white rounded-xl text-xs font-bold hover:bg-rihla-dark transition-all flex items-center gap-2"
                  >
                    <Send size={14} /> Envoyer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: RELATIONSHIP MAP ────────────────────────────── */}
        <div className="col-span-3 space-y-4">

          {/* Relationship Diagram */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={12} /> Chaîne de Responsabilité
            </h3>
            <div className="space-y-3">
              {/* Travel Designer → Guide */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Compass size={14} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-900 dark:text-white">Travel Designer</div>
                  <div className="text-[9px] text-slate-400">Pilote & décisions</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 ml-3.5" />
                <ArrowRight size={10} className="text-rihla" />
                <span className="text-[9px] text-rihla font-bold">Supervise & coordonne</span>
              </div>

              {/* Guide → Client */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  <Users size={14} className="text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-900 dark:text-white">Guide Accompagnateur</div>
                  <div className="text-[9px] text-slate-400">Terrain & relation client</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 ml-3.5" />
                <ArrowRight size={10} className="text-emerald-500" />
                <span className="text-[9px] text-emerald-600 font-bold">Accompagne & remonte</span>
              </div>

              {/* Client (Group Leader) */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <UserCheck size={14} className="text-purple-500" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-slate-900 dark:text-white">Responsable Groupe</div>
                  <div className="text-[9px] text-slate-400">Interlocuteur client</div>
                </div>
              </div>

              <hr className="border-slate-100 dark:border-white/5 my-2" />

              {/* Fournisseurs */}
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Prestataires</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/5">
                  <Hotel size={12} className="text-amber-500" />
                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">Hôtels</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-500/5">
                  <Utensils size={12} className="text-orange-500" />
                  <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400">Restaurants</span>
                </div>
              </div>
            </div>
          </div>

          {/* Escalation Protocol */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Zap size={12} /> Protocole d'Escalade
            </h3>
            <div className="space-y-3">
              {[
                { level: 1, actor: 'Guide', action: 'Résout sur place (délai, menu, chambre)', color: 'bg-emerald-500' },
                { level: 2, actor: 'Travel Designer', action: 'Intervient à distance (changement fournisseur, coordination)', color: 'bg-blue-500' },
                { level: 3, actor: 'Direction', action: 'Décision stratégique (compensation, modification majeure)', color: 'bg-red-500' },
              ].map(step => (
                <div key={step.level} className="flex items-start gap-3">
                  <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0", step.color)}>
                    {step.level}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-900 dark:text-white">{step.actor}</div>
                    <div className="text-[9px] text-slate-400 leading-relaxed">{step.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Rapide */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Phone size={12} /> Contact Rapide J{activeDay}
            </h3>
            {currentDay && (
              <div className="space-y-2">
                {[
                  { label: 'Guide', name: currentDay.guide.name, phone: currentDay.guide.phone, icon: Compass, color: 'text-emerald-500' },
                  { label: 'Hôtel', name: currentDay.hotel.name, phone: currentDay.hotel.phone, icon: Hotel, color: 'text-blue-500' },
                  { label: 'Restaurant', name: currentDay.restaurant.name, phone: currentDay.restaurant.phone, icon: Utensils, color: 'text-orange-500' },
                  { label: 'Client', name: PROJECT.groupLeader, phone: '+33 6 12 34 56 78', icon: UserCheck, color: 'text-purple-500' },
                ].map(c => (
                  <div key={c.label} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                    <c.icon size={14} className={c.color} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-[9px] text-slate-400">{c.label}</div>
                    </div>
                    <a href={`tel:${c.phone}`} className="text-[9px] text-rihla font-bold flex items-center gap-1">
                      <Phone size={10} /> Appeler
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg: Record<TaskStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-slate-100 dark:bg-white/10', text: 'text-slate-500', label: 'En attente' },
    confirmed: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600', label: 'Confirmé' },
    issue: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600', label: 'Problème' },
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600', label: 'Terminé' },
  }
  const c = cfg[status]
  return (
    <span className={clsx("text-[9px] px-2 py-0.5 rounded-full font-bold", c.bg, c.text)}>
      {c.label}
    </span>
  )
}
