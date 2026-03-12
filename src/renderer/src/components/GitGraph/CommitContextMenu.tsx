import { useEffect, useRef } from 'react'
import { useRepoStore } from '../../store/repoStore'

interface Props {
  hash: string
  x: number
  y: number
  onClose: () => void
}

export function CommitContextMenu({ hash, x, y, onClose }: Props) {
  const { checkoutCommit, resetToCommit, repoPath } = useRepoStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Adjust position to stay on screen
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 220)

  const handleCheckout = () => {
    if (confirm('Checkout this commit? (Detached HEAD)')) {
      checkoutCommit(hash)
    }
    onClose()
  }

  const handleReset = (mode: 'soft' | 'mixed' | 'hard') => {
    const labels = { soft: 'Soft (keep staged)', mixed: 'Mixed (keep working tree)', hard: 'Hard (discard all changes)' }
    if (confirm(`Reset HEAD to this commit?\n${labels[mode]}`)) {
      resetToCommit(hash, mode)
    }
    onClose()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(hash)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 1000,
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '4px 0',
        minWidth: 200,
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
      }}
    >
      <MenuItem label="Checkout commit" onClick={handleCheckout} icon="⎇" />
      <Separator />
      <MenuLabel label="Reset to here…" />
      <MenuItem label="Soft reset" onClick={() => handleReset('soft')} sublabel="keep staged" />
      <MenuItem label="Mixed reset" onClick={() => handleReset('mixed')} sublabel="keep working tree" />
      <MenuItem label="Hard reset" onClick={() => handleReset('hard')} sublabel="discard all" danger />
      <Separator />
      <MenuItem label="Copy SHA" onClick={handleCopy} icon="⬚" />
    </div>
  )
}

function MenuItem({ label, onClick, icon, sublabel, danger }: {
  label: string
  onClick: () => void
  icon?: string
  sublabel?: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 12px',
        background: 'transparent',
        border: 'none',
        color: danger ? 'var(--color-red)' : 'var(--color-text-primary)',
        cursor: 'pointer',
        fontSize: 12,
        textAlign: 'left'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon && <span style={{ flexShrink: 0, opacity: 0.7 }}>{icon}</span>}
      <span>{label}</span>
      {sublabel && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>{sublabel}</span>}
    </button>
  )
}

function MenuLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '2px 12px', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600 }}>
      {label}
    </div>
  )
}

function Separator() {
  return <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 0' }} />
}
