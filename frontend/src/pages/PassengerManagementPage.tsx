import { useState, useEffect } from 'react'
import {
  Users, ChevronRight, Plus, Trash2, Edit3,
  Download, Search, Filter, UserPlus,
  Utensils, Bed, Phone,
  CheckCircle2, AlertCircle, Save, X,
  FileSpreadsheet, Mail, Wifi, WifiOff
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { passengersApi } from '@/lib/api'
import { ProjectPicker } from '@/components/projects/ProjectPicker'

// Map backend passenger (snake_case) → UI passenger (camelCase)
function toUi(p: any, idx: number): any {
  return {
    id: p.id || `p-${idx}`,
    firstName: p.first_name ?? p.firstName ?? '',
    lastName: p.last_name ?? p.lastName ?? '',
    nationality: p.nationality ?? 'FR',
    passportNumber: p.passport_number ?? p.passportNumber ?? '',
    passportExpiry: p.passport_expiry ?? p.passportExpiry ?? '',
    dateOfBirth: p.date_of_birth ?? p.dateOfBirth ?? '',
    gender: (p.gender ?? 'M') as 'M' | 'F',
    phone: p.phone ?? '',
    email: p.email ?? '',
    dietaryRestrictions: p.dietary ?? p.dietaryRestrictions ?? '',
    roomType: ((p.room_preference === 'single' ? 'SGL'
              : p.room_preference === 'double' ? 'DBL'
              : p.room_preference === 'sharing' ? 'TWIN'
              : p.roomType ?? 'DBL') as 'SGL' | 'DBL' | 'TWIN' | 'TRPL'),
    roomPartner: p.sharing_with ?? p.roomPartner ?? '',
    specialRequests: p.medical_notes ?? p.notes ?? p.specialRequests ?? '',
    isGroupLeader: !!(p.is_group_leader ?? p.isGroupLeader),
  }
}

function toApi(p: any): any {
  return {
    id: p.id,
    first_name: p.firstName,
    last_name: p.lastName,
    nationality: p.nationality,
    passport_number: p.passportNumber,
    passport_expiry: p.passportExpiry || null,
    date_of_birth: p.dateOfBirth || null,
    gender: p.gender,
    phone: p.phone,
    email: p.email,
    dietary: p.dietaryRestrictions,
    room_preference: p.roomType === 'SGL' ? 'single' : p.roomType === 'DBL' ? 'double' : 'sharing',
    sharing_with: p.roomPartner,
    notes: p.specialRequests,
    is_group_leader: p.isGroupLeader,
  }
}

// ── Types ──────────────────────────────────────────────────────────
interface Passenger {
  id: string
  firstName: string
  lastName: string
  nationality: string
  passportNumber: string
  passportExpiry: string
  dateOfBirth: string
  gender: 'M' | 'F'
  phone: string
  email: string
  dietaryRestrictions: string
  roomType: 'SGL' | 'DBL' | 'TWIN' | 'TRPL'
  roomPartner: string
  specialRequests: string
  isGroupLeader: boolean
}

// ── Mock Data ──────────────────────────────────────────────────────
const initialPassengers: Passenger[] = [
  { id: '1', firstName: 'John', lastName: 'Smith', nationality: 'GB', passportNumber: 'GBR987654', passportExpiry: '2028-06-15', dateOfBirth: '1980-03-12', gender: 'M', phone: '+44 7700 900000', email: 'john.smith@email.com', dietaryRestrictions: '', roomType: 'DBL', roomPartner: 'Jane Smith', specialRequests: '', isGroupLeader: true },
  { id: '2', firstName: 'Jane', lastName: 'Smith', nationality: 'GB', passportNumber: 'GBR123456', passportExpiry: '2027-09-20', dateOfBirth: '1982-07-25', gender: 'F', phone: '+44 7700 900001', email: 'jane.smith@email.com', dietaryRestrictions: 'Végétarienne', roomType: 'DBL', roomPartner: 'John Smith', specialRequests: '', isGroupLeader: false },
  { id: '3', firstName: 'Robert', lastName: 'Doe', nationality: 'US', passportNumber: 'USA456789', passportExpiry: '2029-01-10', dateOfBirth: '1975-11-05', gender: 'M', phone: '+1 555 123 4567', email: 'robert.doe@email.com', dietaryRestrictions: 'Sans gluten', roomType: 'SGL', roomPartner: '', specialRequests: 'Chambre basse, problème de mobilité', isGroupLeader: false },
  { id: '4', firstName: 'Alice', lastName: 'Johnson', nationality: 'FR', passportNumber: 'FRA789012', passportExpiry: '2027-04-30', dateOfBirth: '1990-02-14', gender: 'F', phone: '+33 6 12 34 56 78', email: 'alice.johnson@email.com', dietaryRestrictions: '', roomType: 'TWIN', roomPartner: 'Sarah Brown', specialRequests: '', isGroupLeader: false },
  { id: '5', firstName: 'Sarah', lastName: 'Brown', nationality: 'US', passportNumber: 'USA345678', passportExpiry: '2028-11-22', dateOfBirth: '1988-08-30', gender: 'F', phone: '+1 555 987 6543', email: 'sarah.brown@email.com', dietaryRestrictions: 'Halal', roomType: 'TWIN', roomPartner: 'Alice Johnson', specialRequests: '', isGroupLeader: false },
]

const NATIONALITIES: Record<string, string> = {
  GB: '🇬🇧 Royaume-Uni', US: '🇺🇸 États-Unis', FR: '🇫🇷 France', DE: '🇩🇪 Allemagne',
  ES: '🇪🇸 Espagne', IT: '🇮🇹 Italie', NL: '🇳🇱 Pays-Bas', BE: '🇧🇪 Belgique',
}

export function PassengerManagementPage() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [passengers, setPassengers] = useState<Passenger[]>(initialPassengers)
  const [search, setSearch] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: liveData, isFetching, isSuccess: liveSuccess } = useQuery({
    queryKey: ['passengers', projectId],
    queryFn: () => passengersApi.list(projectId!).then(r => r.data),
    enabled: !!projectId,
    retry: false,
  })

  const saveMut = useMutation({
    mutationFn: (next: Passenger[]) =>
      passengersApi.save(projectId!, next.map(toApi)).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['passengers', projectId] }) },
    onError: (err: any) => setSaveError(err?.response?.data?.detail || err?.message || 'Erreur sauvegarde'),
  })

  // Sync server → local passengers whenever a project is selected / data arrives
  useEffect(() => {
    if (!projectId) {
      setPassengers(initialPassengers)
      return
    }
    const list: any[] = (liveData as any)?.passengers ?? []
    setPassengers(list.length > 0 ? list.map(toUi) : [])
  }, [projectId, liveData])

  const usingLive = !!projectId && liveSuccess
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterDiet, setFilterDiet] = useState(false)

  const [newPassenger, setNewPassenger] = useState<Passenger>({
    id: '', firstName: '', lastName: '', nationality: 'FR', passportNumber: '',
    passportExpiry: '', dateOfBirth: '', gender: 'M', phone: '', email: '',
    dietaryRestrictions: '', roomType: 'DBL', roomPartner: '', specialRequests: '',
    isGroupLeader: false,
  })

  const filtered = passengers.filter(p => {
    const matchSearch = `${p.firstName} ${p.lastName} ${p.passportNumber}`.toLowerCase().includes(search.toLowerCase())
    const matchDiet = !filterDiet || p.dietaryRestrictions.length > 0
    return matchSearch && matchDiet
  })

  const stats = {
    total: passengers.length,
    nationalities: [...new Set(passengers.map(p => p.nationality))].length,
    dietary: passengers.filter(p => p.dietaryRestrictions).length,
    sgl: passengers.filter(p => p.roomType === 'SGL').length,
    dbl: passengers.filter(p => p.roomType === 'DBL').length / 2,
    twin: passengers.filter(p => p.roomType === 'TWIN').length / 2,
    passportExpiring: passengers.filter(p => {
      const exp = new Date(p.passportExpiry)
      const sixMonths = new Date()
      sixMonths.setMonth(sixMonths.getMonth() + 6)
      return exp < sixMonths
    }).length,
  }

  const persist = (next: Passenger[]) => {
    setPassengers(next)
    if (usingLive) saveMut.mutate(next)
  }

  const addPassenger = () => {
    if (!newPassenger.firstName || !newPassenger.lastName) return
    const next = [...passengers, { ...newPassenger, id: Date.now().toString() }]
    persist(next)
    setNewPassenger({
      id: '', firstName: '', lastName: '', nationality: 'FR', passportNumber: '',
      passportExpiry: '', dateOfBirth: '', gender: 'M', phone: '', email: '',
      dietaryRestrictions: '', roomType: 'DBL', roomPartner: '', specialRequests: '',
      isGroupLeader: false,
    })
    setShowAddForm(false)
  }

  const deletePassenger = (id: string) => {
    persist(passengers.filter(p => p.id !== id))
  }

  const exportCSV = () => {
    const headers = ['Prénom', 'Nom', 'Nationalité', 'Passeport', 'Expiration', 'Date Naissance', 'Genre', 'Téléphone', 'Email', 'Régime', 'Chambre', 'Partenaire', 'Demandes spéciales']
    const rows = passengers.map(p => [p.firstName, p.lastName, NATIONALITIES[p.nationality] || p.nationality, p.passportNumber, p.passportExpiry, p.dateOfBirth, p.gender, p.phone, p.email, p.dietaryRestrictions, p.roomType, p.roomPartner, p.specialRequests])
    let csv = headers.join(';') + '\n'
    rows.forEach(r => { csv += r.join(';') + '\n' })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passagers_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Opérations <ChevronRight size={10} /> Gestion Passagers
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Users className="text-rihla" size={36} />
            Gestion des Passagers
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic flex items-center gap-2">
            {usingLive
              ? <span className="inline-flex items-center gap-1 text-emerald-500 font-bold"><Wifi size={12} /> Live — persisté en base</span>
              : <span className="inline-flex items-center gap-1 text-slate-400 font-bold"><WifiOff size={12} /> Démo (mock)</span>}
            {isFetching && <span className="text-xs text-slate-400">· chargement…</span>}
            {saveMut.isPending && <span className="text-xs text-sky-500">· sauvegarde…</span>}
          </p>
          {saveError && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-600"><AlertCircle size={12} /> {saveError}</div>
          )}
        </div>
        <div className="flex items-end gap-3">
          <ProjectPicker value={projectId} onChange={setProjectId} label="Projet" className="w-64" />
          <button onClick={exportCSV} className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <FileSpreadsheet size={14} /> Export CSV
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-6 py-3 bg-rihla text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rihla/20 hover:-translate-y-0.5 transition-all">
            <UserPlus size={14} /> Ajouter Passager
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* ── LEFT: STATS ──────────────────────────────────────── */}
        <div className="col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Résumé Groupe</h3>
            <div className="space-y-4">
              {[
                { label: 'Total passagers', value: stats.total, icon: Users, color: 'text-rihla' },
                { label: 'Nationalités', value: stats.nationalities, icon: Users, color: 'text-blue-500' },
                { label: 'Régimes spéciaux', value: stats.dietary, icon: Utensils, color: 'text-amber-500' },
                { label: 'Chambres SGL', value: stats.sgl, icon: Bed, color: 'text-purple-500' },
                { label: 'Chambres DBL', value: Math.ceil(stats.dbl), icon: Bed, color: 'text-emerald-500' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <s.icon size={14} className={s.color} /> {s.label}
                  </div>
                  <span className="text-lg font-black text-slate-900 dark:text-cream">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {stats.passportExpiring > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 dark:text-red-400">
                <strong>{stats.passportExpiring} passeport(s)</strong> expirent dans moins de 6 mois !
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Filter size={14} /> Filtres
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={filterDiet} onChange={() => setFilterDiet(!filterDiet)} className="w-4 h-4 rounded border-slate-300 text-rihla focus:ring-rihla" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Régimes alimentaires uniquement</span>
            </label>
          </div>
        </div>

        {/* ── RIGHT: PASSENGER LIST ──────────────────────────────── */}
        <div className="col-span-9 space-y-4">

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un passager..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30 shadow-sm"
            />
          </div>

          {/* Passenger cards */}
          {filtered.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm", p.isGroupLeader ? "bg-rihla" : p.gender === 'F' ? "bg-pink-500" : "bg-blue-500")}>
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{p.firstName} {p.lastName}</span>
                      {p.isGroupLeader && <span className="px-2 py-0.5 bg-rihla/10 text-rihla text-[10px] font-black rounded-full">Chef de groupe</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-400">
                      <span>{NATIONALITIES[p.nationality] || p.nationality}</span>
                      <span>{p.passportNumber}</span>
                      <span>Exp: {p.passportExpiry}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 transition-all">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => deletePassenger(p.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Chambre</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{p.roomType} {p.roomPartner && `avec ${p.roomPartner}`}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Régime</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{p.dietaryRestrictions || 'Standard'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Contact</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{p.phone}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase">Demandes</div>
                  <div className="text-xs text-slate-500 mt-1 truncate">{p.specialRequests || '—'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ADD PASSENGER MODAL ──────────────────────────────────── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-cream flex items-center gap-2">
                <UserPlus size={20} className="text-rihla" /> Nouveau Passager
              </h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'firstName', label: 'Prénom', type: 'text' },
                { key: 'lastName', label: 'Nom', type: 'text' },
                { key: 'dateOfBirth', label: 'Date de naissance', type: 'date' },
                { key: 'passportNumber', label: 'N° Passeport', type: 'text' },
                { key: 'passportExpiry', label: 'Expiration passeport', type: 'date' },
                { key: 'phone', label: 'Téléphone', type: 'tel' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'dietaryRestrictions', label: 'Régime alimentaire', type: 'text' },
                { key: 'roomPartner', label: 'Partenaire de chambre', type: 'text' },
                { key: 'specialRequests', label: 'Demandes spéciales', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{field.label}</label>
                  <input
                    type={field.type}
                    value={String((newPassenger as unknown as Record<string, string>)[field.key] || '')}
                    onChange={e => setNewPassenger(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm focus:outline-none focus:ring-2 focus:ring-rihla/30"
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nationalité</label>
                <select
                  value={newPassenger.nationality}
                  onChange={e => setNewPassenger(prev => ({ ...prev, nationality: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm"
                >
                  {Object.entries(NATIONALITIES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Type chambre</label>
                <select
                  value={newPassenger.roomType}
                  onChange={e => setNewPassenger(prev => ({ ...prev, roomType: e.target.value as Passenger['roomType'] }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm"
                >
                  <option value="SGL">Single</option>
                  <option value="DBL">Double</option>
                  <option value="TWIN">Twin</option>
                  <option value="TRPL">Triple</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddForm(false)} className="flex-1 px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                Annuler
              </button>
              <button onClick={addPassenger} disabled={!newPassenger.firstName || !newPassenger.lastName} className="flex-1 px-6 py-3 bg-rihla text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-rihla/20 disabled:opacity-50">
                <Save size={14} className="inline mr-2" /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
