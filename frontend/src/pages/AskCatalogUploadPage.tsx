import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { commitAskCatalogImport, downloadAskCatalogTemplate, previewAskCatalogImport } from '../api/askCatalogImport'
import { useActor } from '../context/ActorContext'
import type { AskCatalogCommitResult, AskCatalogImportMode, AskCatalogPreviewResponse } from '../types/api'

const TYPE_LABELS: Record<string, string> = {
  KBI: 'Change Business',
  PLATFORM: 'Change Platform',
  RECURRING_OPS: 'Run Operations',
}

export function AskCatalogUploadPage() {
  const { actor } = useActor()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AskCatalogPreviewResponse | null>(null)
  const [mode, setMode] = useState<AskCatalogImportMode>('add')
  const [result, setResult] = useState<AskCatalogCommitResult | null>(null)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const previewMutation = useMutation({
    mutationFn: (f: File) => previewAskCatalogImport(actor, f),
    onSuccess: (data) => {
      setPreview(data)
      setResult(null)
      setConfirmOverwrite(false)
    },
  })

  const commitMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a file first.')
      return commitAskCatalogImport(actor, file, mode)
    },
    onSuccess: (data) => {
      setResult(data)
      setPreview(null)
      setFile(null)
      setConfirmOverwrite(false)
    },
  })

  if (actor.role !== 'manager') {
    return (
      <div className="page">
        <p className="text-muted">Only a manager can upload the Marketplace Ask catalog.</p>
      </div>
    )
  }

  const validRowCount = preview ? preview.run_count + preview.platform_count + preview.business_count : 0
  const rowsWithWarnings = preview?.rows.filter((r) => r.warnings.length > 0) ?? []
  const canCommit = mode === 'add' || confirmOverwrite

  return (
    <div className="page">
      <div className="page-toolbar">
        <h1 className="page-title">Upload Marketplace Ask Catalog</h1>
      </div>

      <section className="card">
        <p className="text-muted">
          Upload a spreadsheet with columns <code>Category</code>, <code>Ask</code>, <code>By Date</code>, and one or
          more <code>Outcome</code> columns. The Category decides the type: starting with "Run" becomes a Run
          Operations Ask, "Change Platform" a Change Platform Ask, "Change Business" a Change Business Ask. Every
          populated Outcome column becomes an Outcome automatically. Nothing is saved until you review the preview
          below and confirm.
        </p>
        <div className="import-source-row">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
              setResult(null)
            }}
          />
          <button
            className="btn btn-secondary"
            disabled={!file || previewMutation.isPending}
            onClick={() => file && previewMutation.mutate(file)}
          >
            {previewMutation.isPending ? 'Parsing…' : 'Preview Upload'}
          </button>
          <button className="btn-link" onClick={() => downloadAskCatalogTemplate(actor)}>
            Download a blank template
          </button>
        </div>
        {previewMutation.isError && <p className="text-error">{(previewMutation.error as Error).message}</p>}
      </section>

      {result && (
        <section className="card">
          <h2>Upload complete</h2>
          <p>
            {result.mode === 'overwrite' ? 'Replaced the Marketplace with' : 'Added'}{' '}
            {result.run_count + result.platform_count + result.business_count} Ask(s): {result.run_count} Run
            Operations, {result.platform_count} Change Platform, {result.business_count} Change Business — with{' '}
            {result.outcomes_created} Outcome(s) and {result.categories_created} new categor
            {result.categories_created === 1 ? 'y' : 'ies'}.
          </p>
          {result.skipped_existing_asks.length > 0 && (
            <p className="text-muted">
              Skipped {result.skipped_existing_asks.length} Ask(s) already in the Marketplace:{' '}
              {result.skipped_existing_asks.join(', ')}
            </p>
          )}
          {result.skipped_unclassified_rows > 0 && (
            <p className="text-muted">
              {result.skipped_unclassified_rows} row(s) in the file couldn't be classified and were skipped.
            </p>
          )}
          <p>
            <Link to="/marketplace">View the Marketplace</Link>
          </p>
        </section>
      )}

      {preview && (
        <section className="card">
          <h2>Review before uploading</h2>
          <p>
            {validRowCount} Ask(s) recognized — {preview.run_count} Run Operations, {preview.platform_count} Change
            Platform, {preview.business_count} Change Business — with {preview.total_outcomes} Outcome(s) total.
            {preview.skipped_count > 0 && ` ${preview.skipped_count} row(s) will be skipped (see warnings below).`}
          </p>

          {rowsWithWarnings.length > 0 && (
            <div className="card-inset">
              <h3>Warnings</h3>
              <ul>
                {rowsWithWarnings.map((r) => (
                  <li key={r.row_number}>
                    Row {r.row_number} ({r.ask || r.category || 'blank'}): {r.warnings.join('; ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Ask</th>
                  <th>By Date</th>
                  <th>Priority</th>
                  <th>Outcomes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row_number} className={r.warnings.length > 0 ? 'text-muted' : undefined}>
                    <td>{r.row_number}</td>
                    <td>{r.initiative_type ? TYPE_LABELS[r.initiative_type] : '—'}</td>
                    <td className="marketplace-ask-cell">{r.category}</td>
                    <td className="marketplace-ask-cell">{r.ask}</td>
                    <td>{r.by_date ?? '—'}</td>
                    <td>{r.priority}</td>
                    <td>{r.outcomes.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="import-type-toggle">
            <label>
              <input
                type="radio"
                name="upload-mode"
                checked={mode === 'add'}
                onChange={() => {
                  setMode('add')
                  setConfirmOverwrite(false)
                }}
              />
              Add — only create Asks not already in the Marketplace
            </label>
            <label>
              <input
                type="radio"
                name="upload-mode"
                checked={mode === 'overwrite'}
                onChange={() => setMode('overwrite')}
              />
              Overwrite — replace the entire Marketplace with this file
            </label>
          </div>

          {mode === 'overwrite' && (
            <div className="card-inset">
              <p className="text-error">
                This deletes every existing Ask, Outcome, and opt-in (across Run Operations, Change Platform, and
                Change Business) before loading this file. Engineers are not affected. This can't be undone.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmOverwrite}
                  onChange={(e) => setConfirmOverwrite(e.target.checked)}
                />{' '}
                I understand this will delete the current Marketplace data.
              </label>
            </div>
          )}

          {commitMutation.isError && <p className="text-error">{(commitMutation.error as Error).message}</p>}

          <button
            className="btn btn-primary"
            disabled={!canCommit || commitMutation.isPending || validRowCount === 0}
            onClick={() => commitMutation.mutate()}
          >
            {commitMutation.isPending
              ? 'Uploading…'
              : mode === 'overwrite'
                ? `Replace Marketplace with ${validRowCount} Ask(s)`
                : `Add ${validRowCount} Ask(s)`}
          </button>
        </section>
      )}
    </div>
  )
}
