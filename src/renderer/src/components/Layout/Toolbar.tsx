import { useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import { AccountsModal } from '../Modals/AccountsModal'

export function Toolbar() {
  const { repoName, repoPath, fetchAll, pullCurrent, pushCurrent, forcePushCurrent, pushFailed, refresh, openRepo, operationInProgress } = useRepoStore()
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  useState(() => {
    const offAvailable = window.git.onUpdateAvailable(v => setUpdateVersion(v))
    const offDownloaded = window.git.onUpdateDownloaded(v => { setUpdateVersion(v); setUpdateReady(true) })
    return () => { offAvailable(); offDownloaded() }
  })

  return (
    <div
      className="flex items-center gap-2 px-4 h-12 border-b flex-shrink-0 drag-region"
      style={{ background: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
    >
      {/* macOS traffic light spacer */}
      <div className="w-16 flex-shrink-0" />

      {/* Repo name */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer no-drag"
        style={{ background: 'var(--color-bg-surface)' }}
        onClick={() => openRepo()}
        title={repoPath ?? ''}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h18v18H3z" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {repoName ?? 'Open Repository'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      <div className="flex-1" />

      {/* Action buttons */}
      <div className="flex items-center gap-1 no-drag">
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
          title="GitHub / GitLab accounts"
        />
      </div>

      {operationInProgress && (
        <div className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          <Spinner />
          <span className="text-xs">Running…</span>
        </div>
      )}
      {updateVersion && !updateReady && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs no-drag flex-shrink-0"
          style={{ background: 'rgba(124,140,248,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(124,140,248,0.25)' }}>
          ↓ v{updateVersion} downloading…
        </div>
      )}
      {updateVersion && updateReady && (
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold no-drag flex-shrink-0"
          style={{ background: 'var(--color-accent)', color: 'white', border: 'none', cursor: 'pointer' }}
          onClick={() => window.git.installUpdate()}
          title={`Restart to install v${updateVersion}`}
        >
          ↻ Restart to update v{updateVersion}
        </button>
      )}
      {accountsOpen && <AccountsModal onClose={() => setAccountsOpen(false)} />}
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
