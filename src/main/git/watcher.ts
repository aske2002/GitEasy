import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'
import { IPC } from '../../shared/ipc'

let watcher: chokidar.FSWatcher | null = null

export function startWatcher(repoPath: string): void {
  stopWatcher()

  // Watch the git directory for changes (refs, HEAD, index)
  watcher = chokidar.watch(`${repoPath}/.git`, {
    ignoreInitial: true,
    depth: 2,
    usePolling: true,
    interval: 800,
    ignored: [
      /COMMIT_EDITMSG/,
      /\.lock$/,
      /\/logs\//
    ]
  })

  const notify = () => {
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.REPO_CHANGED)
      }
    })
  }

  watcher.on('change', notify)
  watcher.on('add', notify)
  watcher.on('unlink', notify)
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
