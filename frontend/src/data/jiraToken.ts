const STORAGE_KEY = 'aose.jiraToken'

export function getStoredJiraToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setStoredJiraToken(token: string): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Best-effort only - a private window or blocked storage just means re-pasting
    // the token next visit, not a broken import flow.
  }
}
