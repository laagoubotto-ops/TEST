import { useEffect, useState } from 'react'
import {
  MessageCircle, ChevronRight, Send, Phone,
  Users, MapPin, AlertTriangle, CheckCircle2,
  Clock, Image, Paperclip, FileText, Search,
  Bell, Settings, ExternalLink, Zap, Shield,
  ArrowUpRight, X,
  Wifi, WifiOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { whatsappApi, type WaConversation as ApiConversation, type WaMessage as ApiMessage } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────
interface Conversation {
  id: string
  contactName: string
  contactPhone: string
  role: 'guide' | 'client' | 'driver' | 'supplier' | 'agent'
  lastMessage: string
  lastTime: string
  unread: number
  projectRef: string
  avatar: string
  isOnline: boolean
}

interface Message {
  id: string
  conversationId: string
  text: string
  time: string
  isOutgoing: boolean
  status: 'sent' | 'delivered' | 'read'
  type: 'text' | 'proposal' | 'location' | 'alert' | 'image'
}

interface QuickTemplate {
  id: string
  label: string
  text: string
  category: 'proposal' | 'confirmation' | 'alert' | 'info'
}

// ── Mock Data ──────────────────────────────────────────────────────
const CONVERSATIONS: Conversation[] = [
  { id: 'c1', contactName: 'Marie Lefebvre', contactPhone: '+33 6 12 34 56 78', role: 'client', lastMessage: 'Merci pour la proposition, nous en discutons demain matin.', lastTime: '14:30', unread: 0, projectRef: 'ST-2026-0489', avatar: 'ML', isOnline: true },
  { id: 'c2', contactName: 'Hassan El Moudir', contactPhone: '+212 6 61 23 45 67', role: 'guide', lastMessage: 'Le groupe est arrivé à Fès. Tout va bien. 👍', lastTime: '13:45', unread: 2, projectRef: 'ST-2026-0445', avatar: 'HE', isOnline: true },
  { id: 'c3', contactName: 'Khalid Bennani', contactPhone: '+212 6 62 34 56 78', role: 'driver', lastMessage: 'Bus prêt pour demain 7h30 à l\'hôtel.', lastTime: '12:15', unread: 0, projectRef: 'ST-2026-0445', avatar: 'KB', isOnline: false },
  { id: 'c4', contactName: 'Riad Fes (Réception)', contactPhone: '+212 5 35 94 76 10', role: 'supplier', lastMessage: 'Confirmation 12 chambres check-in 10 juin. Cordialement.', lastTime: '11:00', unread: 1, projectRef: 'ST-2026-0489', avatar: 'RF', isOnline: false },
  { id: 'c5', contactName: 'Sarah Miller (US Adv.)', contactPhone: '+1 555 987 6543', role: 'agent', lastMessage: 'Can you send me the updated proposal with the 5* option?', lastTime: 'Hier', unread: 0, projectRef: 'ST-2026-0512', avatar: 'SM', isOnline: false },
]

const MESSAGES: Record<string, Message[]> = {
  c2: [
    { id: 'm1', conversationId: 'c2', text: 'Bonjour Hassan, le groupe Henderson arrive à Fès vers 14h. 12 personnes.', time: '09:00', isOutgoing: true, status: 'read', type: 'text' },
    { id: 'm2', conversationId: 'c2', text: 'Bien reçu ! Je serai à l\'entrée de la médina. J\'ai préparé le circuit.', time: '09:15', isOutgoing: false, status: 'read', type: 'text' },
    { id: 'm3', conversationId: 'c2', text: '📍 Point de rencontre : Bab Boujloud', time: '09:16', isOutgoing: false, status: 'read', type: 'location' },
    { id: 'm4', conversationId: 'c2', text: 'N\'oublie pas : 2 personnes végétariennes pour le déjeuner chez Dar Roumana.', time: '10:30', isOutgoing: true, status: 'read', type: 'text' },
    { id: 'm5', conversationId: 'c2', text: 'Noté ! Je préviens le restaurant.', time: '10:35', isOutgoing: false, status: 'read', type: 'text' },
    { id: 'm6', conversationId: 'c2', text: 'Le groupe est arrivé à Fès. Tout va bien. 👍', time: '13:45', isOutgoing: false, status: 'delivered', type: 'text' },
    { id: 'm7', conversationId: 'c2', text: '⚠️ ALERTE : Un passager a un problème de santé mineur (M. Doe — allergie). Situation sous contrôle, pharmacie à côté.', time: '15:20', isOutgoing: false, status: 'delivered', type: 'alert' },
  ],
}

const TEMPLATES: QuickTemplate[] = [
  { id: 't1', label: 'Envoyer proposition', text: '📋 Bonjour {nom}, voici votre proposition de circuit : {lien}. N\'hésitez pas à me contacter pour toute question.', category: 'proposal' },
  { id: 't2', label: 'Confirmation réservation', text: '✅ Votre réservation est confirmée ! Réf: {ref}. Dates: {dates}. {pax} personnes. À bientôt au Maroc ! 🇲🇦', category: 'confirmation' },
  { id: 't3', label: 'Alerte guide', text: '⚠️ Attention : changement de programme pour demain. {détails}. Merci de confirmer la réception.', category: 'alert' },
  { id: 't4', label: 'Rappel paiement', text: '💳 Rappel : L\'acompte de 30% ({montant} €) est attendu avant le {date}. Lien de paiement : {lien}', category: 'info' },
]

const roleColors: Record<string, string> = {
  guide: 'bg-emerald-500',
  client: 'bg-blue-500',
  driver: 'bg-amber-500',
  supplier: 'bg-purple-500',
  agent: 'bg-pink-500',
}

const roleLabels: Record<string, string> = {
  guide: 'Guide', client: 'Client', driver: 'Chauffeur', supplier: 'Fournisseur', agent: 'Agent',
}

// ── API ↔ UI mappers ───────────────────────────────────────────────
const convoToUi = (c: ApiConversation): Conversation => {
  const lastTime = c.last_time ? new Date(c.last_time) : null
  const timeLabel = lastTime
    ? (Date.now() - lastTime.getTime() > 24 * 3600e3
        ? lastTime.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
        : lastTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
    : ''
  return {
    id: c.id,
    contactName: c.contact_name,
    contactPhone: c.contact_phone,
    role: (c.role as Conversation['role']) ?? 'client',
    lastMessage: c.last_message ?? '',
    lastTime: timeLabel,
    unread: c.unread ?? 0,
    projectRef: c.project_ref ?? '',
    avatar: c.avatar ?? c.contact_name.slice(0, 2).toUpperCase(),
    isOnline: c.is_online,
  }
}
const msgToUi = (m: ApiMessage): Message => ({
  id: m.id,
  conversationId: m.conversation_id,
  text: m.text,
  time: new Date(m.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  isOutgoing: m.is_outgoing,
  status: (m.status as Message['status']) ?? 'sent',
  type: (m.type as Message['type']) ?? 'text',
})

export function WhatsAppHubPage() {
  const qc = useQueryClient()
  const [selectedConvo, setSelectedConvo] = useState<string>('')
  const [newMessage, setNewMessage] = useState('')
  const [mockMessages, setMockMessages] = useState<Record<string, Message[]>>(MESSAGES)
  const [search, setSearch] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)

  // Live conversations
  const { data: liveConvos = [], isError: convoErr } = useQuery({
    queryKey: ['wa-convos'],
    queryFn: () => whatsappApi.conversations().then(r => r.data),
    retry: 0,
  })
  const isLive = !convoErr && liveConvos.length > 0
  const conversations: Conversation[] = isLive ? liveConvos.map(convoToUi) : CONVERSATIONS

  // Auto-select first convo when list arrives
  useEffect(() => {
    if (!selectedConvo && conversations.length > 0) {
      setSelectedConvo(conversations[0].id)
    }
  }, [conversations, selectedConvo])

  // Live messages for selected conversation
  const { data: liveMsgs = [] } = useQuery({
    queryKey: ['wa-msgs', selectedConvo],
    queryFn: () => whatsappApi.messages(selectedConvo).then(r => r.data),
    enabled: !!selectedConvo && isLive,
    retry: 0,
  })

  const sendMut = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      whatsappApi.send(id, text).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-msgs', selectedConvo] })
      qc.invalidateQueries({ queryKey: ['wa-convos'] })
    },
  })

  const currentMessages: Message[] = isLive
    ? liveMsgs.map(msgToUi)
    : (mockMessages[selectedConvo] || [])
  const currentConvo = conversations.find(c => c.id === selectedConvo)

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConvo) return
    if (isLive) {
      sendMut.mutate({ id: selectedConvo, text: newMessage })
    } else {
      const msg: Message = {
        id: Date.now().toString(),
        conversationId: selectedConvo,
        text: newMessage,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isOutgoing: true,
        status: 'sent',
        type: 'text',
      }
      setMockMessages(prev => ({
        ...prev,
        [selectedConvo]: [...(prev[selectedConvo] || []), msg],
      }))
    }
    setNewMessage('')
  }

  const useTemplate = (template: QuickTemplate) => {
    setNewMessage(template.text)
    setShowTemplates(false)
  }

  const filteredConvos = conversations.filter(c =>
    c.contactName.toLowerCase().includes(search.toLowerCase()) ||
    c.projectRef.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Communication <ChevronRight size={10} /> WhatsApp Business
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-3">
              <MessageCircle className="text-emerald-500" size={28} />
              WhatsApp Business Hub
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold",
              isLive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                     : "bg-slate-100 dark:bg-white/10 text-slate-500",
            )}>
              {isLive ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isLive ? 'Live' : 'Démo (mock)'}
            </div>
            <button className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 transition-all">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex h-[calc(100vh-120px)]">

        {/* ── LEFT: CONVERSATION LIST ──────────────────────────── */}
        <div className="w-80 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col">
          <div className="p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConvos.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedConvo(c.id)}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
                  selectedConvo === c.id ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-slate-50 dark:hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black", roleColors[c.role])}>
                    {c.avatar}
                  </div>
                  {c.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.contactName}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{c.lastTime}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{c.lastMessage}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={clsx("px-1.5 py-0.5 rounded text-[8px] font-bold uppercase", roleColors[c.role], "bg-opacity-20 text-white")} style={{ backgroundColor: 'transparent', color: 'inherit' }}>
                      <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1", roleColors[c.role])} />
                      {roleLabels[c.role]}
                    </span>
                    <span className="text-[9px] text-slate-400">{c.projectRef}</span>
                  </div>
                </div>
                {c.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">{c.unread}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: CHAT ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">

          {/* Chat header */}
          {currentConvo && (
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-6 py-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-black", roleColors[currentConvo.role])}>
                  {currentConvo.avatar}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{currentConvo.contactName}</div>
                  <div className="text-[10px] text-slate-400">{currentConvo.contactPhone} · {currentConvo.projectRef}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 transition-all">
                  <Phone size={14} />
                </button>
                <button className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 transition-all">
                  <Users size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {currentMessages.map(msg => (
              <div key={msg.id} className={clsx("flex", msg.isOutgoing ? "justify-end" : "justify-start")}>
                <div className={clsx(
                  "max-w-md rounded-2xl px-4 py-3 text-sm",
                  msg.isOutgoing
                    ? "bg-emerald-500 text-white rounded-br-md"
                    : msg.type === 'alert'
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-md shadow-sm"
                )}>
                  {msg.type === 'alert' && <AlertTriangle size={14} className="inline mr-1" />}
                  {msg.text}
                  <div className={clsx("text-[10px] mt-1 text-right", msg.isOutgoing ? "text-white/60" : "text-slate-400")}>
                    {msg.time}
                    {msg.isOutgoing && (
                      <span className="ml-1">
                        {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Templates panel */}
          {showTemplates && (
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-slate-400 uppercase">Réponses Rapides</span>
                <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => useTemplate(t)}
                    className="text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                  >
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t.label}</div>
                    <div className="text-[10px] text-slate-400 truncate">{t.text.slice(0, 60)}...</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 transition-all"
                title="Réponses rapides"
              >
                <Zap size={16} />
              </button>
              <button className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 transition-all">
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Tapez votre message..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className={clsx(
                  "p-3 rounded-xl transition-all",
                  newMessage.trim() ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600" : "bg-slate-100 dark:bg-white/5 text-slate-400"
                )}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
