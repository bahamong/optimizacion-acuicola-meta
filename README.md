# 🐟 Acuícola Real del Meta — Optimizador de Red Logística

Sistema de optimización de la red de distribución nacional de pescado, desde
centros de producción (Meta y Cundinamarca) hasta supermercados, minimizando el
costo total de transporte, almacenamiento y mermas, sujeto a restricciones de
capacidad, demanda y calidad.

Integra **programación lineal**, **teoría de grafos** y **algoritmos heurísticos**
(genético + gradiente), expuestos mediante una **API REST (FastAPI)** y una
**interfaz web geoespacial (React + Leaflet)**.

---

## 🧠 Técnicas de optimización implementadas

| Técnica | Uso en el proyecto | Librería |
|---|---|---|
| **Algoritmo Genético** | Búsqueda global de la asignación de flujos óptima | `deap` |
| **Método del Gradiente** | Refinamiento local de la solución | `scipy` / `numpy` |
| **Dijkstra** | Ruta de menor costo entre nodos | `networkx` |
| **Flujo Máximo** | Capacidad máxima de la red | `networkx` |
| **Programación Lineal** | Modelo formal de referencia | `pulp` |
| **Análisis de sensibilidad** | Escenarios "what-if" sobre parámetros | propio |

---

## 🏗️ Arquitectura

```
.
├── backend/                 # API REST + lógica de optimización (Python / FastAPI)
│   ├── algoritmos/          # genético, gradiente, validador
│   ├── grafos/              # Dijkstra, flujo máximo
│   ├── models/              # nodo, arista, grafo (modelos de dominio)
│   ├── api/                 # rutas / endpoints REST
│   ├── database/            # SQLAlchemy (modelos_sql, db)
│   ├── sensibilidad/        # generación de escenarios
│   ├── utils/               # helpers, logger
│   ├── tests/               # pruebas con pytest
│   ├── config.py            # configuración vía variables de entorno
│   ├── main.py              # punto de entrada FastAPI
│   └── requirements.txt
├── frontend/                # SPA React + Vite
│   └── src/
│       ├── components/      # Mapa, PanelKPI, Sidebar, Vistas, etc.
│       └── services/        # cliente HTTP (axios)
├── run.py                   # 🚀 lanzador todo-en-uno (backend + frontend)
└── documentos/
```

---

## 🚀 Cómo ejecutarlo

### Requisitos previos
- **Python 3.9+**
- **Node.js 18+** (incluye `npm`)

### Opción A — Lanzador automático (recomendado)

Desde la raíz del proyecto:

```bash
python run.py
```

Esto instala dependencias (pip + npm), arranca el backend y el frontend, y abre
el navegador automáticamente. `Ctrl+C` detiene ambos servicios.

- Frontend → http://localhost:3000
- Backend  → http://localhost:8000
- API Docs → http://localhost:8000/docs

### Opción B — Manual

**Backend:**
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt
python main.py            # o: uvicorn main:app --reload
```

**Frontend** (en otra terminal):
```bash
cd frontend
cp .env.example .env      # ajusta VITE_API_URL si lo necesitas
npm install
npm run dev
```

---

## ⚙️ Configuración

Los parámetros del backend se controlan con variables de entorno (ver
[`backend/.env.example`](backend/.env.example)): tamaño de población del algoritmo
genético, tasas de mutación/cruzamiento, tolerancia del gradiente, penalizaciones
y parámetros de negocio. Todos tienen valores por defecto razonables.

El frontend usa `VITE_API_URL` (ver [`frontend/.env.example`](frontend/.env.example))
para apuntar a la API.

---

## 🧪 Pruebas

```bash
cd backend
pytest
```

---

## 📄 Documentos

La carpeta raíz incluye la documentación del proyecto (modelo matemático formal,
requerimientos y contexto completo) en formato `.md` y `.pdf`.

---

## 📚 Stack tecnológico

- **Backend:** FastAPI · Uvicorn · Pydantic · NetworkX · NumPy · SciPy · DEAP · PuLP · SQLAlchemy
- **Frontend:** React 18 · Vite · Axios · Leaflet / React-Leaflet · Chart.js

---

> Proyecto académico — Optimización de la red logística "Acuícola Real del Meta".
