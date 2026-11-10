import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { previewJiraIssue } from '../api/initiativeImport'
import { createKbi, listKbiCategories, listKbis } from '../api/kbis'
import { createPlatformInitiative, listPlatformCategories, listPlatformInitiatives } from '../api/platformInitiatives'
import { listRecurringOps } from '../api/recurringOps'
import { getSprints } from '../api/sprints'
import { createTask } from '../api/tasks'
import { Alert } from '../components/common/Alert'
import { AskPicker, type AskOption } from '../components/common/AskPicker'
import { FormField } from '../components/common/FormField'
import { useActor } from '../context/ActorContext'
import { MAX_FORECAST_DAYS } from '../data/sprintConstants'
import { getStoredJiraToken, setStoredJiraToken } from '../data/jiraToken'
import type { JiraIssuePreview } from '../types/api'

type TargetType = 'KBI' | 'PLATFORM'

interface AskReviewForm {
  title: string
  jira_number: string
  description: string
  business_goal: string
  ask: string
  start_date: string
  expected_delivery_date: string
  priority: string
  complexity: string
  status: string
  category_id: string
}

interface OutcomeReviewForm {
  title: string
  description: string
  jira_number: string
  forecast: string
  sprintNumber: string
  status: string
  initiativeId: string
}

function askFormFromPreview(preview: JiraIssuePreview): AskReviewForm {
  return {
    title: preview.title,
    jira_number: preview.jira_number,
    description: preview.description ?? '',
    business_goal: preview.business_goal ?? '',
    ask: '',
    start_date: preview.start_date ?? '',
    expected_delivery_date: preview.expected_delivery_date ?? '',
    priority: preview.priority ?? 'MEDIUM',
    complexity: 'MEDIUM',
    status: preview.suggested_status ?? 'OPEN',
    category_id: '',
  }
}

const TASK_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'COMPLETE', label: 'Complete' },
]

function outcomeFormFromPreview(preview: JiraIssuePreview): OutcomeReviewForm {
  return {
    title: preview.title,
    description: preview.description ?? '',
    jira_number: preview.jira_number,
    forecast: '',
    sprintNumber: '',
    status: preview.suggested_task_status ?? 'NOT_STARTED',
    initiativeId: '',
  }
}

