import type { Actor } from '../context/ActorContext'
import type { JiraImportPreview } from '../types/api'
import { apiFetchMultipart } from './client'

export function previewJiraXmlImport(actor: Actor, file: File): Promise<JiraImportPreview> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetchMultipart<JiraImportPreview>('/api/initiatives/import/jira-xml/preview', actor, formData)
}

export function previewWordDocImport(actor: Actor, file: File): Promise<JiraImportPreview> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetchMultipart<JiraImportPreview>('/api/initiatives/import/word-doc/preview', actor, formData)
}
