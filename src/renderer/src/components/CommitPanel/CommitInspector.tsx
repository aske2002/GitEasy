import { useState, useEffect } from 'react'
import { useRepoStore } from '../../store/repoStore'
import { DiffModal } from '../DiffViewer/DiffModal'
import type { DiffFile } from '../../../../shared/ipc'

interface ModalState {
  path: string
  diffFile: DiffFile | null
}

export function CommitInspector() {
  const {
    selectedHash, commits, commitDiff, commitDiffLoading,
    setInspectorOpen, checkoutCommit, resetToCommit
  } = useRepoStore()

  const [modal, setModal] = useState<ModalState | null>(null)

  // Close modal when the selected commit changes
  useEffect(() => { setModal(null) }, [selectedHash])

  const commit = commits.find(c => c.hash === selectedHash)

  if (!commit) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
        <span className="text-sm">Select a commit</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-bg-panel)', color: 'var(--color-text-primary)' }}
    >
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}>
        <span className="font-semibold text-sm flex-1">Commit</span>
        <button
          onClick={() => setInspectorOpen(false)}
          style={{ color: 'var(--color-text-muted)', padding: '2px 4px' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          ✕
        </button>
      </div>

      {/* Commit meta */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
        <p className="font-medium text-sm leading-snug mb-2">{commit.subject}</p>
        {commit.body && (
          <p className="text-xs mb-2 whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>
            {commit.body}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <MetaRow label="Author" value={`${commit.authorName} <${commit.authorEmail}>`} />
          <MetaRow label="Date" value={new Date(commit.authorDate).toLocaleString()} />
          <MetaRow label="SHA" value={commit.hash} mono copyable />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--color-border)' }}>
        <ActionBtn
          label="Checkout"
          onClick={() => {
            if (confirm('Checkout this commit? (Detached HEAD)')) checkoutCommit(commit.hash)
          }}
        />
        <ActionBtn
          label="Reset →"
          onClick={() => {}}
          dropdown={[
            { label: 'Soft reset', onClick: () => { if (confirm('Soft reset?')) resetToCommit(commit.hash, 'soft') } },
            { label: 'Mixed reset', onClick: () => { if (confirm('Mixed reset?')) resetToCommit(commit.hash, 'mixed') } },
            { label: 'Hard reset', danger: true, onClick: () => { if (confirm('Hard reset? All changes will be lost!')) resetToCommit(commit.hash, 'hard') } }
          ]}
        />
      </div>

      {/* File list — always visible; clicking opens the modal */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <FileList
          files={commitDiff}
          loading={commitDiffLoading}
          hash={commit.hash}
          onFileClick={(f) => setModal({ path: f.path, diffFile: f })}
          onViewFile={(path) => setModal({ path, diffFile: null })}
        />
      </div>

      {/* Diff modal — rendered as a fixed overlay so it covers the whole window */}
      {modal && (
        <DiffModal
          path={modal.path}
          diffFile={modal.diffFile}
          hash={commit.hash}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Tree types & builder ─────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  isDir: boolean
  children: TreeNode[]
  diff: DiffFile | null
}

function buildTree(paths: string[], diffByPath: Map<string, DiffFile>): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, children: [], diff: null }
  for (const filePath of paths) {
    const parts = filePath.split('/')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const isLast = i === parts.length - 1
      let child = cur.children.find(c => c.name === name)
      if (!child) {
        child = { name, path: parts.slice(0, i + 1).join('/'), isDir: !isLast, children: [], diff: isLast ? (diffByPath.get(filePath) ?? null) : null }
        cur.children.push(child)
      }
      cur = child
    }
  }
  function sort(n: TreeNode) {
    n.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sort)
  }
  sort(root)
  return root
}

function TreeView({
  nodes, depth = 0, collapsed, toggle, onFileClick, onViewFile
}: {
  nodes: TreeNode[]
  depth?: number
  collapsed: Set<string>
  toggle: (path: string) => void
  onFileClick: (f: DiffFile) => void
  onViewFile: (path: string) => void
}) {
  return (
    <>
      {nodes.map(node => {
        if (node.isDir) {
          const isCollapsed = collapsed.has(node.path)
          return (
            <div key={node.path}>
              <button
                onClick={() => toggle(node.path)}
                className="w-full flex items-center gap-1.5 text-left"
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12,
                  paddingLeft: 12 + depth * 14,
                  paddingTop: 4, paddingBottom: 4, paddingRight: 8
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 8, opacity: 0.6, width: 8, flexShrink: 0 }}>
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span style={{ opacity: 0.7, fontSize: 11, marginRight: 2 }}>📁</span>
                <span className="font-medium truncate">{node.name}</span>
              </button>
              {!isCollapsed && (
                <TreeView
                  nodes={node.children}
                  depth={depth + 1}
                  collapsed={collapsed}
                  toggle={toggle}
                  onFileClick={onFileClick}
                  onViewFile={onViewFile}
                />
              )}
            </div>
          )
        }
        return (
          <button
            key={node.path}
            onClick={() => node.diff ? onFileClick(node.diff) : onViewFile(node.path)}
            className="w-full flex items-center gap-2 text-left"
            style={{
              background: 'transparent', border: 'none',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 12,
              paddingLeft: 12 + depth * 14 + 12,
              paddingTop: 4, paddingBottom: 4, paddingRight: 8
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Click to view"
          >
            <FileIcon path={node.name} />
            <span className="flex-1 truncate">{node.name}</span>
            {node.diff ? (
              <>
                <span style={{ color: 'var(--color-green)', fontSize: 11 }}>+{node.diff.additions}</span>
                <span style={{ color: 'var(--color-red)', fontSize: 11 }}>-{node.diff.deletions}</span>
              </>
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>unchanged</span>
            )}
          </button>
        )
      })}
    </>
  )
}

// ── FileList ─────────────────────────────────────────────────────────────────

function FileList({
  files, loading, hash, onFileClick, onViewFile
}: {
  files: DiffFile[]
  loading: boolean
  hash: string
  onFileClick: (f: DiffFile) => void
  onViewFile: (path: string) => void
}) {
  const { repoPath } = useRepoStore()
  const [viewAll, setViewAll] = useState(false)
  const [treeMode, setTreeMode] = useState(true)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [allFilesLoading, setAllFilesLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    setViewAll(false)
    setAllFiles([])
    setCollapsed(new Set())
  }, [hash])

  useEffect(() => {
    if (!viewAll || allFiles.length > 0 || !repoPath) return
    setAllFilesLoading(true)
    window.git.getCommitFiles(repoPath, hash)
      .then(list => { setAllFiles(list); setAllFilesLoading(false) })
      .catch(() => setAllFilesLoading(false))
  }, [viewAll, repoPath, hash])

  const diffByPath = new Map(files.map(f => [f.path, f]))

  const toggleCollapsed = (path: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })

  if (loading && !viewAll) {
    return (
      <div className="flex items-center justify-center h-20" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        <span>Loading diff…</span>
      </div>
    )
  }

  const displayPaths = viewAll ? allFiles : files.map(f => f.path)
  const tree = treeMode ? buildTree(displayPaths, diffByPath) : null

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center px-3 py-2 text-xs gap-2"
        style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ color: 'var(--color-text-secondary)' }}>
          <input
            type="checkbox"
            checked={viewAll}
            onChange={e => setViewAll(e.target.checked)}
            style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
          />
          View all
        </label>
        <div style={{ display: 'flex', borderRadius: 4, border: '1px solid var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
          {(['tree', 'list'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setTreeMode(mode === 'tree')}
              style={{
                padding: '2px 8px', fontSize: 10, border: 'none',
                borderLeft: mode === 'list' ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                background: (mode === 'tree') === treeMode ? 'var(--color-accent)' : 'transparent',
                color: (mode === 'tree') === treeMode ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {mode === 'tree' ? 'Tree' : 'List'}
            </button>
          ))}
        </div>
        <span className="ml-auto">
          {viewAll
            ? (allFilesLoading ? '…' : `${allFiles.length} files`)
            : `${files.length} changed`}
        </span>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!viewAll && !loading && files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2" style={{ color: 'var(--color-text-muted)' }}>
          <span style={{ fontSize: 22 }}>✓</span>
          <span style={{ fontSize: 12 }}>No file changes in this commit</span>
        </div>
      )}

      {/* ── Loading all files ────────────────────────────────────────────── */}
      {viewAll && allFilesLoading && (
        <div className="flex items-center justify-center h-20" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          Loading files…
        </div>
      )}

      {/* ── Tree view ───────────────────────────────────────────────────── */}
      {treeMode && tree && !(viewAll && allFilesLoading) && tree.children.length > 0 && (
        <TreeView
          nodes={tree.children}
          collapsed={collapsed}
          toggle={toggleCollapsed}
          onFileClick={onFileClick}
          onViewFile={onViewFile}
        />
      )}

      {/* ── Flat list ──────────────────────────────────────────────────── */}
      {!treeMode && !viewAll && files.map(f => (
        <FileRow key={f.path} path={f.path} diff={f} onClick={() => onFileClick(f)} />
      ))}
      {!treeMode && viewAll && !allFilesLoading && allFiles.map(path => {
        const diff = diffByPath.get(path) ?? null
        return (
          <FileRow key={path} path={path} diff={diff} onClick={() => diff ? onFileClick(diff) : onViewFile(path)} />
        )
      })}
    </div>
  )
}

