# IMPLEMENTATION PROMPT — Acuícola Real del Meta
## Upgrades críticos al backend de optimización

---

## CONTEXTO OBLIGATORIO ANTES DE TOCAR CUALQUIER ARCHIVO

### ¿Qué es el sistema?
Red logística de distribución de pescado en Colombia. El backend es Python + FastAPI.
La base de datos es Supabase (PostgreSQL). El grafo se construye en memoria con NetworkX.

### Estructura de archivos relevantes
```
backend/
├── algoritmos/
│   ├── optimizador_grafo.py   ← MOTOR PRINCIPAL (cambios mayores aquí)
│   └── validador.py           ← validación post-optimización
├── grafos/
│   ├── dijkstra.py            ← REESCRIBIR COMPLETAMENTE
│   └── flujo_maximo.py        ← no tocar
├── sensibilidad/
│   └── escenarios.py          ← REDISEÑAR escenarios What-If
├── models/
│   ├── grafo.py               ← no tocar
│   ├── nodo.py                ← ajuste menor precio_venta
│   └── arista.py              ← no tocar
├── api/
│   └── rutas.py               ← agregar/modificar endpoints
├── config.py                  ← agregar GOOGLE_API_KEY
└── utils/helpers.py           ← no tocar
```

---

## EXPLICACIONES DE LA LÓGICA ACTUAL (leer antes de implementar)

### ¿Qué hace haversine × 1.30?
`haversine` calcula la distancia en línea recta entre dos coordenadas GPS.
Las carreteras colombianas no son rectas (montañas, curvas). El factor 1.30 aproxima la distancia real por carretera. Ejemplo: Bogotá-Medellín en línea recta ≈ 280 km; por carretera ≈ 280 × 1.30 = 364 km (real ≈ 415 km). Está en `utils/helpers.py` funciones `haversine_km()` y `distancia_vial()`.

### ¿Dónde está la super-fuente y el super-sumidero?
En `algoritmos/optimizador_grafo.py`, método `_construir_red()`, líneas 44–61.
- El nodo `__S__` (super-fuente) se conecta con TODOS los orígenes con `capacity=oferta_i, weight=0`.
- El nodo `__T__` (super-sumidero) recibe de TODOS los destinos con `capacity=demanda_k, weight=0`.
- Por qué: `max_flow_min_cost` de NetworkX solo acepta UN nodo fuente y UN sumidero. Para manejar múltiples orígenes y destinos, se "funden" con estos nodos artificiales. El algoritmo luego decide cuánto fluye desde cada origen real y cuánto llega a cada destino real, respetando los límites de oferta y demanda.

### ¿Sobre qué se basa la penalización?
La penalización es por **toneladas no entregadas a un supermercado destino**.
Si D1 (Éxito 170 Bogotá) necesita 20 ton y solo recibe 15 ton → penalización = 5 × $1.000 = $5.000.
Config: `PENALIZACION_INCUMPLIMIENTO = 1000.0` (en `config.py` línea 28).
**PROBLEMA CRÍTICO ACTUAL**: esta penalización solo afecta el cálculo de GANANCIA (`_calcular_ganancia()` línea 134), pero el optimizador (`max_flow_min_cost`) no la conoce. El optimizador puede dejar demanda sin satisfacer y el sistema no lo penaliza durante la búsqueda del óptimo.

### Rol de cada tipo de nodo
- **ORIGEN** (`tipo='origen'`): Estación piscícola. Solo ENVÍA producto. Tiene `oferta` (toneladas disponibles). Nunca recibe. Sin merma, sin costo de operación.
- **ACOPIO** (`tipo='acopio'`): Centro logístico intermedio. RECIBE de orígenes, procesa, ENVÍA a destinos. Tiene `capacidad` (almacenamiento máx.), `tasa_merma` (fracción de producto que se pierde), `tasa_calidad` (probabilidad de pasar control sanitario), `costo_operacion` ($/día para operar el centro). **Es el único nodo donde se puede perder producto.**
- **DESTINO** (`tipo='destino'`): Supermercado. Solo RECIBE producto. Tiene `demanda` (toneladas requeridas) y `precio_venta` ($/ton, actualmente siempre $250 global). Nunca envía.

### Cadena obligatoria: Origen → Acopio → Destino
La red **ya está estructurada así** en las aristas de la BD (no hay aristas directas Origen→Destino).
Pero el grafo en memoria no lo valida explícitamente. Si alguien crea una arista directa O→D en la BD, el sistema la usaría.

### ¿Dónde están los escenarios What-If?
`sensibilidad/escenarios.py`, clase `AnalizadorSensibilidad`.
- `escenario_combustible()` línea 81: aumenta costo en aristas del Meta.
- `escenario_via_cerrada()` línea 128: elimina una arista.
- `escenario_fallo_calidad()` línea 198: reduce calidad de un acopio.
- `ejecutar_todos()` línea 251: llama los 3 en secuencia (NO combinados, cada uno parte del grafo base sin los cambios del anterior).

