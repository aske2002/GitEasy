import { useState } from 'react'
import { useRepoStore } from '../../store/repoStore'
import type { RefInfo } from '../../../../shared/ipc'
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { MergeRebaseDialog } from '../Modals/MergeRebaseDialog'
import { BranchContextMenu } from './BranchContextMenu'
import { TagContextMenu } from './TagContextMenu'
import { StashContextMenu } from './StashContextMenu'
import { ChangesPanel } from './ChangesPanel'
import { RemotesModal } from '../Modals/RemotesModal'

type Section = 'local' | 'remote' | 'stashes' | 'tags'

interface PendingOp {
  source: string
  target: string
}

export function Sidebar() {
  const { refs, checkoutRef, mergeBranch, rebaseBranch, status, createStash, applyStash, operationInProgress } = useRepoStore()
  const [tab, setTab] = useState<'branches' | 'changes'>('branches')
  const [expanded, setExpanded] = useState<Record<Section, boolean>>({
    local: true, remote: false, stashes: true, tags: false
  })
  const [pendingOp, setPendingOp] = useState<PendingOp | null>(null)
  const [activeDrag, setActiveDrag] = useState<string | null>(null)
  const [remotesOpen, setRemotesOpen] = useState(false)

  const local = refs.filter(r => r.type === 'local')
  const remotes = refs.filter(r => r.type === 'remote')
  const stashes = refs.filter(r => r.type === 'stash')
  const tags = refs.filter(r => r.type === 'tag')

  const toggle = (key: Section) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDrag(e.active.id as string)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const source = e.active.id as string
    const target = e.over?.id as string | undefined
    if (!target || source === target) return
    setPendingOp({ source, target })
  }

  const handleConfirmOp = async (op: 'merge' | 'rebase' | 'ff-only') => {
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
  }

  const changesCount = status.filter(f => f.staged || f.unstaged || f.untracked).length
  const hasChanges = changesCount > 0

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div
          className="flex flex-col h-full text-xs"
          style={{ background: 'var(--color-bg-panel)', color: 'var(--color-text-primary)' }}
        >
          {/* ── Tab bar ──────────────────────────────────────────────── */}
          <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
            {(['branches', 'changes'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: 'none',
                  background: 'transparent', cursor: 'pointer', textTransform: 'capitalize',
                  borderBottom: tab === t ? '2px solid var(--color-accent)' : '2px solid transparent',
                  color: tab === t ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  transition: 'color 0.15s'
                }}
              >
                {t === 'changes'
                  ? `Changes${changesCount > 0 ? ` (${changesCount})` : ''}`
                  : 'Branches'}
              </button>
            ))}
          </div>

          {/* ── Changes tab ──────────────────────────────────────────── */}
          {tab === 'changes' && <ChangesPanel />}

          {/* ── Branches tab ─────────────────────────────────────────── */}
          {tab === 'branches' && <div className="flex-1 overflow-y-auto min-h-0">
          <Section
            label="LOCAL BRANCHES"
            count={local.length}
            open={expanded.local}
            onToggle={() => toggle('local')}
          >
            {local.map(ref => (
              <DraggableBranchRow
                key={ref.name}
                ref_={ref}
                onDoubleClick={() => checkoutRef(ref.name)}
              />
            ))}
          </Section>

          <Section
            label="REMOTES"
            count={remotes.length}
            open={expanded.remote}
            onToggle={() => toggle('remote')}
            action={
              <button
                onClick={e => { e.stopPropagation(); setRemotesOpen(true) }}
                title="Manage remotes"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '1px 4px', borderRadius: 3, color: 'var(--color-text-muted)', fontSize: 10 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                </svg>
              </button>
            }
          >
            {groupByRemote(remotes).map(([remote, branches]) => (
              <RemoteGroup key={remote} name={remote} branches={branches} onDoubleClick={checkoutRef} />
            ))}
          </Section>

          <Section
            label="STASHES"
            count={stashes.length}
            open={expanded.stashes}
            onToggle={() => toggle('stashes')}
            action={
              <button
                onClick={async e => {
                  e.stopPropagation()
                  await createStash(undefined, true)
                }}
                disabled={!hasChanges || operationInProgress}
                title={hasChanges ? 'Stash current changes' : 'No changes to stash'}
                style={{
                  background: 'transparent', border: 'none', cursor: hasChanges ? 'pointer' : 'default',
                  padding: '1px 6px', borderRadius: 3, color: 'var(--color-text-muted)', fontSize: 12,
                  opacity: hasChanges ? 1 : 0.4
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              >
                +
              </button>
            }
          >
            {stashes.map(ref => (
              <StashRow key={ref.name} ref_={ref} onDoubleClick={() => applyStash(ref.name)} />
            ))}
          </Section>

          <Section
            label="TAGS"
            count={tags.length}
            open={expanded.tags}
            onToggle={() => toggle('tags')}
          >
            {tags.map(ref => (
              <TagRow key={ref.name} ref_={ref} />
            ))}
          </Section>
          </div>}
        </div>

        <DragOverlay>
          {activeDrag && (
            <div style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'var(--color-accent)', color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', cursor: 'grabbing'
            }}>
              ⎇ {activeDrag.split('/').pop()}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pendingOp && (
        <MergeRebaseDialog
          source={pendingOp.source}
          target={pendingOp.target}
          onConfirm={handleConfirmOp}
          onCancel={() => setPendingOp(null)}
        />
      )}
      {remotesOpen && <RemotesModal onClose={() => setRemotesOpen(false)} />}
    </>
  )
}

