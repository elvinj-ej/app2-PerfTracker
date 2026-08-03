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
  const [newTitle, setNewTitle] = useState('')
  const [newOwnerId, setNewOwnerId] = useState('')
  const [newForecast, setNewForecast] = useState('')

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
  const createMutation = useMutation({
    mutationFn: (payload: TaskPayload) => createTask(actor, initiativeId, payload),
    onSuccess: () => {
      invalidate()
      setNewTitle('')
      setNewOwnerId('')
      setNewForecast('')
    },
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
        <h2>Tasks</h2>
        {onGenerateBreakdown && (
          <button className="btn btn-secondary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Generating…' : 'Generate AI Breakdown'}
          </button>
        )}
      </div>
      {generateMutation.isError && (
        <p className="text-error">{(generateMutation.error as Error).message}</p>
      )}

      {sorted.length === 0 ? (
        <p className="text-muted">No tasks yet.</p>
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
                      value={task.owner_engineer_id}
                      onChange={(e) =>
                        updateMutation.mutate({ taskId: task.id, payload: { owner_engineer_id: Number(e.target.value) } })
                      }
                    >
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

      <div className="add-task-form">
        <input placeholder="New task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
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
        <button
          className="btn btn-primary"
          disabled={!newTitle || !newOwnerId}
          onClick={() =>
            createMutation.mutate({
              title: newTitle,
              owner_engineer_id: Number(newOwnerId),
              forecast_duration_days: newForecast ? Number(newForecast) : null,
            })
          }
        >
          Add Task
        </button>
      </div>
    </section>
  )
}
