import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, BedDouble, Hotel, DollarSign, Users,
  Eye, Maximize, Plus, ChevronDown, ChevronRight,
  RefreshCw, Utensils, Star,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { premiumCatalogsApi, roomsApi, type RoomCategory, type RoomRate } from '@/lib/api'
import { clsx } from 'clsx'

const fmt = (v: number) => new Intl.NumberFormat('fr-FR').format(Math.round(v))

const MEAL_LABELS: Record<string, string> = {
  RO: 'Room Only',
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
  AI: 'All Inclusive',
}

export function HotelRoomsPage() {
  const { hotelId } = useParams<{ hotelId: string }>()
  const queryClient = useQueryClient()

  const { data: hotel } = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: () => premiumCatalogsApi.get(hotelId!).then(r => r.data),
    enabled: !!hotelId,
  })

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['hotel-rooms', hotelId],
    queryFn: () => roomsApi.list(hotelId!).then(r => r.data),
    enabled: !!hotelId,
  })

  const seedMutation = useMutation({
    mutationFn: () => roomsApi.seedDemo(hotelId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotel-rooms', hotelId] }),
  })

  if (!hotelId) return null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/premium-catalogs"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Hotel className="text-blue-500" size={28} />
            {(hotel as any)?.label || 'Hôtel'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {(hotel as any)?.city} • {rooms.length} catégorie{rooms.length > 1 ? 's' : ''} de chambres
          </p>
        </div>
        {rooms.length === 0 && (
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-rihla text-white rounded-lg hover:bg-rihla/90 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={seedMutation.isPending ? 'animate-spin' : ''} />
            Générer démo
          </button>
        )}
      </div>

      {/* Hotel info card */}
      {hotel && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Tarif de base', value: `${fmt((hotel as any).unit_cost)} ${(hotel as any).currency}`, icon: DollarSign },
            { label: 'Tier', value: (hotel as any).tier, icon: Star },
            { label: 'Capacité', value: (hotel as any).capacity ? `${(hotel as any).capacity} chambres` : '—', icon: BedDouble },
            { label: 'Rating', value: `${(hotel as any).rating}/5`, icon: Star },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
              <item.icon size={18} className="text-rihla" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room categories */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Aucune catégorie de chambre configurée</div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <BedDouble size={20} className="text-rihla" />
            Catégories de chambres & Grille tarifaire
          </h2>
          {rooms.map(room => (
            <RoomCategoryCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  )
}

function RoomCategoryCard({ room }: { room: RoomCategory }) {
  const [expanded, setExpanded] = useState(true)

  const { data: rates = [] } = useQuery({
    queryKey: ['room-rates', room.id],
    queryFn: () => roomsApi.rates.list(room.id).then(r => r.data),
  })

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
      {/* Room header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 text-left transition-colors"
      >
        <div className="rounded-lg p-2.5 bg-blue-500/10">
          <BedDouble size={22} className="text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white">{room.name}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Users size={11} />{room.capacity} pers.</span>
            {room.bed_type && <span className="flex items-center gap-1"><BedDouble size={11} />{room.bed_type}</span>}
            {room.surface_m2 && <span className="flex items-center gap-1"><Maximize size={11} />{room.surface_m2}m²</span>}
            {room.view && <span className="flex items-center gap-1"><Eye size={11} />Vue {room.view}</span>}
          </div>
        </div>
        {room.amenities && room.amenities.length > 0 && (
          <div className="flex gap-1">
            {room.amenities.map((a: string) => (
              <span key={a} className="px-2 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-[10px] text-slate-600 dark:text-slate-400">
                {a}
              </span>
            ))}
          </div>
        )}
        <span className="px-2 py-0.5 bg-rihla/10 text-rihla rounded text-xs font-bold">
          {rates.length} tarif{rates.length > 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {/* Rate grid */}
      {expanded && rates.length > 0 && (
        <div className="border-t border-slate-100 dark:border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-xs text-slate-500 uppercase tracking-wider text-left">
              <tr>
                <th className="px-5 py-2.5">Saison</th>
                <th className="px-5 py-2.5">Type</th>
                <th className="px-5 py-2.5 text-right">SGL</th>
                <th className="px-5 py-2.5 text-right">DBL</th>
                <th className="px-5 py-2.5 text-right">TPL</th>
                <th className="px-5 py-2.5">
                  <span className="flex items-center gap-1"><Utensils size={11} />Formule</span>
                </th>
                <th className="px-5 py-2.5">Devise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {rates.map(rate => (
                <tr key={rate.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-white">
                    {rate.season_label || '—'}
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                      rate.rate_type === 'rack' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                      rate.rate_type === 'promo' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                    )}>
                      {rate.rate_type}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {fmt(rate.rate_sgl)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                    {fmt(rate.rate_dbl)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-slate-500">
                    {rate.rate_tpl ? fmt(rate.rate_tpl) : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-slate-500">
                    {MEAL_LABELS[rate.meal_plan] || rate.meal_plan}
                  </td>
                  <td className="px-5 py-2.5 text-xs font-medium">{rate.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
