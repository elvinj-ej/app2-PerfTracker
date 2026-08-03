import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useActor } from '../../context/ActorContext'

interface Props {
  engineerIds: number[]
  onOptIn: () => Promise<void>
  onOptOut: () => Promise<void>
  invalidateKey: QueryKey
}

export function OptInButton({ engineerIds, onOptIn, onOptOut, invalidateKey }: Props) {
  const { actor } = useActor()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (optedIn: boolean) => (optedIn ? onOptOut() : onOptIn()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  })

  if (actor.role !== 'engineer') {
    return null
  }

  const isOptedIn = engineerIds.includes(actor.engineerId)

  return (
    <button
      className={isOptedIn ? 'btn btn-secondary' : 'btn btn-primary'}
      onClick={() => mutation.mutate(isOptedIn)}
      disabled={mutation.isPending}
    >
      {isOptedIn ? 'Opt Out' : 'Opt In'}
    </button>
  )
}
