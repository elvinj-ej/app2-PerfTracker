import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { listEngineers } from '../api/engineers'
import { getEngineerDashboard } from '../api/reports'
import { listTimeEntries, upsertTimeEntry } from '../api/timeEntries'
import { useActor } from '../context/ActorContext'

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const dayIndex = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dayIndex)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeeklyTimeEntryPage() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const { data: engineers } = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })

  const [selectedEngineerId, setSelectedEngineerId] = useState<number | undefined>(
    actor.role === 'engineer' ? actor.engineerId : undefined,
  )
  useEffect(() => {
    if (actor.role === 'engineer') {
      setSelectedEngineerId(actor.engineerId)
    } else if (selectedEngineerId === undefined && engineers && engineers.length > 0) {
      setSelectedEngineerId(engineers[0].id)
    }
  }, [actor, engineers, selectedEngineerId])

  const [weekStart, setWeekStart] = useState(mondayOf(todayIso()))

  const dashboardQuery = useQuery({
    queryKey: ['engineer-dashboard', selectedEngineerId],
    queryFn: () => getEngineerDashboard(actor, selectedEngineerId as number),
    enabled: selectedEngineerId !== undefined,
  })
  const entriesQuery = useQuery({
    queryKey: ['time-entries', selectedEngineerId],
    queryFn: () => listTimeEntries(actor, { engineerId: selectedEngineerId }),
    enabled: selectedEngineerId !== undefined,
  })

  const entriesByTask = useMemo(() => {
    const map = new Map<number, number>()
    for (const entry of entriesQuery.data ?? []) {
      if (entry.week_start_date === weekStart) map.set(entry.task_id, entry.hours)
    }
    return map
  }, [entriesQuery.data, weekStart])

  const [draftHours, setDraftHours] = useState<Record<number, string>>({})

  const saveMutation = useMutation({
    mutationFn: (taskId: number) =>
      upsertTimeEntry(actor, {
        task_id: taskId,
        week_start_date: weekStart,
        hours: Number(draftHours[taskId] ?? entriesByTask.get(taskId) ?? 0),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', selectedEngineerId] })
      queryClient.invalidateQueries({ queryKey: ['engineer-dashboard', selectedEngineerId] })
    },
  })

  const tasks = dashboardQuery.data?.tasks ?? []

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Log Weekly Time</h1>
        <label>
          Engineer
          <select
            value={selectedEngineerId ?? ''}
            onChange={(e) => setSelectedEngineerId(Number(e.target.value))}
            disabled={actor.role === 'engineer'}
          >
            {(engineers ?? []).map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Week starting
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} />
        </label>
      </div>

      <section className="card">
        <h2>My Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-muted">No tasks assigned.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Initiative</th>
                  <th>Hours this week</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.title}</td>
                    <td>{task.initiative_title}</td>
                    <td>
                      <input
                        type="number"
                        className="input-narrow"
                        value={draftHours[task.id] ?? entriesByTask.get(task.id) ?? ''}
                        onChange={(e) => setDraftHours((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        onClick={() => saveMutation.mutate(task.id)}
                        disabled={saveMutation.isPending}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
