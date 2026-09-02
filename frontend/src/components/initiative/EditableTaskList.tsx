import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useState } from 'react'
import { createTask, deleteTask, reorderTasks, updateTask, type TaskPayload } from '../../api/tasks'
import { useActor } from '../../context/ActorContext'
import type { Engineer, Task } from '../../types/api'

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
  const [bulkMode, setBulkMode] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [bulkTitles, setBulkTitles] = useState('')
  const [newOwnerId, setNewOwnerId] = useState(actor.role === 'engineer' ? String(actor.engineerId) : '')
  const [newForecast, setNewForecast] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newDeliveryDate, setNewDeliveryDate] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey })

  const updateMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Partial<TaskPayload> }) =>
      updateTask(actor, taskId, payload),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => deleteTask(actor, taskId),
    onSuccess: invalidate,
  })

  function buildPayload(title: string): TaskPayload {
    return {
      title,
      owner_engineer_id: newOwnerId ? Number(newOwnerId) : null,
      forecast_duration_days: newForecast ? Number(newForecast) : null,
      start_date: newStartDate || null,
      delivery_date: newDeliveryDate || null,
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: TaskPayload) => createTask(actor, initiativeId, payload),
    onSuccess: () => {
      invalidate()
      setNewTitle('')
      setNewOwnerId('')
      setNewForecast('')
      setNewStartDate('')
      setNewDeliveryDate('')
    },
  })
  const bulkCreateMutation = useMutation({
    mutationFn: (titles: string[]) => Promise.all(titles.map((title) => createTask(actor, initiativeId, buildPayload(title)))),
    onSuccess: () => setBulkTitles(''),
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
    onSuccess: invalidate,
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
        An Outcome answers the initiative's Ask. Delivery must land within two weeks of the start
        date, and both dates must fall on a Wednesday — split larger work into multiple Outcomes.
        Working through a list of similar items (servers, UPS units, ...)? Use "Add multiple at
        once" below to create one Outcome per item in a single step.
      </p>
      {generateMutation.isError && (
        <p className="text-error">{(generateMutation.error as Error).message}</p>
      )}
      {(updateMutation.isError || createMutation.isError || bulkCreateMutation.isError) && (
        <p className="text-error">
          {((updateMutation.error ?? createMutation.error ?? bulkCreateMutation.error) as Error).message}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-muted">No outcomes yet.</p>
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
                <th>Start Date</th>
                <th>Delivery Date</th>
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
                    <input
                      type="date"
                      defaultValue={task.start_date ?? ''}
                      onBlur={(e) => {
                        const value = e.target.value === '' ? null : e.target.value
                        updateMutation.mutate({ taskId: task.id, payload: { start_date: value } })
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      defaultValue={task.delivery_date ?? ''}
                      onBlur={(e) => {
                        const value = e.target.value === '' ? null : e.target.value
                        updateMutation.mutate({ taskId: task.id, payload: { delivery_date: value } })
                      }}
                    />
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
                    <button className="btn-icon" onClick={() => deleteMutation.mutate(task.id)}>
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
                placeholder="Forecast days (each)"
                className="input-narrow"
                value={newForecast}
                onChange={(e) => setNewForecast(e.target.value)}
              />
            )}
            <label>
              Start
              <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
            </label>
            <label>
              Delivery
              <input type="date" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)} />
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
              placeholder="Forecast days"
              className="input-narrow"
              value={newForecast}
              onChange={(e) => setNewForecast(e.target.value)}
            />
          )}
          <label>
            Start
            <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
          </label>
          <label>
            Delivery
            <input type="date" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)} />
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
