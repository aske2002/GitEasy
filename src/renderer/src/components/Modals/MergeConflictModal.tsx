import { useState, useEffect } from 'react'
import type { ConflictContent, ConflictSegmentConflict } from '../../../../shared/ipc'

interface Props {
  repoPath: string
  filePath: string
  onClose: () => void
  onResolved: () => void
}

type Resolution = 'ours' | 'theirs' | 'both-ours-first' | 'both-theirs-first' | 'manual'

interface ConflictState {
  resolution: Resolution
  manualLines: string[]
}

function buildResolvedContent(conflict: ConflictContent, states: ConflictState[]): string {
  const parts: string[] = []
  let conflictIdx = 0

  for (const seg of conflict.segments) {
    if (seg.type === 'normal') {
      parts.push(seg.lines.join('\n'))
    } else {
      const state = states[conflictIdx] ?? { resolution: 'ours', manualLines: seg.oursLines }
      conflictIdx++
      switch (state.resolution) {
        case 'ours':
          parts.push(seg.oursLines.join('\n'))
          break
        case 'theirs':
          parts.push(seg.theirsLines.join('\n'))
          break
        case 'both-ours-first':
          parts.push([...seg.oursLines, ...seg.theirsLines].join('\n'))
          break
        case 'both-theirs-first':
          parts.push([...seg.theirsLines, ...seg.oursLines].join('\n'))
          break
        case 'manual':
          parts.push(state.manualLines.join('\n'))
          break
      }
    }
  }

  return parts.join('\n')
}

