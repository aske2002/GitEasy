import { useEffect, useState } from 'react'
import type { AccountInfo, RemoteRepo } from '@shared/ipc'

interface Props {
  onClose: () => void
  onCloned: (path: string) => void
}

export function CloneModal({ onClose, onCloned }: Props) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([])
  const [activeHost, setActiveHost] = useState<string | null>(null)
  const [repos, setRepos] = useState<RemoteRepo[]>([])
  const [reposLoading, setReposLoading] = useState(false)
  const [reposError, setReposError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<RemoteRepo | null>(null)
  const [destDir, setDestDir] = useState('')
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)

  useEffect(() => {
    window.git.listAccounts().then(list => {
      setAccounts(list)
      if (list.length > 0) setActiveHost(list[0].host)
    })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!activeHost) return
    setRepos([])
    setSelected(null)
    setSearch('')
    setReposError(null)
    setReposLoading(true)
    window.git.listRemoteRepos(activeHost)
      .then(list => setRepos(list))
      .catch(e => setReposError(e.message ?? 'Failed to load repositories'))
      .finally(() => setReposLoading(false))
  }, [activeHost])

  const filtered = repos.filter(r =>
    r.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleBrowse = async () => {
    const dir = await window.git.chooseDirectory()
    if (dir) setDestDir(dir)
  }

  const handleClone = async () => {
    if (!selected || !destDir) return
    setCloning(true)
    setCloneError(null)
    const result = await window.git.cloneRepo(selected.cloneUrl, destDir, selected.name)
    setCloning(false)
    if (result.success && result.clonedPath) {
      onCloned(result.clonedPath)
      onClose()
    } else {
      setCloneError(result.error ?? 'Clone failed')
    }
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center'
  }

  const modal: React.CSSProperties = {
    background: 'var(--color-bg-panel)',
    border: '1px solid var(--color-border)',
    borderRadius: 10, width: 640, maxHeight: '80vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 13,
    background: 'var(--color-bg-input)', border: '1px solid var(--color-border)',
    borderRadius: 6, color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Clone Repository
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {accounts.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            No accounts connected.<br />
            <span style={{ fontSize: 12 }}>Add a GitHub or GitLab account in Accounts settings first.</span>
          </div>
        ) : (
          <>
            {/* Account tabs */}
            <div style={{
              display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)',
              padding: '0 20px', flexShrink: 0
            }}>
              {accounts.map(acc => (
                <button
                  key={acc.host}
                  onClick={() => setActiveHost(acc.host)}
                  style={{
                    padding: '8px 14px', fontSize: 12, fontWeight: 500, border: 'none',
                    borderBottom: activeHost === acc.host ? '2px solid var(--color-accent)' : '2px solid transparent',
                    background: 'none', cursor: 'pointer',
                    color: activeHost === acc.host ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    marginBottom: -1
                  }}
                >
                  {acc.host === 'github.com' ? '⌥ GitHub' : acc.host === 'gitlab.com' ? '⌥ GitLab' : acc.host} · {acc.username}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search repositories…"
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* Repo list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 8px' }}>
              {reposLoading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Loading repositories…
                </div>
              )}
              {reposError && (
                <div style={{ padding: 16, color: 'var(--color-danger, #f87171)', fontSize: 13 }}>
                  {reposError}
                </div>
              )}
              {!reposLoading && !reposError && filtered.map(repo => (
                <div
                  key={repo.fullName}
                  onClick={() => setSelected(repo)}
                  style={{
                    padding: '9px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: selected?.fullName === repo.fullName ? 'rgba(124,140,248,0.12)' : 'transparent',
                    border: selected?.fullName === repo.fullName ? '1px solid rgba(124,140,248,0.3)' : '1px solid transparent'
                  }}
                  onMouseEnter={e => {
                    if (selected?.fullName !== repo.fullName)
                      (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-hover)'
                  }}
                  onMouseLeave={e => {
                    if (selected?.fullName !== repo.fullName)
                      (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {repo.fullName}
                    </span>
                    {repo.isPrivate && (
                      <span style={{
                        fontSize: 10, padding: '1px 5px', borderRadius: 4,
                        background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)'
                      }}>private</span>
                    )}
                  </div>
                  {repo.description && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.description}
                    </div>
                  )}
                </div>
              ))}
              {!reposLoading && !reposError && filtered.length === 0 && search && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  No repositories match "{search}"
                </div>
              )}
            </div>

            {/* Clone destination */}
            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Clone into folder
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={destDir}
                  onChange={e => setDestDir(e.target.value)}
                  placeholder="Choose a folder…"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={handleBrowse}
                  style={{
                    padding: '7px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)', whiteSpace: 'nowrap'
                  }}
                >
                  Browse…
                </button>
              </div>

              {selected && destDir && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  Will clone into: <span style={{ color: 'var(--color-text-secondary)' }}>{destDir}/{selected.name}</span>
                </div>
              )}

              {cloneError && (
                <div style={{ fontSize: 12, color: 'var(--color-danger, #f87171)', marginBottom: 10, padding: '6px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 4 }}>
                  {cloneError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '7px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClone}
                  disabled={!selected || !destDir || cloning}
                  style={{
                    padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                    background: 'var(--color-accent)', border: 'none', color: 'white',
                    opacity: (!selected || !destDir || cloning) ? 0.5 : 1
                  }}
                >
                  {cloning ? 'Cloning…' : 'Clone'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
