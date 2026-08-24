import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createKeyboardHook } from './keyboardHook'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let keyboardHook: ReturnType<typeof createKeyboardHook> | null = null
type HookShortcuts = Parameters<ReturnType<typeof createKeyboardHook>['start']>[0]

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.maximize()

  win.on('close', () => console.log('🪟 Main window close requested'))
  win.on('closed', () => console.log('🪟 Main window closed'))
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('💥 Renderer process gone:', details)
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  console.log('🛑 All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
})

process.on('uncaughtException', error => {
  console.error('💥 Main process uncaught exception:', error)
})
process.on('unhandledRejection', reason => {
  console.error('💥 Main process unhandled rejection:', reason)
})
app.on('will-quit', () => console.log('🛑 Electron will quit'))
process.on('exit', code => console.log(`🛑 Node process exit: ${code}`))

// Ensure the global listener is not left behind when the app is closed or
// replaced during an uninstall/reinstall.
app.on('before-quit', () => {
  keyboardHook?.stop()
})

// ========== IPC Handlers ==========

/**
 * Start keyboard hook
 */
ipcMain.handle('start-keyboard-hook', async (_event, shortcuts: HookShortcuts) => {
  try {
    if (!keyboardHook) {
      keyboardHook = createKeyboardHook(win)
    }
    
    const started = keyboardHook.start(shortcuts)
    
    if (win) {
      win.webContents.send('keyboard-hook-ready', started)
    }
    
    return { 
      success: started, 
      message: started ? 'Keyboard hook started' : 'Keyboard hook already running'
    }
  } catch (error) {
    console.error('Error starting keyboard hook:', error)
    return { success: false, message: 'Failed to start keyboard hook' }
  }
})

/**
 * Stop keyboard hook
 */
ipcMain.handle('stop-keyboard-hook', async () => {
  try {
    if (keyboardHook) {
      const stopped = keyboardHook.stop()
      
      if (win) {
        win.webContents.send('keyboard-hook-ready', false)
      }
      
      return { 
        success: stopped, 
        message: stopped ? 'Keyboard hook stopped' : 'Keyboard hook not running'
      }
    }
    
    return { success: true, message: 'Keyboard hook stopped' }
  } catch (error) {
    console.error('Error stopping keyboard hook:', error)
    return { success: false, message: 'Failed to stop keyboard hook' }
  }
})

/**
 * Update shortcuts in keyboard hook
 */
ipcMain.handle('update-shortcuts', async (_event, shortcuts: HookShortcuts) => {
  try {
    if (!keyboardHook) {
      keyboardHook = createKeyboardHook(win)
    }
    
    keyboardHook.updateShortcuts(shortcuts)
    return { success: true, message: 'Shortcuts updated' }
  } catch (error) {
    console.error('Error updating shortcuts:', error)
    return { success: false, message: 'Failed to update shortcuts' }
  }
})

/**
 * Listen for notifications from renderer
 */
ipcMain.on('notification', (_event, message: string) => {
  console.log('Notification from renderer:', message)
})

ipcMain.on('shortcut-test-focus', (_event, focused: boolean) => {
  keyboardHook?.setTestingInputFocused(focused)
})