**PROBLEMA ACTUAL**: los 3 escenarios son independientes. No se pueden combinar (ej: combustible caro + vía cerrada simultáneamente). Tampoco guardan el estado del grafo afectado, solo el resultado numérico.

---

## CAMBIOS A IMPLEMENTAR (en este orden exacto)

---

### CAMBIO 1 — Pre-penalización de calidad en el grafo ANTES de optimizar

**Archivo**: `algoritmos/optimizador_grafo.py`

**Dónde**: dentro de `_construir_red()`, antes de agregar las aristas de red real (antes de la línea 54).

**Lógica a agregar**:
```
ANTES de construir el grafo de flujo, por cada acopio j en self.acopios:
  SI acopio j tiene tasa_calidad < config.UMBRAL_CALIDAD (0.5):
      Para cada arista de SALIDA del acopio (acopio → cualquier nodo):
          nuevo_costo = costo_transporte_arista + config.PENALIZACION_CALIDAD
          Usar nuevo_costo en el weight de NetworkX (no modificar el modelo Arista)
          
    El umbral de calidad es el mismo que usa ValidadorRestricciones: 0.5
    config.PENALIZACION_CALIDAD ya existe = 500.0 $/ton
    NO modificar arista.costo_transporte en el objeto Arista (solo el grafo de NetworkX temporal).
    
IMPORTANTE: Este ajuste de costo solo aplica al grafo G temporal de NetworkX, NO al objeto GrafoRed permanente.
```

**Resultado esperado**: si un acopio tiene mala calidad, el optimizador evitará enrutar por él porque sus aristas de salida ahora cuestan $500/ton más. El optimizador redistribuirá el flujo hacia acopios de mejor calidad.

**Retornar en el resultado** (`ejecutar()` línea 110): agregar clave `"acopios_penalizados": [lista de IDs de acopios que recibieron penalización de calidad]`.

---

### CAMBIO 2 — Merma integrada en las restricciones de flujo del optimizador

**Archivo**: `algoritmos/optimizador_grafo.py`

**Problema actual**: el optimizador no sabe que pasar flujo por un acopio con tasa_merma=0.15 significa perder el 15% del producto. Envía 100 ton a un acopio con 15% merma y espera que lleguen 100 ton al destino.

**Solución — reducir capacidad efectiva de aristas de salida del acopio**:

En `_construir_red()`, al agregar las aristas de la red real (líneas 54–60), hacer:
```
Para cada arista (u → v) donde u es un ACOPIO:
    acopio_u = self.grafo.obtener_nodo(u)
    factor_merma = 1.0 - acopio_u.tasa_merma  # ej: 0.85 si merma=15%
    capacidad_efectiva = arista.capacidad * factor_merma
    weight = int(round(arista.costo_transporte * ESCALA_COSTO))
    G.add_edge(u, v, capacity=int(round(capacidad_efectiva)), weight=weight)

Para aristas cuyo nodo origen NO es acopio, usar capacidad original sin cambio.
```

**Por qué funciona**: si el acopio A1 tiene merma 15% y capacidad de salida máx. 80 ton, la capacidad efectiva de salida se reduce a 68 ton. El optimizador, al intentar satisfacer demandas, deberá enviar más flujo entrante al acopio para compensar la pérdida implícita. Esto refleja la realidad: para entregar 50 ton a un destino vía un acopio con 15% merma, necesitas enviar 50/0.85 ≈ 59 ton al acopio.

**Agregar a la clave del resultado**: `"merma_total_estimada": float` calculada como:
```
sum(arista.flujo_actual * acopio.tasa_merma 
    for (u,v), arista in grafo.aristas.items() 
    if grafo.obtener_nodo(u).tipo == TipoNodo.ACOPIO)
```

---

### CAMBIO 3 — costo_operacion integrado en la función objetivo

**Archivo**: `algoritmos/optimizador_grafo.py`

**Problema actual**: `costo_operacion` de cada acopio existe en el modelo pero nunca entra en la optimización ni en el cálculo de ganancia.

**Solución A — integrar en el weight de aristas de ENTRADA al acopio** (compatible con `max_flow_min_cost`):

En `_construir_red()`, al agregar aristas cuyo destino `v` es un ACOPIO:
```
acopio_v = self.grafo.obtener_nodo(v)
SI acopio_v.costo_operacion > 0:
    # Distribuir el costo de operación entre los flujos de entrada
    # Estimación: el acopio opera a ~50% de capacidad (estimación conservadora)
    capacidad_promedio = max(acopio_v.capacidad * 0.5, 1.0)
    costo_op_por_ton = acopio_v.costo_operacion / capacidad_promedio
    weight_total = arista.costo_transporte + costo_op_por_ton
    weight = int(round(weight_total * ESCALA_COSTO))
SINO:
    weight = int(round(arista.costo_transporte * ESCALA_COSTO))
```

**Solución B — integrar en `_calcular_ganancia()`** para que el reporte sea correcto aunque el optimizador use aproximación:

