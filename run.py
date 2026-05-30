#!/usr/bin/env python3
"""
run.py — Lanzador del Sistema de Optimización Acuícola Real del Meta

Uso:
    cd proyecto
    python run.py

Hace automáticamente:
    1. Verifica Node.js instalado
    2. pip install -r backend/requirements.txt
    3. npm install en frontend/ (solo primera vez)
    4. Arranca el backend  → http://localhost:8000
    5. Arranca el frontend → http://localhost:3000
    6. Abre el navegador
    7. Ctrl+C detiene ambos servicios limpiamente
"""

import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ── Rutas ─────────────────────────────────────────────────────────────────────
BASE         = Path(__file__).resolve().parent
BACKEND_DIR  = BASE / "backend"
FRONTEND_DIR = BASE / "frontend"
NPM          = "npm.cmd" if sys.platform == "win32" else "npm"

BACKEND_PORT  = 8000
FRONTEND_PORT = 3000

# ── Colores ANSI (habilitados en Windows moderno) ─────────────────────────────
if sys.platform == "win32":
    os.system("")  # activa secuencias ANSI en la terminal de Windows

def _c(code, texto):
    return f"\033[{code}m{texto}\033[0m"

def bold(t):   return _c("1", t)
def green(t):  return _c("92", t)
def yellow(t): return _c("93", t)
def red(t):    return _c("91", t)
def cyan(t):   return _c("96", t)
def gray(t):   return _c("90", t)
def blue(t):   return _c("94", t)

# ── Banner ────────────────────────────────────────────────────────────────────
def banner():
    print(cyan(bold(r"""
  ╔══════════════════════════════════════════════════════╗
  ║  🐟  ACUÍCOLA REAL DEL META                          ║
  ║      Optimización de Red Logística                    ║
  ║      AG + Gradiente + Dijkstra + Flujo Máximo         ║
  ╚══════════════════════════════════════════════════════╝
""")))

# ── Paso 1: Verificar entorno ─────────────────────────────────────────────────
def verificar():
    print(bold("\n[1/3] Verificando entorno...\n"))
    ok = True

    if not BACKEND_DIR.exists():
        print(red(f"  ✗  No se encontró la carpeta: {BACKEND_DIR}"))
        ok = False
    else:
        print(green(f"  ✓  backend/  →  {BACKEND_DIR}"))

    if not FRONTEND_DIR.exists():
        print(red(f"  ✗  No se encontró la carpeta: {FRONTEND_DIR}"))
        ok = False
    else:
        print(green(f"  ✓  frontend/ →  {FRONTEND_DIR}"))

    if sys.version_info < (3, 9):
        print(red(f"  ✗  Python {sys.version} detectado — se requiere 3.9+"))
        ok = False
    else:
        print(green(f"  ✓  Python {sys.version.split()[0]}"))

    if shutil.which("node") is None:
        print(red("  ✗  Node.js no encontrado"))
        print(yellow("     Descárgalo en:  https://nodejs.org"))
        ok = False
    else:
        node_ver = subprocess.check_output(["node", "--version"], text=True).strip()
        print(green(f"  ✓  Node.js {node_ver}"))

    if not ok:
        print(red("\n  Corrige los errores anteriores y vuelve a ejecutar.\n"))
        sys.exit(1)

# ── Paso 2: Instalar dependencias ─────────────────────────────────────────────
def instalar():
    print(bold("\n[2/3] Instalando dependencias...\n"))

    # ─ Python / pip ─
    req = BACKEND_DIR / "requirements.txt"
    if not req.exists():
        print(red(f"  ✗  No se encontró {req}"))
        sys.exit(1)

    print(yellow("  → pip install -r requirements.txt ..."))
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(req),
         "-q", "--no-warn-script-location"],
        cwd=BACKEND_DIR,
    )
    if r.returncode != 0:
        print(red("  ✗  Error en pip install. Revisa requirements.txt y tu conexión."))
        sys.exit(1)
    print(green("  ✓  Dependencias Python instaladas"))

    # ─ Node / npm ─
    node_modules = FRONTEND_DIR / "node_modules"
    if node_modules.exists():
        print(green("  ✓  node_modules ya existe  (npm install omitido)"))
    else:
        print(yellow("  → npm install  (primera vez, puede tardar 1-2 minutos)..."))
        r = subprocess.run([NPM, "install"], cwd=FRONTEND_DIR)
        if r.returncode != 0:
            print(red("  ✗  Error en npm install. Revisa tu conexión a internet."))
            sys.exit(1)
        print(green("  ✓  Dependencias npm instaladas"))

# ── Paso 3: Lanzar servicios ──────────────────────────────────────────────────
def lanzar():
    print(bold("\n[3/3] Iniciando servicios...\n"))
    procesos = []

    # ─ Backend ─
    print(cyan(f"  → Backend  (FastAPI + uvicorn)  →  http://localhost:{BACKEND_PORT}"))
    proc_back = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "main:app",
            "--reload", "--host", "127.0.0.1", "--port", str(BACKEND_PORT),
        ],
        cwd=BACKEND_DIR,
    )
    procesos.append(proc_back)

    # Dar tiempo al backend para arrancar antes de abrir el frontend
    time.sleep(4)

    # ─ Frontend ─
    print(cyan(f"  → Frontend (Vite + React)       →  http://localhost:{FRONTEND_PORT}"))
    proc_front = subprocess.Popen(
        [NPM, "run", "dev"],
        cwd=FRONTEND_DIR,
    )
    procesos.append(proc_front)

    # Dar tiempo a Vite para compilar
    time.sleep(5)

    # ─ Abrir navegador ─
    print(cyan("  → Abriendo navegador..."))
    try:
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")
    except Exception:
        pass

    # ─ Mensaje final ─
    print(green(bold(f"""
  ╔══════════════════════════════════════════════════════╗
  ║  ✓  Sistema listo                                    ║
  ╠══════════════════════════════════════════════════════╣
  ║  Frontend →  http://localhost:{FRONTEND_PORT}                  ║
  ║  Backend  →  http://localhost:{BACKEND_PORT}                  ║
  ║  API Docs →  http://localhost:{BACKEND_PORT}/docs             ║
  ╠══════════════════════════════════════════════════════╣
  ║  Presiona  Ctrl+C  para detener todo                 ║
  ╚══════════════════════════════════════════════════════╝
""")))

    # ─ Esperar hasta Ctrl+C ─
    try:
        proc_back.wait()
    except KeyboardInterrupt:
        pass
    finally:
        print(yellow("\n  → Deteniendo servicios..."))
        for p in procesos:
            try:
                p.terminate()
                p.wait(timeout=6)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
        print(green("  ✓  Servicios detenidos.\n"))

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    banner()
    verificar()
    instalar()
    lanzar()
