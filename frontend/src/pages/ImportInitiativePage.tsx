import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { previewJiraXmlImport } from '../api/initiativeImport'
import { createKbi } from '../api/kbis'
import { createPlatformInitiative, listPlatformCategories } from '../api/platformInitiatives'
import { useActor } from '../context/ActorContext'
import type { JiraImportPreview } from '../types/api'

type TargetType = 'KBI' | 'PLATFORM'

interface ReviewForm {
  title: string
  jira_number: string
  description: string
  business_goal: string
  start_date: string
  expected_delivery_date: string
  priority: string
  complexity: string
  status: string
  category_id: string
}

function formFromPreview(preview: JiraImportPreview): ReviewForm {
  return {
    title: preview.title,
    jira_number: preview.jira_number ?? '',
    description: preview.description ?? '',
    business_goal: preview.business_goal ?? '',
    start_date: preview.start_date ?? '',
    expected_delivery_date: preview.expected_delivery_date ?? '',
    priority: preview.priority ?? 'MEDIUM',
    complexity: 'MEDIUM',
    status: preview.suggested_status,
    category_id: '',
  }
}

export function ImportInitiativePage() {
  const { actor } = useActor()
  const queryClient = useQueryClient()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<JiraImportPreview | null>(null)
  const [form, setForm] = useState<ReviewForm | null>(null)
  const [targetType, setTargetType] = useState<TargetType>('KBI')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<{ to: string; label: string } | null>(null)

  const { data: categories } = useQuery({
    queryKey: ['platform-categories'],
    queryFn: () => listPlatformCategories(actor),
    enabled: targetType === 'PLATFORM',
  })

  const previewMutation = useMutation({
    mutationFn: (f: File) => previewJiraXmlImport(actor, f),
    onSuccess: (data) => {
      setPreview(data)
      setForm(formFromPreview(data))
      setPreviewError(null)
      setCreatedLink(null)
    },
    onError: (err) => setPreviewError(err instanceof Error ? err.message : 'Failed to parse file.'),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('Nothing to create yet.')
      const basePayload = {
        title: form.title,
        description: form.description || null,
        business_goal: form.business_goal || null,
        start_date: form.start_date || null,
        expected_delivery_date: form.expected_delivery_date || null,
        priority: form.priority || null,
        status: form.status,
      }
      if (targetType === 'KBI') {
        return { type: 'KBI' as const, result: await createKbi(actor, { ...basePayload, jira_number: form.jira_number || null, complexity: form.complexity || null }) }
      }
      if (!form.category_id) {
        throw new Error('Choose a category for the Platform Initiative.')
      }
      return {
        type: 'PLATFORM' as const,
        result: await createPlatformInitiative(actor, { ...basePayload, category_id: Number(form.category_id) }),
      }
    },
    onSuccess: ({ type, result }) => {
      if (type === 'KBI') {
        queryClient.invalidateQueries({ queryKey: ['kbis'] })
        setCreatedLink({ to: `/kbis/${result.id}`, label: 'View the new Key Business Initiative' })
      } else {
        queryClient.invalidateQueries({ queryKey: ['platform-initiatives'] })
        setCreatedLink({ to: `/platform-initiatives/${result.id}`, label: 'View the new Platform Initiative' })
      }
      setFile(null)
      setPreview(null)
      setForm(null)
    },
  })

  if (actor.role !== 'manager') {
    return (
      <div className="page">
        <p className="text-muted">Only a manager can import initiatives.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Import from Jira XML</h1>
      </div>

      <section className="card">
        <p className="text-muted">
          Upload a Jira single-issue XML export (open the issue in Jira, then Export → XML) to
          pre-fill a new initiative. You'll review every field, choose whether it becomes a Key
          Business Initiative or a Platform Initiative, and edit anything before it's created —
          nothing is saved until you click Create.
        </p>
        <div className="add-task-form">
          <input
            type="file"
            accept=".xml"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
              setForm(null)
              setCreatedLink(null)
            }}
          />
          <button
            className="btn btn-secondary"
            disabled={!file || previewMutation.isPending}
            onClick={() => file && previewMutation.mutate(file)}
          >
            {previewMutation.isPending ? 'Parsing…' : 'Preview Import'}
          </button>
        </div>
        {previewError && <p className="text-error">{previewError}</p>}
      </section>

      {createdLink && (
        <section className="card">
          <p>
            Created successfully. <Link to={createdLink.to}>{createdLink.label}</Link>
          </p>
        </section>
      )}

      {preview && form && (
        <section className="card">
          <h2>Review before creating</h2>
          {preview.skipped_linked_issues > 0 && (
            <p className="text-muted">
              Note: {preview.skipped_linked_issues} linked Jira issue(s) (Blocks/Relates/etc.) were
              not imported — this app has no equivalent concept.
            </p>
          )}

          <div className="import-type-toggle">
            <label>
              <input
                type="radio"
                name="target-type"
                checked={targetType === 'KBI'}
                onChange={() => setTargetType('KBI')}
              />
              Key Business Initiative
            </label>
            <label>
              <input
                type="radio"
                name="target-type"
                checked={targetType === 'PLATFORM'}
                onChange={() => setTargetType('PLATFORM')}
              />
              Platform Initiative
            </label>
          </div>

          <div className="form-grid">
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            {targetType === 'KBI' && (
              <input
                placeholder="Jira number"
                value={form.jira_number}
                onChange={(e) => setForm({ ...form, jira_number: e.target.value })}
              />
            )}
            <input
              placeholder="Business goal"
              value={form.business_goal}
              onChange={(e) => setForm({ ...form, business_goal: e.target.value })}
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <input
              type="date"
              value={form.expected_delivery_date}
              onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
            />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            {targetType === 'KBI' && (
              <select value={form.complexity} onChange={(e) => setForm({ ...form, complexity: e.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            )}
            {targetType === 'PLATFORM' && (
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Category…</option>
                {(categories ?? []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <textarea
            className="import-description"
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {createMutation.isError && (
            <p className="text-error">{(createMutation.error as Error).message}</p>
          )}

          <button
            className="btn btn-primary"
            disabled={!form.title || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending
              ? 'Creating…'
              : `Create ${targetType === 'KBI' ? 'Key Business Initiative' : 'Platform Initiative'}`}
          </button>
        </section>
      )}
    </div>
  )
}
