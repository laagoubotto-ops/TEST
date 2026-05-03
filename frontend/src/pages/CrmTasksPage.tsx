import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ListChecks, Clock, CheckCircle2, ArrowLeft, AlertTriangle,
  Wifi, WifiOff, Building2,
} from 'lucide-react'
import clsx from 'clsx'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui'
import { crmApi, type CrmTask, type CrmAccount } from '@/lib/api'

const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'


type Filter = 'all' | 'open' | 'overdue' | 'today' | 'week' | 'completed'


export function CrmTasksPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('open')

  const { data: tasks = [], isFetching, isError } = useQuery({
    queryKey: ['crm', 'tasks', filter],
    queryFn: () => crmApi.listTasks({
      completed: filter === 'completed' ? true : filter === 'all' ? undefined : false,
      overdue: filter === 'overdue' ? true : undefined,
    }).then(r => r.data),
    retry: 0,
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['crm', 'accounts', 'all'],
    queryFn: () => crmApi.listAccounts().then(r => r.data),
    retry: 0,
  })

  const completeMut = useMutation({
    mutationFn: (id: string) => crmApi.completeTask(id).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'tasks'] }),
  })

  const isLive = !isError && (tasks.length > 0 || accounts.length > 0)
  const accountsById = new Map<string, CrmAccount>(accounts.map(a => [a.id, a]))

  const filtered = useMemo(() => {
    const now = new Date()
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
    return tasks.filter(t => {
      if (filter === 'today') {
        return t.due_date && new Date(t.due_date) <= todayEnd && !t.completed_at
      }
      if (filter === 'week') {
        return t.due_date && new Date(t.due_date) <= weekEnd && !t.completed_at
      }
      return true
    })
  }, [tasks, filter])

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.completed_at).length
  const todayCount = tasks.filter(t => {
    if (!t.due_date || t.completed_at) return false
    const end = new Date(); end.setHours(23, 59, 59, 999)
    return new Date(t.due_date) <= end
  }).length

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-12">
      <PageHeader
        eyebrow="CRM"
        title="Tâches & rappels"
        subtitle="Vos prochaines actions sur le pipeline et les comptes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm" className="btn btn-secondary btn-sm gap-2">
              <ArrowLeft size={14} /> Comptes
            </Link>
          </div>
        }
      />

      <div className="p-8 max-w-[1400px] mx-auto space-y-6">
        {/* badge */}
        <div className="flex justify-end">
          <span className={clsx(
            'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5',
            isLive
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
              : 'bg-slate-100 dark:bg-white/10 text-slate-500',
          )}>
            {isFetching && <span className="text-[9px]">…</span>}
            {isLive ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isLive ? 'Live · API' : 'Démo (mock)'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tâches en retard" value={overdue} icon={AlertTriangle}
            variant={overdue > 0 ? 'primary' : undefined} sub="à traiter" />
          <StatCard label="À faire aujourd'hui" value={todayCount} icon={Clock} sub="due today" />
          <StatCard label="Total ouvertes" value={tasks.filter(t => !t.completed_at).length} icon={ListChecks} sub="all open" />
          <StatCard label="Terminées" value={tasks.filter(t => !!t.completed_at).length} icon={CheckCircle2} sub="completed" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Toutes'], ['open', 'Ouvertes'], ['overdue', 'En retard'],
            ['today', "Aujourd'hui"], ['week', 'Cette semaine'], ['completed', 'Terminées'],
          ] as [Filter, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={clsx(
                'px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                filter === k
                  ? 'bg-rihla text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-rihla',
              )}
            >{l}</button>
          ))}
        </div>

        {/* Tasks list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[20px] overflow-hidden">
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map(t => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && !t.completed_at
              const isCompleted = !!t.completed_at
              const acc = t.account_id ? accountsById.get(t.account_id) : null
              return (
                <li key={t.id}
                  className={clsx(
                    'flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors',
                    isCompleted && 'opacity-60',
                  )}>
                  <button
                    onClick={() => !isCompleted && completeMut.mutate(t.id)}
                    disabled={isCompleted}
                    className={clsx(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0',
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:bg-rihla hover:border-rihla',
                    )}
                  >
                    {isCompleted && <CheckCircle2 size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('font-bold text-[13px] text-slate-800 dark:text-cream',
                      isCompleted && 'line-through')}>
                      {t.title}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {t.due_date && (
                        <span className={clsx(
                          'flex items-center gap-1',
                          isOverdue && 'text-rose-600 font-bold',
                        )}>
                          <Clock size={11} /> {fmtDateTime(t.due_date)}
                          {isOverdue && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                              EN RETARD
                            </span>
                          )}
                        </span>
                      )}
                      {acc && (
                        <Link to={`/crm/accounts/${acc.id}`} className="flex items-center gap-1 hover:text-rihla">
                          <Building2 size={11} /> {acc.name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className={clsx(
                    'px-2 py-1 rounded-full text-[10px] font-bold uppercase shrink-0',
                    t.priority === 'urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' :
                    t.priority === 'high'   ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                    t.priority === 'low'    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' :
                    'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
                  )}>{t.priority}</span>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-5 py-12 text-center text-slate-400">
                <ListChecks size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-[12px]">Aucune tâche dans ce filtre.</p>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default CrmTasksPage
