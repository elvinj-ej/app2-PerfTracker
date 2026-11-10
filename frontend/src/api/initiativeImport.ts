import type { Actor } from '../context/ActorContext'
import type { JiraIssuePreview } from '../types/api'
import { apiFetch } from './client'

export function previewJiraIssue(actor: Actor, issueOrUrl: string, jiraToken: string): Promise<JiraIssuePreview> {
  return apiFetch<JiraIssuePreview>('/api/initiatives/import/jira/preview', actor, {
    method: 'POST',
    headers: { 'X-Jira-Token': jiraToken },
    body: JSON.stringify({ issue: issueOrUrl }),
  })
}