En `_calcular_ganancia()` (línea 121), agregar después de calcular `costo`:
```python
# Costo de operación de acopios activos
costo_operacion_total = 0.0
for acopio in self.acopios:
    flujo_entrante = sum(
        self.grafo.obtener_arista(u, acopio.id).flujo_actual
        for u in self.grafo.vecinos_entrada(acopio.id)
        if self.grafo.obtener_arista(u, acopio.id)
    )
    if flujo_entrante > 1e-6:  # acopio está activo
        costo_operacion_total += acopio.costo_operacion

return ingreso - costo - costo_operacion_total - penalizacion
```

**Ambas soluciones deben implementarse**: A para que el optimizador considere el costo en su búsqueda, B para que la ganancia reportada sea correcta y detallada.

**Agregar a resultados**: `"costo_operacion_acopios": costo_operacion_total`, `"acopios_activos": [lista de IDs de acopios con flujo > 0]`.

---

### CAMBIO 4 — precio_venta variable por destino afecta la optimización

**Archivos**: `models/nodo.py`, `algoritmos/optimizador_grafo.py`, `api/rutas.py`

**Estado actual**: `nodo.py` línea 29 tiene `precio_venta: float = 250.0` pero `_calcular_ganancia()` línea 133 usa `config.PRECIO_VENTA_TON` (valor global) ignorando el precio individual del nodo.

**Cambio 4a — usar precio_venta del nodo en `_calcular_ganancia()`**:
```python
# Línea 133, REEMPLAZAR:
ingreso += cubierto * config.PRECIO_VENTA_TON
# POR:
precio = destino.precio_venta if destino.precio_venta > 0 else config.PRECIO_VENTA_TON
ingreso += cubierto * precio
```

**Cambio 4b — influir en el optimizador mediante weight de aristas hacia `__T__`**:
En `_construir_red()`, líneas 51-52, al crear las aristas `destino → __T__`:
```python
for destino in self.destinos:
    # El "beneficio" de satisfacer demanda se modela como costo negativo hacia __T__
    # Mayor precio_venta = mayor incentivo = peso más negativo (el solver maximiza)
    # PERO max_flow_min_cost minimiza, así que no podemos usar pesos negativos directamente.
    # Solución: el precio diferenciado afecta el cálculo de ganancia (Cambio 4a).
    # El optimizador sigue priorizando rutas de menor costo de transporte.
    G.add_edge(destino.id, "__T__", capacity=int(round(destino.demanda)), weight=0)
```

**Nota para el implementador**: la influencia directa del precio_venta en el optimizador de flujo (haciendo que el solver prefiera destinos más rentables) requeriría un reformulación completa como problema de maximización de beneficio neto. Por ahora, el cambio 4a garantiza que el REPORTE de ganancia use precios reales. Si se quiere que el optimizador realmente priorice destinos más rentables, eso queda como trabajo futuro con PuLP.

**Cambio 4c — modelo de nodo**: en `nodo.py`, asegurar que `precio_venta` tenga default 250.0 pero sea cargado desde BD:
```python
precio_venta: float = 250.0   # $/ton — debe cargarse desde Supabase si está en la tabla
```

**Cambio 4d — CRUD en API**: en `api/rutas.py`, en `NodoInputDTO`, agregar:
```python
precio_venta: float = 250.0
```

En `_nodo_a_fila()`, agregar `"precio_venta": d.precio_venta` al dict.
En `_fila_a_nodo()`, agregar `"precio_venta": row.get("precio_venta", 250.0)`.

En `helpers.py`, en `construir_red_acuicola()`, al construir nodos de tipo DESTINO, agregar:
```python
precio_venta=n.get("precio_venta", 250.0)
```

**NOTA**: La tabla `nodos` en Supabase necesita una columna `precio_venta double precision DEFAULT 250.0`. Agregar al esquema de BD:
```sql
ALTER TABLE public.nodos ADD COLUMN IF NOT EXISTS precio_venta double precision DEFAULT 250.0;
```

---

### CAMBIO 5 — Cadena obligatoria Origen → Acopio → Destino (validación explícita)

**Archivo**: `algoritmos/optimizador_grafo.py`

**En `_construir_red()`**, agregar validación al inicio:
```python
# Eliminar cualquier arista directa Origen→Destino del grafo temporal
# (no debería existir en BD, pero se defiende contra errores de datos)
for origen in self.origenes:
    for destino in self.destinos:
        arista_directa = self.grafo.obtener_arista(origen.id, destino.id)
        if arista_directa:
            logger.warning(
                f"Arista directa Origen→Destino detectada y eliminada del optimizador: "
                f"{origen.id}→{destino.id}. La cadena debe ser Origen→Acopio→Destino."
            )
            # No agregar esta arista al grafo G de NetworkX
```

**En el método `ejecutar()`**, agregar en el resultado:
```python
"cadena_valida": True,  # siempre True si pasó por aquí
"restriccion": "Origen → Acopio → Destino (obligatorio)"
```

---

