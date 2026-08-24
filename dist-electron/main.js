var _ = Object.defineProperty;
var I = (t, e, o) => e in t ? _(t, e, { enumerable: !0, configurable: !0, writable: !0, value: o }) : t[e] = o;
var a = (t, e, o) => I(t, typeof e != "symbol" ? e + "" : e, o);
import { clipboard as y, app as h, BrowserWindow as w, ipcMain as u } from "electron";
import { fileURLToPath as P } from "node:url";
import i from "node:path";
import { spawn as A } from "node:child_process";
import { existsSync as S } from "node:fs";
const C = i.dirname(P(import.meta.url));
class W {
  constructor(e) {
    a(this, "isActive", !1);
    a(this, "shortcuts", []);
    a(this, "mainWindow", null);
    a(this, "pythonProcess", null);
    a(this, "stdoutBuffer", "");
    a(this, "replacementInProgress", !1);
    a(this, "testingInputFocused", !1);
    this.mainWindow = e;
  }
  setTestingInputFocused(e) {
    this.testingInputFocused = e;
  }
  /**
   * Start the keyboard hook
   */
  start(e) {
    return this.isActive ? (console.log("🎹 Keyboard hook already active"), !0) : (this.shortcuts = e, this.isActive = !0, console.log("🎹 Keyboard hook STARTING..."), console.log("📝 Registered shortcuts:"), e.forEach((o) => {
      console.log(`   "${o.name}" → "${o.content}"`);
    }), this.spawnPythonListener(), !0);
  }
  /**
   * Stop the keyboard hook
   */
  stop() {
    var o;
    if (!this.isActive)
      return console.log("🎹 Keyboard hook not active"), !1;
    this.isActive = !1;
    const e = this.pythonProcess;
    if (e) {
      try {
        (o = e.stdin) == null || o.write(JSON.stringify({ type: "stop" }) + `
`), setTimeout(() => {
          e.killed || e.kill();
        }, 1e3);
      } catch (s) {
        console.error("Error stopping Python process:", s);
      }
      this.pythonProcess = null;
    }
    return console.log("🎹 Keyboard hook STOPPED"), !0;
  }
  /**
   * Update shortcuts
   */
  updateShortcuts(e) {
    if (this.shortcuts = e, console.log("✏️ Shortcuts updated:", e.length), this.pythonProcess && this.pythonProcess.stdin)
      try {
        const o = {
          type: "update_shortcuts",
          shortcuts: e.map((s) => ({
            name: s.name,
            label: s.label,
            content: s.content
          }))
        };
        this.pythonProcess.stdin.write(JSON.stringify(o) + `
`);
      } catch (o) {
        console.error("Error updating shortcuts in Python:", o);
      }
  }
  /**
   * Spawn Python listener process
   */
  spawnPythonListener() {
    var e, o, s;
    try {
      const l = !process.env.VITE_DEV_SERVER_URL, d = process.platform === "win32" ? "listener.exe" : "listener", g = l ? i.join(process.resourcesPath, d) : process.platform === "win32" ? "python.exe" : "python3", v = l ? [] : ["-u", i.join(C, "..", "listener.py")];
      if (console.log(`⚙️ Listener: ${g}`), !S(g)) {
        console.error(`❌ Listener not found: ${g}`), this.isActive = !1, (e = this.mainWindow) == null || e.webContents.send("keyboard-hook-ready", !1);
        return;
      }
      if (this.pythonProcess = A(g, v, {
        stdio: ["pipe", "pipe", "pipe"],
        detached: !1
      }), !this.pythonProcess) {
        console.error("❌ Failed to spawn Python process"), this.isActive = !1, this.mainWindow && this.mainWindow.webContents.send("keyboard-hook-ready", !1);
        return;
      }
      console.log(`✅ Python process spawned (PID: ${this.pythonProcess.pid})`), (o = this.pythonProcess.stdout) == null || o.on("data", (c) => {
        this.stdoutBuffer += c.toString("utf-8");
        const p = this.stdoutBuffer.split(/\r?\n/);
        this.stdoutBuffer = p.pop() ?? "";
        for (const R of p) {
          const f = R.trim();
          f && (console.log(`[PYTHON-OUT] ${f}`), this.handlePythonMessage(f));
        }
      }), (s = this.pythonProcess.stderr) == null || s.on("data", (c) => {
        const p = c.toString("utf-8").trim();
        p && console.error(`[PYTHON-ERR] ${p}`);
      }), this.pythonProcess.on("error", (c) => {
        console.error(`❌ Python process error: ${c}`), this.isActive = !1, this.pythonProcess = null, this.stdoutBuffer = "", this.mainWindow && this.mainWindow.webContents.send("keyboard-hook-ready", !1);
      }), this.pythonProcess.on("exit", (c) => {
        console.log(`⚠️ Python listener exited with code ${c}`), this.isActive = !1, this.pythonProcess = null, this.mainWindow && this.mainWindow.webContents.send("keyboard-hook-ready", !1);
      }), this.updateShortcuts(this.shortcuts), this.mainWindow && setTimeout(() => {
        var c;
        console.log(`📢 Notifying UI: Hook is ${this.isActive ? "ACTIVE" : "INACTIVE"}`), (c = this.mainWindow) == null || c.webContents.send("keyboard-hook-ready", this.isActive);
      }, 1e3), console.log("✅ Python listener setup complete");
    } catch (l) {
      console.error("❌ Fatal error spawning Python process:", l), this.isActive = !1, this.mainWindow && this.mainWindow.webContents.send("keyboard-hook-ready", !1);
    }
  }
  /**
   * Handle messages from Python process
   */
  handlePythonMessage(e) {
    var o;
    try {
      const s = JSON.parse(e);
      if (s.type === "shortcut_detected" && typeof s.trigger == "string" && typeof s.content == "string") {
        if (console.log(`✨ SHORTCUT DETECTED: "${s.trigger}"`), (o = this.mainWindow) != null && o.isFocused() && !this.testingInputFocused) {
          console.log("⏭️ Ignoring shortcut while ColixAI is focused");
          return;
        }
        console.log(`🔄 REPLACING WITH: "${s.content}"`), this.requestReplacement(s.trigger, s.content), this.mainWindow && this.mainWindow.webContents.send("shortcut-triggered", s.trigger, s.content);
      }
    } catch {
      e.length > 0 && console.log(`[PYTHON] ${e}`);
    }
  }
  /**
   * Request replacement through the Python keyboard listener
   */
  requestReplacement(e, o) {
    var s, l;
    if (this.replacementInProgress) {
      console.log("⏭️ Replacement already in progress; ignoring overlapping trigger");
      return;
    }
    this.replacementInProgress = !0;
    try {
      console.log(`📋 Preparing instant replacement (${o.length} characters)`);
      const d = y.readText();
      y.writeText(o), (l = (s = this.pythonProcess) == null ? void 0 : s.stdin) == null || l.write(JSON.stringify({
        type: "replace_text",
        character_count: e.length
      }) + `
`), setTimeout(() => y.writeText(d), 300), console.log("✅ Replacement requested");
    } catch (d) {
      console.error("❌ Error performing replacement:", d);
    } finally {
      this.replacementInProgress = !1;
    }
  }
  /**
   * Check if hook is active
   */
  isRunning() {
    return this.isActive;
  }
  /**
   * Get all shortcuts
   */
  getShortcuts() {
    return this.shortcuts;
  }
}
function b(t) {
  return new W(t);
}
const k = i.dirname(P(import.meta.url));
process.env.APP_ROOT = i.join(k, "..");
const m = process.env.VITE_DEV_SERVER_URL, j = i.join(process.env.APP_ROOT, "dist-electron"), T = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? i.join(process.env.APP_ROOT, "public") : T;
let n, r = null;
function E() {
  n = new w({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    autoHideMenuBar: !0,
    icon: i.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: i.join(k, "preload.mjs")
    }
  }), n.maximize(), n.on("close", () => console.log("🪟 Main window close requested")), n.on("closed", () => console.log("🪟 Main window closed")), n.webContents.on("render-process-gone", (t, e) => {
    console.error("💥 Renderer process gone:", e);
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), m ? n.loadURL(m) : n.loadFile(i.join(T, "index.html"));
}
h.on("window-all-closed", () => {
  console.log("🛑 All windows closed"), process.platform !== "darwin" && (h.quit(), n = null);
});
h.on("activate", () => {
  w.getAllWindows().length === 0 && E();
});
h.whenReady().then(() => {
  E();
});
process.on("uncaughtException", (t) => {
  console.error("💥 Main process uncaught exception:", t);
});
process.on("unhandledRejection", (t) => {
  console.error("💥 Main process unhandled rejection:", t);
});
h.on("will-quit", () => console.log("🛑 Electron will quit"));
process.on("exit", (t) => console.log(`🛑 Node process exit: ${t}`));
h.on("before-quit", () => {
  r == null || r.stop();
});
u.handle("start-keyboard-hook", async (t, e) => {
  try {
    r || (r = b(n));
    const o = r.start(e);
    return n && n.webContents.send("keyboard-hook-ready", o), {
      success: o,
      message: o ? "Keyboard hook started" : "Keyboard hook already running"
    };
  } catch (o) {
    return console.error("Error starting keyboard hook:", o), { success: !1, message: "Failed to start keyboard hook" };
  }
});
u.handle("stop-keyboard-hook", async () => {
  try {
    if (r) {
      const t = r.stop();
      return n && n.webContents.send("keyboard-hook-ready", !1), {
        success: t,
        message: t ? "Keyboard hook stopped" : "Keyboard hook not running"
      };
    }
    return { success: !0, message: "Keyboard hook stopped" };
  } catch (t) {
    return console.error("Error stopping keyboard hook:", t), { success: !1, message: "Failed to stop keyboard hook" };
  }
});
u.handle("update-shortcuts", async (t, e) => {
  try {
    return r || (r = b(n)), r.updateShortcuts(e), { success: !0, message: "Shortcuts updated" };
  } catch (o) {
    return console.error("Error updating shortcuts:", o), { success: !1, message: "Failed to update shortcuts" };
  }
});
u.on("notification", (t, e) => {
  console.log("Notification from renderer:", e);
});
u.on("shortcut-test-focus", (t, e) => {
  r == null || r.setTestingInputFocused(e);
});
export {
  j as MAIN_DIST,
  T as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
