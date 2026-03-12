import { app, shell, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { join } from 'path'
import { registerHandlers } from './ipc/handlers'
import { startWatcher, stopWatcher } from './git/watcher'
import { IPC } from '../shared/ipc'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'

const store = new Store<{ recentRepos: string[]; accounts: any[] }>({
  defaults: { recentRepos: [], accounts: [] }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  createWindow()
  registerHandlers(store)

  // Auto-updater (only runs in packaged app, not dev)
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send(IPC.UPDATE_AVAILABLE, info.version)
  })
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send(IPC.UPDATE_DOWNLOADED, info.version)
  })
  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send(IPC.UPDATE_ERROR, err.message)
  })

  ipcMain.on(IPC.UPDATE_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })
  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    if (!process.env['ELECTRON_RENDERER_URL']) autoUpdater.checkForUpdates()
  })

  if (!process.env['ELECTRON_RENDERER_URL']) {
    autoUpdater.checkForUpdates()
  }

  globalShortcut.register('CommandOrControl+O', () => {
    mainWindow?.webContents.send('menu:openRepo')
  })
  globalShortcut.register('CommandOrControl+R', () => {
    mainWindow?.webContents.send(IPC.REPO_CHANGED)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  stopWatcher()
  if (process.platform !== 'darwin') app.quit()
})

export { mainWindow, store }