### CAMBIO 6 — REESCRIBIR `DijkstraCalculator` en `grafos/dijkstra.py`

**Objetivo**: el usuario solo da el ID del supermercado DESTINO. El sistema encuentra automáticamente la cadena completa más económica: el mejor Origen → el mejor Acopio → ese Destino.

**Reescribir el método `ruta_con_detalle()`** para que acepte solo `destino: str`:

```python
def mejor_cadena_hacia_destino(self, id_destino: str) -> dict:
    """
    Encuentra la cadena óptima O→A→D para el destino dado.
    
    Algoritmo:
    1. Verificar que id_destino es un nodo tipo DESTINO.
    2. Encontrar todos los acopios que tienen arista directa hacia id_destino.
    3. Para cada acopio candidato y cada origen disponible:
       - Calcular costo(origen → acopio) con Dijkstra.
       - Sumar costo(acopio → destino) de la arista directa.
    4. Retornar la cadena con menor costo total.
    5. Si no existe ninguna cadena válida, retornar existe=False.
    """
    nodo_destino = self.grafo.obtener_nodo(id_destino)
    if not nodo_destino:
        return {"existe": False, "error": f"Nodo '{id_destino}' no existe", "ruta": []}
    if nodo_destino.tipo != TipoNodo.DESTINO:
        return {"existe": False, "error": f"'{id_destino}' no es un destino (es {nodo_destino.tipo.value})", "ruta": []}

    from models.nodo import TipoNodo  # import local para evitar circular

    origenes   = self.grafo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
    
    # Acopios que tienen arista directa al destino
    acopios_conectados_al_destino = [
        uid for uid in self.grafo.vecinos_entrada(id_destino)
        if self.grafo.obtener_nodo(uid) and 
           self.grafo.obtener_nodo(uid).tipo == TipoNodo.ACOPIO
    ]
    
    if not acopios_conectados_al_destino:
        return {
            "existe": False,
            "error": f"Ningún acopio conecta directamente con '{id_destino}'",
            "ruta": []
        }
    
    mejor_costo   = float("inf")
    mejor_ruta    = None
    mejor_acopio  = None
    mejor_origen  = None
    
    for id_acopio in acopios_conectados_al_destino:
        arista_ad = self.grafo.obtener_arista(id_acopio, id_destino)
        costo_ultima_milla = arista_ad.costo_transporte if arista_ad else float("inf")
        if costo_ultima_milla == float("inf"):
            continue
        
        for origen in origenes:
            try:
                # Usa Dijkstra o Bellman-Ford según pesos del grafo
                if self._hay_costos_negativos():
                    path_oa = nx.bellman_ford_path(
                        self.grafo._nx, origen.id, id_acopio, weight="weight")
                    costo_oa = nx.bellman_ford_path_length(
                        self.grafo._nx, origen.id, id_acopio, weight="weight")
                else:
                    path_oa = nx.dijkstra_path(
                        self.grafo._nx, origen.id, id_acopio, weight="weight")
                    costo_oa = nx.dijkstra_path_length(
                        self.grafo._nx, origen.id, id_acopio, weight="weight")
                
                # El costo reportado en el grafo está escalado ×100 para el optimizador,
                # pero el grafo._nx usa el costo_total_unitario (no escalado). Verificar.
                # grafo._nx tiene weight=costo_total_unitario (ver grafo.py línea 51).
                
                costo_total = costo_oa + costo_ultima_milla
                if costo_total < mejor_costo:
                    mejor_costo  = costo_total
                    mejor_ruta   = path_oa + [id_destino]
                    mejor_acopio = id_acopio
                    mejor_origen = origen.id
            except (nx.NetworkXNoPath, nx.NodeNotFound, nx.NetworkXUnbounded):
                continue
    
    if mejor_ruta is None:
        return {
            "existe": False,
            "error": f"No se encontró cadena O→A→D válida hacia '{id_destino}'",
            "ruta": []
        }
    
    # Construir detalle tramo por tramo
    detalle = []
    for i in range(len(mejor_ruta) - 1):
        u, v      = mejor_ruta[i], mejor_ruta[i+1]
        arista    = self.grafo.obtener_arista(u, v)
        nodo_u    = self.grafo.obtener_nodo(u)
        nodo_v    = self.grafo.obtener_nodo(v)
        detalle.append({
            "de":             u,
            "nombre_de":      nodo_u.nombre if nodo_u else u,
            "tipo_de":        nodo_u.tipo.value if nodo_u else "?",
            "a":              v,
            "nombre_a":       nodo_v.nombre if nodo_v else v,
            "tipo_a":         nodo_v.tipo.value if nodo_v else "?",
            "costo_unitario": round(arista.costo_transporte, 4) if arista else 0.0,
            "distancia_km":   round(arista.distancia, 2) if arista else 0.0,
            "capacidad":      arista.capacidad if arista else 0.0,
            "estado":         arista.estado if arista else "activa",
        })
    
    return {
        "existe":          True,
        "destino":         id_destino,
        "nombre_destino":  nodo_destino.nombre,
        "origen_optimo":   mejor_origen,
        "acopio_intermedio": mejor_acopio,
        "ruta":            mejor_ruta,
        "costo_total":     round(mejor_costo, 4),
        "saltos":          len(mejor_ruta) - 1,
        "algoritmo":       "bellman_ford" if self._hay_costos_negativos() else "dijkstra",
        "cadena":          f"{mejor_origen} → {mejor_acopio} → {id_destino}",
        "detalle":         detalle,
    }

def _hay_costos_negativos(self) -> bool:
    """Retorna True si alguna arista del grafo tiene peso negativo."""
    return any(
        data.get("weight", 0) < 0
        for _, _, data in self.grafo._nx.edges(data=True)
    )
```