function FileRow({ path, diff, onClick }: { path: string; diff: DiffFile | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2 text-left"
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
        fontSize: 12
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      title="Click to view"
    >
      <FileIcon path={path} />
      <span className="flex-1 truncate">{path}</span>
      {diff ? (
        <>
          <span style={{ color: 'var(--color-green)', fontSize: 11 }}>+{diff.additions}</span>
          <span style={{ color: 'var(--color-red)', fontSize: 11 }}>-{diff.deletions}</span>
        </>
      ) : (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>unchanged</span>
      )}
    </button>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetaRow({ label, value, mono, copyable }: {
  label: string; value: string; mono?: boolean; copyable?: boolean
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="flex-shrink-0 w-12" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        className={`truncate flex-1 ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--color-text-secondary)', cursor: copyable ? 'pointer' : 'default' }}
        onClick={copyable ? () => navigator.clipboard.writeText(value) : undefined}
        title={copyable ? 'Click to copy' : value}
      >
        {value}
      </span>
    </div>
  )
}

function FileIcon({ path }: { path: string }) {
  const ext = path.split('.').pop() ?? ''
  const color = extColor(ext)
  return (
    <span style={{ width: 14, height: 14, flexShrink: 0, color, fontSize: 10 }}>{'◼'}</span>
  )
}

function extColor(ext: string): string {
  const map: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f7df1e', jsx: '#61dafb',
    css: '#563d7c', html: '#e34c26', json: '#cbcb41', py: '#3572A5',
    rs: '#dea584', go: '#00add8', md: '#083fa1', sh: '#89e051'
  }
  return map[ext.toLowerCase()] ?? 'var(--color-text-muted)'
}

function ActionBtn({ label, onClick, dropdown }: {
  label: string
  onClick: () => void
  dropdown?: { label: string; onClick: () => void; danger?: boolean }[]
}) {
  const [open, setOpen] = useState(false)

  if (!dropdown) {
    return (
      <button
        onClick={onClick}
        className="px-3 py-1 rounded text-xs font-medium"
        style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1 rounded text-xs font-medium"
        style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
      >
        {label}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
          borderRadius: 6, padding: '4px 0', minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          {dropdown.map(item => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false) }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: 'transparent', border: 'none',
                color: item.danger ? 'var(--color-red)' : 'var(--color-text-primary)',
                cursor: 'pointer', fontSize: 12, textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

