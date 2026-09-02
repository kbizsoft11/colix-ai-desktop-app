"""Global keyboard listener for ColixAI shortcuts."""

import json
import ctypes
import os
import sys
import time
from threading import Thread

from pynput import keyboard

RESET = "\033[0m"
CYAN = "\033[36m"
GREEN = "\033[32m"

def get_foreground_process_name():
    """Return the executable name of the currently focused Windows app."""
    if sys.platform != "win32":
        return ""
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        hwnd = user32.GetForegroundWindow()
        process_id = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
        process_query_limited_information = 0x1000
        handle = kernel32.OpenProcess(process_query_limited_information, False, process_id.value)
        if not handle:
            return ""
        try:
            buffer = ctypes.create_unicode_buffer(260)
            buffer_size = ctypes.c_ulong(len(buffer))
            if kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(buffer_size)):
                return os.path.basename(buffer.value).lower()
        finally:
            kernel32.CloseHandle(handle)
    except Exception as error:
        print(f"[PROCESS] lookup failed: {error}", flush=True)
    return ""

class ShortcutListener:
    def __init__(self):
        self.typed_buffer = ""
        self.shortcuts = {}
        self.buffer_clear_time = 1.0
        self.last_keystroke_time = time.time()
        self.listener = None
        self.controller = keyboard.Controller()

    def load_shortcuts(self, shortcuts_dict):
        """Load the current shortcut definitions."""
        self.shortcuts = {s['name']: s for s in shortcuts_dict}
        print(f"[LISTENER] Loaded {len(self.shortcuts)} shortcuts with current content", flush=True)
        print(f"[SHORTCUTS] Active triggers: {', '.join(self.shortcuts.keys()) or '(none)'}", flush=True)
        for name in self.shortcuts:
            print(f"  - '{name}'", flush=True)

    def on_press(self, key):
        try:
            if hasattr(key, 'char') and key.char is not None:
                self.on_key_typed(key.char)
            else:
                self.clear_buffer_if_timeout()
        except Exception as error:
            print(f"[ERROR] {error}", flush=True)

    def on_key_typed(self, char):
        current_time = time.time()
        if current_time - self.last_keystroke_time > self.buffer_clear_time:
            self.typed_buffer = ""

        self.last_keystroke_time = current_time
        self.typed_buffer += char

        for shortcut_name, shortcut_data in self.shortcuts.items():
            if self.typed_buffer == shortcut_name:
                print(f"{GREEN}[MATCH]{RESET} '{shortcut_name}' at {time.perf_counter():.6f}", flush=True)
                print(json.dumps({
                    "type": "shortcut_detected",
                    "trigger": shortcut_name,
                    "content": shortcut_data['content'],
                    "process": get_foreground_process_name(),
                }), flush=True)
                self.typed_buffer = ""
                return

    def clear_buffer_if_timeout(self):
        if time.time() - self.last_keystroke_time > self.buffer_clear_time:
            self.typed_buffer = ""

    def start(self):
        print("[LISTENER] Starting global keyboard listener...", flush=True)
        self.listener = keyboard.Listener(on_press=self.on_press)
        self.listener.start()
        print("[LISTENER] Keyboard listener active", flush=True)
        try:
            self.listener.join()
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        if self.listener:
            self.listener.stop()

    def replace_text(self, character_count):
        """Remove the typed trigger and paste the clipboard into the target app."""
        import platform
        started_at = time.perf_counter()
        print(f"{CYAN}[REPLACE]{RESET} started; deleting {character_count} characters", flush=True)
        for _ in range(max(0, character_count)):
            self.controller.press(keyboard.Key.backspace)
            self.controller.release(keyboard.Key.backspace)

        # Mac uses Cmd+V, Windows/Linux uses Ctrl+V
        if platform.system() == 'Darwin':
            self.controller.press(keyboard.Key.cmd)
            self.controller.press('v')
            self.controller.release('v')
            self.controller.release(keyboard.Key.cmd)
        else:
            self.controller.press(keyboard.Key.ctrl)
            self.controller.press('v')
            self.controller.release('v')
            self.controller.release(keyboard.Key.ctrl)

        self.typed_buffer = ""
        print(f"{GREEN}[REPLACE]{RESET} finished in {(time.perf_counter() - started_at) * 1000:.1f}ms", flush=True)


def main():
    listener = ShortcutListener()
    print("[STARTUP] ColixAI Keyboard Listener Starting", flush=True)

    listener_thread = Thread(target=listener.start, daemon=True)
    listener_thread.start()

    try:
        while True:
            try:
                line = input()
                if not line.strip():
                    continue
                data = json.loads(line)
                if data.get("type") == "update_shortcuts":
                    listener.load_shortcuts(data.get("shortcuts", []))
                elif data.get("type") == "stop":
                    listener.stop()
                    break
                elif data.get("type") == "replace_text":
                    listener.replace_text(int(data.get("character_count", 0)))
            except json.JSONDecodeError:
                print("[ERROR] Invalid JSON received", flush=True)
            except EOFError:
                listener.stop()
                break
    except KeyboardInterrupt:
        listener.stop()
    finally:
        print("[SHUTDOWN] Keyboard listener shutting down", flush=True)


if __name__ == "__main__":
    main()
