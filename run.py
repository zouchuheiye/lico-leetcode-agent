#!/usr/bin/env python3
# encoding: utf-8
"""Lico launcher.

All startup logic lives here. start.bat only calls this script, so we avoid
every known Windows .bat pitfall: nested quotes, GBK mojibake of Chinese
comments, parenthesised folder names like "(2)", and silent crashes of a
minimised `start /MIN` child window.

Behaviour:
  - detect a Python that can import fastapi/uvicorn/httpx; if missing, pip install
  - pick a free port starting from 8000 (avoids "address in use" crashes)
  - start uvicorn in a child process (logs inherit the console, fully visible)
  - wait for /api/status, then open the browser
  - stay in the foreground; on Ctrl+C or window close, kill the child
  - on any error, print it and wait for Enter instead of vanishing
"""
import os
import sys
import time
import socket
import subprocess
import webbrowser
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, "backend")
LOG = os.path.join(ROOT, "start.log")

REQUIRED = ["fastapi", "uvicorn", "pydantic", "httpx"]


def log(msg):
    line = "[%s] %s" % (time.strftime("%H:%M:%S"), msg)
    print(line)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def fix_encoding():
    # Keep the Windows console readable (avoid GBK mojibake).
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        os.system("chcp 65001 >nul 2>nul")
    except Exception:
        pass


def check_deps():
    missing = []
    for mod in REQUIRED:
        try:
            __import__(mod)
        except Exception:
            missing.append(mod)
    if not missing:
        return True
    log("Missing dependencies: %s. Installing (Tsinghua mirror)..." % ", ".join(missing))
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-q",
            "--disable-pip-version-check",
            "-i", "https://pypi.tuna.tsinghua.edu.cn/simple",
            *missing,
        ])
        return True
    except Exception as e:
        log("pip install failed: %s" % e)
        return False


def pick_port(start=8000, end=8010):
    for p in range(start, end + 1):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            pass
        finally:
            s.close()
    return None


def wait_ready(port, timeout=30):
    url = "http://127.0.0.1:%d/api/status" % port
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def main():
    fix_encoding()
    log("Lico launcher starting...")
    if not os.path.isdir(BACKEND):
        log("[ERROR] backend/ directory not found next to run.py.")
        input("Press Enter to exit.")
        return
    if not check_deps():
        log("[ERROR] Could not install dependencies. Check your network and Python.")
        input("Press Enter to exit.")
        return
    port = pick_port()
    if not port:
        log("[ERROR] No free port between 8000 and 8010.")
        input("Press Enter to exit.")
        return

    log("Starting backend on port %d ..." % port)
    # Run uvicorn as a child process. Args passed as a list (no shell quoting),
    # and its output inherits this console so nothing is hidden.
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=BACKEND,
    )

    try:
        if not wait_ready(port):
            log("[ERROR] Backend failed to start within 30s. See output above.")
            proc.terminate()
            input("Press Enter to exit.")
            return

        url = "http://127.0.0.1:%d" % port
        log("READY: %s" % url)
        print("")
        print("========================================")
        print("  Lico is running at  %s" % url)
        print("  Close this window to stop the server.")
        print("========================================")
        print("")
        try:
            webbrowser.open(url)
        except Exception:
            pass

        # Foreground keep-alive. Ctrl+C stops everything.
        try:
            while True:
                time.sleep(1)
                if proc.poll() is not None:
                    log("[WARN] Backend process exited unexpectedly.")
                    break
        except KeyboardInterrupt:
            log("Interrupted, stopping...")
    finally:
        try:
            if proc.poll() is None:
                proc.terminate()
        except Exception:
            pass


if __name__ == "__main__":
    main()
