'use client'

import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  GraduationCap,
  Play,
  Wallet,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useStudy } from '@/lib/study-context'
import { Category, reviewedQuestionCount, sessionStats } from '@/lib/study-models'
import { Badge, Button, Progress } from './ui'

export const categoryColors: Record<string, { soft: string; ink: string; bar: string }> = {
  indigo: { soft: 'bg-primary-soft', ink: 'text-primary', bar: 'bg-primary' },
  blue: { soft: 'bg-blue-soft', ink: 'text-blue-ink', bar: 'bg-blue-ink' },
  purple: { soft: 'bg-violet-soft', ink: 'text-violet-ink', bar: 'bg-violet-ink' },
  orange: { soft: 'bg-orange-soft', ink: 'text-orange-ink', bar: 'bg-orange-ink' },
  green: { soft: 'bg-green-soft', ink: 'text-green-ink', bar: 'bg-green-ink' },
  rose: { soft: 'bg-rose-soft', ink: 'text-rose-ink', bar: 'bg-rose-ink' },
}

export function CategoryIcon({
  category,
  size = 21,
  className = '',
}: {
  category: Category
  size?: number
  className?: string
}) {
  const colors = categoryColors[category.color] || categoryColors.indigo
  const Icon =
    {
      book: BookOpen,
      clipboard: ClipboardList,
      brain: Brain,
      graduation: GraduationCap,
      wallet: Wallet,
      chart: ChartNoAxesCombined,
    }[category.icon] || BookOpen
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${colors.soft} ${colors.ink} ${className}`}
    >
      <Icon size={size} strokeWidth={1.7} />
    </span>
  )
}

export function relativeDate(value?: number) {
  if (!value) return 'Not studied yet'
  const days = Math.floor((Date.now() - value) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function CategoryCard({
  category,
  onStart,
  flashcardMode = false,
}: {
  category: Category
  onStart: (category: Category) => void
  flashcardMode?: boolean
}) {
  const router = useRouter()
  const { data, setActiveSessionId } = useStudy()
  const completed = reviewedQuestionCount(data.sessions, category.id)
  const progress = Math.min(
    100,
    Math.round((completed / Math.max(category.questionCount, 1)) * 100),
  )
  const sessions = Object.values(data.sessions)
    .filter((s) => s.categoryId === category.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  const last = sessions.find((s) => s.status === 'completed')
  const unfinished = sessions.find((s) => s.status === 'in-progress')
  const colors = categoryColors[category.color] || categoryColors.indigo
  function continueSession() {
    if (unfinished && (!flashcardMode || unfinished.mode === 'flashcard')) {
      setActiveSessionId(unfinished.id)
      router.push('/study')
    } else onStart(category)
  }
  return (
    <article className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-[0_2px_3px_-2px_rgba(25,25,55,.03)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md hover:shadow-primary/5">
      <div className="mb-4 flex items-center justify-between">
        <CategoryIcon category={category} />
        <Badge className="border border-line bg-canvas text-subtle">
          {category.questionCount} questions
        </Badge>
      </div>
      <button className="text-left" onClick={() => router.push(`/categories/${category.id}`)}>
        <h3 className="font-display text-[15px] leading-6 font-bold tracking-tight text-ink transition-colors group-hover:text-primary">
          {category.title}
        </h3>
      </button>
      <p className="mt-2 min-h-12 text-[12px] leading-[1.8] text-subtle">{category.description}</p>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-[11px]">
          <span className="text-subtle">Your progress</span>
          <span className="font-semibold text-ink">
            {progress}
            <span className="font-normal text-subtle">% complete</span>
          </span>
        </div>
        <Progress value={progress} color={colors.bar} />
        <div className="mt-3 flex items-center justify-between text-[10px] text-subtle">
          <span>
            Last score{' '}
            <span className={`ml-1.5 font-semibold ${last ? 'text-ink' : 'text-faint'}`}>
              {last ? `${sessionStats(last).percent}%` : '—'}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Clock3 size={11} />
            {relativeDate(sessions[0]?.updatedAt)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
        <Button
          variant="secondary"
          className="min-h-9 flex-1 gap-1.5 px-2 py-2 text-[11px] hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
          onClick={continueSession}
        >
          {unfinished ? <Play size={12} /> : <BookOpen size={13} />}
          {unfinished ? 'Continue studying' : 'Start studying'}
          <ArrowRight className="ml-auto" size={13} />
        </Button>
      </div>
    </article>
  )
}
