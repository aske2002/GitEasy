import type { DiffFile } from '../../../../shared/ipc'

interface Props {
  file: DiffFile
  /** When true, hides the file header (path/stats row) – used when the modal already shows it */
  hideHeader?: boolean
}

export function DiffViewer({ file, hideHeader }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)', overflow: 'hidden' }}>
      {/* File header – optional */}
      {!hideHeader && (
        <div
          className="px-4 py-2 flex items-center gap-3 text-xs font-sans flex-shrink-0"
          style={{ background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-border)' }}
        >
          <span style={{ color: 'var(--color-text-secondary)' }}>{file.path}</span>
          <span style={{ color: 'var(--color-green)' }}>+{file.additions}</span>
          <span style={{ color: 'var(--color-red)' }}>-{file.deletions}</span>
        </div>
      )}

      {/* Single scroll container — one horizontal scrollbar for the whole diff */}
      <div className="flex-1 font-mono text-xs" style={{ overflow: 'auto' }}>
        <div style={{ minWidth: 'max-content' }}>
          {file.hunks.map((hunk, hi) => (
            <div key={hi}>
              {/* Hunk header */}
              <div
                className="px-4 py-1"
                style={{ background: 'rgba(91,158,248,0.08)', color: 'var(--color-blue)', borderTop: '1px solid var(--color-border)' }}
              >
                {hunk.header}
              </div>

              {/* Lines */}
              {hunk.lines.map((line, li) => {
                const bg =
                  line.type === 'add' ? 'rgba(76,175,130,0.12)' :
                  line.type === 'del' ? 'rgba(224,92,106,0.12)' :
                  'transparent'
                const color =
                  line.type === 'add' ? 'var(--color-green)' :
                  line.type === 'del' ? 'var(--color-red)' :
                  'var(--color-text-muted)'
                const prefix =
                  line.type === 'add' ? '+' :
                  line.type === 'del' ? '-' :
                  ' '

                return (
                  <div key={li} style={{ display: 'flex', background: bg, minHeight: 20 }}>
                    {/* Old line number */}
                    <div style={{ width: 40, textAlign: 'right', paddingRight: 8, color: 'var(--color-text-muted)', userSelect: 'none', flexShrink: 0, lineHeight: '20px', paddingTop: 1, paddingBottom: 1 }}>
                      {line.oldLine ?? ''}
                    </div>
                    {/* New line number */}
                    <div style={{ width: 40, textAlign: 'right', paddingRight: 8, color: 'var(--color-text-muted)', userSelect: 'none', flexShrink: 0, lineHeight: '20px', paddingTop: 1, paddingBottom: 1 }}>
                      {line.newLine ?? ''}
                    </div>
                    {/* +/- prefix */}
                    <div style={{ width: 16, color, flexShrink: 0, lineHeight: '20px', paddingTop: 1, paddingBottom: 1 }}>
                      {prefix}
                    </div>
                    {/* Content — no per-line overflow; parent handles horizontal scroll */}
                    <div style={{ whiteSpace: 'pre', color: 'var(--color-text-primary)', lineHeight: '20px', paddingTop: 1, paddingBottom: 1, paddingRight: 24 }}>
                      {line.content}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {file.hunks.length === 0 && (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No changes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
