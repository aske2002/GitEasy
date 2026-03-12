import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import Store from 'electron-store'
import { IPC } from '../../shared/ipc'
import { getGraph } from '../git/log'
import { getRefs } from '../git/refs'
import { getStatus, stageFile, unstageFile, stageAll, unstageAll, commitChanges } from '../git/status'
import { verifyAndAddAccount, listAccounts, removeAccount, getRemoteAuthUrl } from '../git/auth'
import { getCommitDiff, getFileDiff, getFileContent, getCommitFiles, restoreFile } from '../git/diff'
import {
  checkout, reset, merge, rebase,
  fetch, pull, push, forcePush, canFastForward,
  createBranch, deleteBranch, renameBranch,
  cherryPick, createTag, pushTag, deleteTag
} from '../git/checkout'
import { startWatcher } from '../git/watcher'

export function registerHandlers(store: Store<{ recentRepos: string[] }>): void {

  // --- Repo management ---

  ipcMain.handle(IPC.OPEN_REPO, async (_event, repoPath?: string) => {
    let targetPath = repoPath

    if (!targetPath) {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Open Git Repository'
      })
      if (result.canceled || !result.filePaths[0]) return null
      targetPath = result.filePaths[0]
    }

    // Validate it's a git repo
    if (!existsSync(join(targetPath, '.git'))) {
      throw new Error('Not a git repository')
    }

    // Track recent repos
    const recent = store.get('recentRepos', [])
    const updated = [targetPath, ...recent.filter(r => r !== targetPath)].slice(0, 10)
    store.set('recentRepos', updated)

    startWatcher(targetPath)
    return { path: targetPath, name: targetPath.split('/').pop() || targetPath }
  })

  ipcMain.handle(IPC.GET_RECENT_REPOS, () => {
    return store.get('recentRepos', [])
  })

  // --- Git data ---

  ipcMain.handle(IPC.GET_GRAPH, async (_event, repoPath: string) => {
    return getGraph(repoPath)
  })

  ipcMain.handle(IPC.GET_REFS, async (_event, repoPath: string) => {
    return getRefs(repoPath)
  })

  ipcMain.handle(IPC.GET_STATUS, async (_event, repoPath: string) => {
    return getStatus(repoPath)
  })

  ipcMain.handle(IPC.GET_COMMIT_DIFF, async (_event, repoPath: string, hash: string) => {
    return getCommitDiff(repoPath, hash)
  })

  ipcMain.handle(IPC.GET_FILE_DIFF, async (_event, repoPath: string, hash: string, filePath: string) => {
    return getFileDiff(repoPath, hash, filePath)
  })

  ipcMain.handle(IPC.GET_FILE_CONTENT, async (_event, repoPath: string, hash: string, filePath: string) => {
    return getFileContent(repoPath, hash, filePath)
  })

  ipcMain.handle(IPC.GET_COMMIT_FILES, async (_event, repoPath: string, hash: string) => {
    return getCommitFiles(repoPath, hash)
  })

  ipcMain.handle(IPC.RESTORE_FILE, async (_event, repoPath: string, hash: string, filePath: string) => {
    await restoreFile(repoPath, hash, filePath)
  })

  ipcMain.handle(IPC.STAGE_FILE, async (_event, repoPath: string, filePath: string) => {
    await stageFile(repoPath, filePath)
  })

  ipcMain.handle(IPC.UNSTAGE_FILE, async (_event, repoPath: string, filePath: string) => {
    await unstageFile(repoPath, filePath)
  })

  ipcMain.handle(IPC.STAGE_ALL, async (_event, repoPath: string) => {
    await stageAll(repoPath)
  })

  ipcMain.handle(IPC.UNSTAGE_ALL, async (_event, repoPath: string) => {
    await unstageAll(repoPath)
  })

  ipcMain.handle(IPC.COMMIT, async (_event, repoPath: string, message: string) => {
    return commitChanges(repoPath, message)
  })

  // --- Operations ---

  ipcMain.handle(IPC.CHECKOUT, async (_event, repoPath: string, opts) => {
    return checkout(repoPath, opts)
  })

  ipcMain.handle(IPC.RESET, async (_event, repoPath: string, hash: string, mode) => {
    return reset(repoPath, hash, mode)
  })

  ipcMain.handle(IPC.MERGE, async (_event, repoPath: string, opts) => {
    return merge(repoPath, opts)
  })

  ipcMain.handle(IPC.CAN_FF_ONLY, async (_event, repoPath: string, source: string, target: string) => {
    return canFastForward(repoPath, source, target)
  })

  ipcMain.handle(IPC.REBASE, async (_event, repoPath: string, currentBranch: string, opts) => {
    return rebase(repoPath, currentBranch, opts)
  })

  ipcMain.handle(IPC.FETCH, async (_event, repoPath: string) => {
    const authUrl = await getRemoteAuthUrl(repoPath, store as any)
    return fetch(repoPath, authUrl ?? undefined)
  })

  ipcMain.handle(IPC.PULL, async (_event, repoPath: string) => {
    const authUrl = await getRemoteAuthUrl(repoPath, store as any)
    return pull(repoPath, authUrl ?? undefined)
  })

  ipcMain.handle(IPC.PUSH, async (_event, repoPath: string) => {
    const authUrl = await getRemoteAuthUrl(repoPath, store as any)
    return push(repoPath, authUrl ?? undefined)
  })

  ipcMain.handle(IPC.FORCE_PUSH, async (_event, repoPath: string) => {
    const authUrl = await getRemoteAuthUrl(repoPath, store as any)
    return forcePush(repoPath, authUrl ?? undefined)
  })

  ipcMain.handle(IPC.AUTH_ADD_ACCOUNT, async (_event, provider: string, host: string, token: string) => {
    return verifyAndAddAccount(store as any, provider as any, host, token)
  })

  ipcMain.handle(IPC.AUTH_LIST_ACCOUNTS, () => {
    return listAccounts(store as any)
  })

  ipcMain.handle(IPC.AUTH_REMOVE_ACCOUNT, (_event, host: string, username: string) => {
    removeAccount(store as any, host, username)
  })

  ipcMain.handle(IPC.CREATE_BRANCH, async (_event, repoPath: string, name: string, from: string) => {
    return createBranch(repoPath, name, from)
  })

  ipcMain.handle(IPC.DELETE_BRANCH, async (_event, repoPath: string, name: string, force: boolean) => {
    return deleteBranch(repoPath, name, force)
  })

  ipcMain.handle(IPC.RENAME_BRANCH, async (_event, repoPath: string, oldName: string, newName: string) => {
    return renameBranch(repoPath, oldName, newName)
  })

  ipcMain.handle(IPC.CHERRY_PICK, async (_event, repoPath: string, hash: string) => {
    return cherryPick(repoPath, hash)
  })

  ipcMain.handle(IPC.CREATE_TAG, async (_event, repoPath: string, name: string, hash: string) => {
    return createTag(repoPath, name, hash)
  })

  ipcMain.handle(IPC.PUSH_TAG, async (_event, repoPath: string, name: string) => {
    const authUrl = await getRemoteAuthUrl(repoPath, store as any)
    return pushTag(repoPath, name, authUrl ?? undefined)
  })

  ipcMain.handle(IPC.DELETE_TAG, async (_event, repoPath: string, name: string) => {
    return deleteTag(repoPath, name)
  })
}
