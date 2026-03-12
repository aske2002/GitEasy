import { useEffect, useRef, useCallback } from 'react'
import { useRepoStore, GraphNode } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'

const ROW_HEIGHT = 36
const NODE_RADIUS = 5
const LANE_WIDTH = 20
const GRAPH_PADDING_LEFT = 12

interface RenderState {
  nodes: GraphNode[]
  refs: RefInfo[]
  selectedHash: string | null
  scrollTop: number
  canvasHeight: number
  canvasWidth: number
}

function getNodeX(lane: number) {
  return GRAPH_PADDING_LEFT + lane * LANE_WIDTH + NODE_RADIUS
}

function getNodeY(row: number, scrollTop: number) {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function renderGraph(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { nodes, refs, selectedHash, scrollTop, canvasHeight, canvasWidth } = state

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 1)
  const lastVisibleRow = Math.min(nodes.length - 1, Math.ceil((scrollTop + canvasHeight) / ROW_HEIGHT) + 1)

  const refsByHash = new Map<string, RefInfo[]>()
  for (const ref of refs) {
    if (!refsByHash.has(ref.hash)) refsByHash.set(ref.hash, [])
    refsByHash.get(ref.hash)!.push(ref)
  }

  // Draw edges (connections) first
  for (let i = firstVisibleRow; i <= lastVisibleRow; i++) {
    const node = nodes[i]
    const x1 = getNodeX(node.lane)
    const y1 = getNodeY(node.row, scrollTop)

    for (const conn of node.parentConnections) {
      const parentRow = conn.toRow
      const x2 = getNodeX(conn.toLane)
      const y2 = getNodeY(parentRow, scrollTop)

      // Only draw if either endpoint is visible
      if (y2 < -ROW_HEIGHT || y1 > canvasHeight + ROW_HEIGHT) continue

      ctx.strokeStyle = node.laneColor
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(x1, y1)

      if (x1 === x2) {
        // Straight line
        ctx.lineTo(x2, y2)
      } else {
        // Bezier curve
        const cy = y1 + (y2 - y1) * 0.5
        ctx.bezierCurveTo(x1, cy, x2, cy, x2, y2)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // Draw nodes
  for (let i = firstVisibleRow; i <= lastVisibleRow; i++) {
    const node = nodes[i]
    const x = getNodeX(node.lane)
    const y = getNodeY(node.row, scrollTop)
    const isSelected = node.hash === selectedHash

    // Selection highlight row
    if (isSelected) {
      ctx.fillStyle = 'rgba(44, 49, 80, 0.8)'
      ctx.fillRect(0, y - ROW_HEIGHT / 2, canvasWidth, ROW_HEIGHT)
    }

    // Node circle
    ctx.beginPath()
    ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)

    if (isSelected) {
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = node.laneColor
      ctx.lineWidth = 2
      ctx.stroke()
    } else {
      ctx.fillStyle = node.laneColor
      ctx.fill()
      ctx.strokeStyle = '#161821'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
}

export function GraphCanvas({
  onCommitClick,
  onCommitContextMenu
}: {
  onCommitClick: (hash: string, clientY: number) => void
  onCommitContextMenu: (hash: string, x: number, y: number) => void
}) {
  const { graphNodes, refs, selectedHash } = useRepoStore()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  const totalHeight = graphNodes.length * ROW_HEIGHT

  const getRowAtY = useCallback((clientY: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return -1
    const rect = canvas.getBoundingClientRect()
    const relY = clientY - rect.top + scrollRef.current
    return Math.floor(relY / ROW_HEIGHT)
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderGraph(ctx, {
      nodes: graphNodes,
      refs,
      selectedHash,
      scrollTop: scrollRef.current,
      canvasHeight: canvas.height / window.devicePixelRatio,
      canvasWidth: canvas.width / window.devicePixelRatio
    })
  }, [graphNodes, refs, selectedHash])

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
        cancelAnimationFrame(animRef.current)
        animRef.current = requestAnimationFrame(paint)
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [paint])

  // Repaint on data change
  useEffect(() => {
    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(paint)
  }, [paint])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollRef.current = e.currentTarget.scrollTop
    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(paint)
  }

  const handleClick = (e: React.MouseEvent) => {
    const row = getRowAtY(e.clientY)
    if (row >= 0 && row < graphNodes.length) {
      onCommitClick(graphNodes[row].hash, e.clientY)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const row = getRowAtY(e.clientY)
    if (row >= 0 && row < graphNodes.length) {
      onCommitContextMenu(graphNodes[row].hash, e.clientX, e.clientY)
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      onScroll={handleScroll}
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* Scroll height spacer */}
      <div style={{ height: totalHeight, position: 'relative', pointerEvents: 'none' }} />

      {/* Fixed canvas overlay */}
      <canvas
        ref={canvasRef}
        style={{ position: 'sticky', top: 0, left: 0, pointerEvents: 'auto', cursor: 'pointer' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
    </div>
  )
}
