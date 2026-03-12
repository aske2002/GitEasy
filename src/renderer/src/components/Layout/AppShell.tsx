import { useState } from 'react'
import { Toolbar } from './Toolbar'
import { Sidebar } from '../Sidebar/Sidebar'
import { GitGraph } from '../GitGraph/GitGraph'
import { CommitInspector } from '../CommitPanel/CommitInspector'
import { useRepoStore } from '../../store/repoStore'

const MIN_SIDEBAR = 180
const MIN_GRAPH = 300
const MIN_INSPECTOR = 260

export function AppShell() {
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [inspectorWidth, setInspectorWidth] = useState(340)
  const { inspectorOpen } = useRepoStore()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          style={{ width: sidebarWidth, minWidth: MIN_SIDEBAR, flexShrink: 0 }}
          className="flex flex-col overflow-hidden border-r"
          css-border="var(--color-border)"
        >
          <Sidebar />
        </div>

        {/* Sidebar resize handle */}
        <ResizeHandle
          onDrag={(dx) => setSidebarWidth(w => Math.min(
            window.innerWidth - (inspectorOpen ? inspectorWidth : 0) - MIN_GRAPH,
            Math.max(MIN_SIDEBAR, w + dx)
          ))}
        />

        {/* Graph */}
        <div className="flex-1 overflow-hidden min-w-0">
          <GitGraph />
        </div>

        {/* Inspector resize handle + panel */}
        {inspectorOpen && (
          <>
            <ResizeHandle
              onDrag={(dx) => setInspectorWidth(w => Math.min(
                window.innerWidth - sidebarWidth - MIN_GRAPH,
                Math.max(MIN_INSPECTOR, w - dx)
              ))}
            />
            <div
              style={{ width: inspectorWidth, minWidth: MIN_INSPECTOR, flexShrink: 0 }}
              className="flex flex-col overflow-hidden border-l"
            >
              <CommitInspector />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault()
    let prevX = e.clientX
    const onMove = (mv: MouseEvent) => {
      onDrag(mv.clientX - prevX)
      prevX = mv.clientX
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={startDrag}
      className="w-1 cursor-col-resize hover:bg-accent flex-shrink-0"
      style={{
        background: 'var(--color-border)',
        transition: 'background 0.15s'
      }}
    />
  )
}