export function ImportInitiativePage() {
  const { actor } = useActor()
  const queryClient = useQueryClient()

  const [jiraToken, setJiraToken] = useState(getStoredJiraToken())
  const [issueInput, setIssueInput] = useState('')
  const [preview, setPreview] = useState<JiraIssuePreview | null>(null)
  const [askForm, setAskForm] = useState<AskReviewForm | null>(null)
  const [outcomeForm, setOutcomeForm] = useState<OutcomeReviewForm | null>(null)
  const [targetType, setTargetType] = useState<TargetType>('KBI')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<{ to: string; label: string } | null>(null)

  function handleTokenChange(value: string) {
    setJiraToken(value)
    setStoredJiraToken(value)
  }

  const { data: kbiCategories } = useQuery({
    queryKey: ['kbi-categories'],
    queryFn: () => listKbiCategories(actor),
    enabled: preview?.kind === 'INITIATIVE' && targetType === 'KBI',
  })
  const { data: platformCategories } = useQuery({
    queryKey: ['platform-categories'],
    queryFn: () => listPlatformCategories(actor),
    enabled: preview?.kind === 'INITIATIVE' && targetType === 'PLATFORM',
  })
  const categories = targetType === 'KBI' ? kbiCategories : platformCategories

  const { data: sprints } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => getSprints(actor),
    enabled: preview?.kind === 'OUTCOME',
  })
  const currentSprint = sprints?.find((s) => s.is_current)

  const { data: kbis } = useQuery({ queryKey: ['kbis'], queryFn: () => listKbis(actor), enabled: preview?.kind === 'OUTCOME' })
  const { data: platforms } = useQuery({
    queryKey: ['platform-initiatives'],
    queryFn: () => listPlatformInitiatives(actor),
    enabled: preview?.kind === 'OUTCOME',
  })
  const { data: runOps } = useQuery({
    queryKey: ['recurring-ops'],
    queryFn: () => listRecurringOps(actor),
    enabled: preview?.kind === 'OUTCOME',
  })
  const asksLoading = preview?.kind === 'OUTCOME' && (!kbis || !platforms || !runOps)

  const linkableAsks = useMemo(
    () => [
      ...(kbis ?? []).map((k) => ({
        id: k.id,
        title: k.title,
        path: `/kbis/${k.id}`,
        typeLabel: 'Change Business',
        categoryName: k.category?.name ?? null,
      })),
      ...(platforms ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        path: `/platform-initiatives/${p.id}`,
        typeLabel: 'Change Platform',
        categoryName: p.category?.name ?? null,
      })),
      ...(runOps ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        path: `/recurring-ops/${r.id}`,
        typeLabel: 'Run Operations',
        categoryName: r.category?.name ?? null,
      })),
    ],
    [kbis, platforms, runOps],
  )
  const askOptions: AskOption[] = linkableAsks.map(({ id, title, typeLabel, categoryName }) => ({
    id,
    title,
    typeLabel,
    categoryName,
  }))

  function resetAfterCreate() {
    setIssueInput('')
    setPreview(null)
    setAskForm(null)
    setOutcomeForm(null)
  }

  const previewMutation = useMutation({
    mutationFn: () => previewJiraIssue(actor, issueInput, jiraToken),
    onSuccess: (data) => {
      setPreview(data)
      setPreviewError(null)
      setCreatedLink(null)
      setAskForm(data.kind === 'INITIATIVE' ? askFormFromPreview(data) : null)
      setOutcomeForm(data.kind === 'OUTCOME' ? outcomeFormFromPreview(data) : null)
    },
    onError: (err) => {
      setPreview(null)
      setPreviewError(err instanceof Error ? err.message : 'Failed to fetch this issue from Jira.')
    },
  })

  const createAskMutation = useMutation({
    mutationFn: async () => {
      if (!askForm) throw new Error('Nothing to create yet.')
      const basePayload = {
        title: askForm.title,
        description: askForm.description || null,
        business_goal: askForm.business_goal || null,
        start_date: askForm.start_date || null,
        expected_delivery_date: askForm.expected_delivery_date || null,
        priority: askForm.priority || null,
        status: askForm.status,
      }
      if (!askForm.category_id) {
        throw new Error(`Choose a category for the ${targetType === 'KBI' ? 'Change Business' : 'Change Platform'} Ask.`)
      }
      if (targetType === 'KBI') {
        return {
          type: 'KBI' as const,
          result: await createKbi(actor, {
            ...basePayload,
            jira_number: askForm.jira_number || null,
            complexity: askForm.complexity || null,
            ask: askForm.ask || null,
            category_id: Number(askForm.category_id),
          }),
        }
      }
      return {
        type: 'PLATFORM' as const,
        result: await createPlatformInitiative(actor, { ...basePayload, category_id: Number(askForm.category_id) }),
      }
    },
    onSuccess: ({ type, result }) => {
      if (type === 'KBI') {
        queryClient.invalidateQueries({ queryKey: ['kbis'] })
        setCreatedLink({ to: `/kbis/${result.id}`, label: 'View the new Change Business' })
      } else {
        queryClient.invalidateQueries({ queryKey: ['platform-initiatives'] })
        setCreatedLink({ to: `/platform-initiatives/${result.id}`, label: 'View the new Change Platform' })
      }
      resetAfterCreate()
    },
  })

  const createOutcomeMutation = useMutation({
    mutationFn: async () => {
      if (!outcomeForm) throw new Error('Nothing to create yet.')
      if (!outcomeForm.initiativeId) throw new Error('Choose which Ask this Outcome belongs to.')
      return createTask(actor, Number(outcomeForm.initiativeId), {
        title: outcomeForm.title,
        description: outcomeForm.description || null,
        owner_engineer_id: null,
        forecast_duration_days: outcomeForm.forecast ? Number(outcomeForm.forecast) : null,
        jira_number: outcomeForm.jira_number || null,
        sprint_number: outcomeForm.sprintNumber ? Number(outcomeForm.sprintNumber) : null,
        status: outcomeForm.status,
      })
    },
    onSuccess: (task) => {
      const ask = linkableAsks.find((a) => a.id === task.initiative_id)
      queryClient.invalidateQueries({ queryKey: ['tasks', task.initiative_id] })
      setCreatedLink({ to: ask?.path ?? '/', label: 'View the Ask this Outcome was added to' })
      resetAfterCreate()
    },
  })

  if (actor.role !== 'manager') {
    return (
      <div className="page">
        <p className="text-muted">Only a manager can import from Jira.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Import from Jira</h1>
      </div>

      <section className="card">
        <div className="import-intro">
          <p className="text-muted">
            Paste a Jira issue URL or key to pull it in live — no export/upload needed. You'll review every field
            before anything is created.
          </p>
          <div className="import-how-it-works">
            <div className="import-how-it-works-item">
              <span className="badge badge-gray">Initiative</span>
              <span>→ a new Change Business or Change Platform Ask</span>
            </div>
            <div className="import-how-it-works-item">
              <span className="badge badge-gray">Epic / Story</span>
              <span>→ a new Outcome under an existing Ask you pick</span>
            </div>
          </div>
        </div>

        <div className="import-section">
          <FormField label="Jira Personal Access Token" hint="Stored only in this browser, sent only to Jira.">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="password"
                placeholder="Paste your token"
                value={jiraToken}
                onChange={(e) => handleTokenChange(e.target.value)}
              />
              {jiraToken && (
                <button type="button" className="btn-link" onClick={() => handleTokenChange('')}>
                  Forget
                </button>
              )}
            </div>
          </FormField>
          <details className="import-pat-help">
            <summary>Don't have a token yet? Here's how to create one</summary>
            <ol>
              <li>In Jira, click your avatar in the top-right corner, then open your <strong>Profile</strong>.</li>
              <li>
                Open the <strong>Personal Access Tokens</strong> tab (or go directly to{' '}
                <code>your-jira-url/plugins/servlet/pat</code>).
              </li>
              <li>
                Click <strong>Create token</strong>, give it a name like "AOSE import", and choose an expiry.
              </li>
              <li>Click <strong>Create</strong> — Jira shows the token once. Copy it right away.</li>
              <li>Paste it into the field above. It never leaves your browser except to talk to Jira directly.</li>
            </ol>
          </details>
        </div>

        <div className="import-section">
          <div className="import-source-row">
            <FormField label="Jira URL or issue key" hint="e.g. https://cltd-jira.cochlear.com/browse/IHT-14715 or IHT-14715">
              <input placeholder="IHT-14715" value={issueInput} onChange={(e) => setIssueInput(e.target.value)} />
            </FormField>
            <button
              className="btn btn-secondary"
              disabled={!issueInput || !jiraToken || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? 'Fetching…' : 'Fetch from Jira'}
            </button>
          </div>

          {previewError && <Alert variant="error">{previewError}</Alert>}
        </div>
      </section>

      {createdLink && (
        <section className="card">
          <p>
            Created successfully. <Link to={createdLink.to}>{createdLink.label}</Link>
          </p>
        </section>
      )}

      {preview && preview.kind === 'UNSUPPORTED' && (
        <Alert variant="error">
          "{preview.issue_type}" isn't a supported import type — only Initiative, Epic, and Story issues can be
          imported.
        </Alert>
      )}

      {preview && askForm && preview.kind === 'INITIATIVE' && (
        <section className="card">
          <h2>Review before creating</h2>
          {preview.skipped_linked_issues > 0 && (
            <p className="text-muted">
              Note: {preview.skipped_linked_issues} linked Jira issue(s) (Blocks/Relates/etc.) were not imported —
              this app has no equivalent concept.
            </p>
          )}

          <div className="import-type-toggle">
            <label>
              <input
                type="radio"
                name="target-type"
                checked={targetType === 'KBI'}
                onChange={() => {
                  setTargetType('KBI')
                  setAskForm({ ...askForm, category_id: '' })
                }}
              />
              Change Business
            </label>
            <label>
              <input
                type="radio"
                name="target-type"
                checked={targetType === 'PLATFORM'}
                onChange={() => {
                  setTargetType('PLATFORM')
                  setAskForm({ ...askForm, category_id: '' })
                }}
              />
              Change Platform
            </label>
          </div>

          <div className="form-grid">
            <FormField label="Ask" hint="What needs to be delivered">
              <input
                placeholder="Ask"
                value={askForm.title}
                onChange={(e) => setAskForm({ ...askForm, title: e.target.value })}
              />
            </FormField>
            {targetType === 'KBI' && (
              <FormField label="Jira Number" hint="From the imported issue">
                <input
                  placeholder="Jira number"
                  value={askForm.jira_number}
                  onChange={(e) => setAskForm({ ...askForm, jira_number: e.target.value })}
                />
              </FormField>
            )}
            <FormField label="Business Goal" hint="The outcome this needs to achieve">
              <input
                placeholder="Business goal"
                value={askForm.business_goal}
                onChange={(e) => setAskForm({ ...askForm, business_goal: e.target.value })}
              />
            </FormField>
            {targetType === 'KBI' && (
              <FormField label="Additional Ask Detail" hint="Optional - more on what the Hosting, Platform & Database Team needs to provide">
                <input
                  placeholder="Additional detail"
                  value={askForm.ask}
                  onChange={(e) => setAskForm({ ...askForm, ask: e.target.value })}
                />
              </FormField>
            )}
            <FormField label="Start Date" hint="When work begins">
              <input
                type="date"
                value={askForm.start_date}
                onChange={(e) => setAskForm({ ...askForm, start_date: e.target.value })}
              />
            </FormField>
            <FormField label="Expected Delivery" hint="Target completion date">
              <input
                type="date"
                value={askForm.expected_delivery_date}
                onChange={(e) => setAskForm({ ...askForm, expected_delivery_date: e.target.value })}
              />
            </FormField>
            <FormField label="Priority" hint="How urgent this is">
              <select value={askForm.priority} onChange={(e) => setAskForm({ ...askForm, priority: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </FormField>
            {targetType === 'KBI' && (
              <FormField label="Complexity" hint="Expected effort/difficulty">
                <select value={askForm.complexity} onChange={(e) => setAskForm({ ...askForm, complexity: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </FormField>
            )}
            <FormField
              label="Category"
              hint={targetType === 'KBI' ? 'Which Change Business area this belongs to' : 'Upgrade type, improvement, automation, etc.'}
            >
              <select value={askForm.category_id} onChange={(e) => setAskForm({ ...askForm, category_id: e.target.value })}>
                <option value="">Category…</option>
                {(categories ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" hint="Current state of the initiative">
              <select value={askForm.status} onChange={(e) => setAskForm({ ...askForm, status: e.target.value })}>
                <option value="DRAFT">Draft</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </FormField>
          </div>

          <FormField label="Description" hint="Full details, imported from Jira and editable">
            <textarea
              className="import-description"
              rows={6}
              value={askForm.description}
              onChange={(e) => setAskForm({ ...askForm, description: e.target.value })}
            />
          </FormField>

          {createAskMutation.isError && <Alert variant="error">{(createAskMutation.error as Error).message}</Alert>}

          <button
            className="btn btn-primary"
            disabled={!askForm.title || !askForm.category_id || createAskMutation.isPending}
            onClick={() => createAskMutation.mutate()}
          >
            {createAskMutation.isPending ? 'Creating…' : `Create ${targetType === 'KBI' ? 'Change Business' : 'Change Platform'}`}
          </button>
        </section>
      )}

      {preview && outcomeForm && preview.kind === 'OUTCOME' && (
        <section className="card">
          <h2>Review before creating</h2>
          <p className="text-muted">
            Jira issue type: <strong>{preview.issue_type}</strong> — this will become a new Outcome under an
            existing Ask.
          </p>
          {preview.skipped_linked_issues > 0 && (
            <p className="text-muted">
              Note: {preview.skipped_linked_issues} linked Jira issue(s) were not imported — this app has no
              equivalent concept.
            </p>
          )}

          <div className="form-grid">
            <FormField label="Outcome" hint="What this piece of work delivers">
              <input
                placeholder="Outcome title"
                value={outcomeForm.title}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, title: e.target.value })}
              />
            </FormField>
            <FormField label="Jira Number" hint="From the imported issue">
              <input
                placeholder="Jira number"
                value={outcomeForm.jira_number}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, jira_number: e.target.value })}
              />
            </FormField>
            <FormField label="Ask" hint="Which existing Ask this Outcome belongs to">
              <AskPicker
                options={askOptions}
                loading={asksLoading}
                value={outcomeForm.initiativeId}
                onChange={(id) => setOutcomeForm({ ...outcomeForm, initiativeId: id })}
              />
            </FormField>
            <FormField label="Forecast (days)" hint={`Up to ${MAX_FORECAST_DAYS} working days in the sprint`}>
              <input
                type="number"
                min={0}
                max={MAX_FORECAST_DAYS}
                value={outcomeForm.forecast}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, forecast: e.target.value })}
              />
            </FormField>
            <FormField label="Sprint" hint="Delivery window">
              <select
                value={outcomeForm.sprintNumber || (currentSprint ? String(currentSprint.number) : '')}
                onChange={(e) => setOutcomeForm({ ...outcomeForm, sprintNumber: e.target.value })}
              >
                <option value="">Unscheduled</option>
                {(sprints ?? []).map((s) => (
                  <option key={s.number} value={s.number}>
                    {s.label} — {s.start_date} – {s.end_date}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" hint="Current state of the Outcome">
              <select value={outcomeForm.status} onChange={(e) => setOutcomeForm({ ...outcomeForm, status: e.target.value })}>
                {TASK_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Description" hint="Full details, imported from Jira and editable">
            <textarea
              className="import-description"
              rows={6}
              value={outcomeForm.description}
              onChange={(e) => setOutcomeForm({ ...outcomeForm, description: e.target.value })}
            />
          </FormField>

          {createOutcomeMutation.isError && <Alert variant="error">{(createOutcomeMutation.error as Error).message}</Alert>}

          <button
            className="btn btn-primary"
            disabled={!outcomeForm.title || !outcomeForm.initiativeId || createOutcomeMutation.isPending}
            onClick={() => createOutcomeMutation.mutate()}
          >
            {createOutcomeMutation.isPending ? 'Creating…' : 'Create Outcome'}
          </button>
        </section>
      )}
    </div>
  )
}
