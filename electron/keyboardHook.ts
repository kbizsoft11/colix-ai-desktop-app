import { spawn, ChildProcess } from 'node:child_process'
import { BrowserWindow, clipboard } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Shortcut {
  id: string
  name: string
  label: string
  content: string
  createdAt: number
  updatedAt: number
}

/**
 * Keyboard Hook using Python + pynput
 * Spawns a Python process that listens to all keystrokes globally
 */
export class KeyboardHook {
  private isActive: boolean = false
  private shortcuts: Shortcut[] = []
  private mainWindow: BrowserWindow | null = null
  private pythonProcess: ChildProcess | null = null
  private stdoutBuffer = ''
  private replacementInProgress = false
  private testingInputFocused = false

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow
  }

  setTestingInputFocused(focused: boolean): void {
    this.testingInputFocused = focused
  }

  /**
   * Start the keyboard hook
   */
  start(shortcuts: Shortcut[]): boolean {
    if (this.isActive) {
      console.log('🎹 Keyboard hook already active')
      return true
    }

    this.shortcuts = shortcuts
    this.isActive = true

    console.log('🎹 Keyboard hook STARTING...')
    console.log('📝 Registered shortcuts:')
    shortcuts.forEach(s => {
      console.log(`   "${s.name}" → "${s.content}"`)
    })

    // Spawn Python listener process
    this.spawnPythonListener()
    return true
  }

  /**
   * Stop the keyboard hook
   */
  stop(): boolean {
    if (!this.isActive) {
      console.log('🎹 Keyboard hook not active')
      return false
    }

    this.isActive = false

    const pythonProcess = this.pythonProcess
    if (pythonProcess) {
      try {
        pythonProcess.stdin?.write(JSON.stringify({ type: 'stop' }) + '\n')
        setTimeout(() => {
          if (!pythonProcess.killed) {
            pythonProcess.kill()
          }
        }, 1000)
      } catch (error) {
        console.error('Error stopping Python process:', error)
      }
      this.pythonProcess = null
    }

    console.log('🎹 Keyboard hook STOPPED')
    return true
  }

  /**
   * Update shortcuts
   */
  updateShortcuts(shortcuts: Shortcut[]): void {
    this.shortcuts = shortcuts
    console.log('✏️ Shortcuts updated:', shortcuts.length)

    // Send updated shortcuts to Python process
    if (this.pythonProcess && this.pythonProcess.stdin) {
      try {
        const message = {
          type: 'update_shortcuts',
          shortcuts: shortcuts.map(s => ({
            name: s.name,
            label: s.label,
            content: s.content
          })),
        }
        this.pythonProcess.stdin.write(JSON.stringify(message) + '\n')
      } catch (error) {
        console.error('Error updating shortcuts in Python:', error)
      }
    }
  }

  /**
   * Spawn Python listener process
   */
  private spawnPythonListener(): void {
    try {
      const isPackaged = !process.env.VITE_DEV_SERVER_URL
      const exeName = process.platform === 'win32' ? 'listener.exe' : 'listener'

      const cmd = isPackaged
        ? path.join(process.resourcesPath, exeName)
        : process.platform === 'win32' ? 'python.exe' : 'python3'

      const args = isPackaged
        ? []
        : ['-u', path.join(__dirname, '..', 'listener.py')]

      console.log(`⚙️ Listener: ${cmd}`)

      if (!existsSync(cmd)) {
        console.error(`❌ Listener not found: ${cmd}`)
        this.isActive = false
        this.mainWindow?.webContents.send('keyboard-hook-ready', false)
        return
      }

      this.pythonProcess = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })

      if (!this.pythonProcess) {
        console.error('❌ Failed to spawn Python process')
        this.isActive = false
        if (this.mainWindow) {
          this.mainWindow.webContents.send('keyboard-hook-ready', false)
        }
        return
      }

      console.log(`✅ Python process spawned (PID: ${this.pythonProcess.pid})`)

      // Handle stdout (messages from Python)
      this.pythonProcess.stdout?.on('data', (data: Buffer) => {
        this.stdoutBuffer += data.toString('utf-8')
        const lines = this.stdoutBuffer.split(/\r?\n/)
        this.stdoutBuffer = lines.pop() ?? ''
        for (const line of lines) {
          const message = line.trim()
          if (message) {
            console.log(`[PYTHON-OUT] ${message}`)
            this.handlePythonMessage(message)
          }
        }
      })

      // Handle stderr (debug from Python)
      this.pythonProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString('utf-8').trim()
        if (message) {
          console.error(`[PYTHON-ERR] ${message}`)
        }
      })

      // Handle process error
      this.pythonProcess.on('error', (err: Error) => {
        console.error(`❌ Python process error: ${err}`)
        this.isActive = false
        this.pythonProcess = null
        this.stdoutBuffer = ''
        if (this.mainWindow) {
          this.mainWindow.webContents.send('keyboard-hook-ready', false)
        }
      })

      // Handle process exit
      this.pythonProcess.on('exit', (code: number) => {
        console.log(`⚠️ Python listener exited with code ${code}`)
        this.isActive = false
        this.pythonProcess = null

        if (this.mainWindow) {
          this.mainWindow.webContents.send('keyboard-hook-ready', false)
        }
      })

      // Send initial shortcuts
      this.updateShortcuts(this.shortcuts)

      // Notify UI that hook is ready after a delay
      if (this.mainWindow) {
        setTimeout(() => {
          console.log(`📢 Notifying UI: Hook is ${this.isActive ? 'ACTIVE' : 'INACTIVE'}`)
          this.mainWindow?.webContents.send('keyboard-hook-ready', this.isActive)
        }, 1000)
      }

      console.log('✅ Python listener setup complete')
    } catch (error) {
      console.error('❌ Fatal error spawning Python process:', error)
      this.isActive = false

      if (this.mainWindow) {
        this.mainWindow.webContents.send('keyboard-hook-ready', false)
      }
    }
  }

  /**
   * Handle messages from Python process
   */
  private handlePythonMessage(message: string): void {
    try {
      // Parse JSON messages from Python
      const data = JSON.parse(message) as {
        type?: string
        trigger?: string
        content?: string
      }

      if (data.type === 'shortcut_detected' && typeof data.trigger === 'string' && typeof data.content === 'string') {
        console.log(`✨ SHORTCUT DETECTED: "${data.trigger}"`)

        // The global listener also sees keystrokes inside ColixAI. Ignore the
        // event here instead of asking Python to inspect Windows processes.
        if (this.mainWindow?.isFocused() && !this.testingInputFocused) {
          console.log('⏭️ Ignoring shortcut while ColixAI is focused')
          return
        }

        console.log(`🔄 REPLACING WITH: "${data.content}"`)

        // Request replacement through the Python keyboard listener.
        this.requestReplacement(data.trigger, data.content)

        // Notify UI
        if (this.mainWindow) {
          this.mainWindow.webContents.send('shortcut-triggered', data.trigger, data.content)
        }
      }
    } catch (error) {
      // Not JSON, just debug output from Python
      if (message.length > 0) {
        console.log(`[PYTHON] ${message}`)
      }
    }
  }

  /**
   * Request replacement through the Python keyboard listener
   */
  private requestReplacement(trigger: string, content: string): void {
    if (this.replacementInProgress) {
      console.log('⏭️ Replacement already in progress; ignoring overlapping trigger')
      return
    }

    this.replacementInProgress = true
    try {
      console.log(`📋 Preparing instant replacement (${content.length} characters)`)
      const previousClipboardText = clipboard.readText()
      clipboard.writeText(content)
      this.pythonProcess?.stdin?.write(JSON.stringify({
        type: 'replace_text',
        character_count: trigger.length,
      }) + '\n')
      // Give the target application time to consume Ctrl+V before restoring
      // the user's previous text clipboard contents.
      setTimeout(() => clipboard.writeText(previousClipboardText), 300)
      console.log('✅ Replacement requested')
    } catch (error) {
      console.error('❌ Error performing replacement:', error)
    } finally {
      this.replacementInProgress = false
    }
  }

  /**
   * Check if hook is active
   */
  isRunning(): boolean {
    return this.isActive
  }

  /**
   * Get all shortcuts
   */
  getShortcuts(): Shortcut[] {
    return this.shortcuts
  }
}

/**
 * Factory function to create keyboard hook
 */
export function createKeyboardHook(
  mainWindow: BrowserWindow | null,
): KeyboardHook {
  return new KeyboardHook(mainWindow)
}
