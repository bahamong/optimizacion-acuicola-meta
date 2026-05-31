#!/usr/bin/env python3
"""
run.py — Lanzador del Sistema de Optimización Acuícola Real del Meta

Uso:
    python run.py              # arranca backend + frontend (rápido, sin reinstalar)
    python run.py --install    # reinstala dependencias (pip + npm) y luego arranca

Qué hace:
    1. Verifica el entorno (carpetas, Python 3.11, Node.js)
    2. Instala dependencias SOLO la primera vez (o con --install)
    3. Arranca el backend  → http://localhost:8000   (FastAPI + uvicorn, Python 3.11)
    4. Arranca el frontend → http://localhost:3000   (Vite + React)
    5. Abre el navegador
    6. Ctrl+C detiene ambos servicios limpiamente

Nota: el backend usa Python 3.11 (vía el lanzador "py -3.11" en Windows),
porque las dependencias científicas (scipy, pydantic) no compilan en 3.12+.
"""

import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# Asegurar salida UTF-8 para que el banner y los acentos no rompan en consolas
# Windows (cp1252) ni al redirigir la salida a un archivo.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ── Rutas y constantes ────────────────────────────────────────────────────────
BASE          = Path(__file__).resolve().parent
BACKEND_DIR   = BASE / "backend"
FRONTEND_DIR  = BASE / "frontend"
NPM           = "npm.cmd" if sys.platform == "win32" else "npm"
MARKER        = BASE / ".deps_instalados"   # se crea tras instalar correctamente

BACKEND_PORT  = 8000
FRONTEND_PORT = 3000

FORZAR_INSTALL = "--install" in sys.argv or "--reinstall" in sys.argv

# ── Colores ANSI ──────────────────────────────────────────────────────────────
if sys.platform == "win32":
    os.system("")  # activa secuencias ANSI en la terminal de Windows

def _c(code, t): return f"\033[{code}m{t}\033[0m"
def bold(t):   return _c("1", t)
def green(t):  return _c("92", t)
def yellow(t): return _c("93", t)
def red(t):    return _c("91", t)
def cyan(t):   return _c("96", t)
def gray(t):   return _c("90", t)

# ── Banner ──────────────────────────────────────────────────────────────────
def banner():
    print(cyan(bold(r"""
  ╔══════════════════════════════════════════════════════╗
  ║      ACUÍCOLA REAL DEL META                          ║
  ║      Optimización de Red Logística                    ║
  ║      AG + Gradiente + Dijkstra + Flujo Máximo         ║
  ╚══════════════════════════════════════════════════════╝
""")))

# ── Detectar el intérprete de Python 3.11 para el backend ─────────────────────
def python_backend():
    """Devuelve la orden para invocar Python 3.11 (donde están las dependencias)."""
    # 1. Lanzador 'py -3.11' (Windows)
    if sys.platform == "win32":
        try:
            subprocess.run(["py", "-3.11", "--version"],
                           capture_output=True, check=True)
            return ["py", "-3.11"]
        except Exception:
            pass
    # 2. Ejecutables comunes en PATH
    for exe in ("python3.11", "python3", "python"):
        ruta = shutil.which(exe)
        if ruta:
            try:
                out = subprocess.check_output([ruta, "--version"], text=True)
                if "3.11" in out:
                    return [ruta]
            except Exception:
                pass
    # 3. Último recurso: el intérprete actual
    return [sys.executable]

PY = python_backend()

# ── Paso 1: Verificar entorno ─────────────────────────────────────────────────
def verificar():
    print(bold("\n[1/3] Verificando entorno...\n"))
    ok = True

    if BACKEND_DIR.exists():
        print(green(f"  ✓  backend/  →  {BACKEND_DIR}"))
    else:
        print(red(f"  ✗  No se encontró la carpeta: {BACKEND_DIR}")); ok = False

    if FRONTEND_DIR.exists():
        print(green(f"  ✓  frontend/ →  {FRONTEND_DIR}"))
    else:
        print(red(f"  ✗  No se encontró la carpeta: {FRONTEND_DIR}")); ok = False

    try:
        ver = subprocess.check_output(PY + ["--version"], text=True).strip()
        if "3.11" in ver:
            print(green(f"  ✓  Backend usará {ver}  ({' '.join(PY)})"))
        else:
            print(yellow(f"  ⚠  Backend usará {ver} — se recomienda Python 3.11."))
            print(yellow("     Instálalo desde https://www.python.org/downloads/release/python-3119/"))
    except Exception:
        print(red("  ✗  No se pudo determinar la versión de Python del backend")); ok = False

    if shutil.which("node"):
        node_ver = subprocess.check_output(["node", "--version"], text=True).strip()
        print(green(f"  ✓  Node.js {node_ver}"))
    else:
        print(red("  ✗  Node.js no encontrado — descárgalo en https://nodejs.org")); ok = False

    if not ok:
        print(red("\n  Corrige los errores anteriores y vuelve a ejecutar.\n"))
        sys.exit(1)

