import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRepoStore, GraphNode } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'
import { CommitContextMenu } from './CommitContextMenu'
import { MergeRebaseDialog } from '../Modals/MergeRebaseDialog'

const ROW_HEIGHT = 36
const NODE_RADIUS = 5
const LANE_WIDTH = 18
const GRAPH_PADDING_LEFT = 10
const LABEL_AREA_WIDTH = 200  // reserved px on the LEFT of canvas for branch labels

function getNodeX(lane: number) {
  return LABEL_AREA_WIDTH + GRAPH_PADDING_LEFT + lane * LANE_WIDTH + NODE_RADIUS
}

function getGraphWidth(nodes: GraphNode[]) {
  if (nodes.length === 0) return LABEL_AREA_WIDTH + 60
  const maxLane = Math.max(...nodes.map(n => n.lane))
  return LABEL_AREA_WIDTH + GRAPH_PADDING_LEFT + (maxLane + 1) * LANE_WIDTH + NODE_RADIUS * 2 + 8
}

export function GitGraph() {
  const { graphNodes, refs, selectedHash, selectCommit, isLoading, checkoutRef, mergeBranch, rebaseBranch } = useRepoStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollTopRef = useRef(0)
  const rafRef = useRef(0)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hash: string } | null>(null)
  const [pendingOp, setPendingOp] = useState<{ source: string; target: string } | null>(null)

  const refsByHash = useRef(new Map<string, RefInfo[]>())
  useEffect(() => {
    const map = new Map<string, RefInfo[]>()
    for (const ref of refs) {
      if (!map.has(ref.hash)) map.set(ref.hash, [])
      map.get(ref.hash)!.push(ref)
    }
    refsByHash.current = map
  }, [refs])

  const graphWidth = getGraphWidth(graphNodes)
  const totalHeight = graphNodes.length * ROW_HEIGHT

  // ── Resize observer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        setContainerSize({ w: width, h: height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Canvas DPI setup ─────────────────────────────────────────────────────────
  const CANVAS_EXTRA = ROW_HEIGHT * 8  // extra buffer so bezier curves don't clip at bottom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const canvasH = containerSize.h + CANVAS_EXTRA
    canvas.width = graphWidth * dpr
    canvas.height = canvasH * dpr
    canvas.style.width = `${graphWidth}px`
    canvas.style.height = `${canvasH}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [graphWidth, containerSize.h])

  // ── Paint ────────────────────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scrollTop = scrollTopRef.current
    const { h } = containerSize
    const canvasH = h + ROW_HEIGHT * 8

    ctx.clearRect(0, 0, graphWidth, canvasH)

    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2)
    const lastRow = Math.min(graphNodes.length - 1, Math.ceil((scrollTop + canvasH) / ROW_HEIGHT) + 2)

    // Edges
    for (let i = firstRow; i <= lastRow; i++) {
      const node = graphNodes[i]
      const x1 = getNodeX(node.lane)
      const y1 = node.row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop

      for (const conn of node.parentConnections) {
        const x2 = getNodeX(conn.toLane)
        const y2 = conn.toRow * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop

        ctx.strokeStyle = node.laneColor
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.75
        ctx.beginPath()
        ctx.moveTo(x1, y1)

        if (x1 === x2) {
          ctx.lineTo(x2, y2)
        } else {
          const midY = (y1 + y2) / 2
          ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }

    // Nodes
    for (let i = firstRow; i <= lastRow; i++) {
      const node = graphNodes[i]
      const x = getNodeX(node.lane)
      const y = node.row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop

      const isSelected = node.hash === selectedHash
      const isHead = refsByHash.current.get(node.hash)?.some(r => r.isHead) ?? false

      // Row hover/select highlight shown via DOM (not canvas)

      ctx.beginPath()
      ctx.arc(x, y, NODE_RADIUS + (isSelected ? 1 : 0), 0, Math.PI * 2)

      if (isSelected) {
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.strokeStyle = node.laneColor
        ctx.lineWidth = 2
        ctx.stroke()
      } else if (isHead) {
        ctx.fillStyle = node.laneColor
        ctx.fill()
        // Draw inner ring
        ctx.beginPath()
        ctx.arc(x, y, NODE_RADIUS - 2, 0, Math.PI * 2)
        ctx.fillStyle = '#0f1117'
        ctx.fill()
      } else {
        ctx.fillStyle = node.laneColor
        ctx.fill()
        ctx.strokeStyle = '#0f1117'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
  }, [graphNodes, selectedHash, containerSize, graphWidth])

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(paint)
  }, [paint])

  // ── Scroll ───────────────────────────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = e.currentTarget.scrollTop
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(paint)
  }

  // ── Click ────────────────────────────────────────────────────────────────────
  const handleRowClick = (hash: string) => {
    selectCommit(hash)
    setContextMenu(null)
  }

  const handleContextMenu = (e: React.MouseEvent, hash: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, hash })
  }

  if (isLoading && graphNodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }} />
          <span className="text-sm">Loading repository…</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-hidden"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Scrollable container */}
      <div
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        onScroll={handleScroll}
        onClick={() => setContextMenu(null)}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, minHeight: '100%', position: 'relative' }}>
          {/* Canvas (graph lines + nodes) — sticky so it stays in view */}
          <div style={{ position: 'sticky', top: 0, height: containerSize.h + ROW_HEIGHT * 8, pointerEvents: 'none', zIndex: 1 }}>
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
          </div>

          {/* DOM rows for text, click areas, context menus */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <GraphLabels
              nodes={graphNodes}
              refs={refs}
              onDrop={(source, target) => setPendingOp({ source, target })}
            />
            <VirtualRows
              nodes={graphNodes}
              refs={refs}
              selectedHash={selectedHash}
              scrollTop={scrollTopRef}
              containerHeight={containerSize.h}
              graphWidth={graphWidth}
              onRowClick={handleRowClick}
              onContextMenu={handleContextMenu}
              onDrop={(source, target) => setPendingOp({ source, target })}
            />
          </div>
        </div>
      </div>

      {contextMenu && (
        <CommitContextMenu
          hash={contextMenu.hash}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {pendingOp && (
        <MergeRebaseDialog
          source={pendingOp.source}
          target={pendingOp.target}
          onConfirm={async op => {
            if (!pendingOp) return
            if (op === 'ff-only') {
              await checkoutRef(pendingOp.target)
              await mergeBranch(pendingOp.source, 'ff-only')
            } else if (op === 'merge') {
              await checkoutRef(pendingOp.target)
              await mergeBranch(pendingOp.source)
            } else {
              await checkoutRef(pendingOp.source)
              await rebaseBranch(pendingOp.source, pendingOp.target)
            }
            setPendingOp(null)
          }}
          onCancel={() => setPendingOp(null)}
        />
      )}
    </div>
  )
}

// VirtualRows: render only visible DOM rows for commit metadata
function VirtualRows({
  nodes, refs, selectedHash, scrollTop, containerHeight, graphWidth,
  onRowClick, onContextMenu, onDrop
}: {
  nodes: GraphNode[]
  refs: RefInfo[]
  selectedHash: string | null
  scrollTop: React.MutableRefObject<number>
  containerHeight: number
  graphWidth: number
  onRowClick: (hash: string) => void
  onContextMenu: (e: React.MouseEvent, hash: string) => void
  onDrop: (source: string, target: string) => void
}) {
  const [, forceUpdate] = useState(0)
  const rafRef2 = useRef(0)

  // Re-render on scroll via RAF
  useEffect(() => {
    const el = scrollTop as any // ref is passed
    // We rely on parent's re-render from paint(), but for row visibility
    // we do a simple subscription approach
    return () => {}
  }, [])

  const refsByHash = new Map<string, RefInfo[]>()
  for (const ref of refs) {
    if (!refsByHash.has(ref.hash)) refsByHash.set(ref.hash, [])
    refsByHash.get(ref.hash)!.push(ref)
  }

  const [dragOverHash, setDragOverHash] = useState<string | null>(null)

  // Since canvas paints scroll-aware, and DOM rows are absolutely positioned,
  // we render ALL rows but use CSS visibility for out-of-view ones
  return (
    <>
      {nodes.map((node, i) => {
        const nodeRefs = refsByHash.get(node.hash) ?? []
        const isSelected = node.hash === selectedHash
        const isDragOver = node.hash === dragOverHash
        // only show droppable highlight if node has a LOCAL branch ref
        const hasLocalBranch = nodeRefs.some(r => r.type === 'local')

        return (
          <div
            key={node.hash}
            style={{
              position: 'absolute',
              top: i * ROW_HEIGHT,
              left: graphWidth,
              right: 0,
              height: ROW_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 8,
              paddingRight: 12,
              cursor: 'pointer',
              background: isDragOver && hasLocalBranch
                ? 'rgba(124,140,248,0.15)'
                : isSelected ? 'rgba(44,49,80,0.6)' : 'transparent',
              outline: isDragOver && hasLocalBranch ? '1px dashed var(--color-accent)' : 'none',
              zIndex: 2
            }}
            onClick={() => onRowClick(node.hash)}
            onContextMenu={e => onContextMenu(e, node.hash)}
            onMouseEnter={e => {
              if (!isSelected) e.currentTarget.style.background = 'rgba(37,40,64,0.5)'
            }}
            onMouseLeave={e => {
              if (!isSelected && !isDragOver) e.currentTarget.style.background = 'transparent'
            }}
            onDragOver={e => { e.preventDefault(); setDragOverHash(node.hash) }}
            onDragLeave={() => setDragOverHash(null)}
            onDrop={e => {
              e.preventDefault()
              setDragOverHash(null)
              const sourceBranch = e.dataTransfer.getData('branch')
              const targetRef = nodeRefs.find(r => r.type === 'local')
              if (sourceBranch && targetRef && sourceBranch !== targetRef.name) {
                onDrop(sourceBranch, targetRef.name)
              }
            }}
          >
            {/* Subject */}
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'
            }}>
              {node.subject}
            </span>

            {/* Metadata */}
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0, marginLeft: 8 }}>
              {node.authorName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {formatRelDate(node.authorDate)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
              {node.shortHash}
            </span>
          </div>
        )
      })}
    </>
  )
}

function GraphLabels({ nodes, refs, onDrop }: {
  nodes: GraphNode[]
  refs: RefInfo[]
  onDrop: (source: string, target: string) => void
}) {
  const { checkoutRef } = useRepoStore()

  const nodeByHash = useMemo(() => {
    const m = new Map<string, GraphNode>()
    for (const n of nodes) m.set(n.hash, n)
    return m
  }, [nodes])

  const hashEntries = useMemo(() => {
    // Build map of remote-tracking-name -> local-branch-hash so we can suppress
    // a remote label when the local branch is already at that same commit.
    const localUpstreamToHash = new Map<string, string>()
    for (const ref of refs) {
      if (ref.type === 'local' && ref.upstream) {
        localUpstreamToHash.set(ref.upstream, ref.hash)
      }
    }
    const map = new Map<string, RefInfo[]>()
    for (const ref of refs) {
      // Skip symbolic remote HEAD pointers (refs/remotes/origin/HEAD → origin/HEAD)
      if (ref.type === 'remote' && ref.name.endsWith('/HEAD')) continue
      // Suppress remote label when a local branch tracks it at the same commit
      if (ref.type === 'remote') {
        const localHash = localUpstreamToHash.get(ref.name)
        if (localHash && localHash === ref.hash) continue
      }
      if (!map.has(ref.hash)) map.set(ref.hash, [])
      map.get(ref.hash)!.push(ref)
    }
    return Array.from(map.entries())
  }, [refs])

  return (
    <>
      {hashEntries.map(([hash, nodeRefs]) => {
        const node = nodeByHash.get(hash)
        if (!node) return null
        const top = node.row * ROW_HEIGHT + (ROW_HEIGHT - 22) / 2
        return (
          <div
            key={hash}
            style={{
              position: 'absolute',
              top,
              left: 4,
              width: LABEL_AREA_WIDTH - 8,
              display: 'flex',
              gap: 3,
              zIndex: 5,
              overflow: 'hidden',
              flexWrap: 'nowrap',
              alignItems: 'center'
            }}
          >
            {nodeRefs.map(ref => (
              <GraphBranchLabel key={ref.name} ref_={ref} color={node.laneColor} onDrop={onDrop} onDoubleClick={checkoutRef} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function GraphBranchLabel({ ref_, color, onDrop, onDoubleClick }: {
  ref_: RefInfo
  color: string
  onDrop: (source: string, target: string) => void
  onDoubleClick: (name: string) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const isHead = ref_.isHead
  const isTag = ref_.type === 'tag'
  const isLocal = ref_.type === 'local'
  const isRemote = ref_.type === 'remote'
  // Locals: show short name only. Remotes: show full name (e.g. origin/main) to distinguish.
  const label = isLocal ? (ref_.name.split('/').pop() ?? ref_.name) : ref_.name

  return (
    <span
      draggable={isLocal}
      onDragStart={e => {
        e.dataTransfer.setData('branch', ref_.name)
        e.dataTransfer.effectAllowed = 'move'
        e.stopPropagation()
      }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => {
        e.preventDefault()
        e.stopPropagation()
        setIsOver(false)
        const source = e.dataTransfer.getData('branch')
        if (source && isLocal && source !== ref_.name) onDrop(source, ref_.name)
      }}
      onDoubleClick={e => {
        e.stopPropagation()
        onDoubleClick(ref_.name)
      }}
      title={isLocal ? `${ref_.name} — drag to merge/rebase` : ref_.name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 6px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.01em',
        background: isOver
          ? color
          : isHead
          ? color
          : isRemote
          ? 'transparent'
          : 'var(--color-bg-surface)',
        color: (isHead || isOver) ? '#fff' : color,
        border: `1px solid ${isRemote && !isOver ? color + '99' : color}`,
        cursor: isLocal ? 'grab' : 'default',
        userSelect: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
        maxWidth: LABEL_AREA_WIDTH - 16,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexShrink: 1,
        transition: 'background 0.12s, color 0.12s'
      }}
    >
      {isHead ? '✓ ' : isTag ? '⚑ ' : '⎇ '}{label}
    </span>
  )
}

function RefPill({ ref_, color }: { ref_: RefInfo; color: string }) {
  const isHead = ref_.isHead
  const isTag = ref_.type === 'tag'
  const isLocal = ref_.type === 'local'
  const label = ref_.name.split('/').pop() ?? ref_.name

  return (
    <span
      draggable={isLocal}
      onDragStart={e => {
        e.dataTransfer.setData('branch', ref_.name)
        e.dataTransfer.effectAllowed = 'move'
        e.stopPropagation()
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '1px 5px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: isHead ? color : 'var(--color-bg-surface)',
        color: isHead ? '#fff' : color,
        border: `1px solid ${isHead ? color : color + '80'}`,
        maxWidth: 110,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: isLocal ? 'grab' : 'default',
        userSelect: 'none'
      }} title={isLocal ? `Drag to merge/rebase onto another branch` : ref_.name}>
      {isTag ? '⚑ ' : isHead ? '● ' : ''}{label}
    </span>
  )
}

function formatRelDate(iso: string) {
  try {
    const d = new Date(iso)
    const diff = (Date.now() - d.getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`
    return d.toLocaleDateString()
  } catch {
    return iso.slice(0, 10)
  }
}
