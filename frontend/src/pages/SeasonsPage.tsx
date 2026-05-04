import { useState } from 'react'
import {
  Calendar, Sun, Snowflake, Cloud, Sparkles,
  Plus, Pencil, Trash2, Hotel, Bus, Compass,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { seasonsApi, type Season } from '@/lib/api'
import { clsx } from 'clsx'

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Sun; color: string; bg: string }> = {
  haute:    { label: 'Haute Saison',   icon: Sun,      color: 'text-red-500',    bg: 'bg-red-500/10' },
  moyenne:  { label: 'Moyenne Saison', icon: Cloud,    color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  basse:    { label: 'Basse Saison',   icon: Snowflake,color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  speciale: { label: 'Spéciale',       icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
}

const APPLIES_ICONS: Record<string, typeof Hotel> = {
  hotel: Hotel,
  transport: Bus,
  guide: Compass,
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export function SeasonsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)
  const queryClient = useQueryClient()

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['seasons'],
    queryFn: () => seasonsApi.list().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => seasonsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seasons'] }),
  })

  const byType = seasons.reduce((acc, s) => {
    acc[s.season_type] = (acc[s.season_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="text-rihla" size={28} />
            Gestion des Saisons
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {seasons.length} saisons configurées
          </p>
        </div>
        <button
          onClick={() => { setEditSeason(null); setShowForm(!showForm) }}
          className="flex items-center gap-2 px-4 py-2 bg-rihla text-white rounded-lg hover:bg-rihla/90 text-sm font-medium"
        >
          <Plus size={16} /> Nouvelle Saison
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={key} className={clsx('flex items-center gap-3 rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3', cfg.bg)}>
              <Icon size={20} className={cfg.color} />
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{byType[key] || 0}</p>
                <p className="text-xs text-slate-500">{cfg.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Form */}
      {showForm && <SeasonForm season={editSeason} onClose={() => setShowForm(false)} />}

      {/* Seasons Timeline */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Chargement…</div>
      ) : (
        <div className="space-y-3">
          {seasons.map(season => {
            const cfg = TYPE_CONFIG[season.season_type] || TYPE_CONFIG.moyenne
            const Icon = cfg.icon
            const days = daysBetween(season.date_from, season.date_to)
            return (
              <div
                key={season.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-white/10 px-5 py-4 hover:border-rihla/30 transition-colors"
              >
                <div className={clsx('rounded-lg p-2.5', cfg.bg)}>
                  <Icon size={22} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{season.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{formatDate(season.date_from)} → {formatDate(season.date_to)}</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-[10px] font-medium">
                      {days} jours
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(season.applies_to || []).map(kind => {
                    const KindIcon = APPLIES_ICONS[kind]
                    return KindIcon ? <KindIcon key={kind} size={14} className="text-slate-400" /> : null
                  })}
                </div>
                {season.color && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: season.color }} />
                )}
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', cfg.bg, cfg.color)}>
                  {cfg.label}
                </span>
                {season.notes && (
                  <span className="text-xs text-slate-400 max-w-[150px] truncate">{season.notes}</span>
                )}
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditSeason(season); setShowForm(true) }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Archiver "${season.name}" ?`)) deleteMutation.mutate(season.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SeasonForm({ season, onClose }: { season: Season | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: season?.name || '',
    season_type: season?.season_type || 'haute',
    date_from: season?.date_from || '',
    date_to: season?.date_to || '',
    color: season?.color || '#ef4444',
    notes: season?.notes || '',
    applies_to: season?.applies_to || ['hotel', 'transport', 'guide'],
  })

  const mutation = useMutation({
    mutationFn: () =>
      season
        ? seasonsApi.update(season.id, form)
        : seasonsApi.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seasons'] })
      onClose()
    },
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="rounded-xl border border-rihla/30 bg-rihla/5 p-5 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">
        {season ? 'Modifier la saison' : 'Nouvelle saison'}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Nom" value={form.name} onChange={e => set('name', e.target.value)}
          className="col-span-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none focus:ring-2 focus:ring-rihla/30" />
        <select value={form.season_type} onChange={e => set('season_type', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none">
          <option value="haute">Haute Saison</option>
          <option value="moyenne">Moyenne Saison</option>
          <option value="basse">Basse Saison</option>
          <option value="speciale">Spéciale</option>
        </select>
        <input type="color" value={form.color || '#ef4444'} onChange={e => set('color', e.target.value)}
          className="w-full h-[38px] rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer" />
        <input type="date" value={form.date_from} onChange={e => set('date_from', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none" />
        <input type="date" value={form.date_to} onChange={e => set('date_to', e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none" />
        <input placeholder="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)}
          className="col-span-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm bg-white dark:bg-white/5 outline-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => mutation.mutate()}
          className="px-4 py-2 bg-rihla text-white rounded-lg text-sm font-medium hover:bg-rihla/90">
          {season ? 'Mettre à jour' : 'Créer'}
        </button>
        <button onClick={onClose}
          className="px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5">
          Annuler
        </button>
      </div>
    </div>
  )
}
