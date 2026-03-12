import { useRepoStore } from '../../store/repoStore'

export function WelcomeScreen() {
  const { openRepo, loadRecentRepos, recentRepos } = useRepoStore()

  const handleOpen = () => openRepo()
  const handleOpenRecent = (path: string) => openRepo(path)

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-8"
      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-accent)' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="4" cy="20" r="2" />
            <circle cx="20" cy="20" r="2" />
            <line x1="12" y1="7" x2="12" y2="9" />
            <line x1="5.5" y1="18.5" x2="10.5" y2="13.5" />
            <line x1="18.5" y1="18.5" x2="13.5" y2="13.5" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>GitEasy</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>A beautiful Git client</p>
        </div>
      </div>

      {/* Open button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-opacity"
        style={{ background: 'var(--color-accent)', color: 'white' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 9.5V19a1 1 0 001 1h16a1 1 0 001-1V9.5M3 9.5l9-5.5 9 5.5M3 9.5h18" />
        </svg>
        Open Repository
      </button>

      {/* Recent repos */}
      {recentRepos.length > 0 && (
        <div className="w-96 max-w-full">
          <p className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--color-text-muted)' }}>
            RECENT REPOSITORIES
          </p>
          <div
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-panel)' }}
          >
            {recentRepos.slice(0, 5).map((path, i) => (
              <button
                key={path}
                onClick={() => handleOpenRecent(path)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  borderTop: i > 0 ? `1px solid var(--color-border)` : 'none',
                  color: 'var(--color-text-primary)'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  <path d="M3 7h6l2 2h10v12H3z" />
                </svg>
                <span className="truncate text-sm">{path.split('/').slice(-2).join('/')}</span>
                <span className="ml-auto text-xs truncate max-w-32" style={{ color: 'var(--color-text-muted)' }}>
                  {path}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        ⌘O to open a repository
      </p>
    </div>
  )
}