**Mantener el método `ruta_con_detalle(origen, destino)` existente** para compatibilidad interna, pero marcarlo como `_legacy` en los comentarios. El endpoint de la API usará `mejor_cadena_hacia_destino`.

**Mantener** `aristas_criticas()` y `todas_rutas_desde()` sin cambios.

---

### CAMBIO 7 — Implementar Bellman-Ford (nuevo archivo)

**Crear**: `backend/grafos/bellman_ford.py`

```python
"""
Bellman-Ford para rutas óptimas en redes con costos negativos.
Misma interfaz que DijkstraCalculator para que sea intercambiable.
Usado automáticamente cuando hay aristas con costo < 0 (subsidios, bonificaciones).
"""
from typing import Dict, List, Optional, Tuple
import networkx as nx
from models.grafo import GrafoRed
from models.nodo import TipoNodo


class BellmanFordCalculator:
    """
    Calcula rutas de mínimo costo con el algoritmo de Bellman-Ford.
    Soporta pesos negativos. Detecta ciclos negativos y los reporta.
    """

    def __init__(self, grafo: GrafoRed) -> None:
        self.grafo = grafo

    def ruta_minimo_costo(self, origen: str, destino: str) -> Tuple[Optional[List[str]], float]:
        try:
            path  = nx.bellman_ford_path(self.grafo._nx, origen, destino, weight="weight")
            costo = nx.bellman_ford_path_length(self.grafo._nx, origen, destino, weight="weight")
            return path, costo
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None, float("inf")
        except nx.NetworkXUnbounded:
            return None, float("-inf")  # ciclo negativo detectado

    def mejor_cadena_hacia_destino(self, id_destino: str) -> dict:
        """Misma lógica que DijkstraCalculator.mejor_cadena_hacia_destino()
        pero usando Bellman-Ford internamente."""
        # Delegamos a la lógica compartida: importar y llamar a la función de Dijkstra
        # que ya tiene auto-selección con _hay_costos_negativos().
        from grafos.dijkstra import DijkstraCalculator
        calc = DijkstraCalculator(self.grafo)
        return calc.mejor_cadena_hacia_destino(id_destino)

    def tiene_ciclo_negativo(self) -> bool:
        try:
            nx.negative_edge_cycle(self.grafo._nx, weight="weight")
            return True
        except nx.NetworkXUnbounded:
            return True
        except Exception:
            return False
```

---

### CAMBIO 8 — Rediseño de escenarios What-If en `sensibilidad/escenarios.py`

**Nuevo diseño** — 3 principios:

**8.1 Escenarios combinables**: el usuario puede especificar múltiples condiciones en una sola llamada. Las condiciones se aplican secuencialmente sobre la misma copia del grafo base.

**8.2 El resultado incluye el estado del grafo ANTES y DESPUÉS de la optimización**: muestra cómo el grafo se ve con los problemas, y cómo la optimización resuelve el enrutamiento alrededor de esos problemas.

**8.3 El escenario completo se guarda en Supabase** (tabla `escenarios_historial`) incluyendo el grafo perturbado como JSON y el análisis completo.

**Nueva clase `ParametrosEscenario`** (dataclass):
```python
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class ParametrosEscenario:
    nombre: str = "Escenario personalizado"
    
    # Condición 1: combustible
    combustible_activo: bool = False
    combustible_pct: float = 15.0          # % de aumento
    combustible_departamento: str = "Meta" # filtro por departamento
    
    # Condición 2: vías cerradas (puede haber varias)
    vias_cerradas: List[dict] = field(default_factory=list)
    # Cada elemento: {"id_origen": "A2", "id_destino": "A5"}
    
    # Condición 3: calidad (puede haber varios acopios afectados)
    fallos_calidad: List[dict] = field(default_factory=list)
    # Cada elemento: {"id_acopio": "A3", "tasa_calidad_nueva": 0.2}
```

