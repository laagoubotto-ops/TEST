import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, ArrowLeft, Building2, Calendar, Wifi, WifiOff,
  CheckCircle2, XCircle, Plus,
} from 'lucide-react'
import clsx from 'clsx'

import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui'
import {
  crmApi,
  type CrmDeal, type CrmDealStage, type CrmAccount,
} from '@/lib/api'

const STAGE_ORDER: CrmDealStage[] = ['qualification', 'proposal', 'negotiation', 'won', 'lost']
const STAGE_LABEL: Record<CrmDealStage, string> = {
  qualification: 'Qualification', proposal: 'Proposition',
  negotiation: 'Négociation', won: 'Gagné', lost: 'Perdu',
}
const STAGE_COLOR: Record<CrmDealStage, string> = {
  qualification: 'border-slate-300 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700',
  proposal:      'border-sky-300 bg-sky-50 dark:bg-sky-500/10 dark:border-sky-500/30',
  negotiation:   'border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30',
  won:           'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30',
  lost:          'border-rose-300 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30',
}
const STAGE_HEADER_COLOR: Record<CrmDealStage, string> = {
  qualification: 'text-slate-700 dark:text-slate-300',
  proposal:      'text-sky-700 dark:text-sky-300',
  negotiation:   'text-amber-700 dark:text-amber-300',
  won:           'text-emerald-700 dark:text-emerald-300',
  lost:          'text-rose-700 dark:text-rose-300',
}

const fmtMad = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtDate = (s?: string | null) => s
  ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'


export function CrmPipelinePage() {
  const qc = useQueryClient()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const { data: pipeline, isFetching, isError } = useQuery({
    queryKey: ['crm', 'pipeline'],
    queryFn: () => crmApi.pipeline().then(r => r.data),
    retry: 0,
  })
  const { data: accounts = [] } = useQuery({
    queryKey: ['crm', 'accounts', 'all'],
    queryFn: () => crmApi.listAccounts().then(r => r.data),
    retry: 0,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: CrmDealStage }) =>
      crmApi.updateDeal(id, { stage }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm'] }),
  })

  const isLive = !isError && !!pipeline

  const accountsById = new Map<string, CrmAccount>(accounts.map(a => [a.id, a]))

  const onDragStart = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragEnd = () => setDraggingId(null)
  const onDrop = (stage: CrmDealStage) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (draggingId) updateMut.mutate({ id: draggingId, stage })
    setDraggingId(null)
  }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-12">
      <PageHeader
        eyebrow="CRM"
        title="Pipeline commercial"
        subtitle="Glissez-déposez les deals d'une étape à l'autre. Chaque déplacement met à jour le backend en temps réel."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm" className="btn btn-secondary btn-sm gap-2">
              <ArrowLeft size={14} /> Comptes
            </Link>
            <Link to="/crm/tasks" className="btn btn-secondary btn-sm gap-2">
              <CheckCircle2 size={14} /> Tâches
            </Link>
          </div>
        }
      />

      <div className="p-8 max-w-[1800px] mx-auto space-y-6">
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

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Pipeline ouvert"
            value={`${((pipeline?.total_pipeline_mad ?? 0) / 1000000).toFixed(2)}M MAD`}
            icon={TrendingUp}
            variant="primary"
            sub={`${(pipeline?.columns ?? []).filter(c => ['qualification','proposal','negotiation'].includes(c.stage)).reduce((s, c) => s + c.count, 0)} deals`}
          />
          <StatCard
            label="Pipeline pondéré"
            value={`${((pipeline?.weighted_pipeline_mad ?? 0) / 1000000).toFixed(2)}M MAD`}
            icon={TrendingUp}
            variant="dark"
            sub="amount × prob"
          />
          <StatCard
            label="Gagné"
            value={pipeline?.columns?.find(c => c.stage === 'won')?.count ?? 0}
            icon={CheckCircle2}
            sub={`${fmtMad(pipeline?.columns?.find(c => c.stage === 'won')?.total_amount_mad ?? 0)} MAD`}
          />
          <StatCard
            label="Perdu"
            value={pipeline?.columns?.find(c => c.stage === 'lost')?.count ?? 0}
            icon={XCircle}
            sub={`${fmtMad(pipeline?.columns?.find(c => c.stage === 'lost')?.total_amount_mad ?? 0)} MAD`}
          />
        </div>

        {/* KANBAN */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STAGE_ORDER.map(stage => {
            const col = pipeline?.columns?.find(c => c.stage === stage)
            const deals = col?.deals ?? []
            return (
              <div
                key={stage}
                onDragOver={onDragOver}
                onDrop={onDrop(stage)}
                className={clsx(
                  'rounded-[20px] border-2 border-dashed p-3 min-h-[60vh]',
                  STAGE_COLOR[stage],
                )}
              >
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className={clsx('text-[12px] font-extrabold uppercase tracking-wider', STAGE_HEADER_COLOR[stage])}>
                    {STAGE_LABEL[stage]}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {col?.count ?? 0}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mb-3 px-2">
                  {fmtMad(col?.total_amount_mad ?? 0)} MAD
                </p>

                <div className="space-y-2">
                  {deals.map(d => {
                    const acc = accountsById.get(d.account_id)
                    return (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={onDragStart(d.id)}
                        onDragEnd={onDragEnd}
                        className={clsx(
                          'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all',
                          draggingId === d.id && 'opacity-50',
                        )}
                      >
                        <p className="font-bold text-[12px] text-slate-800 dark:text-cream line-clamp-2">{d.title}</p>
                        {acc && (
                          <Link to={`/crm/accounts/${acc.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-rihla font-bold flex items-center gap-1 mt-1 hover:underline">
                            <Building2 size={10} /> {acc.name}
                          </Link>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[12px] font-extrabold text-slate-800 dark:text-cream">{fmtMad(d.amount_mad)} MAD</p>
                          <span className="text-[10px] text-slate-500">{d.probability}%</span>
                        </div>
                        {d.expected_close_date && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                            <Calendar size={10} /> {fmtDate(d.expected_close_date)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {deals.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-4">Vide</p>
                  )}
                  {/* + add button only on open columns */}
                  {(['qualification','proposal','negotiation'].includes(stage)) && (
                    <p className="text-[10px] text-slate-400 italic text-center py-2 flex items-center justify-center gap-1">
                      <Plus size={11} /> Glissez ici
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CrmPipelinePage
