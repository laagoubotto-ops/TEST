import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { projectsApi } from '@/lib/api'

/**
 * Reusable project picker used by the "extras" pages (/budget-tracker,
 * /passengers, /what-if, /group-ops, /client-portal, /export-excel).
 *
 * Pattern:
 *   const [projectId, setProjectId] = useState<string|null>(null)
 *   <ProjectPicker value={projectId} onChange={setProjectId} />
 *
 * When no project is selected the host page should fall back to mock data so
 * it remains demoable on a fresh tenant.
 */
export interface ProjectOption {
  id: string
  name: string
  client_name?: string | null
  status?: string | null
  pax_count?: number | null
  start_date?: string | null
}

export function ProjectPicker({
  value,
  onChange,
  label = 'Projet',
  className,
  compact = false,
}: {
  value: string | null
  onChange: (id: string | null) => void
  label?: string
  className?: string
  compact?: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['projects-picker'],
    queryFn: () => projectsApi.list({ limit: 100 }).then(r => (r.data?.items ?? []) as ProjectOption[]),
    retry: false,
    staleTime: 60_000,
  })

  const projects = useMemo(() => data ?? [], [data])
  const selected = projects.find(p => p.id === value)

  if (compact) {
    return (
      <div className={clsx('inline-flex items-center gap-2', className)}>
        <FolderKanban size={14} className="text-slate-400" />
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rihla"
        >
          <option value="">{isLoading ? 'Chargement…' : `— ${label} (mock) —`}</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.client_name ? `· ${p.client_name}` : ''}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className={clsx('relative', className)}>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      <div className="relative">
        <FolderKanban size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className={clsx(
            'w-full appearance-none pl-9 pr-9 py-2.5 text-sm font-medium',
            'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10',
            'rounded-xl text-slate-700 dark:text-slate-200',
            'focus:outline-none focus:ring-2 focus:ring-rihla/40'
          )}
        >
          <option value="">
            {isLoading ? 'Chargement des projets…' : `— Aucun projet sélectionné (données de démo) —`}
          </option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.client_name ? ` · ${p.client_name}` : ''}{p.pax_count ? ` · ${p.pax_count} pax` : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {selected && (
        <div className="mt-1.5 text-[10px] text-slate-400">
          Sélectionné : <span className="font-mono text-rihla">{selected.id}</span>
          {selected.status && <span className="ml-2 uppercase tracking-widest">· {selected.status}</span>}
        </div>
      )}
    </div>
  )
}
