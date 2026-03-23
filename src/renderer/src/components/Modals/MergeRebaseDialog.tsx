import { useState, useEffect } from 'react'
import { useRepoStore } from '../../store/repoStore'

export function MergeRebaseDialog({
  source,
  target,
  allowMerge = true,
  onConfirm,
  onCancel
}: {
  source: string
  target: string
  allowMerge?: boolean
  onConfirm: (op: 'merge' | 'rebase' | 'ff-only') => void
  onCancel: () => void
}) {
  const repoPath = useRepoStore(s => s.repoPath)
  const [ffPossible, setFfPossible] = useState<boolean | null>(null)

  useEffect(() => {
    if (!repoPath || !allowMerge) return
    window.git.canFfOnly(repoPath, source, target).then(setFfPossible).catch(() => setFfPossible(false))
  }, [repoPath, source, target, allowMerge])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
      onClick={onCancel}
    >
      <div style={{
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '24px',
        minWidth: 380,
        maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
      }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Branch Operation
        </h3>

        <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <div style={{ marginBottom: 8 }}>
            Source: <Tag label={source} color="var(--color-accent)" />
            {' '}→{' '}
            Target: <Tag label={target} color="var(--color-green)" />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
            {allowMerge
              ? <>Choose how to integrate <strong>{source}</strong> into <strong>{target}</strong>:</>
              : <>Rebase <strong>{source}</strong> onto <strong>{target}</strong>:</>}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {allowMerge && ffPossible === true && (
            <OptionBtn
              title="Fast Forward"
              desc={`Move ${target} pointer forward to ${source} — no merge commit`}
              onClick={() => onConfirm('ff-only')}
            />
          )}
          {allowMerge && (
            <OptionBtn
              title="Merge"
              desc={`Create a merge commit combining ${source} into ${target}`}
              onClick={() => onConfirm('merge')}
            />
          )}
          <OptionBtn
            title={allowMerge ? 'Rebase' : 'Rebase Onto Remote'}
            desc={`Rebase ${source} onto ${target} (rewrites history)`}
            onClick={() => onConfirm('rebase')}
            warn
          />
        </div>

        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '8px', background: 'transparent',
            border: '1px solid var(--color-border)', borderRadius: 6,
            color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 12
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 4,
      background: color + '20', color, border: `1px solid ${color}60`,
      fontSize: 11, fontWeight: 600
    }}>
      {label}
    </span>
  )
}

function OptionBtn({ title, desc, onClick, warn }: {
  title: string; desc: string; onClick: () => void; warn?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 14px', background: 'var(--color-bg-surface)',
        border: `1px solid ${warn ? 'var(--color-yellow)40' : 'var(--color-border)'}`,
        borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}
    >
      <div style={{ fontWeight: 600, fontSize: 13, color: warn ? 'var(--color-yellow)' : 'var(--color-text-primary)', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{desc}</div>
    </button>
  )
}
