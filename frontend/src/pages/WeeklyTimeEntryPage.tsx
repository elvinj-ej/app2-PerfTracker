import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEngineers } from '../api/engineers'
import { getEngineerDashboard } from '../api/reports'
import { getSprints } from '../api/sprints'
import { listTimeEntries, upsertTimeEntry } from '../api/timeEntries'
import { Alert } from '../components/common/Alert'
import { useActor } from '../context/ActorContext'
import { useToast } from '../context/ToastContext'

export function WeeklyTimeEntryPage() {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: engineers } = useQuery({ queryKey: ['engineers'], queryFn: () => listEngineers(actor) })
  const { data: sprints } = useQuery({ queryKey: ['sprints'], queryFn: () => getSprints(actor) })

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

  const [sprintNumber, setSprintNumber] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (sprintNumber === undefined && sprints && sprints.length > 0) {
      setSprintNumber(sprints.find((s) => s.is_current)?.number ?? sprints[0].number)
    }
  }, [sprints, sprintNumber])

  const selectedSprint = sprints?.find((s) => s.number === sprintNumber)
  const sprintStart = selectedSprint?.start_date

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
      if (entry.week_start_date === sprintStart) map.set(entry.task_id, entry.hours)
    }
    return map
  }, [entriesQuery.data, sprintStart])

  const [draftHours, setDraftHours] = useState<Record<number, string>>({})
  useEffect(() => {
    setDraftHours({})
  }, [sprintNumber, selectedEngineerId])

  const saveMutation = useMutation({
    mutationFn: (taskId: number) =>
      upsertTimeEntry(actor, {
        task_id: taskId,
        week_start_date: sprintStart as string,
        hours: Number(draftHours[taskId] ?? entriesByTask.get(taskId) ?? 0),
        engineer_id: selectedEngineerId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries', selectedEngineerId] })
      queryClient.invalidateQueries({ queryKey: ['engineer-dashboard', selectedEngineerId] })
      toast.success('Hours saved')
    },
  })

  const tasks = dashboardQuery.data?.tasks ?? []

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Log Time</h1>
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
          Sprint
          <select value={sprintNumber ?? ''} onChange={(e) => setSprintNumber(Number(e.target.value))}>
            {(sprints ?? []).map((s) => (
              <option key={s.number} value={s.number}>
                {s.label} — {s.start_date} – {s.end_date}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="card">
        <h2>My Outcomes</h2>
        {saveMutation.isError && <Alert variant="error">{(saveMutation.error as Error).message}</Alert>}
        {tasks.length === 0 ? (
          <p className="text-muted">
            No outcomes assigned yet — visit the <Link to="/marketplace">Marketplace</Link> to opt into an Ask.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Initiative</th>
                  <th>Hours this sprint</th>
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
                        disabled={saveMutation.isPending || sprintStart === undefined}
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
