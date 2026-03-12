import { useRef, useCallback, useEffect, useState } from 'react'
import { useRepoStore, GraphNode } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'

const ROW_HEIGHT = 36
const LABEL_OFFSET_LEFT = 24  // px after the graph lanes area

interface Props {
  scrollTop: number
  containerHeight: number
  onCommitClick: (hash: string) => void
  graphLanesWidth: number
}

export function CommitList({ scrollTop, containerHeight, onCommitClick, graphLanesWidth }: Props) {
  const { graphNodes, refs, selectedHash } = useRepoStore()

  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
  const lastVisible = Math.min(
    graphNodes.length - 1,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 2
  )

  const refsByHash = new Map<string, RefInfo[]>()
  for (const ref of refs) {
    if (!refsByHash.has(ref.hash)) refsByHash.set(ref.hash, [])
    refsByHash.get(ref.hash)!.push(ref)
  }

  const visibleNodes = graphNodes.slice(firstVisible, lastVisible + 1)

  return (
    <div
      style={{
        position: 'absolute',
        top: firstVisible * ROW_HEIGHT,
        left: graphLanesWidth + LABEL_OFFSET_LEFT,
        right: 0,
        pointerEvents: 'none'
      }}
    >
      {visibleNodes.map((node) => {
        const isSelected = node.hash === selectedHash
        const nodeRefs = refsByHash.get(node.hash) ?? []

        return (
          <div
            key={node.hash}
            style={{
              height: ROW_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingRight: 12,
              cursor: 'pointer',
              pointerEvents: 'auto',
              background: isSelected ? 'transparent' : 'transparent'
            }}
            onClick={() => onCommitClick(node.hash)}
          >
            {/* Branch/tag labels */}
            <div className="flex items-center gap-1 flex-shrink-0 flex-wrap" style={{ maxWidth: 200 }}>
              {nodeRefs.filter(r => r.type === 'local' || r.type === 'tag').map(ref => (
                <RefLabel key={ref.name} ref_={ref} color={node.laneColor} />
              ))}
            </div>

            {/* Subject */}
            <span
              className="truncate text-xs"
              style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
            >
              {node.subject}
            </span>

            {/* Metadata */}
            <div className="ml-auto flex items-center gap-3 flex-shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>{node.authorName}</span>
              <span>{formatDate(node.authorDate)}</span>
              <span className="font-mono">{node.shortHash}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RefLabel({ ref_, color }: { ref_: RefInfo; color: string }) {
  const isHead = ref_.isHead
  const isTag = ref_.type === 'tag'
  const displayName = ref_.name.split('/').pop() ?? ref_.name

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium"
      style={{
        background: isHead ? color : isTag ? 'var(--color-bg-surface)' : 'var(--color-bg-surface)',
        color: isHead ? 'white' : color,
        border: `1px solid ${isHead ? color : color + '60'}`,
        maxWidth: 120
      }}
      title={ref_.name}
    >
      {isHead && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      {isTag && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      )}
      <span className="truncate">{displayName}</span>
    </span>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  } catch {
    return iso.slice(0, 10)
  }
}
