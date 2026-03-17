import { useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import type { DiffFile, StatusFile } from '../../../../shared/ipc'
import { DiffViewer } from '../DiffViewer/DiffViewer'

export function ChangesPanel() {
  const { status, stageFile, unstageFile, stageAll, unstageAll, commitChanges, repoPath } = useRepoStore()
  const [commitMsg, setCommitMsg] = useState('')
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null)
  const [diffFile, setDiffFile] = useState<DiffFile | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const openDiff = async (file: StatusFile, staged: boolean) => {
    if (file.untracked || !repoPath) return // no diff for untracked files or when no repo
    if (selectedFile?.path === file.path && selectedFile?.staged === staged) {
      setSelectedFile(null)
      setDiffFile(null)
      return
    }
    setSelectedFile({ path: file.path, staged })
    setDiffFile(null)
    setDiffLoading(true)
    try {
      const files = staged
        ? await window.git.getStagedDiff(repoPath, file.path)
        : await window.git.getWorkingDiff(repoPath, file.path)
      setDiffFile(files[0] ?? null)
    } finally {
      setDiffLoading(false)
    }
  }

  const staged = status.filter(f => f.staged)
  const unstaged = status.filter(f => f.unstaged || f.untracked)

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    setCommitError(null)
    const result = await commitChanges(commitMsg.trim())
    setCommitting(false)
    if (result?.success) {
      setCommitMsg('')
    } else {
      setCommitError(result?.error ?? 'Commit failed')
    }
  }

  const canCommit = staged.length > 0 && commitMsg.trim().length > 0 && !committing

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontSize: 12 }}>

      {/* ── Staged section ─────────────────────────────────────────────── */}
      <SectionHeader
        label="Staged"
        count={staged.length}
        action={staged.length > 0 ? { label: 'Unstage all', onClick: unstageAll } : undefined}
      />
      {staged.length === 0 ? (
        <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No staged changes</div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: '35%' }}>
          {staged.map(f => (
            <FileEntry
              key={f.path}
              file={f}
              selected={selectedFile?.path === f.path && selectedFile?.staged === true}
              onDiffClick={() => openDiff(f, true)}
              action={{ label: '−', title: 'Unstage', onClick: () => unstageFile(f.path) }}
            />
          ))}
        </div>
      )}

      {/* ── Unstaged section ────────────────────────────────────────────── */}
      <SectionHeader
        label="Unstaged"
        count={unstaged.length}
        action={unstaged.length > 0 ? { label: 'Stage all', onClick: stageAll } : undefined}
      />
      {unstaged.length === 0 ? (
        <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>No unstaged changes</div>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: '35%' }}>
          {unstaged.map(f => (
            <FileEntry
              key={f.path}
              file={f}
              selected={selectedFile?.path === f.path && selectedFile?.staged === false}
              onDiffClick={() => openDiff(f, false)}
              action={{ label: '+', title: 'Stage', onClick: () => stageFile(f.path) }}
            />
          ))}
        </div>
      )}

      {/* ── Diff panel ──────────────────────────────────────────────────── */}
      {(selectedFile || diffLoading) && (
        <div className="flex flex-col flex-1 min-h-0 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div
            className="flex items-center gap-2 px-3 shrink-0"
            style={{
              background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em', minHeight: 28
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile?.staged ? 'Staged' : 'Unstaged'}: {selectedFile?.path}
            </span>
            <button
              onClick={() => { setSelectedFile(null); setDiffFile(null) }}
              title="Close diff"
              style={{
                background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px', borderRadius: 3
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
            >×</button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            {diffLoading && (
              <div className="px-3 py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>Loading diff…</div>
            )}
            {!diffLoading && !diffFile && (
              <div className="px-3 py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {selectedFile?.path?.match(/\?\?/) ? 'Untracked file – no diff available' : 'No diff available'}
              </div>
            )}
            {!diffLoading && diffFile && (
              <DiffViewer file={diffFile} hideHeader />
            )}
          </div>
        </div>
      )}

      {/* ── Commit area ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t px-3 py-3 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
        <textarea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCommit() }}
          placeholder="Commit message (⌘↵ to commit)"
          rows={3}
          style={{
            width: '100%', resize: 'none', fontSize: 12, padding: '6px 8px',
            background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)', borderRadius: 4, outline: 'none',
            fontFamily: 'inherit'
          }}
        />
        {commitError && (
          <div style={{ color: 'var(--color-red)', fontSize: 11, whiteSpace: 'pre-wrap' }}>{commitError}</div>
        )}
        <button
          onClick={handleCommit}
          disabled={!canCommit}
          style={{
            width: '100%', padding: '6px 0', borderRadius: 4, fontSize: 12, fontWeight: 600,
            border: 'none', cursor: canCommit ? 'pointer' : 'not-allowed',
            background: canCommit ? 'var(--color-accent)' : 'var(--color-bg-surface)',
            color: canCommit ? '#fff' : 'var(--color-text-muted)',
            transition: 'background 0.15s',
            opacity: committing ? 0.6 : 1
          }}
        >
          {committing ? 'Committing…' : `Commit${staged.length > 0 ? ` (${staged.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ label, count, action }: {
  label: string
  count: number
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 shrink-0"
      style={{
        background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)',
        borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
      }}
    >
      <span>{label}</span>
      <span style={{
        background: 'var(--color-bg-hover)', borderRadius: 9, padding: '0 5px',
        color: 'var(--color-text-secondary)', fontWeight: 400
      }}>{count}</span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginLeft: 'auto', fontSize: 11, background: 'transparent', border: 'none',
            color: 'var(--color-text-muted)', cursor: 'pointer', padding: '1px 4px', borderRadius: 3
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function FileEntry({ file, action, selected, onDiffClick }: {
  file: StatusFile
  action: { label: string; title: string; onClick: () => void }
  selected?: boolean
  onDiffClick?: () => void
}) {
  const statusLabel = statusBadge(file.statusCode)
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
        background: selected ? 'var(--color-bg-hover)' : 'transparent',
        cursor: file.untracked ? 'default' : 'pointer'
      }}
      onClick={onDiffClick}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-hover)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, width: 14, flexShrink: 0, color: statusColor(file.statusCode) }}>
        {statusLabel}
      </span>
      <span className="flex-1 truncate" style={{ fontSize: 12 }} title={file.path}>{file.path}</span>
      <button
        onClick={e => { e.stopPropagation(); action.onClick() }}
        title={action.title}
        style={{
          width: 18, height: 18, borderRadius: 3, border: 'none', flexShrink: 0,
          background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)',
          cursor: 'pointer', fontSize: 14, lineHeight: '16px', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      >
        {action.label}
      </button>
    </div>
  )
}

function statusBadge(code: string): string {
  const x = code[0], y = code[1]
  if (x === '?' && y === '?') return 'U'
  if (x === 'A') return 'A'
  if (x === 'D' || y === 'D') return 'D'
  if (x === 'R') return 'R'
  if (x === 'C') return 'C'
  return 'M'
}

function statusColor(code: string): string {
  const letter = statusBadge(code)
  if (letter === 'A') return 'var(--color-green)'
  if (letter === 'D') return 'var(--color-red)'
  if (letter === 'U') return 'var(--color-text-muted)'
  return '#f0b555' // M / R / C → orange
}
