import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { createTask, deleteTask, reorderTasks, updateTask, type TaskPayload } from '../../api/tasks'
import { getSprints } from '../../api/sprints'
import { Alert } from '../common/Alert'
import { useActor } from '../../context/ActorContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import type { Engineer, Sprint, Task } from '../../types/api'
import { MAX_FORECAST_DAYS } from '../../data/sprintConstants'

interface Props {
  initiativeId: number
  tasks: Task[]
  engineers: Engineer[]
  onGenerateBreakdown?: () => Promise<unknown>
  showForecast?: boolean
  invalidateKey: QueryKey
}

const STATUS_OPTIONS: { value: Task['status']; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'COMPLETE', label: 'Complete' },
]

export function EditableTaskList({
  initiativeId,
  tasks,
  engineers,
  onGenerateBreakdown,
  showForecast = true,
  invalidateKey,
}: Props) {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()
  const [bulkMode, setBulkMode] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [bulkTitles, setBulkTitles] = useState('')
  const [newOwnerId, setNewOwnerId] = useState(actor.role === 'engineer' ? String(actor.engineerId) : '')
  const [newForecast, setNewForecast] = useState('')
  const [newSprint, setNewSprint] = useState('')

  const { data: sprints } = useQuery({ queryKey: ['sprints'], queryFn: () => getSprints(actor) })
  const currentSprint = sprints?.find((s) => s.is_current)

  useEffect(() => {
    if (!newSprint && currentSprint) setNewSprint(String(currentSprint.number))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSprint])

  function sprintLabel(s: Sprint): string {
    return `${s.label} — ${s.start_date} – ${s.end_date}`
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      updateTask(actor, taskId, payload),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(actor, taskId),
    onSuccess: () => {
      invalidate()
      toast.success('Outcome deleted')
    },
  })

  async function handleDelete(task: Task) {
    const confirmed = await confirm(`Delete "${task.title}"? This can't be undone.`, {
      title: 'Delete this Outcome?',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (confirmed) deleteMutation.mutate(task.id)
  }

  function buildPayload(title: string): TaskPayload {
    return {
      title,
      owner_engineer_id: newOwnerId ? Number(newOwnerId) : null,
      forecast_duration_days: newForecast ? Number(newForecast) : null,
      sprint_number: newSprint ? Number(newSprint) : null,
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: TaskPayload) => createTask(actor, initiativeId, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Outcome added')
      setNewTitle('')
      setNewOwnerId('')
      setNewForecast('')
      setNewSprint(currentSprint ? String(currentSprint.number) : '')
    },
  })
  const bulkCreateMutation = useMutation({
    mutationFn: (titles: string[]) => Promise.all(titles.map((title) => createTask(actor, initiativeId, buildPayload(title)))),
    onSuccess: (created) => {
      setBulkTitles('')
      toast.success(`${created.length} Outcome${created.length === 1 ? '' : 's'} added`)
    },
    // Even a partially-failed batch may have created some Outcomes already (Promise.all
    // rejects on the first error, but earlier requests already landed) - always refresh
    // so the list reflects whatever actually got created.
    onSettled: invalidate,
  })
  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => reorderTasks(actor, initiativeId, ids),
    onSuccess: invalidate,
  })
  const generateMutation = useMutation({
    mutationFn: () => onGenerateBreakdown!(),
    onSuccess: (created) => {
      invalidate()
      const count = Array.isArray(created) ? created.length : undefined
      toast.success(count !== undefined ? `${count} Outcome${count === 1 ? '' : 's'} generated` : 'Breakdown generated')
    },
  })

  const sorted = [...tasks].sort((a, b) => a.sequence_order - b.sequence_order)
  const bulkLines = bulkTitles
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const reordered = [...sorted]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    reorderMutation.mutate(reordered.map((t) => t.id))
  }

  return (
    <section className="card">
      <div className="card-header-row">
        <h2>Outcomes</h2>
        {onGenerateBreakdown && (
          <button className="btn btn-secondary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Generating…' : 'Generate AI Breakdown'}
          </button>
        )}
      </div>
      <p className="text-muted">
        An Outcome answers the initiative's Ask. Pick a sprint (Sx) for delivery — start and end
        dates are set automatically — and a forecast of up to {MAX_FORECAST_DAYS} working days for
        that sprint. Working through a list of similar items (servers, UPS units, ...)? Use "Add
        multiple at once" below to create one Outcome per item in a single step. Generated or
        bulk-created Outcomes start Unassigned — an engineer claims the ones they want via the
        Owner column.
      </p>
      {generateMutation.isError && (
        <Alert variant="error">{(generateMutation.error as Error).message}</Alert>
      )}
      {(updateMutation.isError || createMutation.isError || bulkCreateMutation.isError) && (
        <Alert variant="error">
          {((updateMutation.error ?? createMutation.error ?? bulkCreateMutation.error) as Error).message}
        </Alert>
      )}

      {sorted.length === 0 ? (
        <p className="text-muted">
          No outcomes yet — add one with the form below
          {onGenerateBreakdown ? ', or generate a suggested breakdown above.' : '.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Stage</th>
                <th>Owner</th>
                {showForecast && <th>Forecast (days)</th>}
                <th>Sprint</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((task, index) => (
                <tr key={task.id}>
                  <td>
                    <button className="btn-icon" onClick={() => move(index, -1)} disabled={index === 0}>
                      ↑
                    </button>
                    <button className="btn-icon" onClick={() => move(index, 1)} disabled={index === sorted.length - 1}>
                      ↓
                    </button>
                  </td>
                  <td>
                    {task.title}
                    {task.is_ai_generated && <span className="badge badge-gray badge-inline">AI</span>}
                  </td>
                  <td>{task.stage ?? '—'}</td>
                  <td>
                    <select
                      value={task.owner_engineer_id ?? ''}
                      onChange={(e) =>
                        updateMutation.mutate({
                          taskId: task.id,
                          payload: { owner_engineer_id: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {engineers.map((eng) => (
                        <option key={eng.id} value={eng.id}>
                          {eng.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {showForecast && (
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={MAX_FORECAST_DAYS}
                        className="input-narrow"
                        defaultValue={task.forecast_duration_days ?? ''}
                        onBlur={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value)
                          updateMutation.mutate({ taskId: task.id, payload: { forecast_duration_days: value } })
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <select
                      value={task.sprint_number ?? ''}
                      onChange={(e) =>
                        updateMutation.mutate({
                          taskId: task.id,
                          payload: { sprint_number: e.target.value ? Number(e.target.value) : null },
                        })
                      }
                    >
                      <option value="">Unscheduled</option>
                      {(sprints ?? []).map((s) => (
                        <option key={s.number} value={s.number}>
                          {sprintLabel(s)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={task.status}
                      onChange={(e) => updateMutation.mutate({ taskId: task.id, payload: { status: e.target.value } })}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn-icon" aria-label={`Delete ${task.title}`} onClick={() => handleDelete(task)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="outcomes-toggle-row">
        <button className="btn-link" onClick={() => setBulkMode(!bulkMode)}>
          {bulkMode ? 'Add one at a time' : 'Add multiple at once'}
        </button>
      </div>

      {bulkMode ? (
        <div className="add-task-form add-task-form-bulk">
          <textarea
            className="bulk-outcome-input"
            rows={4}
            placeholder={'One Outcome per line, e.g.\nWIN-DC-01\nWIN-DC-02\nWIN-DC-03'}
            value={bulkTitles}
            onChange={(e) => setBulkTitles(e.target.value)}
          />
          <div className="add-task-form">
            <select value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
              <option value="">Owner…</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
            </select>
            {showForecast && (
              <input
                type="number"
                min={0}
                max={MAX_FORECAST_DAYS}
                placeholder="Forecast days (each)"
                className="input-narrow"
                value={newForecast}
                onChange={(e) => setNewForecast(e.target.value)}
              />
            )}
            <label>
              Sprint
              <select value={newSprint} onChange={(e) => setNewSprint(e.target.value)}>
                <option value="">Unscheduled</option>
                {(sprints ?? []).map((s) => (
                  <option key={s.number} value={s.number}>
                    {sprintLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn btn-primary"
              disabled={bulkLines.length === 0 || !newOwnerId || bulkCreateMutation.isPending}
              onClick={() => bulkCreateMutation.mutate(bulkLines)}
            >
              {bulkCreateMutation.isPending
                ? 'Adding…'
                : `Add ${bulkLines.length || ''} Outcome${bulkLines.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="add-task-form">
          <input placeholder="New outcome title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <select value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
            <option value="">Owner…</option>
            {engineers.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
          {showForecast && (
            <input
              type="number"
              min={0}
              max={MAX_FORECAST_DAYS}
              placeholder="Forecast days"
              className="input-narrow"
              value={newForecast}
              onChange={(e) => setNewForecast(e.target.value)}
            />
          )}
          <label>
            Sprint
            <select value={newSprint} onChange={(e) => setNewSprint(e.target.value)}>
              <option value="">Unscheduled</option>
              {(sprints ?? []).map((s) => (
                <option key={s.number} value={s.number}>
                  {sprintLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            disabled={!newTitle || !newOwnerId}
            onClick={() => createMutation.mutate(buildPayload(newTitle))}
          >
            Add Outcome
          </button>
        </div>
      )}
    </section>
  )
}
