import { create } from 'zustand'
import type { CommitRaw, RefInfo, StatusFile, DiffFile } from '../../../shared/ipc'

export interface GraphNode extends CommitRaw {
  lane: number
  laneColor: string
  parentConnections: Array<{
    toHash: string
    toLane: number
    toRow: number
  }>
  row: number
}

export interface RepoState {
  // Repo
  repoPath: string | null
  repoName: string | null
  recentRepos: string[]
  isLoading: boolean
  error: string | null

  // Graph
  commits: CommitRaw[]
  graphNodes: GraphNode[]
  refs: RefInfo[]
  status: StatusFile[]

  // Selection
  selectedHash: string | null
  selectedRef: string | null

  // Inspector
  commitDiff: DiffFile[]
  commitDiffLoading: boolean
  selectedFile: DiffFile | null
  inspectorOpen: boolean

  // Operations
  operationInProgress: boolean
  operationError: string | null
  pushFailed: boolean
}

export interface RepoActions {
  openRepo: (path?: string) => Promise<void>
  closeRepo: () => void
  loadRecentRepos: () => Promise<void>
  refresh: () => Promise<void>

  selectCommit: (hash: string) => Promise<void>
  selectFile: (file: DiffFile) => void
  setInspectorOpen: (open: boolean) => void

  checkoutRef: (target: string) => Promise<void>
  checkoutCommit: (hash: string) => Promise<void>
  resetToCommit: (hash: string, mode: 'soft' | 'mixed' | 'hard') => Promise<void>
  mergeBranch: (source: string, strategy?: 'merge' | 'squash' | 'ff-only') => Promise<void>
  rebaseBranch: (source: string, onto: string) => Promise<void>
  fetchAll: () => Promise<void>
  pullCurrent: () => Promise<void>
  pushCurrent: () => Promise<void>
  forcePushCurrent: () => Promise<void>
  createBranchFrom: (name: string, from: string) => Promise<void>
  deleteBranch: (name: string, force?: boolean) => Promise<void>
  deleteRemoteBranch: (remote: string, branchName: string) => Promise<void>
  renameBranch: (oldName: string, newName: string) => Promise<void>
  pushTag: (name: string) => Promise<void>
  deleteTag: (name: string) => Promise<void>

  stageFile: (filePath: string) => Promise<void>
  unstageFile: (filePath: string) => Promise<void>
  stageAll: () => Promise<void>
  unstageAll: () => Promise<void>
  commitChanges: (message: string) => Promise<{ success: boolean; error?: string }>
  createStash: (message?: string, includeUntracked?: boolean) => Promise<void>
  popStash: (stashRef: string) => Promise<void>
  applyStash: (stashRef: string) => Promise<void>
  dropStash: (stashRef: string) => Promise<void>

  clearError: () => void
}

type Store = RepoState & RepoActions

const LANE_COLORS = [
  '#7c8cf8', // accent blue
  '#4caf82', // green
  '#f0b555', // yellow
  '#b07cf8', // purple
  '#5b9ef8', // blue
  '#f0824a', // orange
  '#e05c6a', // red
  '#50c8cf', // teal
  '#e07cbb', // pink
  '#a0c878', // lime
]

function computeGraph(commits: CommitRaw[], refs: RefInfo[]): GraphNode[] {
  if (commits.length === 0) return []

  const hashToRow = new Map<string, number>()
  commits.forEach((c, i) => hashToRow.set(c.hash, i))

  // Lane assignment: each "active" branch tracks its lane column
  const lanes: (string | null)[] = [] // lane index → current tip hash (null = free)
  const hashToLane = new Map<string, number>()

  const getLane = (hash: string): number => {
    // Find an existing lane tip that maps to this hash
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === hash) return i
    }
    // Allocate a new lane
    const freeIdx = lanes.findIndex(l => l === null)
    const idx = freeIdx >= 0 ? freeIdx : lanes.length
    lanes[idx] = hash
    return idx
  }

  const nodes: GraphNode[] = commits.map((commit, row) => {
    const lane = getLane(commit.hash)
    hashToLane.set(commit.hash, lane)

    // After processing this commit, update lane to its first parent
    if (commit.parentHashes.length > 0) {
      lanes[lane] = commit.parentHashes[0]
    } else {
      lanes[lane] = null
    }

    // Second+ parents: allocate their own lanes
    for (let p = 1; p < commit.parentHashes.length; p++) {
      const parentHash = commit.parentHashes[p]
      const existingLane = getLane(parentHash)
      // Lane already allocated by prior visit; nothing to do
    }

    return {
      ...commit,
      row,
      lane,
      laneColor: LANE_COLORS[lane % LANE_COLORS.length],
      parentConnections: commit.parentHashes.map(ph => ({
        toHash: ph,
        toLane: hashToLane.get(ph) ?? lane, // will be filled below
        toRow: hashToRow.get(ph) ?? row + 1
      }))
    }
  })

  // Second pass: resolve parent lanes (they are now known)
  nodes.forEach(node => {
    node.parentConnections = node.parentConnections.map(conn => ({
      ...conn,
      toLane: hashToLane.get(conn.toHash) ?? node.lane
    }))
  })

  return nodes
}

