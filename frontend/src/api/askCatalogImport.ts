import type { Actor } from '../context/ActorContext'
import type { AskCatalogCommitResult, AskCatalogImportMode, AskCatalogPreviewResponse } from '../types/api'
import { apiFetchMultipart, downloadFile } from './client'

export function previewAskCatalogImport(actor: Actor, file: File): Promise<AskCatalogPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetchMultipart<AskCatalogPreviewResponse>('/api/initiatives/import/ask-catalog/preview', actor, formData)
}

export function commitAskCatalogImport(
  actor: Actor,
  file: File,
  mode: AskCatalogImportMode,
): Promise<AskCatalogCommitResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('mode', mode)
  return apiFetchMultipart<AskCatalogCommitResult>('/api/initiatives/import/ask-catalog/commit', actor, formData)
}

export function downloadAskCatalogTemplate(actor: Actor): Promise<void> {
  return downloadFile('/api/initiatives/import/ask-catalog/template', actor, 'ask-catalog-template.xlsx')
}
