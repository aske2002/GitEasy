import { useState, useEffect } from 'react'
import type { DiffFile } from '../../../../shared/ipc'
import { DiffViewer } from './DiffViewer'
import { useRepoStore } from '../../store/repoStore'

interface Props {
  /** Path of the file being viewed */
  path: string
  /** Diff data — null when viewing an unchanged file in "view all" mode */
  diffFile: DiffFile | null
  /** Commit hash */
  hash: string
  onClose: () => void
}

export function DiffModal({ path, diffFile, hash, onClose }: Props) {
  const { repoPath } = useRepoStore()
  const [tab, setTab] = useState<'diff' | 'full'>(diffFile ? 'diff' : 'full')
  const [fullContent, setFullContent] = useState<string | null>(null)
  const [fullError, setFullError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Load full file content the first time the "Full File" tab is activated
  useEffect(() => {
    if (tab !== 'full' || fullContent !== null || fullError !== null || !repoPath) return
    window.git.getFileContent(repoPath, hash, path)
      .then(c => setFullContent(c))
      .catch((e: Error) => setFullError(e.message))
  }, [tab, repoPath, hash, path])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRestore = async () => {
    if (!repoPath || restoring) return
    setRestoring(true)
    setRestoreMsg(null)
    try {
      await window.git.restoreFile(repoPath, hash, path)
      setRestoreMsg({ text: 'Restored (unstaged)', ok: true })
      setTimeout(() => setRestoreMsg(null), 3000)
    } catch (e: any) {
      setRestoreMsg({ text: 'Error: ' + e.message, ok: false })
    } finally {
      setRestoring(false)
    }
  }

  return (
    // Backdrop
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', padding: 24, background: 'rgba(0,0,0,0.65)', alignItems: 'stretch' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', minWidth: 0 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-panel)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {path}
          </span>
          {diffFile && (
            <>
              <span style={{ color: 'var(--color-green)', fontSize: 11, flexShrink: 0 }}>+{diffFile.additions}</span>
              <span style={{ color: 'var(--color-red)', fontSize: 11, flexShrink: 0 }}>-{diffFile.deletions}</span>
            </>
          )}

          {/* Restore button */}
          <button
            onClick={handleRestore}
            disabled={restoring}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
              background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
              opacity: restoring ? 0.6 : 1
            }}
            onMouseEnter={e => { if (!restoring) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-surface)' }}
          >
            ↩ {restoring ? 'Restoring…' : 'Restore to this version'}
          </button>

          {restoreMsg && (
            <span style={{ fontSize: 11, flexShrink: 0, color: restoreMsg.ok ? 'var(--color-green)' : 'var(--color-red)' }}>
              {restoreMsg.text}
            </span>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0, color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-panel)', flexShrink: 0 }}>
          {diffFile && (
            <TabBtn active={tab === 'diff'} onClick={() => setTab('diff')}>Diff</TabBtn>
          )}
          <TabBtn active={tab === 'full'} onClick={() => setTab('full')}>Full File</TabBtn>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {tab === 'diff' && diffFile && (
            <DiffViewer file={diffFile} hideHeader />
          )}
          {tab === 'full' && (
            fullContent === null && fullError === null
              ? <Spinner />
              : fullError
                ? <ErrorMsg msg={fullError} />
                : <FullFileView content={fullContent!} path={path} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        transition: 'color 0.1s'
      }}
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        className="animate-spin" />
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-red)', fontSize: 12 }}>
      {msg}
    </div>
  )
}

function FullFileView({ content, path: _path }: { content: string; path: string }) {
  const lines = content.split('\n')
  // Remove trailing empty line artifact from git show
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  return (
    <div style={{ height: '100%', overflow: 'auto', fontFamily: 'monospace', fontSize: 12, background: 'var(--color-bg-base)' }}>
      <div style={{ minWidth: 'max-content' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', minHeight: 20 }}>
            {/* Line number */}
            <div style={{ width: 52, textAlign: 'right', paddingRight: 12, color: 'var(--color-text-muted)', userSelect: 'none', flexShrink: 0, lineHeight: '20px', paddingTop: 1, paddingBottom: 1 }}>
              {i + 1}
            </div>
            {/* Content */}
            <div style={{ whiteSpace: 'pre', color: 'var(--color-text-primary)', lineHeight: '20px', paddingTop: 1, paddingBottom: 1, paddingRight: 24 }}>
              {line}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
