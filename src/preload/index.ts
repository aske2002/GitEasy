import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  CheckoutOptions, MergeOptions, RebaseOptions, ResetMode, AccountInfo, RemoteRepo, ConflictContent
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
  getWorkingDiff: (repoPath: string, filePath?: string): Promise<import('../shared/ipc').DiffFile[]> =>
    ipcRenderer.invoke(IPC.GET_WORKING_DIFF, repoPath, filePath),
  getStagedDiff: (repoPath: string, filePath?: string): Promise<import('../shared/ipc').DiffFile[]> =>
    ipcRenderer.invoke(IPC.GET_STAGED_DIFF, repoPath, filePath),
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
  createStash: (repoPath: string, message?: string, includeUntracked = true): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.CREATE_STASH, repoPath, message, includeUntracked),
  popStash: (repoPath: string, stashRef: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.POP_STASH, repoPath, stashRef),
  applyStash: (repoPath: string, stashRef: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.APPLY_STASH, repoPath, stashRef),
  dropStash: (repoPath: string, stashRef: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.DROP_STASH, repoPath, stashRef),

  // Merge conflicts
  getConflictContent: (repoPath: string, filePath: string): Promise<ConflictContent> =>
    ipcRenderer.invoke(IPC.GET_CONFLICT_CONTENT, repoPath, filePath),
  resolveConflict: (repoPath: string, filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.RESOLVE_CONFLICT, repoPath, filePath, content),

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
  pull: (repoPath: string, rebase = false) => ipcRenderer.invoke(IPC.PULL, repoPath, rebase),
  push: (repoPath: string) => ipcRenderer.invoke(IPC.PUSH, repoPath),
  forcePush: (repoPath: string) => ipcRenderer.invoke(IPC.FORCE_PUSH, repoPath),
  createBranch: (repoPath: string, name: string, from: string) =>
    ipcRenderer.invoke(IPC.CREATE_BRANCH, repoPath, name, from),
  deleteBranch: (repoPath: string, name: string, force = false) =>
    ipcRenderer.invoke(IPC.DELETE_BRANCH, repoPath, name, force),
  deleteRemoteBranch: (repoPath: string, remote: string, branchName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.DELETE_REMOTE_BRANCH, repoPath, remote, branchName),
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
  listRemoteRepos: (host: string): Promise<RemoteRepo[]> =>
    ipcRenderer.invoke(IPC.LIST_REMOTE_REPOS, host),
  listRemotes: (repoPath: string): Promise<import('../shared/ipc').RemoteConfig[]> =>
    ipcRenderer.invoke(IPC.LIST_REMOTES, repoPath),
  addRemote: (repoPath: string, name: string, url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.ADD_REMOTE, repoPath, name, url),
  removeRemote: (repoPath: string, name: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.REMOVE_REMOTE, repoPath, name),
  renameRemote: (repoPath: string, oldName: string, newName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.RENAME_REMOTE, repoPath, oldName, newName),
  setRemoteUrl: (repoPath: string, name: string, url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC.SET_REMOTE_URL, repoPath, name, url),
  cloneRepo: (cloneUrl: string, parentDir: string, repoName: string): Promise<{ success: boolean; clonedPath?: string; error?: string }> =>
    ipcRenderer.invoke(IPC.CLONE_REPO, cloneUrl, parentDir, repoName),
  chooseDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.CHOOSE_DIRECTORY),

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
