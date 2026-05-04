/**
 * Command Palette (Cmd+K / Ctrl+K)
 * Recherche globale fuzzy sur toute la navigation du sidebar
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Command } from 'lucide-react'
import { ALL_GROUPS as NAV_GROUPS_ALL } from '../lib/roleConfig'

interface Item {
  to: string
  label: string
  group: string
}

// Flatten all nav items across all groups
function allItems(): Item[] {
  const out: Item[] = []
  for (const g of NAV_GROUPS_ALL) {
    for (const it of g.items) {
      out.push({ to: it.to, label: it.label, group: g.label })
    }
  }
  return out
}

// Simple fuzzy score: higher = better. Returns -1 if no match.
function fuzzyScore(hay: string, needle: string): number {
  if (!needle) return 0
  hay = hay.toLowerCase()
  needle = needle.toLowerCase()
  if (hay.includes(needle)) return 1000 - hay.indexOf(needle)
  let hi = 0, score = 0, streak = 0
  for (const ch of needle) {
    const idx = hay.indexOf(ch, hi)
    if (idx === -1) return -1
    streak = idx === hi ? streak + 1 : 1
    score += streak
    hi = idx + 1
  }
  return score
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const items = useMemo(() => allItems(), [])

  const results = useMemo(() => {
    if (!q.trim()) return items.slice(0, 30)
    return items
      .map(it => ({ it, s: Math.max(fuzzyScore(it.label, q), fuzzyScore(it.group, q), fuzzyScore(it.to, q)) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map(r => r.it)
  }, [q, items])

  // Global hotkey
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 20)
    }
  }, [open])

  useEffect(() => { setCursor(0) }, [q])

  if (!open) return null

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(c => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(c => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[cursor]
      if (r) go(r.to)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[640px] max-w-[92vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
          <Search size={16} className="text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Rechercher dans toute l'app…"
            className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
            <Command size={10} /> K
          </span>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              Aucun résultat pour "{q}"
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.to + i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(r.to)}
              className={
                'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ' +
                (i === cursor
                  ? 'bg-rihla/10 dark:bg-rihla/20'
                  : 'hover:bg-slate-50 dark:hover:bg-white/5')
              }
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {r.label}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  {r.group} · {r.to}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">↓</kbd> naviguer</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">↵</kbd> ouvrir</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono">Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  )
}
