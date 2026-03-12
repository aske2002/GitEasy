import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  CheckoutOptions, MergeOptions, RebaseOptions, ResetMode, AccountInfo
} from '../shared/ipc'

// Expose a typed, safe API to the renderer via window.git
const gitApi = {
  // Repo
  openRepo: (path?: string) => ipcRenderer.invoke(IPC.OPEN_REPO, path),
  getRecentRepos: () => ipcRenderer.invoke(IPC.GET_RECENT_REPOS),

  // Graph data
  getGraph: (repoPath: string) => ipcRenderer.invoke(IPC.GET_GRAPH, repoPath),
  getRefs: (repoPath: string) => ipcRenderer.invoke(IPC.GET_REFS, repoPath),
  getStatus: (repoPath: string) => ipcRenderer.invoke(IPC.GET_STATUS, repoPath),
  getCommitDiff: (repoPath: string, hash: string) =>
    ipcRenderer.invoke(IPC.GET_COMMIT_DIFF, repoPath, hash),
  getFileDiff: (repoPath: string, hash: string, filePath: string) =>
    ipcRenderer.invoke(IPC.GET_FILE_DIFF, repoPath, hash, filePath),
  getFileContent: (repoPath: string, hash: string, filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.GET_FILE_CONTENT, repoPath, hash, filePath),
  getCommitFiles: (repoPath: string, hash: string): Promise<string[]> =>
    ipcRenderer.invoke(IPC.GET_COMMIT_FILES, repoPath, hash),
  restoreFile: (repoPath: string, hash: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RESTORE_FILE, repoPath, hash, filePath),

  // Staging & commit
  stageFile: (repoPath: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.STAGE_FILE, repoPath, filePath),
  unstageFile: (repoPath: string, filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.UNSTAGE_FILE, repoPath, filePath),
  stageAll: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.STAGE_ALL, repoPath),
  unstageAll: (repoPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.UNSTAGE_ALL, repoPath),
  commit: (repoPath: string, message: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.COMMIT, repoPath, message),

  // Operations
  checkout: (repoPath: string, opts: CheckoutOptions) =>
    ipcRenderer.invoke(IPC.CHECKOUT, repoPath, opts),
  reset: (repoPath: string, hash: string, mode: ResetMode) =>
    ipcRenderer.invoke(IPC.RESET, repoPath, hash, mode),
  merge: (repoPath: string, opts: MergeOptions) =>
    ipcRenderer.invoke(IPC.MERGE, repoPath, opts),
  canFfOnly: (repoPath: string, source: string, target: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.CAN_FF_ONLY, repoPath, source, target),
  rebase: (repoPath: string, currentBranch: string, opts: RebaseOptions) =>
    ipcRenderer.invoke(IPC.REBASE, repoPath, currentBranch, opts),
  fetch: (repoPath: string) => ipcRenderer.invoke(IPC.FETCH, repoPath),
  pull: (repoPath: string) => ipcRenderer.invoke(IPC.PULL, repoPath),
  push: (repoPath: string) => ipcRenderer.invoke(IPC.PUSH, repoPath),
  forcePush: (repoPath: string) => ipcRenderer.invoke(IPC.FORCE_PUSH, repoPath),
  createBranch: (repoPath: string, name: string, from: string) =>
    ipcRenderer.invoke(IPC.CREATE_BRANCH, repoPath, name, from),
  deleteBranch: (repoPath: string, name: string, force = false) =>
    ipcRenderer.invoke(IPC.DELETE_BRANCH, repoPath, name, force),
  renameBranch: (repoPath: string, oldName: string, newName: string) =>
    ipcRenderer.invoke(IPC.RENAME_BRANCH, repoPath, oldName, newName),
  cherryPick: (repoPath: string, hash: string) =>
    ipcRenderer.invoke(IPC.CHERRY_PICK, repoPath, hash),
  createTag: (repoPath: string, name: string, hash: string) =>
    ipcRenderer.invoke(IPC.CREATE_TAG, repoPath, name, hash),
  pushTag: (repoPath: string, name: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.PUSH_TAG, repoPath, name),
  deleteTag: (repoPath: string, name: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.DELETE_TAG, repoPath, name),

  // Auth (accounts) — token never leaves main process
  addAccount: (provider: string, host: string, token: string): Promise<AccountInfo> =>
    ipcRenderer.invoke(IPC.AUTH_ADD_ACCOUNT, provider, host, token),
  listAccounts: (): Promise<AccountInfo[]> =>
    ipcRenderer.invoke(IPC.AUTH_LIST_ACCOUNTS),
  removeAccount: (host: string, username: string): Promise<void> =>
    ipcRenderer.invoke(IPC.AUTH_REMOVE_ACCOUNT, host, username),

  // Events
  onRepoChanged: (cb: () => void) => {
    ipcRenderer.on(IPC.REPO_CHANGED, cb)
    return () => ipcRenderer.off(IPC.REPO_CHANGED, cb)
  },
  onOpenRepo: (cb: () => void) => {
    ipcRenderer.on('menu:openRepo', cb)
    return () => ipcRenderer.off('menu:openRepo', cb)
  },

  // Updater
  onUpdateAvailable: (cb: (version: string) => void) => {
    const handler = (_: unknown, version: string) => cb(version)
    ipcRenderer.on(IPC.UPDATE_AVAILABLE, handler)
    return () => ipcRenderer.off(IPC.UPDATE_AVAILABLE, handler)
  },
  onUpdateDownloaded: (cb: (version: string) => void) => {
    const handler = (_: unknown, version: string) => cb(version)
    ipcRenderer.on(IPC.UPDATE_DOWNLOADED, handler)
    return () => ipcRenderer.off(IPC.UPDATE_DOWNLOADED, handler)
  },
  installUpdate: () => ipcRenderer.send(IPC.UPDATE_INSTALL),
  checkForUpdates: () => ipcRenderer.invoke(IPC.UPDATE_CHECK),
}

contextBridge.exposeInMainWorld('git', gitApi)

export type GitApi = typeof gitApi
