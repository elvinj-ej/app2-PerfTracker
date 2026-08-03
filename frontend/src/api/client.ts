import type { Actor } from '../context/ActorContext'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: string }
    return parsed.detail ?? body
  } catch {
    return body
  }
}

function actorHeaders(actor: Actor): HeadersInit {
  if (actor.role === 'manager') {
    return { 'X-Actor-Role': 'manager' }
  }
  return { 'X-Actor-Role': 'engineer', 'X-Actor-Engineer-Id': String(actor.engineerId) }
}

export async function apiFetch<T>(path: string, actor: Actor, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...actorHeaders(actor),
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, extractErrorMessage(body) || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
