'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  Check,
  Layers,
  Lightbulb,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react'
import { useStudy } from '@/lib/study-context'
import { friendlyError } from '@/lib/firebase'
import {
  Category,
  defaultSettings,
  hasResponse,
  latestAnswers,
  Question,
  QuestionFormat,
  SessionSettings,
  shuffled,
  StudyMode,
  StudySession,
  typeLabels,
} from '@/lib/study-models'
import { Badge, Button, Modal, Input, Select, Toggle } from './ui'
import { CategoryIcon } from './category-card'
import { answerFormats, presentationTypes, questionsForSession, selectedQuestions } from '@/lib/question-presentation'

const modes: { id: StudyMode; title: string; description: string; icon: typeof BookOpen }[] = [
  { id: 'practice', title: 'Practice', description: 'Learn with instant feedback', icon: BookOpen },
  { id: 'exam', title: 'Exam', description: 'Check answers at the end', icon: Timer },
  { id: 'flashcard', title: 'Flashcards', description: 'Flip, recall, and remember', icon: Layers },
  { id: 'mixed', title: 'Mixed study', description: 'A little of every format', icon: Sparkles },
]

export function SessionSettingsModal({
  category,
  onClose,
  initialMode,
  questionIds,
}: {
  category: Category
  onClose: () => void
  initialMode?: StudyMode
  questionIds?: string[]
}) {
  const { user, data, loadQuestions, commitSession, setActiveSessionId } = useStudy()
  const router = useRouter()
  const getDefaults = (): SessionSettings => ({
    ...defaultSettings,
    mode: initialMode || data.preferences.defaultStudyMode,
    instantFeedback: data.preferences.instantFeedback,
    showExplanations: data.preferences.showExplanations,
    types: category.types,
    count: questionIds ? questionIds.length : Math.min(10, category.questionCount),
    questionFormat: 'original',
  })
  const [settings, setSettings] = useState<SessionSettings>(getDefaults)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [custom, setCustom] = useState(false)
  const [reload, setReload] = useState(0)
  const [draftSessionId] = useState(() => crypto.randomUUID())
  const [chosenIds, setChosenIds] = useState<Set<string>>(() => new Set(questionIds ?? []))
  const [questionSearch, setQuestionSearch] = useState('')
  const [pickerPage, setPickerPage] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    loadQuestions(category.id)
      .then((value) => {
        if (alive) {
          setQuestions(value)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (alive) {
          setError(friendlyError(err))
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [category.id, user?.uid, reload])
  const eligible = useMemo(() => {
    const answers = latestAnswers(data.sessions, category.id)
    return questions.filter(
      (q) =>
        (!questionIds || questionIds.includes(q.id)) &&
        ((settings.questionFormat && settings.questionFormat !== 'original') || settings.types.includes(q.type)) &&
        (settings.filter === 'all' ||
          (settings.filter === 'unanswered' && !hasResponse(answers[q.id])) ||
          (settings.filter === 'bookmarked' && data.bookmarks[category.id]?.[q.id]) ||
          (settings.filter === 'incorrect' &&
            ['incorrect', 'partial', 'review-required'].includes(answers[q.id]?.status))),
    )
  }, [
    questions,
    settings.types,
    settings.questionFormat,
    settings.filter,
    data.sessions,
    data.bookmarks,
    category.id,
    questionIds,
  ])
  const manuallySelected = selectedQuestions(eligible, chosenIds)
  const count = custom ? manuallySelected.length : Math.min(settings.count, eligible.length)
  const matching = eligible.filter(q => `${q.originalNumber} ${q.question} ${q.topic}`.toLowerCase().includes(questionSearch.toLowerCase()))
  const pickerPages = Math.max(1, Math.ceil(matching.length / 8))
  const visiblePage = Math.min(pickerPage, pickerPages - 1)
  const shownQuestions = matching.slice(visiblePage * 8, (visiblePage + 1) * 8)
  const previewQuestions = Object.fromEntries(questionsForSession(questions, { id: draftSessionId, settings }).map(q => [q.id, q]))
  function change<K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value }))
  }
  async function start() {
    if (busy || !count || (!custom && (!Number.isInteger(settings.count) || settings.count < 1))) return
    setBusy(true)
    setError('')
    const candidates = custom ? manuallySelected : eligible
    const selected = (settings.randomize ? shuffled(candidates) : candidates).slice(0, count)
    const effectiveSettings = {
      ...settings,
      count,
      instantFeedback: settings.mode === 'exam' ? false : settings.instantFeedback,
    }
    const session: StudySession = {
      id: draftSessionId,
      categoryId: category.id,
      mode: settings.mode,
      settings: effectiveSettings,
      questionIds: selected.map((q) => q.id),
      currentQuestionIndex: 0,
      answers: {},
      choiceOrder: Object.fromEntries(
        selected.map(q => previewQuestions[q.id])
          .filter((q) => q.choices)
          .map((q) => [q.id, settings.shuffleChoices ? shuffled(q.choices!) : q.choices!]),
      ),
      status: 'in-progress',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      revision: 0,
      ...(selected[0]?.contentVersion ? { contentVersion: selected[0].contentVersion } : {}),
    }
    try {
      await commitSession(session)
      setActiveSessionId(session.id)
      onClose()
      router.push('/study')
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Session settings"
      onClose={() => {
        if (!busy) onClose()
      }}
      wide
    >
      <div className="space-y-6 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3">
          <CategoryIcon category={category} size={18} />
          <div>
            <p className="text-xs font-semibold">{category.title}</p>
            <p className="mt-1 text-[11px] text-subtle">
              {loading ? 'Loading question bank…' : `${questions.length} available questions`}
            </p>
          </div>
        </div>
        <fieldset>
          <legend className="mb-3 text-xs font-semibold">How would you like to study?</legend>
          <div className="grid grid-cols-2 gap-3">
            {modes.map((mode) => (
              <button
                key={mode.id}
                disabled={!category.enabledModes?.includes(mode.id)}
                onClick={() => change('mode', mode.id)}
                className={`relative rounded-xl border p-3.5 text-left transition-all disabled:opacity-35 ${settings.mode === mode.id ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-line hover:border-primary/30'}`}
              >
                <mode.icon
                  size={19}
                  className={settings.mode === mode.id ? 'text-primary' : 'text-subtle'}
                />
                <p className="mt-2.5 text-xs font-semibold">{mode.title}</p>
                <p className="mt-1 text-[10px] text-subtle">{mode.description}</p>
                {settings.mode === mode.id && (
                  <Check className="absolute right-3 top-3 text-primary" size={15} />
                )}
              </button>
            ))}
          </div>
        </fieldset>
        {settings.mode === 'exam' && (
          <p className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[11px] leading-5 text-warning">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            Exam mode is self-assessment, not a tamper-proof examination. Answer keys are accessible
            to authenticated database clients. Feedback appears only after submission.
          </p>
        )}
        {settings.mode === 'flashcard' && (
          <p className="flex gap-2 rounded-lg bg-primary-soft p-3 text-[11px] leading-5 text-primary">
            <Lightbulb size={16} className="mt-0.5 shrink-0" />
            These flashcards are derived presentations: the source question appears on the front and
            its supplied answer key on the back.
          </p>
        )}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold">Answer format</legend>
          <p className="mb-3 text-[11px] leading-5 text-subtle">Use the same questions in any format. Your selection applies to every question in this session.</p>
          <div className="flex flex-wrap gap-2">
            {answerFormats.map(({ id, label }) => {
              const checked = (settings.questionFormat ?? 'original') === id
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[11px] ${checked ? 'border-primary/30 bg-primary-soft text-primary' : 'border-line text-subtle'}`}
                >
                  <input
                    type="radio"
                    name="question-format"
                    className="accent-primary"
                    checked={checked}
                    onChange={() => setSettings(previous => ({ ...previous, questionFormat: id as QuestionFormat,
                      types: id === 'original' ? category.types : id === 'mixed' ? presentationTypes : [id] }))}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2.5 block text-xs font-semibold">How many questions?</label>
            <div className="flex gap-1.5">
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  disabled={eligible.length < n}
                  onClick={() => {
                    setCustom(false)
                    change('count', n)
                  }}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs disabled:opacity-30 ${!custom && settings.count === n ? 'border-primary bg-primary-soft text-primary' : 'border-line text-subtle'}`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => {
                  setCustom(false)
                  change('count', eligible.length)
                }}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs ${!custom && settings.count === eligible.length ? 'border-primary bg-primary-soft text-primary' : 'border-line text-subtle'}`}
              >
                All
              </button>
              <button
                onClick={() => { setCustom(true); setPickerPage(0) }}
                className={`rounded-lg border px-2 py-2 text-xs ${custom ? 'border-primary text-primary' : 'border-line text-subtle'}`}
              >
                Choose questions
              </button>
            </div>
            <p className="mt-2 text-[10px] text-subtle">
              {eligible.length} matching questions · {count} in this session
            </p>
          </div>
          <label className="block text-xs font-semibold">
            Include questions
            <Select
              value={settings.filter}
              onChange={(e) => change('filter', e.target.value as SessionSettings['filter'])}
              className="mt-2.5 w-full font-normal"
            >
              <option value="all">All questions</option>
              <option value="unanswered">Unanswered</option>
              <option value="bookmarked">Bookmarked</option>
              <option value="incorrect">Previously incorrect / needs review</option>
            </Select>
          </label>
        </div>
        {custom && <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-xs font-semibold">Choose your questions · {count} selected</legend>
          <Input aria-label="Search questions to select" placeholder="Search by question number, text, or topic" value={questionSearch}
            onChange={event => { setQuestionSearch(event.target.value); setPickerPage(0) }} />
          <div className="my-3 flex flex-wrap items-center gap-3 text-[11px]">
            <button className="font-semibold text-primary underline" onClick={() => setChosenIds(previous => new Set([...previous, ...matching.map(q => q.id)]))}>Select all matching ({matching.length})</button>
            <button className="text-subtle underline" onClick={() => setChosenIds(new Set())}>Clear selection</button>
            <span className="ml-auto text-subtle">{count} selected · {matching.length} matching</span>
          </div>
          <div className="space-y-2">
            {shownQuestions.map(q => { const preview = previewQuestions[q.id]; return <article key={q.id} className={`rounded-lg border p-3 ${chosenIds.has(q.id) ? 'border-primary/30 bg-primary-soft/40' : 'border-line'}`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 accent-primary" aria-label={`Select question ${q.originalNumber}`}
                  checked={chosenIds.has(q.id)} onChange={() => setChosenIds(previous => { const next = new Set(previous); if (next.has(q.id)) next.delete(q.id); else next.add(q.id); return next })} />
                <span className="min-w-0"><span className="block text-[10px] font-semibold text-primary">Question {q.originalNumber} · {typeLabels[preview.type]}</span><span className="mt-1 block text-xs leading-6 text-ink">{q.question}</span></span>
              </label>
              <details className="ml-7 mt-2 text-[11px] text-subtle"><summary className="cursor-pointer text-primary">Preview question</summary>
                {preview.proposedAnswer && <p className="mt-2 rounded bg-canvas p-2 leading-5"><strong>Proposed answer:</strong> {preview.proposedAnswer}<br />Is this answer correct?</p>}
                {preview.choices && <ul className="mt-2 list-inside list-[upper-alpha] space-y-1">{preview.choices.map((choice,index) => <li key={index}>{choice}</li>)}</ul>}
                {!preview.choices && <p className="mt-2">{preview.type === 'enumeration' ? 'Enter each answer separately.' : 'Type your answer.'}</p>}
              </details>
            </article> })}
            {!matching.length && <p className="py-5 text-center text-xs text-subtle">No questions match this search.</p>}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-subtle">
            <button disabled={visiblePage === 0} className="rounded border border-line px-3 py-2 disabled:opacity-40" onClick={() => setPickerPage(visiblePage - 1)}>Previous</button>
            <span>Page {visiblePage + 1} of {pickerPages}</span>
            <button disabled={visiblePage + 1 >= pickerPages} className="rounded border border-line px-3 py-2 disabled:opacity-40" onClick={() => setPickerPage(visiblePage + 1)}>Next</button>
          </div>
        </fieldset>}
        <div className="divide-y divide-line border-t border-line">
          <Toggle
            label="Randomize question order"
            description="A different sequence each session"
            checked={settings.randomize}
            onChange={(v) => change('randomize', v)}
          />
          {settings.mode !== 'flashcard' && (
            <>
              <Toggle
                label="Shuffle answer choices"
                checked={settings.shuffleChoices}
                onChange={(v) => change('shuffleChoices', v)}
              />
              {settings.mode !== 'exam' && (
                <>
                  <Toggle
                    label="Instant answer feedback"
                    description="Learn from each answer before moving on"
                    checked={settings.instantFeedback}
                    onChange={(v) => change('instantFeedback', v)}
                  />
                  <Toggle
                    label="Show explanations"
                    checked={settings.showExplanations}
                    onChange={(v) => change('showExplanations', v)}
                  />
                </>
              )}
            </>
          )}
          <Toggle
            label="Session timer"
            description="Track a time limit for focused practice"
            checked={settings.timer}
            onChange={(v) => change('timer', v)}
          />
          {settings.timer && (
            <label className="flex items-center justify-between pt-3 text-xs">
              Time limit (minutes)
              <Input
                type="number"
                aria-label="Time limit in minutes"
                min={1}
                max={180}
                value={settings.durationMinutes}
                onChange={(e) =>
                  change('durationMinutes', Math.max(1, Math.min(180, Number(e.target.value))))
                }
                className="w-24"
              />
            </label>
          )}
        </div>
        {error && (
          <div role="alert" className="rounded-lg bg-danger-soft p-3 text-xs text-danger">
            {error}{' '}
            <button
              className="ml-1 underline"
              onClick={() => {
                setError('')
                setReload((r) => r + 1)
              }}
            >
              Retry loading
            </button>
          </div>
        )}
        {!loading && !count && (
          <p className="rounded-lg bg-warning-soft p-3 text-xs leading-5 text-warning">
            {custom ? 'Select at least one question to start your session.' : 'No questions match these settings. Include all questions or choose another filter.'}
          </p>
        )}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
        <Button
          variant="ghost"
          className="px-0 text-[11px]"
          disabled={busy}
          onClick={() => {
            setSettings(getDefaults())
            setCustom(false)
            setChosenIds(new Set(questionIds ?? []))
            setQuestionSearch('')
          }}
        >
          <RotateCcw size={13} />
          Reset defaults
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={start}
            busy={busy}
            disabled={loading || !count || (!custom && (settings.count < 1 || !Number.isInteger(settings.count)))}
          >
            {busy ? 'Saving session…' : 'Start session'}
            {!busy && <ArrowRight size={15} />}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
