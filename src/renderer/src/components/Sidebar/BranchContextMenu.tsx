import { useEffect, useRef, useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'

interface Props {
  ref_: RefInfo
  x: number
  y: number
  onClose: () => void
}

export function BranchContextMenu({ ref_, x, y, onClose }: Props) {
  const { checkoutRef, deleteBranch, renameBranch, pushCurrent, refs } = useRepoStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(ref_.name.split('/').pop() ?? ref_.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Adjust position so menu doesn't go off screen
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    setPos({
      x: rect.right > vw ? x - rect.width : x,
      y: rect.bottom > vh ? y - rect.height : y
    })
  }, [x, y])

  useEffect(() => {
    if (renaming) inputRef.current?.focus()
  }, [renaming])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isHead = ref_.isHead
  const isLocal = ref_.type === 'local'
  const displayName = ref_.name.split('/').pop() ?? ref_.name

  const handleCheckout = async () => {
    onClose()
    await checkoutRef(ref_.name)
  }

  const handleDelete = async () => {
    onClose()
    if (!window.confirm(`Delete branch "${displayName}"?`)) return
    await deleteBranch(ref_.name, false)
  }

  const handleForceDelete = async () => {
    onClose()
    if (!window.confirm(`Force-delete branch "${displayName}"? Unmerged commits will be lost.`)) return
    await deleteBranch(ref_.name, true)
  }

  const handleRename = () => {
    setRenaming(true)
  }

  const commitRename = async () => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === displayName) { onClose(); return }
    onClose()
    await renameBranch(ref_.name, trimmed)
  }

  const handlePush = async () => {
    onClose()
    // Checkout first if not HEAD, then push
    if (!isHead) await checkoutRef(ref_.name)
    const store = useRepoStore.getState()
    await store.pushCurrent()
  }

  const sep = <div style={{ height: 1, background: 'var(--color-bg-hover)', margin: '3px 0' }} />

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        minWidth: 190,
        background: 'var(--color-bg-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '4px 0',
        fontSize: 12
      }}
    >
      {/* Branch name header */}
      <div style={{
        padding: '6px 14px 8px',
        color: 'var(--color-text-muted)',
        fontSize: 11,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 3
      }}>
        <span style={{ color: 'var(--color-accent)', marginRight: 5 }}>⎇</span>
        {displayName}
        {isHead && <span style={{ marginLeft: 6, color: 'var(--color-green)', fontSize: 10 }}>HEAD</span>}
      </div>

      {!isHead && (
        <MenuItem onClick={handleCheckout}>Checkout</MenuItem>
      )}

      {isLocal && !renaming && (
        <MenuItem onClick={handleRename}>Rename…</MenuItem>
      )}

      {renaming && (
        <div style={{ padding: '4px 10px' }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') onClose() }}
            style={{
              width: '100%',
              background: 'var(--color-bg-base)',
              border: '1px solid var(--color-accent)',
              borderRadius: 4,
              color: 'var(--color-text-primary)',
              padding: '3px 7px',
              fontSize: 12,
              outline: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            <button
              onClick={commitRename}
              style={{
                flex: 1, padding: '3px 0', background: 'var(--color-accent)', border: 'none',
                borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer'
              }}
            >Rename</button>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '3px 0', background: 'var(--color-bg-hover)', border: 'none',
                borderRadius: 4, color: 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer'
              }}
            >Cancel</button>
          </div>
        </div>
      )}

      {isLocal && sep}

      {isLocal && (
        <MenuItem onClick={handlePush}>Push to Remote</MenuItem>
      )}

      {sep}

      {isLocal && !isHead && (
        <MenuItem onClick={handleDelete} danger>Delete Branch</MenuItem>
      )}
      {isLocal && !isHead && (
        <MenuItem onClick={handleForceDelete} danger>Force Delete</MenuItem>
      )}
    </div>
  )
}

function MenuItem({
  children, onClick, danger = false
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 14px',
        cursor: 'pointer',
        color: danger
          ? hover ? '#ff6b6b' : 'var(--color-red)'
          : hover ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        background: hover ? 'var(--color-bg-hover)' : 'transparent',
        transition: 'background 0.1s'
      }}
    >
      {children}
    </div>
  )
}
