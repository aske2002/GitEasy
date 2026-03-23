import { useEffect, useRef, useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import { AccountsModal } from '../Modals/AccountsModal'
import { CloneModal } from '../Modals/CloneModal'

declare const __APP_VERSION__: string

export function Toolbar() {
  const { repoName, repoPath, fetchAll, pullCurrent, pushCurrent, forcePushCurrent, pushFailed, refresh, openRepo, operationInProgress, recentRepos, loadRecentRepos, status, createStash } = useRepoStore()
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [repoPicker, setRepoPicker] = useState(false)
  const repoPickerRef = useRef<HTMLDivElement>(null)

  useState(() => {
    const offAvailable = window.git.onUpdateAvailable(v => setUpdateVersion(v))
    const offDownloaded = window.git.onUpdateDownloaded(v => { setUpdateVersion(v); setUpdateReady(true) })
    return () => { offAvailable(); offDownloaded() }
  })

  useEffect(() => {
    loadRecentRepos()
  }, [])

  useEffect(() => {
    if (!repoPicker) return
    const handler = (e: MouseEvent) => {
      if (!repoPickerRef.current?.contains(e.target as Node)) setRepoPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [repoPicker])

  const hasChanges = status.some(f => f.staged || f.unstaged || f.untracked)

  return (
    <div
      className="flex items-center gap-2 px-4 h-12 border-b shrink-0 drag-region"
      style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
    >
      {/* macOS traffic light spacer */}
      <div className="w-16 shrink-0" />

      {/* Repo name / picker */}
      <div className="relative no-drag" ref={repoPickerRef}>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer"
          style={{ background: 'var(--color-bg-surface)' }}
          onClick={() => setRepoPicker(v => !v)}
          title={repoPath ?? 'Open a repository'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h18v18H3z" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {repoName ?? 'Open Repository'}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: repoPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {repoPicker && (
          <div
            className="absolute left-0 top-full mt-1 rounded-xl overflow-hidden border z-50"
            style={{
              minWidth: 280, maxWidth: 380,
              background: 'var(--color-bg-panel)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
            }}
          >
            {recentRepos.length > 0 && (
              <>
                <div className="px-3 py-2" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  Recent Repositories
                </div>
                {recentRepos.map(path => {
                  const name = path.split('/').pop() ?? path
                  const isActive = path === repoPath
                  return (
                    <button
                      key={path}
                      onClick={() => { setRepoPicker(false); if (!isActive) openRepo(path) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                      style={{
                        background: isActive ? 'var(--color-bg-hover)' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isActive ? 'var(--color-bg-hover)' : 'transparent')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        <path d="M3 3h18v18H3z" /><path d="M3 9h18M9 21V9" />
                      </svg>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</div>
                      </div>
                      {isActive && <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="none" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="M20 6L9 17l-5-5" stroke="var(--color-accent)" strokeWidth="2.5" fill="none"/></svg>}
                    </button>
                  )
                })}
              </>
            )}
            <button
              onClick={() => { setRepoPicker(false); openRepo() }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Browse for folder…</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1 no-drag">
        <ToolbarBtn
          icon={<CloneIcon />}
          label="Clone"
          onClick={() => setCloneOpen(true)}
          title="Clone a repository from GitHub, GitLab, or Bitbucket"
        />
        <ToolbarBtn
          icon={<FetchIcon />}
          label="Fetch"
          onClick={fetchAll}
          disabled={operationInProgress}
          title="Fetch all remotes"
        />
        <ToolbarBtn
          icon={<PullIcon />}
          label="Pull"
          onClick={pullCurrent}
          disabled={operationInProgress}
          title="Pull current branch"
        />
        <ToolbarBtn
          icon={<StashIcon />}
          label="Stash"
          onClick={() => createStash(undefined, true)}
          disabled={operationInProgress || !hasChanges}
          title={hasChanges ? 'Stash current changes' : 'No changes to stash'}
        />
        <ToolbarBtn
          icon={<PushIcon />}
          label="Push"
          onClick={pushCurrent}
          disabled={operationInProgress}
          title="Push current branch"
        />
        {pushFailed && (
          <ToolbarBtn
            icon={<ForceIcon />}
            label="Force Push"
            onClick={forcePushCurrent}
            disabled={operationInProgress}
            title="Force push with lease (safe force push)"
            danger
          />
        )}
        <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
        <ToolbarBtn
          icon={<RefreshIcon />}
          label="Refresh"
          onClick={refresh}
          disabled={operationInProgress}
          title="Refresh (Cmd+R)"
        />
        <div className="w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />
        <ToolbarBtn
          icon={<AccountIcon />}
          label="Accounts"
          onClick={() => setAccountsOpen(true)}
          title="GitHub / GitLab / Bitbucket accounts"
        />
      </div>

      {operationInProgress && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          <Spinner />
          <span className="text-xs">Running…</span>
        </div>
      )}
      {updateVersion && !updateReady && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs no-drag shrink-0"
          style={{ background: 'rgba(124,140,248,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(124,140,248,0.25)' }}>
          ↓ v{updateVersion} downloading…
        </div>
      )}
      {updateVersion && updateReady && (
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold no-drag shrink-0"
          style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer' }}
          onClick={() => window.git.installUpdate()}
          title={`Restart to install v${updateVersion}`}
        >
          ↻ Restart to update v{updateVersion}
        </button>
      )}
      <span
        className="text-xs shrink-0 select-none"
        style={{ color: 'var(--color-text-secondary)', opacity: 0.45 }}
      >
        v{__APP_VERSION__}
      </span>
      {accountsOpen && <AccountsModal onClose={() => setAccountsOpen(false)} />}
      {cloneOpen && (
        <CloneModal
          onClose={() => setCloneOpen(false)}
          onCloned={path => openRepo(path)}
        />
      )}
    </div>
  )
}

function ToolbarBtn({ icon, label, onClick, disabled, title, danger }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        color: danger ? 'var(--color-danger, #f87171)' : 'var(--color-text-secondary)',
        background: 'transparent'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.12)' : 'var(--color-bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}

const FetchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2v6h-6M3 22v-6h6M3.51 9a9 9 0 0114.85-3.36L21 8M3 16l2.64 2.36A9 9 0 0020.49 15" />
  </svg>
)
const PullIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
)
const StashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M8 8V6a4 4 0 018 0v2" />
    <path d="M3 12h18" />
  </svg>
)
const PushIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
)
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L21 8M3 16l2.64 2.36A9 9 0 0020.49 15" />
  </svg>
)

const Spinner = () => (
  <div
    className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
    style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
  />
)

const AccountIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)

const ForceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19V5M5 12l7-7 7 7" />
    <path d="M5 5h14" />
  </svg>
)

const CloneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="13" height="14" rx="2" />
    <path d="M9 7V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3" />
  </svg>
)