**Nuevo método `ejecutar_escenario_combinado(params: ParametrosEscenario) -> dict`**:
```python
def ejecutar_escenario_combinado(self, params: ParametrosEscenario) -> dict:
    """
    Aplica todas las condiciones del escenario al grafo base,
    re-optimiza, y retorna comparativa + grafo antes y después.
    """
    grafo_mod = self.grafo_base.copia()
    cambios_aplicados = []
    
    # 1. Aplicar aumento de combustible
    if params.combustible_activo:
        factor = 1.0 + params.combustible_pct / 100.0
        rutas_afectadas = []
        for (u, v), arista in grafo_mod.aristas.items():
            nodo_u = grafo_mod.obtener_nodo(u)
            nodo_v = grafo_mod.obtener_nodo(v)
            en_zona = any(
                params.combustible_departamento.lower() in (
                    (n.departamento or "").lower() + (n.municipio or "").lower()
                )
                for n in [nodo_u, nodo_v] if n
            )
            if en_zona:
                costo_anterior = arista.costo_transporte
                arista.costo_transporte = round(costo_anterior * factor, 4)
                grafo_mod._nx[u][v]["weight"] = arista.costo_transporte
                rutas_afectadas.append({"ruta": f"{u}→{v}", "costo_anterior": costo_anterior, "costo_nuevo": arista.costo_transporte})
        cambios_aplicados.append({
            "tipo": "combustible",
            "descripcion": f"+{params.combustible_pct}% en {params.combustible_departamento}",
            "rutas_afectadas": rutas_afectadas
        })
    
    # 2. Cerrar vías
    for via in params.vias_cerradas:
        id_o, id_d = via["id_origen"], via["id_destino"]
        clave = (id_o, id_d)
        if clave in grafo_mod.aristas:
            info = {
                "ruta": f"{id_o}→{id_d}",
                "capacidad": grafo_mod.aristas[clave].capacidad,
                "costo": grafo_mod.aristas[clave].costo_transporte,
            }
            grafo_mod.aristas[clave].estado = "bloqueada"
            del grafo_mod.aristas[clave]
            if grafo_mod._nx.has_edge(id_o, id_d):
                grafo_mod._nx.remove_edge(id_o, id_d)
            cambios_aplicados.append({"tipo": "via_cerrada", "arista": info})
    
    # 3. Fallos de calidad
    for fallo in params.fallos_calidad:
        id_acopio = fallo["id_acopio"]
        nueva_calidad = fallo.get("tasa_calidad_nueva", 0.2)
        nodo_acopio = grafo_mod.obtener_nodo(id_acopio)
        if nodo_acopio and nodo_acopio.tipo == TipoNodo.ACOPIO:
            calidad_anterior = nodo_acopio.tasa_calidad
            nodo_acopio.tasa_calidad = nueva_calidad
            nodo_acopio.tasa_merma = min(nodo_acopio.tasa_merma * 3.0, 0.5)
            cambios_aplicados.append({
                "tipo": "fallo_calidad",
                "acopio": id_acopio,
                "calidad_anterior": calidad_anterior,
                "calidad_nueva": nueva_calidad,
            })
    
    # Guardar estado del grafo ANTES de optimizar (con problemas aplicados)
    grafo_con_problemas = grafo_mod.to_dict()
    
    # Re-optimizar con el grafo perturbado
    ganancia_esc, resultado = _optimizar_grafo(grafo_mod)
    
    # Estado DESPUÉS de optimizar
    grafo_optimizado = grafo_mod.to_dict()
    
    impacto_abs = ganancia_esc - self.ganancia_base
    impacto_pct = (impacto_abs / abs(self.ganancia_base) * 100) if self.ganancia_base != 0 else 0.0
    
    return {
        "nombre": params.nombre,
        "ganancia_base": round(self.ganancia_base, 2),
        "ganancia_escenario": round(ganancia_esc, 2),
        "impacto_absoluto": round(impacto_abs, 2),
        "impacto_porcentual": round(impacto_pct, 2),
        "evaluacion": "NEGATIVO" if impacto_abs < 0 else "POSITIVO",
        "cambios_aplicados": cambios_aplicados,
        "grafo_con_problemas": grafo_con_problemas,    # estado con perturbaciones
        "grafo_optimizado": grafo_optimizado,          # estado tras optimizar
        "resultado_optimizacion": resultado,
    }
```

**Mantener los 3 métodos existentes** (`escenario_combustible`, `escenario_via_cerrada`, `escenario_fallo_calidad`) como wrappers que llaman a `ejecutar_escenario_combinado` con un solo parámetro. No eliminar por compatibilidad con endpoints existentes.

**Guardar en BD**: en `api/rutas.py`, en los endpoints de sensibilidad, después de obtener el resultado, guardar el grafo perturbado:
```python
# Agregar al resultado antes de persistir:
resultado["grafo_con_problemas_json"] = json.dumps(resultado.get("grafo_con_problemas", {}))
resultado["grafo_optimizado_json"]    = json.dumps(resultado.get("grafo_optimizado", {}))
```
La tabla `escenarios_historial` ya tiene `resultado_json text` que puede almacenar el resultado completo serializado como JSON string.

---

### CAMBIO 9 — Nuevo endpoint para análisis combinado What-If

**Archivo**: `api/rutas.py`