export function MergeConflictModal({ repoPath, filePath, onClose, onResolved }: Props) {
  const [conflict, setConflict] = useState<ConflictContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [states, setStates] = useState<ConflictState[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.git.getConflictContent(repoPath, filePath)
      .then(c => {
        setConflict(c)
        const conflicts = c.segments.filter(s => s.type === 'conflict') as ConflictSegmentConflict[]
        setStates(conflicts.map(seg => ({ resolution: 'ours' as Resolution, manualLines: [...seg.oursLines] })))
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [repoPath, filePath])

  const setResolution = (idx: number, resolution: Resolution) => {
    setStates(prev => prev.map((s, i) => {
      if (i !== idx) return s
      const conflicts = conflict!.segments.filter(s => s.type === 'conflict') as ConflictSegmentConflict[]
      const seg = conflicts[idx]
      let manualLines = s.manualLines
      if (resolution === 'ours') manualLines = [...seg.oursLines]
      else if (resolution === 'theirs') manualLines = [...seg.theirsLines]
      else if (resolution === 'both-ours-first') manualLines = [...seg.oursLines, ...seg.theirsLines]
      else if (resolution === 'both-theirs-first') manualLines = [...seg.theirsLines, ...seg.oursLines]
      return { resolution, manualLines }
    }))
  }

  const setManual = (idx: number, text: string) => {
    setStates(prev => prev.map((s, i) =>
      i === idx ? { resolution: 'manual', manualLines: text.split('\n') } : s
    ))
  }

  const handleSave = async () => {
    if (!conflict) return
    setSaving(true)
    setSaveError(null)
    try {
      const resolved = buildResolvedContent(conflict, states)
      await window.git.resolveConflict(repoPath, filePath, resolved)
      onResolved()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const total = states.length

  const preview = conflict ? buildResolvedContent(conflict, states) : ''

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          width: '90vw', maxWidth: 960,
          height: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0
        }}>
          <span style={{ fontSize: 15, color: 'var(--color-yellow)', fontWeight: 600 }}>⚠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Resolve Merge Conflicts
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filePath}
            </div>
          </div>
          {conflict && (
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
              {total} conflict{total !== 1 ? 's' : ''}
            </div>
          )}
          <button
            onClick={() => setPreviewMode(p => !p)}
            style={{
              background: previewMode ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 5, padding: '3px 10px',
              fontSize: 11, cursor: 'pointer',
              color: previewMode ? '#fff' : 'var(--color-text-primary)'
            }}
          >
            Preview
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1, padding: '2px 4px'
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Loading conflicts…
            </div>
          )}
          {error && (
            <div style={{ padding: 32, color: 'var(--color-red)', fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && conflict && previewMode && (
            <pre style={{
              margin: 0, padding: 16,
              fontFamily: 'monospace', fontSize: 12,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre', overflowX: 'auto'
            }}>
              {preview}
            </pre>
          )}
          {!loading && !error && conflict && !previewMode && (
            <ConflictEditor conflict={conflict} states={states} onSetResolution={setResolution} onSetManual={setManual} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0
        }}>
          {saveError && (
            <div style={{ flex: 1, fontSize: 11, color: 'var(--color-red)' }}>{saveError}</div>
          )}
          {!saveError && (
            <div style={{ flex: 1, fontSize: 11, color: 'var(--color-text-muted)' }}>
              Choose a resolution for each conflict, then save.
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
              color: 'var(--color-text-primary)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !conflict}
            style={{
              background: 'var(--color-accent)', border: 'none',
              borderRadius: 6, padding: '5px 14px', fontSize: 12,
              cursor: (saving || !conflict) ? 'not-allowed' : 'pointer',
              color: '#fff', opacity: (saving || !conflict) ? 0.6 : 1, fontWeight: 600
            }}
          >
            {saving ? 'Saving…' : 'Save & Mark Resolved'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditorProps {
  conflict: ConflictContent
  states: ConflictState[]
  onSetResolution: (idx: number, r: Resolution) => void
  onSetManual: (idx: number, text: string) => void
}

function ConflictEditor({ conflict, states, onSetResolution, onSetManual }: EditorProps) {
  let conflictIdx = 0

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {conflict.segments.map((seg, si) => {
        if (seg.type === 'normal') {
          return (
            <div key={si}>
              {seg.lines.map((line, li) => (
                <div key={li} style={{
                  padding: '0 16px', lineHeight: '18px',
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'pre'
                }}>
                  {line}
                </div>
              ))}
            </div>
          )
        }

        const idx = conflictIdx++
        const state = states[idx]
        if (!state) return null

        return (
          <ConflictBlock
            key={si}
            index={idx}
            seg={seg}
            state={state}
            onSetResolution={r => onSetResolution(idx, r)}
            onSetManual={t => onSetManual(idx, t)}
          />
        )
      })}
    </div>
  )
}

interface BlockProps {
  index: number
  seg: ConflictSegmentConflict
  state: ConflictState
  onSetResolution: (r: Resolution) => void
  onSetManual: (text: string) => void
}

function ConflictBlock({ index, seg, state, onSetResolution, onSetManual }: BlockProps) {
  const isManual = state.resolution === 'manual'

  return (
    <div style={{
      margin: '8px 0',
      border: '1px solid var(--color-border)',
      borderRadius: 6,
      overflow: 'hidden'
    }}>
      {/* Conflict header */}
      <div style={{
        background: 'rgba(240,181,85,0.12)',
        borderBottom: '1px solid var(--color-border)',
        padding: '4px 12px',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-yellow)' }}>
          Conflict #{index + 1}
        </span>
        <div style={{ flex: 1 }} />
        {/* Resolution buttons */}
        {(['ours', 'theirs', 'both-ours-first', 'both-theirs-first'] as Resolution[]).map(r => (
          <button
            key={r}
            onClick={() => onSetResolution(r)}
            style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              border: '1px solid',
              borderColor: state.resolution === r ? 'var(--color-accent)' : 'var(--color-border)',
              background: state.resolution === r ? 'var(--color-accent)' : 'var(--color-bg-surface)',
              color: state.resolution === r ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer', fontFamily: 'sans-serif'
            }}
          >
            {r === 'ours' ? 'Accept Ours' :
             r === 'theirs' ? 'Accept Theirs' :
             r === 'both-ours-first' ? 'Both (↑)' :
             'Both (↓)'}
          </button>
        ))}
        <button
          onClick={() => onSetResolution('manual')}
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            border: '1px solid',
            borderColor: isManual ? 'var(--color-blue)' : 'var(--color-border)',
            background: isManual ? 'rgba(91,158,248,0.15)' : 'var(--color-bg-surface)',
            color: isManual ? 'var(--color-blue)' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontFamily: 'sans-serif'
          }}
        >
          Edit
        </button>
      </div>

      {/* Side-by-side or manual */}
      {!isManual ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Ours */}
          <div style={{ borderRight: '1px solid var(--color-border)' }}>
            <div style={{
              padding: '2px 12px', fontSize: 10, fontFamily: 'sans-serif',
              color: 'var(--color-green)', fontWeight: 600,
              borderBottom: '1px solid var(--color-border)',
              background: 'rgba(76,175,130,0.06)'
            }}>
              HEAD (ours)
            </div>
            <div style={{
              background: state.resolution === 'ours' || state.resolution === 'both-ours-first' || state.resolution === 'both-theirs-first'
                ? 'rgba(76,175,130,0.07)' : 'transparent'
            }}>
              {seg.oursLines.length === 0
                ? <div style={{ padding: '4px 12px', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 11 }}>(empty)</div>
                : seg.oursLines.map((line, li) => (
                  <div key={li} style={{ padding: '0 12px', lineHeight: '18px', whiteSpace: 'pre', color: 'var(--color-text-primary)' }}>
                    {line}
                  </div>
                ))
              }
            </div>
          </div>

          {/* Theirs */}
          <div>
            <div style={{
              padding: '2px 12px', fontSize: 10, fontFamily: 'sans-serif',
              color: 'var(--color-blue)', fontWeight: 600,
              borderBottom: '1px solid var(--color-border)',
              background: 'rgba(91,158,248,0.06)'
            }}>
              {seg.theirLabel || 'Incoming (theirs)'}
            </div>
            <div style={{
              background: state.resolution === 'theirs' || state.resolution === 'both-ours-first' || state.resolution === 'both-theirs-first'
                ? 'rgba(91,158,248,0.07)' : 'transparent'
            }}>
              {seg.theirsLines.length === 0
                ? <div style={{ padding: '4px 12px', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 11 }}>(empty)</div>
                : seg.theirsLines.map((line, li) => (
                  <div key={li} style={{ padding: '0 12px', lineHeight: '18px', whiteSpace: 'pre', color: 'var(--color-text-primary)' }}>
                    {line}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            padding: '2px 12px', fontSize: 10, fontFamily: 'sans-serif',
            color: 'var(--color-blue)', fontWeight: 600,
            borderBottom: '1px solid var(--color-border)',
            background: 'rgba(91,158,248,0.06)'
          }}>
            Manual edit
          </div>
          <textarea
            value={state.manualLines.join('\n')}
            onChange={e => onSetManual(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', boxSizing: 'border-box',
              minHeight: Math.max(80, state.manualLines.length * 18 + 16),
              background: 'var(--color-bg-base)',
              color: 'var(--color-text-primary)',
              border: 'none', outline: 'none',
              padding: '8px 12px', fontFamily: 'monospace', fontSize: 12,
              resize: 'vertical'
            }}
          />
        </div>
      )}
    </div>
  )
}
