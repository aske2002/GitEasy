import { useEffect, useRef, useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import type { RemoteConfig } from '../../../../shared/ipc'

interface Props {
  onClose: () => void
}

export function RemotesModal({ onClose }: Props) {
  const { repoPath, refresh } = useRepoStore()
  const [remotes, setRemotes] = useState<RemoteConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!repoPath) return
    setLoading(true)
    setError(null)
    const list = await window.git.listRemotes(repoPath)
    setRemotes(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [repoPath])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleOp = async (op: () => Promise<{ success: boolean; error?: string } | void>) => {
    setError(null)
    const result = await op()
    if (result && !result.success) { setError(result.error ?? 'Operation failed'); return }
    await load()
    await refresh()
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 560, maxHeight: '80vh',
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Manage Remotes</span>
          <button
            onClick={onClose}
            className="ml-auto"
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-3">
          {loading && <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading remotes…</div>}
          {!loading && remotes.length === 0 && (
            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No remotes configured.</div>
          )}
          {!loading && remotes.map(remote => (
            <RemoteRow
              key={remote.name}
              remote={remote}
              repoPath={repoPath!}
              onDone={() => handleOp(async () => { await load(); await refresh() })}
              onError={msg => setError(msg)}
              onRefresh={load}
              onRefreshStore={refresh}
            />
          ))}

          {error && (
            <div className="text-xs px-3 py-2 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              {error}
            </div>
          )}
        </div>

        {/* Add remote form */}
        <AddRemoteForm repoPath={repoPath!} onAdd={() => handleOp(async () => { await load(); await refresh() })} />
      </div>
    </div>
  )
}

function RemoteRow({
  remote, repoPath, onRefresh, onRefreshStore, onError
}: {
  remote: RemoteConfig
  repoPath: string
  onDone: () => void
  onRefresh: () => void
  onRefreshStore: () => void
  onError: (msg: string) => void
}) {
  const [editingUrl, setEditingUrl] = useState(false)
  const [newUrl, setNewUrl] = useState(remote.fetchUrl)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(remote.name)
  const [busy, setBusy] = useState(false)

  const run = async (op: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(true)
    const result = await op()
    setBusy(false)
    if (!result.success) { onError(result.error ?? 'Operation failed'); return }
    onRefresh()
    onRefreshStore()
  }

  const handleSaveUrl = () => {
    const trimmed = newUrl.trim()
    if (!trimmed || trimmed === remote.fetchUrl) { setEditingUrl(false); return }
    run(() => window.git.setRemoteUrl(repoPath, remote.name, trimmed))
    setEditingUrl(false)
  }

  const handleSaveName = () => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === remote.name) { setEditingName(false); return }
    run(() => window.git.renameRemote(repoPath, remote.name, trimmed))
    setEditingName(false)
  }

  const handleRemove = () => {
    if (!window.confirm(`Remove remote "${remote.name}"?`)) return
    run(() => window.git.removeRemote(repoPath, remote.name))
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-base)',
    border: '1px solid var(--color-accent)',
    borderRadius: 4,
    color: 'var(--color-text-primary)',
    padding: '3px 8px',
    fontSize: 12,
    outline: 'none',
    width: '100%'
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', opacity: busy ? 0.6 : 1 }}
    >
      {/* Remote name row */}
      <div className="flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        {editingName ? (
          <div className="flex items-center gap-1 flex-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
              style={{ ...inputStyle, width: 140 }}
              autoFocus
            />
            <IconBtn title="Save" onClick={handleSaveName}>✓</IconBtn>
            <IconBtn title="Cancel" onClick={() => setEditingName(false)}>✕</IconBtn>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{remote.name}</span>
            <IconBtn title="Rename remote" onClick={() => { setEditingName(true); setNewName(remote.name) }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </IconBtn>
          </>
        )}
        <button
          onClick={handleRemove}
          title="Remove remote"
          className="ml-auto text-xs px-2 py-1 rounded"
          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
        >
          Remove
        </button>
      </div>

      {/* Fetch URL */}
      <UrlRow
        label="Fetch"
        url={remote.fetchUrl}
        editing={editingUrl}
        value={newUrl}
        onChange={setNewUrl}
        onStartEdit={() => { setEditingUrl(true); setNewUrl(remote.fetchUrl) }}
        onSave={handleSaveUrl}
        onCancel={() => setEditingUrl(false)}
        inputStyle={inputStyle}
      />

      {/* Push URL (only show if different from fetch) */}
      {remote.pushUrl && remote.pushUrl !== remote.fetchUrl && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium w-10 shrink-0" style={{ color: 'var(--color-text-muted)' }}>Push</span>
          <span className="text-xs flex-1 truncate font-mono" style={{ color: 'var(--color-text-secondary)' }} title={remote.pushUrl}>{remote.pushUrl}</span>
        </div>
      )}
    </div>
  )
}

function UrlRow({
  label, url, editing, value, onChange, onStartEdit, onSave, onCancel, inputStyle
}: {
  label: string
  url: string
  editing: boolean
  value: string
  onChange: (v: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
  inputStyle: React.CSSProperties
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium w-10 shrink-0" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            style={inputStyle}
            autoFocus
          />
          <IconBtn title="Save" onClick={onSave}>✓</IconBtn>
          <IconBtn title="Cancel" onClick={onCancel}>✕</IconBtn>
        </div>
      ) : (
        <>
          <span
            className="text-xs flex-1 truncate font-mono"
            style={{ color: 'var(--color-text-secondary)' }}
            title={url}
          >{url || <em style={{ opacity: 0.5 }}>—</em>}</span>
          <IconBtn title={`Edit ${label.toLowerCase()} URL`} onClick={onStartEdit}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </IconBtn>
        </>
      )}
    </div>
  )
}

function AddRemoteForm({ repoPath, onAdd }: { repoPath: string; onAdd: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleAdd = async () => {
    const trimName = name.trim()
    const trimUrl = url.trim()
    if (!trimName || !trimUrl) return
    setBusy(true)
    setError(null)
    const result = await window.git.addRemote(repoPath, trimName, trimUrl)
    setBusy(false)
    if (!result.success) { setError(result.error ?? 'Failed to add remote'); return }
    setName('')
    setUrl('')
    onAdd()
  }

  return (
    <div className="px-5 py-4 border-t flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>Add Remote</div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name (e.g. origin)"
          style={{
            width: 130, flexShrink: 0,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-primary)',
            padding: '6px 10px', fontSize: 12, outline: 'none'
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="URL (https:// or git@...)"
          style={{
            flex: 1,
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-primary)',
            padding: '6px 10px', fontSize: 12, outline: 'none'
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !name.trim() || !url.trim()}
          style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff',
            opacity: (busy || !name.trim() || !url.trim()) ? 0.4 : 1
          }}
        >
          {busy ? '…' : 'Add'}
        </button>
      </div>
      {error && (
        <div className="text-xs" style={{ color: '#f87171' }}>{error}</div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--color-text-muted)', padding: '2px 4px', borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
    >
      {children}
    </button>
  )
}