function Section({
  label, count, open, onToggle, children, action
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-1 px-3 py-2 font-semibold text-left"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          <svg
            width="10" height="10"
            viewBox="0 0 10 10" fill="currentColor"
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          >
            <path d="M3 2l4 3-4 3z" />
          </svg>
          <span>{label}</span>
          <span className="ml-auto font-normal">{count}</span>
        </button>
        {action && <div className="pr-2">{action}</div>}
      </div>
      {open && children}
    </div>
  )
}

function BranchRow({ ref_, active, selected, onDoubleClick }: {
  ref_: RefInfo
  active: boolean
  selected: boolean
  onDoubleClick: () => void
}) {
  const { checkoutRef, deleteBranch, selectedRef } = useRepoStore()
  const [hovering, setHovering] = useState(false)

  const displayName = ref_.name.split('/').pop() ?? ref_.name

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none"
      style={{
        background: selected ? 'var(--color-bg-selected)' : hovering ? 'var(--color-bg-hover)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
        borderLeft: active ? '2px solid var(--color-accent)' : '2px solid transparent'
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onDoubleClick={onDoubleClick}
      title={`Double-click to checkout "${ref_.name}"`}
    >
      {/* Branch icon */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 01-9 9" />
      </svg>

      <span className="truncate flex-1">{displayName}</span>

      {/* Tracking status */}
      {ref_.type === 'local' && (ref_.ahead! > 0 || ref_.behind! > 0) && (
        <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          {ref_.ahead! > 0 && <span style={{ color: 'var(--color-green)' }}>↑{ref_.ahead}</span>}
          {ref_.behind! > 0 && <span style={{ color: 'var(--color-red)' }}>↓{ref_.behind}</span>}
        </div>
      )}

      {active && (
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
      )}
    </div>
  )
}

function RemoteGroup({ name, branches, onDoubleClick }: {
  name: string
  branches: RefInfo[]
  onDoubleClick: (name: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-4 py-1 w-full text-left"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M3 2l4 3-4 3z" />
        </svg>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        <span className="ml-1 font-medium">{name}</span>
      </button>
      {open && branches.map(ref => (
        <RemoteBranchRow key={ref.name} ref_={ref} onDoubleClick={onDoubleClick} />
      ))}
    </div>
  )
}

function RemoteBranchRow({ ref_, onDoubleClick }: { ref_: RefInfo; onDoubleClick: (name: string) => void }) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  return (
    <>
      <div
        className="flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-pointer"
        style={{ color: 'var(--color-text-secondary)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onDoubleClick={() => onDoubleClick(ref_.name)}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        title="Double-click to checkout locally. Right-click for options."
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6, flexShrink: 0 }}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 01-9 9" />
        </svg>
        <span className="truncate">{ref_.name.split('/').slice(1).join('/')}</span>
      </div>
      {ctxMenu && (
        <BranchContextMenu
          ref_={ref_}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

function DraggableBranchRow({ ref_, onDoubleClick }: {
  ref_: RefInfo
  onDoubleClick: () => void
}) {
  const { selectedRef } = useRepoStore()
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: ref_.name })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: ref_.name })
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const displayName = ref_.name.split('/').pop() ?? ref_.name
  const isActive = ref_.isHead
  const isSelected = ref_.name === selectedRef

  return (
    <>
      <div
        ref={node => { setDragRef(node); setDropRef(node) }}
        className="flex items-center gap-2 px-3 py-1.5 cursor-grab select-none"
        style={{
          background: isOver
            ? 'rgba(124,140,248,0.15)'
            : isSelected
            ? 'var(--color-bg-selected)'
            : 'transparent',
          color: isActive ? 'var(--color-accent)' : 'var(--color-text-primary)',
          borderLeft: isActive
            ? '2px solid var(--color-accent)'
            : isOver
            ? '2px solid var(--color-accent)'
            : '2px solid transparent',
          opacity: isDragging ? 0.3 : 1,
          outline: isOver ? '1px dashed var(--color-accent)' : 'none',
          transition: 'background 0.1s, outline 0.1s'
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        title={`Double-click to checkout. Right-click for options. Drag to merge/rebase.`}
        {...listeners}
        {...attributes}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 01-9 9" />
        </svg>

        <span className="truncate flex-1">{displayName}</span>

        {(ref_.ahead! > 0 || ref_.behind! > 0) && (
          <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {ref_.ahead! > 0 && <span style={{ color: 'var(--color-green)' }}>↑{ref_.ahead}</span>}
            {ref_.behind! > 0 && <span style={{ color: 'var(--color-red)' }}>↓{ref_.behind}</span>}
          </div>
        )}

        {isActive && (
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
        )}
      </div>

      {ctxMenu && (
        <BranchContextMenu
          ref_={ref_}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

function groupByRemote(refs: RefInfo[]): [string, RefInfo[]][] {
  const map = new Map<string, RefInfo[]>()
  for (const ref of refs) {
    const parts = ref.name.split('/')
    const remoteName = parts[0]
    if (!map.has(remoteName)) map.set(remoteName, [])
    map.get(remoteName)!.push(ref)
  }
  return Array.from(map.entries())
}

function TagRow({ ref_ }: { ref_: RefInfo }) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [hovering, setHovering] = useState(false)

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1.5 select-none cursor-default"
        style={{
          background: hovering ? 'var(--color-bg-hover)' : 'transparent',
          color: 'var(--color-text-primary)'
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        title="Right-click for options"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.7 }}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        <span className="truncate flex-1">{ref_.name}</span>
      </div>
      {ctxMenu && (
        <TagContextMenu
          ref_={ref_}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}

function StashRow({ ref_, onDoubleClick }: { ref_: RefInfo; onDoubleClick: () => void }) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [hovering, setHovering] = useState(false)

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1.5 select-none cursor-pointer"
        style={{
          background: hovering ? 'var(--color-bg-hover)' : 'transparent',
          color: 'var(--color-text-primary)'
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onDoubleClick={onDoubleClick}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        title="Double-click to apply. Right-click for apply/pop/delete."
      >
        <span style={{ opacity: 0.7, width: 12, textAlign: 'center', flexShrink: 0 }}>✦</span>
        <span className="truncate" style={{ maxWidth: '38%' }}>{ref_.name}</span>
        {ref_.stashMessage && (
          <span
            className="truncate"
            style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 6, flex: 1 }}
            title={ref_.stashMessage}
          >
            {ref_.stashMessage}
          </span>
        )}
      </div>
      {ctxMenu && (
        <StashContextMenu
          ref_={ref_}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