**Agregar DTO**:
```python
class EscenarioCombinavoDTO(BaseModel):
    nombre: str = "Escenario personalizado"
    combustible_activo: bool = False
    combustible_pct: float = 15.0
    combustible_departamento: str = "Meta"
    vias_cerradas: list = []     # [{"id_origen": "X", "id_destino": "Y"}]
    fallos_calidad: list = []    # [{"id_acopio": "X", "tasa_calidad_nueva": 0.2}]
```

**Agregar endpoint**:
```python
@router.post("/api/sensibilidad/combinado")
def sensibilidad_combinado(params: EscenarioCombinadorDTO):
    """
    Escenario What-If con múltiples condiciones simultáneas.
    Retorna el grafo con problemas y el grafo optimizado.
    """
    grafo = _cargar_grafo()
    analizador = AnalizadorSensibilidad(grafo, ganancia_base)
    
    from sensibilidad.escenarios import ParametrosEscenario
    p = ParametrosEscenario(
        nombre=params.nombre,
        combustible_activo=params.combustible_activo,
        combustible_pct=params.combustible_pct,
        combustible_departamento=params.combustible_departamento,
        vias_cerradas=params.vias_cerradas,
        fallos_calidad=params.fallos_calidad,
    )
    resultado = analizador.ejecutar_escenario_combinado(p)
    _persistir_escenario("combinado", params.dict(), resultado)
    return _to_native(resultado)
```

---

### CAMBIO 10 — Modificar endpoint `/api/ruta_optima` para aceptar solo destino

**Archivo**: `api/rutas.py`, endpoint `ruta_optima` (línea ~584)

**Cambio**: hacer `origen` opcional. Si no se provee, usar `mejor_cadena_hacia_destino`.

```python
@router.get("/api/ruta_optima")
def ruta_optima(destino: str, origen: Optional[str] = None):
    """
    Calcula la ruta óptima.
    - Si solo se da 'destino': encuentra la cadena completa O→A→D más económica.
    - Si se dan 'origen' y 'destino': Dijkstra directo entre los dos nodos.
    """
    grafo = _cargar_grafo()
    
    if destino not in grafo.nodos:
        raise HTTPException(status_code=404, detail=f"Nodo destino '{destino}' no existe.")
    
    calc = DijkstraCalculator(grafo)
    
    if origen is None:
        # Modo nuevo: solo destino → buscar mejor cadena O→A→D
        resultado = calc.mejor_cadena_hacia_destino(destino)
    else:
        # Modo legacy: origen + destino → Dijkstra directo
        if origen not in grafo.nodos:
            raise HTTPException(status_code=404, detail=f"Nodo origen '{origen}' no existe.")
        resultado = calc.ruta_con_detalle(origen, destino)
    
    if not isinstance(resultado, dict) or not resultado.get("existe", False):
        raise HTTPException(
            status_code=404,
            detail=resultado.get("error", f"No existe ruta hacia '{destino}'.")
        )
    
    if _contiene_no_finito(resultado):
        raise HTTPException(status_code=404, detail=f"La ruta encontrada contiene costos inválidos.")
    
    return _to_native(resultado)
```

---

### CAMBIO 11 — Google AI API para análisis narrativo de escenarios

**Archivo**: `config.py` — agregar:
```python
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_AI_MODEL = os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
```

