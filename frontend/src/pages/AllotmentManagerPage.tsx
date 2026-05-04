import { useState } from 'react'
import {
  Hotel, ChevronRight, Lock, Unlock, Calendar,
  CheckCircle2, AlertTriangle, Clock,
  Bell, ChevronDown, ChevronUp, Wifi, WifiOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { allotmentsApi, type AllotmentRow } from '../lib/api'

// ── Types ──────────────────────────────────────────────────────────
interface Allotment {
  id: string
  hotelName: string
  city: string
  category: string
  checkIn: string
  checkOut: string
  roomsBlocked: number
  roomsConfirmed: number
  roomsReleased: number
  deadline: string
  status: 'blocked' | 'confirmed' | 'partial' | 'released' | 'expired'
  contractId: string
  pricePerNight: number
  notes: string
}

// ── Mock Data ──────────────────────────────────────────────────────
const initialAllotments: Allotment[] = [
  { id: 'a1', hotelName: 'Riad Fes', city: 'Fès', category: '5*', checkIn: '2026-06-10', checkOut: '2026-06-13', roomsBlocked: 12, roomsConfirmed: 10, roomsReleased: 0, deadline: '2026-05-25', status: 'confirmed', contractId: 'CTR-2026-001', pricePerNight: 1950, notes: 'Contrat saison haute' },
  { id: 'a2', hotelName: 'Movenpick Mansour Eddahbi', city: 'Marrakech', category: '5*', checkIn: '2026-06-13', checkOut: '2026-06-16', roomsBlocked: 12, roomsConfirmed: 8, roomsReleased: 0, deadline: '2026-05-28', status: 'partial', contractId: 'CTR-2026-002', pricePerNight: 1800, notes: '' },
  { id: 'a3', hotelName: 'Bivouac de Luxe Merzouga', city: 'Merzouga', category: 'Luxe', checkIn: '2026-06-16', checkOut: '2026-06-17', roomsBlocked: 10, roomsConfirmed: 10, roomsReleased: 0, deadline: '2026-06-01', status: 'confirmed', contractId: 'CTR-2026-003', pricePerNight: 2800, notes: 'Tentes privatives' },
  { id: 'a4', hotelName: 'Le Casablanca Hotel', city: 'Casablanca', category: '4*', checkIn: '2026-06-10', checkOut: '2026-06-11', roomsBlocked: 12, roomsConfirmed: 0, roomsReleased: 0, deadline: '2026-05-20', status: 'blocked', contractId: 'CTR-2026-004', pricePerNight: 1400, notes: 'En attente confirmation devis' },
  { id: 'a5', hotelName: 'Lina Ryad & Spa', city: 'Chefchaouen', category: '4*', checkIn: '2026-06-11', checkOut: '2026-06-13', roomsBlocked: 12, roomsConfirmed: 0, roomsReleased: 12, deadline: '2026-05-15', status: 'released', contractId: 'CTR-2026-005', pricePerNight: 1200, notes: 'Client n\'a pas confirmé à temps' },
]

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof Lock }> = {
  blocked:   { label: 'Bloqué', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Lock },
  confirmed: { label: 'Confirmé', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2 },
  partial:   { label: 'Partiel', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: AlertTriangle },
  released:  { label: 'Libéré', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-white/10', icon: Unlock },
  expired:   { label: 'Expiré', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: Clock },
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

// ── API ↔ UI mappers ───────────────────────────────────────────────
const toUi = (r: AllotmentRow): Allotment => ({
  id: r.id,
  hotelName: r.hotel_name,
  city: r.city,
  category: r.category ?? '',
  checkIn: r.check_in,
  checkOut: r.check_out,
  roomsBlocked: r.rooms_blocked,
  roomsConfirmed: r.rooms_confirmed,
  roomsReleased: r.rooms_released,
  deadline: r.deadline ?? '',
  status: r.status,
  contractId: r.contract_id ?? '',
  pricePerNight: r.price_per_night,
  notes: r.notes ?? '',
})

export function AllotmentManagerPage() {
  const qc = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTimeline] = useState(true)

  const { data: liveRows = [], isFetching, isError } = useQuery({
    queryKey: ['allotments'],
    queryFn: () => allotmentsApi.list().then(r => r.data),
    retry: 0,
  })

  const confirmMut = useMutation({
    mutationFn: (id: string) => allotmentsApi.confirm(id).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allotments'] }),
  })
  const releaseMut = useMutation({
    mutationFn: (id: string) => allotmentsApi.release(id).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allotments'] }),
  })

  const isLive = !isError && liveRows.length > 0
  const allotments: Allotment[] = isLive ? liveRows.map(toUi) : initialAllotments

  const confirmAllotment = (id: string) => {
    if (isLive) confirmMut.mutate(id)
  }
  const releaseAllotment = (id: string) => {
    if (isLive) releaseMut.mutate(id)
  }

  const stats = {
    totalRooms: allotments.reduce((s, a) => s + a.roomsBlocked, 0),
    confirmed: allotments.reduce((s, a) => s + a.roomsConfirmed, 0),
    released: allotments.reduce((s, a) => s + a.roomsReleased, 0),
    pending: allotments.reduce((s, a) => s + (a.roomsBlocked - a.roomsConfirmed - a.roomsReleased), 0),
    totalCost: allotments.reduce((s, a) => {
      const nights = Math.ceil((new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 86400000)
      return s + a.pricePerNight * nights * a.roomsBlocked
    }, 0),
    nearDeadline: allotments.filter(a => {
      const dl = new Date(a.deadline)
      const now = new Date()
      const diff = (dl.getTime() - now.getTime()) / 86400000
      return diff > 0 && diff < 7 && a.status !== 'confirmed' && a.status !== 'released'
    }).length,
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Contracting <ChevronRight size={10} /> Allotements
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Hotel className="text-rihla" size={36} />
            Gestion des Allotements
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Bloquer / Libérer automatiquement les chambres à la confirmation du devis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <span className="text-[10px] text-slate-400">Chargement…</span>}
          <span className={clsx(
            "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
            isLive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-slate-100 dark:bg-white/10 text-slate-500",
          )}>
            {isLive ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isLive ? 'Live' : 'Démo (mock)'}
          </span>
        </div>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Chambres bloquées', value: stats.totalRooms, icon: Lock, color: 'text-blue-500' },
          { label: 'Confirmées', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'En attente', value: stats.pending, icon: Clock, color: 'text-amber-500' },
          { label: 'Libérées', value: stats.released, icon: Unlock, color: 'text-slate-400' },
          { label: 'Deadline < 7j', value: stats.nearDeadline, icon: AlertTriangle, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2">
              <s.icon size={14} className={s.color} /> {s.label}
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-cream">{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── TIMELINE VIEW ──────────────────────────────────────── */}
      {showTimeline && (
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Calendar size={14} /> Vue Chronologique
            </h3>
            <div className="relative h-32">
              {/* Timeline bar */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 dark:bg-white/10 -translate-y-1/2" />
              {allotments.map((a, i) => {
                const startDate = new Date(a.checkIn)
                const minDate = new Date('2026-06-10')
                const maxDate = new Date('2026-06-20')
                const range = maxDate.getTime() - minDate.getTime()
                const left = ((startDate.getTime() - minDate.getTime()) / range) * 100
                const endDate = new Date(a.checkOut)
                const width = ((endDate.getTime() - startDate.getTime()) / range) * 100
                const sc = statusConfig[a.status]

                return (
                  <div
                    key={a.id}
                    className="absolute"
                    style={{ left: `${Math.max(0, Math.min(left, 90))}%`, width: `${Math.max(5, Math.min(width, 90 - left))}%`, top: `${(i % 3) * 35 + 5}px` }}
                  >
                    <div className={clsx("h-8 rounded-lg flex items-center px-2 text-[9px] font-bold truncate cursor-pointer hover:scale-105 transition-transform", sc.bgColor, sc.color)} title={`${a.hotelName} — ${a.city}`}>
                      {a.hotelName.split(' ').slice(0, 2).join(' ')}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-2">
              <span>10 Juin</span>
              <span>12 Juin</span>
              <span>14 Juin</span>
              <span>16 Juin</span>
              <span>18 Juin</span>
              <span>20 Juin</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ALLOTMENT CARDS ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-4">
        {allotments.map(a => {
          const sc = statusConfig[a.status]
          const StatusIcon = sc.icon
          const nights = Math.ceil((new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 86400000)
          const totalCost = a.pricePerNight * nights * a.roomsBlocked
          const occupancy = a.roomsBlocked > 0 ? (a.roomsConfirmed / a.roomsBlocked) * 100 : 0
          const daysToDeadline = Math.ceil((new Date(a.deadline).getTime() - new Date().getTime()) / 86400000)

          return (
            <div key={a.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-rihla/10 flex items-center justify-center">
                    <Hotel size={24} className="text-rihla" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{a.hotelName} <span className="text-rihla text-xs">{a.category}</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{a.city} · {a.checkIn} → {a.checkOut} ({nights} nuits)</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={clsx("px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1", sc.bgColor, sc.color)}>
                        <StatusIcon size={10} /> {sc.label}
                      </span>
                      <span className="text-[10px] text-slate-400">Réf: {a.contractId}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Chambres</div>
                    <div className="text-lg font-black">{a.roomsConfirmed}/{a.roomsBlocked}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase">Coût total</div>
                    <div className="text-lg font-black text-rihla">{fmt(totalCost)} MAD</div>
                  </div>
                  {daysToDeadline > 0 && daysToDeadline < 7 && a.status !== 'confirmed' && a.status !== 'released' && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <Bell size={10} /> {daysToDeadline}j restants
                    </div>
                  )}
                  {expandedId === a.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedId === a.id && (
                <div className="p-6 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4">
                  {/* Occupancy bar */}
                  <div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                      <span>Taux d'occupation</span>
                      <span className="text-rihla">{occupancy.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{a.roomsConfirmed} confirmées</span>
                      <span>{a.roomsBlocked - a.roomsConfirmed - a.roomsReleased} en attente</span>
                      <span>{a.roomsReleased} libérées</span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Prix/nuit</div>
                      <div className="text-sm font-bold">{fmt(a.pricePerNight)} MAD</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Deadline</div>
                      <div className="text-sm font-bold">{a.deadline}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Notes</div>
                      <div className="text-xs text-slate-500">{a.notes || '—'}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  {a.status !== 'confirmed' && a.status !== 'released' && (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => confirmAllotment(a.id)}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                      >
                        <CheckCircle2 size={14} /> Confirmer toutes les chambres
                      </button>
                      <button
                        onClick={() => releaseAllotment(a.id)}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                      >
                        <Unlock size={14} /> Libérer les non-confirmées
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
