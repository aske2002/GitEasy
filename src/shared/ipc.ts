// Typed IPC channel names and payload types shared between main and renderer

export const IPC = {
  // Repo management
  OPEN_REPO: 'repo:open',
  CLOSE_REPO: 'repo:close',
  GET_RECENT_REPOS: 'repo:getRecent',

  // Graph
  GET_GRAPH: 'git:getGraph',

  // Refs
  GET_REFS: 'git:getRefs',

  // Status
  GET_STATUS: 'git:getStatus',

  // Diff
  GET_COMMIT_DIFF: 'git:getCommitDiff',
  GET_FILE_DIFF: 'git:getFileDiff',
  GET_WORKING_DIFF: 'git:getWorkingDiff',
  GET_STAGED_DIFF: 'git:getStagedDiff',
  GET_FILE_CONTENT: 'git:getFileContent',
  GET_COMMIT_FILES: 'git:getCommitFiles',
  RESTORE_FILE: 'git:restoreFile',

  // Operations
  CHECKOUT: 'git:checkout',
  RESET: 'git:reset',
  MERGE: 'git:merge',
  REBASE: 'git:rebase',
  CAN_FF_ONLY: 'git:canFfOnly',
  FETCH: 'git:fetch',
  PULL: 'git:pull',
  PUSH: 'git:push',
  FORCE_PUSH: 'git:forcePush',
  CREATE_BRANCH: 'git:createBranch',
  DELETE_BRANCH: 'git:deleteBranch',
  DELETE_REMOTE_BRANCH: 'git:deleteRemoteBranch',
  RENAME_BRANCH: 'git:renameBranch',
  CHERRY_PICK: 'git:cherryPick',
  CREATE_TAG: 'git:createTag',
  PUSH_TAG: 'git:pushTag',
  DELETE_TAG: 'git:deleteTag',

  // Staging & commit
  STAGE_FILE: 'git:stageFile',
  UNSTAGE_FILE: 'git:unstageFile',
  STAGE_ALL: 'git:stageAll',
  UNSTAGE_ALL: 'git:unstageAll',
  COMMIT: 'git:commit',

  // Auth (accounts)
  AUTH_ADD_ACCOUNT: 'auth:addAccount',
  AUTH_LIST_ACCOUNTS: 'auth:listAccounts',
  AUTH_REMOVE_ACCOUNT: 'auth:removeAccount',
  LIST_REMOTE_REPOS: 'auth:listRemoteRepos',

  // Remotes management
  LIST_REMOTES: 'git:listRemotes',
  ADD_REMOTE: 'git:addRemote',
  REMOVE_REMOTE: 'git:removeRemote',
  RENAME_REMOTE: 'git:renameRemote',
  SET_REMOTE_URL: 'git:setRemoteUrl',

  // Clone
  CLONE_REPO: 'git:cloneRepo',
  CHOOSE_DIRECTORY: 'fs:chooseDirectory',

  // Events (main → renderer)
  REPO_CHANGED: 'repo:changed',
  SHOW_CONTEXT_MENU: 'menu:showContext',

  // Updater (main → renderer)
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',
  // Updater (renderer → main)
  UPDATE_INSTALL: 'update:install',
  UPDATE_CHECK: 'update:check',
} as const

export type ResetMode = 'soft' | 'mixed' | 'hard'

export interface OpenRepoResult {
  path: string
  name: string
}

export interface CommitRaw {
  hash: string
  shortHash: string
  parentHashes: string[]
  authorName: string
  authorEmail: string
  authorDate: string
  subject: string
  body: string
  refs: string[]
}

export interface RemoteConfig {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface RefInfo {
  name: string
  hash: string
  type: 'local' | 'remote' | 'tag'
  isHead: boolean
  upstream?: string
  ahead?: number
  behind?: number
}

export interface StatusFile {
  path: string
  staged: boolean
  unstaged: boolean
  untracked: boolean
  statusCode: string
}

export interface DiffFile {
  path: string
  oldPath?: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  content: string
  oldLine?: number
  newLine?: number
}

export interface CheckoutOptions {
  target: string // branch name or commit hash
  createBranch?: string
  isRemote?: boolean // if true, use --track to create local tracking branch
}

export interface MergeOptions {
  source: string // branch to merge in
  strategy?: 'merge' | 'squash' | 'ff-only'
}

export interface RebaseOptions {
  onto: string
}

export interface GitOperationResult {
  success: boolean
  error?: string
  conflicts?: string[]
}

export interface AccountInfo {
  provider: 'github' | 'gitlab' | 'custom'
  host: string
  username: string
  avatarUrl?: string
}

export interface RemoteRepo {
  name: string
  fullName: string
  cloneUrl: string
  description: string | null
  isPrivate: boolean
  updatedAt: string
}
