import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useActor } from '../../context/ActorContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'

interface Props {
  engineerIds: number[]
  onOptIn: () => Promise<void>
  onOptOut: () => Promise<void>
  invalidateKey: QueryKey
}

export function OptInButton({ engineerIds, onOptIn, onOptOut, invalidateKey }: Props) {
  const { actor } = useActor()
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const toast = useToast()

  const mutation = useMutation({
    mutationFn: (optedIn: boolean) => (optedIn ? onOptOut() : onOptIn()),
    onSuccess: (_, optedIn) => {
      queryClient.invalidateQueries({ queryKey: invalidateKey })
      toast.success(optedIn ? "You've opted out" : "You're opted in")
    },
  })

  if (actor.role !== 'engineer') {
    return null
  }

  const isOptedIn = engineerIds.includes(actor.engineerId)

  async function handleClick() {
    if (isOptedIn) {
      const confirmed = await confirm('Opt out of this Ask? Any Outcomes you own will stay assigned to you.', {
        title: 'Opt out?',
        confirmLabel: 'Opt Out',
        danger: true,
      })
      if (!confirmed) return
    }
    mutation.mutate(isOptedIn)
  }

  return (
    <button className={isOptedIn ? 'btn btn-secondary' : 'btn btn-primary'} onClick={handleClick} disabled={mutation.isPending}>
      {isOptedIn ? 'Opt Out' : 'Opt In'}
    </button>
  )
}
