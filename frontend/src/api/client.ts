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

// API paths throughout this module are written as absolute paths from the app's own
// root (e.g. "/api/engineers"). Resolving them against BASE_URL (which Vite sets to
// wherever this app is actually hosted - "/" in dev, "/PerfTracker/" in production,
// see vite.config.ts) makes them work whether the app is served at the origin root
// or under a path prefix alongside other internally-hosted apps.
function resolveUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  return path.startsWith('/') ? `${base}${path.slice(1)}` : `${base}${path}`
}

export async function apiFetch<T>(path: string, actor: Actor, options: RequestInit = {}): Promise<T> {
  const response = await fetch(resolveUrl(path), {
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