# ── Paso 2: Instalar dependencias ─────────────────────────────────────────────
def _backend_ok() -> bool:
    """Devuelve True si los paquetes críticos del backend están instalados en PY."""
    paquetes = ["fastapi", "uvicorn", "supabase", "networkx", "numpy", "deap"]
    for pkg in paquetes:
        r = subprocess.run(
            PY + ["-c", f"import {pkg}"],
            capture_output=True,
        )
        if r.returncode != 0:
            return False
    return True


def instalar():
    node_modules = FRONTEND_DIR / "node_modules"
    # Verificar que los paquetes críticos estén instalados en Python 3.11
    deps_python_ok = _backend_ok()
    deps_npm_ok    = node_modules.exists() and (node_modules / "tailwindcss").exists()
    ya_instalado   = MARKER.exists() and deps_python_ok and deps_npm_ok

    if ya_instalado and not FORZAR_INSTALL:
        print(bold("\n[2/3] Dependencias ya instaladas (omitido)"))
        print(gray("       Usa  python run.py --install  si agregaste o actualizaste paquetes.\n"))
        return

    print(bold("\n[2/3] Instalando dependencias...\n"))

    # ─ Python / pip (en el intérprete 3.11) ─
    req = BACKEND_DIR / "requirements.txt"
    if not req.exists():
        print(red(f"  ✗  No se encontró {req}")); sys.exit(1)

    print(yellow(f"  → {' '.join(PY)} -m pip install -r requirements.txt ..."))
    r = subprocess.run(
        PY + ["-m", "pip", "install", "-r", str(req), "-q", "--no-warn-script-location"],
        cwd=BACKEND_DIR,
    )
    if r.returncode != 0:
        print(red("  ✗  Error en pip install. Revisa requirements.txt y tu conexión."))
        sys.exit(1)
    print(green("  ✓  Dependencias Python instaladas"))

    # ─ Node / npm ─
    if node_modules.exists() and not FORZAR_INSTALL:
        print(green("  ✓  node_modules ya existe  (npm install omitido)"))
    else:
        print(yellow("  → npm install  (puede tardar 1-2 minutos)..."))
        r = subprocess.run([NPM, "install"], cwd=FRONTEND_DIR)
        if r.returncode != 0:
            print(red("  ✗  Error en npm install. Revisa tu conexión a internet."))
            sys.exit(1)
        print(green("  ✓  Dependencias npm instaladas"))

    MARKER.touch()  # marcar instalación exitosa

# ── Paso 3: Lanzar servicios ──────────────────────────────────────────────────
def lanzar():
    print(bold("\n[3/3] Iniciando servicios...\n"))
    procesos = []

    # ─ Backend (FastAPI + uvicorn con Python 3.11) ─
    print(cyan(f"  → Backend  (FastAPI + uvicorn)  →  http://localhost:{BACKEND_PORT}"))
    proc_back = subprocess.Popen(
        PY + ["-m", "uvicorn", "main:app",
              "--host", "127.0.0.1", "--port", str(BACKEND_PORT)],
        cwd=BACKEND_DIR,
    )
    procesos.append(proc_back)
    time.sleep(4)  # dar tiempo al backend antes de abrir el navegador

    # ─ Frontend (Vite + React) ─
    print(cyan(f"  → Frontend (Vite + React)       →  http://localhost:{FRONTEND_PORT}"))
    proc_front = subprocess.Popen([NPM, "run", "dev"], cwd=FRONTEND_DIR)
    procesos.append(proc_front)
    time.sleep(5)  # dar tiempo a Vite para compilar

    # ─ Abrir navegador ─
    print(cyan("  → Abriendo navegador..."))
    try:
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")
    except Exception:
        pass

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

    # ─ Esperar hasta Ctrl+C y detener limpiamente ─
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
