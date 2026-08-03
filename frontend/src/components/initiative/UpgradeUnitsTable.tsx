import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createUpgradeUnit, listUpgradeUnits, updateUpgradeUnit } from '../../api/platformInitiatives'
import { useActor } from '../../context/ActorContext'
import type { UpgradeUnitStatus } from '../../types/api'

const STATUS_OPTIONS: { value: UpgradeUnitStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'SKIPPED', label: 'Skipped' },
]

export function UpgradeUnitsTable({ initiativeId }: { initiativeId: number }) {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const unitsQuery = useQuery({
    queryKey: ['upgrade-units', initiativeId],
    queryFn: () => listUpgradeUnits(actor, initiativeId),
  })
  const [systemName, setSystemName] = useState('')
  const [systemType, setSystemType] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['upgrade-units', initiativeId] })

  const createMutation = useMutation({
    mutationFn: () => createUpgradeUnit(actor, initiativeId, { system_name: systemName, system_type: systemType || null }),
    onSuccess: () => {
      invalidate()
      setSystemName('')
      setSystemType('')
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ unitId, status }: { unitId: number; status: UpgradeUnitStatus }) =>
      updateUpgradeUnit(actor, unitId, { status }),
    onSuccess: invalidate,
  })

  return (
    <section className="card">
      <h2>Upgrade Units</h2>
      {(unitsQuery.data ?? []).length === 0 ? (
        <p className="text-muted">No systems added yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>System</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(unitsQuery.data ?? []).map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.system_name}</td>
                  <td>{unit.system_type ?? '—'}</td>
                  <td>
                    <select
                      value={unit.status}
                      onChange={(e) => updateMutation.mutate({ unitId: unit.id, status: e.target.value as UpgradeUnitStatus })}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="add-task-form">
        <input
          placeholder="System name (e.g. SQL-PROD-05)"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
        />
        <input placeholder="System type" value={systemType} onChange={(e) => setSystemType(e.target.value)} />
        <button className="btn btn-primary" disabled={!systemName} onClick={() => createMutation.mutate()}>
          Add Unit
        </button>
      </div>
    </section>
  )
}
