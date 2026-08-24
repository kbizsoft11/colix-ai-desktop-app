var R = Object.defineProperty;
var _ = (t, e, o) => e in t ? R(t, e, { enumerable: !0, configurable: !0, writable: !0, value: o }) : t[e] = o;
var l = (t, e, o) => _(t, typeof e != "symbol" ? e + "" : e, o);
import { clipboard as f, app as d, BrowserWindow as m, ipcMain as u } from "electron";
import { fileURLToPath as w } from "node:url";
import i from "node:path";
import { spawn as I } from "node:child_process";
import { existsSync as A } from "node:fs";
const S = i.dirname(w(import.meta.url));
class C {
  constructor(e) {
    l(this, "isActive", !1);
    l(this, "shortcuts", []);
    l(this, "mainWindow", null);
    l(this, "pythonProcess", null);
    l(this, "stdoutBuffer", "");
    l(this, "replacementInProgress", !1);
    l(this, "testingInputFocused", !1);
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
      const h = !process.env.VITE_DEV_SERVER_URL, a = h ? i.join(process.resourcesPath, "listener.exe") : "python.exe", E = h ? [] : ["-u", i.join(S, "..", "listener.py")];
      if (console.log(`⚙️ Listener: ${a}`), !A(a)) {
        console.error(`❌ Listener not found: ${a}`), this.isActive = !1, (e = this.mainWindow) == null || e.webContents.send("keyboard-hook-ready", !1);
        return;
      }
      if (this.pythonProcess = I(a, E, {
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
        for (const v of p) {
          const g = v.trim();
          g && (console.log(`[PYTHON-OUT] ${g}`), this.handlePythonMessage(g));
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
    } catch (h) {
      console.error("❌ Fatal error spawning Python process:", h), this.isActive = !1, this.mainWindow && this.mainWindow.webContents.send("keyboard-hook-ready", !1);
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
    var s, h;
    if (this.replacementInProgress) {
      console.log("⏭️ Replacement already in progress; ignoring overlapping trigger");
      return;
    }
    this.replacementInProgress = !0;
    try {
      console.log(`📋 Preparing instant replacement (${o.length} characters)`);
      const a = f.readText();
      f.writeText(o), (h = (s = this.pythonProcess) == null ? void 0 : s.stdin) == null || h.write(JSON.stringify({
        type: "replace_text",
        character_count: e.length
      }) + `
`), setTimeout(() => f.writeText(a), 300), console.log("✅ Replacement requested");
    } catch (a) {
      console.error("❌ Error performing replacement:", a);
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
function P(t) {
  return new C(t);
}
const b = i.dirname(w(import.meta.url));
process.env.APP_ROOT = i.join(b, "..");
const y = process.env.VITE_DEV_SERVER_URL, V = i.join(process.env.APP_ROOT, "dist-electron"), k = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = y ? i.join(process.env.APP_ROOT, "public") : k;
let n, r = null;
function T() {
  n = new m({
    width: 1440,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    autoHideMenuBar: !0,
    icon: i.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: i.join(b, "preload.mjs")
    }
  }), n.maximize(), n.on("close", () => console.log("🪟 Main window close requested")), n.on("closed", () => console.log("🪟 Main window closed")), n.webContents.on("render-process-gone", (t, e) => {
    console.error("💥 Renderer process gone:", e);
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), y ? n.loadURL(y) : n.loadFile(i.join(k, "index.html"));
}
d.on("window-all-closed", () => {
  console.log("🛑 All windows closed"), process.platform !== "darwin" && (d.quit(), n = null);
});
d.on("activate", () => {
  m.getAllWindows().length === 0 && T();
});
d.whenReady().then(() => {
  T();
});
process.on("uncaughtException", (t) => {
  console.error("💥 Main process uncaught exception:", t);
});
process.on("unhandledRejection", (t) => {
  console.error("💥 Main process unhandled rejection:", t);
});
d.on("will-quit", () => console.log("🛑 Electron will quit"));
process.on("exit", (t) => console.log(`🛑 Node process exit: ${t}`));
d.on("before-quit", () => {
  r == null || r.stop();
});
u.handle("start-keyboard-hook", async (t, e) => {
  try {
    r || (r = P(n));
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
    return r || (r = P(n)), r.updateShortcuts(e), { success: !0, message: "Shortcuts updated" };
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
  V as MAIN_DIST,
  k as RENDERER_DIST,
  y as VITE_DEV_SERVER_URL
};
