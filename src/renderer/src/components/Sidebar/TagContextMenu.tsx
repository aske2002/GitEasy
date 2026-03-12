import { useEffect, useRef, useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'

interface Props {
  ref_: RefInfo
  x: number
  y: number
  onClose: () => void
}

export function TagContextMenu({ ref_, x, y, onClose }: Props) {
  const { pushTag, deleteTag } = useRepoStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    setPos({
      x: rect.right > window.innerWidth ? x - rect.width : x,
      y: rect.bottom > window.innerHeight ? y - rect.height : y
    })
  }, [x, y])

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

  const name = ref_.name

  const handlePush = async () => {
    onClose()
    await pushTag(name)
  }

  const handleDelete = async () => {
    onClose()
    if (!window.confirm(`Delete tag "${name}"?`)) return
    await deleteTag(name)
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        minWidth: 180,
        background: 'var(--color-bg-surface)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        padding: '4px 0',
        fontSize: 12
      }}
    >
      <div style={{
        padding: '6px 14px 8px',
        color: 'var(--color-text-muted)',
        fontSize: 11,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 3
      }}>
        <span style={{ marginRight: 5 }}>⚑</span>
        {name}
      </div>

      <MenuItem onClick={handlePush}>Push Tag to Remote</MenuItem>
      <div style={{ height: 1, background: 'var(--color-bg-hover)', margin: '3px 0' }} />
      <MenuItem onClick={handleDelete} danger>Delete Tag</MenuItem>
    </div>
  )
}

function MenuItem({ children, onClick, danger = false }: {
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