**Archivo**: `backend/.env` — agregar (el usuario debe obtener su key en https://ai.google.dev/):
```
GOOGLE_API_KEY=tu_api_key_aqui
GOOGLE_AI_MODEL=gemini-1.5-flash
```

**Instalar dependencia**:
```
pip install google-generativeai
```

**Crear**: `backend/utils/ia_analista.py`:
```python
"""
Análisis narrativo de escenarios de sensibilidad usando Google Gemini.
"""
import json
import config
from utils.logger import get_logger

logger = get_logger(__name__)


def analizar_escenario_con_ia(resultado_escenario: dict) -> str:
    """
    Envía el resultado del escenario a Google Gemini y retorna
    una interpretación gerencial en español.
    
    Retorna string vacío si no hay API key configurada o si falla.
    """
    if not config.GOOGLE_API_KEY:
        return "Análisis de IA no disponible (GOOGLE_API_KEY no configurado)."
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=config.GOOGLE_API_KEY)
        model = genai.GenerativeModel(config.GOOGLE_AI_MODEL)
        
        # Preparar resumen ejecutivo (no enviar el grafo completo a la IA)
        resumen = {
            "nombre_escenario": resultado_escenario.get("nombre", ""),
            "ganancia_base":       resultado_escenario.get("ganancia_base", 0),
            "ganancia_escenario":  resultado_escenario.get("ganancia_escenario", 0),
            "impacto_absoluto":    resultado_escenario.get("impacto_absoluto", 0),
            "impacto_porcentual":  resultado_escenario.get("impacto_porcentual", 0),
            "evaluacion":          resultado_escenario.get("evaluacion", ""),
            "cambios_aplicados":   resultado_escenario.get("cambios_aplicados", []),
            "rutas_activas":       resultado_escenario.get("resultado_optimizacion", {})
                                        .get("grafo", {}).get("num_rutas_activas", 0),
        }
        
        prompt = f"""Eres un consultor logístico experto en distribución de alimentos en Colombia.
Analiza el siguiente resultado de un escenario What-If de la empresa Acuícola Real del Meta,
que distribuye pescado desde estaciones piscícolas a supermercados a través de centros logísticos.

DATOS DEL ESCENARIO:
{json.dumps(resumen, ensure_ascii=False, indent=2)}

Proporciona en español, en máximo 3 párrafos cortos:
1. Qué pasó (qué condición se aplicó y cuál fue el impacto en ganancia).
2. Por qué ocurrió (qué restricción logística lo causó).
3. Qué debería hacer la empresa (recomendación concreta y accionable).

Usa números exactos del resumen. Sé directo y ejecutivo. No uses markdown ni listas."""
        
        response = model.generate_content(prompt)
        return response.text.strip()
        
    except Exception as e:
        logger.error(f"Error en análisis IA: {e}")
        return f"Error en análisis de IA: {str(e)}"
```

**Agregar endpoint** en `api/rutas.py`:
```python
@router.post("/api/sensibilidad/analisis_ia")
def analisis_ia_escenario(resultado: dict):
    """
    Recibe el resultado de un escenario y retorna análisis narrativo de Google Gemini.
    """
    from utils.ia_analista import analizar_escenario_con_ia
    interpretacion = analizar_escenario_con_ia(resultado)
    return {"interpretacion": interpretacion, "modelo": config.GOOGLE_AI_MODEL}
```

---

## REGLAS CRÍTICAS PARA EL IMPLEMENTADOR

1. **No romper la API existente**: todos los endpoints actuales deben seguir funcionando. Los cambios son ADITIVOS salvo donde se especifica que se modifica un endpoint existente.

2. **No modificar `GrafoRed` ni `Arista` directamente para los pesos temporales**: los ajustes de costo por calidad y merma solo viven en el grafo NetworkX `G` temporal dentro de `_construir_red()`. El objeto `self.grafo` permanece intacto.

3. **No eliminar `max_flow_min_cost`**: sigue siendo el algoritmo principal. Los cambios de Merma y costo_operacion se integran como modificaciones al grafo de entrada, no reemplazando el algoritmo.

4. **El método `ruta_con_detalle(origen, destino)` existente debe mantenerse** aunque se agregue el nuevo. Es usado en `api/rutas.py` para la ruta representativa post-optimización.

5. **Nunca modificar `arista.costo_transporte`** en los objetos del modelo durante la optimización. Ese valor debe permanecer como fue cargado desde BD.

6. **El grafo `_nx` del `GrafoRed`** almacena `weight=costo_total_unitario` (no escalado). El grafo `G` temporal en `_construir_red()` usa `weight=int(costo * ESCALA_COSTO)`. No confundir.

7. **Orden de importación**: `grafos/bellman_ford.py` puede importar desde `grafos/dijkstra.py` pero NO al revés. `dijkstra.py` tiene la lógica compartida.

8. **`_to_native()`** debe aplicarse a TODOS los resultados antes de retornarlos en la API. No olvidarlo en los nuevos endpoints.

9. **Manejo de errores**: cada cambio nuevo debe tener try/except y loggear el error sin romper la respuesta. Si falla el análisis de IA, retornar string explicativo, no 500.

10. **El campo `precio_venta` en Supabase**: ejecutar el ALTER TABLE antes de desplegar, o el sistema fallará al cargar nodos.

---

## CHECKLIST DE VERIFICACIÓN (probar en este orden)

- [ ] `GET /health` → responde 200 OK
- [ ] `GET /api/nodos` → incluye campo `precio_venta` en cada nodo destino
- [ ] `POST /api/optimizar` → el resultado incluye `acopios_penalizados`, `merma_total_estimada`, `costo_operacion_acopios`, `acopios_activos`
- [ ] `POST /api/optimizar` con un acopio de tasa_calidad=0.1 → ese acopio debe aparecer en `acopios_penalizados` y el optimizador debe preferir rutas alternativas
- [ ] `GET /api/ruta_optima?destino=D1` → retorna cadena completa con `origen_optimo`, `acopio_intermedio`, `cadena`, `algoritmo`
- [ ] `GET /api/ruta_optima?destino=D1&origen=O1` → modo legacy, ruta directa
- [ ] `POST /api/sensibilidad/combinado` con combustible + una vía cerrada → resultado muestra `grafo_con_problemas` y `grafo_optimizado`
- [ ] `POST /api/sensibilidad/analisis_ia` con el resultado del punto anterior → retorna `interpretacion` no vacía (si hay GOOGLE_API_KEY)
- [ ] Verificar que ganancia calculada usa `destino.precio_venta` y no el precio global cuando los precios son distintos
- [ ] Verificar que acopio con merma alta fuerza más flujo entrante para compensar la pérdida en la red