export const useRepoStore = create<Store>((set, get) => ({
  // State
  repoPath: null,
  repoName: null,
  recentRepos: [],
  isLoading: false,
  error: null,
  commits: [],
  graphNodes: [],
  refs: [],
  status: [],
  selectedHash: null,
  selectedRef: null,
  commitDiff: [],
  commitDiffLoading: false,
  selectedFile: null,
  inspectorOpen: false,
  operationInProgress: false,
  operationError: null,
  pushFailed: false,

  // Actions
  openRepo: async (path) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.git.openRepo(path)
      if (!result) { set({ isLoading: false }); return }

      set({ repoPath: result.path, repoName: result.name })
      await get().refresh()
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  closeRepo: () => set({
    repoPath: null, repoName: null, commits: [], graphNodes: [],
    refs: [], status: [], selectedHash: null, commitDiff: [], commitDiffLoading: false, selectedFile: null
  }),

  loadRecentRepos: async () => {
    const recent = await window.git.getRecentRepos()
    set({ recentRepos: recent })
  },

  refresh: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ isLoading: true })
    try {
      const [commits, refs, status] = await Promise.all([
        window.git.getGraph(repoPath),
        window.git.getRefs(repoPath),
        window.git.getStatus(repoPath)
      ])
      const graphNodes = computeGraph(commits, refs)
      set({ commits, graphNodes, refs, status, isLoading: false, error: null })
    } catch (e: any) {
      set({ error: e.message, isLoading: false })
    }
  },

  selectCommit: async (hash) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ selectedHash: hash, inspectorOpen: true, commitDiff: [], commitDiffLoading: true, selectedFile: null })
    try {
      const diff = await window.git.getCommitDiff(repoPath, hash)
      set({ commitDiff: diff, commitDiffLoading: false })
    } catch (e: any) {
      set({ error: e.message, commitDiffLoading: false })
    }
  },

  selectFile: (file) => set({ selectedFile: file }),

  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  checkoutRef: async (target) => {
    const { repoPath, refs } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const ref = refs.find(r => r.name === target)
    const isRemote = ref?.type === 'remote'
    const result = await window.git.checkout(repoPath, { target, isRemote })
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  checkoutCommit: async (hash) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.checkout(repoPath, { target: hash })
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  resetToCommit: async (hash, mode) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.reset(repoPath, hash, mode)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  mergeBranch: async (source, strategy?: 'merge' | 'squash' | 'ff-only') => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.merge(repoPath, { source, strategy })
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  rebaseBranch: async (source, onto) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.rebase(repoPath, source, { onto })
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  fetchAll: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    await window.git.fetch(repoPath)
    set({ operationInProgress: false })
    await get().refresh()
  },

  pullCurrent: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.pull(repoPath)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  pushCurrent: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null, pushFailed: false })
    const result = await window.git.push(repoPath)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error, pushFailed: true }); return }
    set({ pushFailed: false })
    await get().refresh()
  },

  forcePushCurrent: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null, pushFailed: false })
    const result = await window.git.forcePush(repoPath)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  createBranchFrom: async (name, from) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.createBranch(repoPath, name, from)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  deleteBranch: async (name, force = false) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.deleteBranch(repoPath, name, force)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  deleteRemoteBranch: async (remote, branchName) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.deleteRemoteBranch(repoPath, remote, branchName)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  renameBranch: async (oldName, newName) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.renameBranch(repoPath, oldName, newName)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  clearError: () => set({ operationError: null, error: null }),

  pushTag: async (name) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.pushTag(repoPath, name)
    set({ operationInProgress: false })
    if (!result.success) set({ operationError: result.error })
  },

  deleteTag: async (name) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.deleteTag(repoPath, name)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  stageFile: async (filePath) => {
    const { repoPath } = get()
    if (!repoPath) return
    await window.git.stageFile(repoPath, filePath)
    await get().refresh()
  },

  unstageFile: async (filePath) => {
    const { repoPath } = get()
    if (!repoPath) return
    await window.git.unstageFile(repoPath, filePath)
    await get().refresh()
  },

  stageAll: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    await window.git.stageAll(repoPath)
    await get().refresh()
  },

  unstageAll: async () => {
    const { repoPath } = get()
    if (!repoPath) return
    await window.git.unstageAll(repoPath)
    await get().refresh()
  },

  commitChanges: async (message) => {
    const { repoPath } = get()
    if (!repoPath) return { success: false, error: 'No repo open' }
    const result = await window.git.commit(repoPath, message)
    if (result.success) await get().refresh()
    return result
  },

  createStash: async (message, includeUntracked = true) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.createStash(repoPath, message, includeUntracked)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  popStash: async (stashRef) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.popStash(repoPath, stashRef)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  applyStash: async (stashRef) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.applyStash(repoPath, stashRef)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },

  dropStash: async (stashRef) => {
    const { repoPath } = get()
    if (!repoPath) return
    set({ operationInProgress: true, operationError: null })
    const result = await window.git.dropStash(repoPath, stashRef)
    set({ operationInProgress: false })
    if (!result.success) { set({ operationError: result.error }); return }
    await get().refresh()
  },
}))
