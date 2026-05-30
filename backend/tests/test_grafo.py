"""
Tests unitarios para GrafoRed, Nodo y Arista.
Ejecutar: pytest tests/test_grafo.py -v
"""

import pytest
from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo
from utils.helpers import construir_red_acuicola


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def grafo_minimo():
    """Grafo mínimo: 1 origen, 1 acopio, 1 destino."""
    g = GrafoRed()
    g.agregar_nodo(Nodo("O1", TipoNodo.ORIGEN, "Orig1", "M1", "D1", 4.0, -72.0, 100, oferta=100))
    g.agregar_nodo(Nodo("A1", TipoNodo.ACOPIO, "Aco1", "M2", "D2", 4.5, -73.0, 150, tasa_merma=0.02))
    g.agregar_nodo(Nodo("D1", TipoNodo.DESTINO, "Dest1", "M3", "D3", 5.0, -74.0, 50, demanda=50))
    g.agregar_arista(Arista("O1", "A1", 5.0, 100, 50))
    g.agregar_arista(Arista("A1", "D1", 10.0, 100, 30))
    return g


@pytest.fixture
def grafo_colombia():
    """Red completa de Acuícola Real del Meta."""
    return construir_red_acuicola()


# ── Tests de construcción ─────────────────────────────────────────────────────

def test_agregar_nodo(grafo_minimo):
    assert len(grafo_minimo.nodos) == 3
    assert grafo_minimo.obtener_nodo("O1") is not None
    assert grafo_minimo.obtener_nodo("A1") is not None
    assert grafo_minimo.obtener_nodo("D1") is not None


def test_agregar_arista(grafo_minimo):
    assert len(grafo_minimo.aristas) == 2
    arista = grafo_minimo.obtener_arista("O1", "A1")
    assert arista is not None
    assert arista.costo_transporte == 5.0
    assert arista.capacidad == 100


def test_nodo_invalido_latitud():
    with pytest.raises(ValueError, match="Latitud"):
        n = Nodo("X", TipoNodo.ORIGEN, "X", "X", "X", 200.0, -74.0, 100)
        n.validar()


def test_arista_invalida_capacidad():
    with pytest.raises(ValueError, match="Capacidad"):
        a = Arista("O1", "A1", 5.0, -10, 50)
        a.validar()


def test_nodo_origen_inexistente(grafo_minimo):
    with pytest.raises(ValueError, match="no existe"):
        grafo_minimo.agregar_arista(Arista("X99", "A1", 5.0, 100, 50))


# ── Tests de consultas ────────────────────────────────────────────────────────

def test_nodos_por_tipo(grafo_minimo):
    origenes = grafo_minimo.obtener_nodos_por_tipo(TipoNodo.ORIGEN)
    acopios = grafo_minimo.obtener_nodos_por_tipo(TipoNodo.ACOPIO)
    destinos = grafo_minimo.obtener_nodos_por_tipo(TipoNodo.DESTINO)
    assert len(origenes) == 1
    assert len(acopios) == 1
    assert len(destinos) == 1


def test_oferta_y_demanda(grafo_minimo):
    assert grafo_minimo.oferta_total() == 100.0
    assert grafo_minimo.demanda_total() == 50.0


def test_vecinos(grafo_minimo):
    assert "A1" in grafo_minimo.vecinos_salida("O1")
    assert "O1" in grafo_minimo.vecinos_entrada("A1")


def test_conectividad(grafo_minimo):
    assert grafo_minimo.validar_conectividad() is True


def test_grafo_desconexo():
    g = GrafoRed()
    g.agregar_nodo(Nodo("N1", TipoNodo.ORIGEN, "A", "M", "D", 4.0, -72.0, 100, oferta=50))
    g.agregar_nodo(Nodo("N2", TipoNodo.DESTINO, "B", "M", "D", 5.0, -73.0, 50, demanda=50))
    # Sin arista entre N1 y N2
    assert g.validar_conectividad() is False


def test_calcular_merma(grafo_minimo):
    merma = grafo_minimo.calcular_merma("A1", 100.0, 1.0)
    assert abs(merma - 2.0) < 1e-6   # 100 * 0.02 * 1 = 2


def test_arista_bloqueada_no_agrega():
    g = GrafoRed()
    g.agregar_nodo(Nodo("O1", TipoNodo.ORIGEN, "A", "M", "D", 4.0, -72.0, 100, oferta=100))
    g.agregar_nodo(Nodo("A1", TipoNodo.ACOPIO, "B", "M", "D", 4.5, -73.0, 100))
    g.agregar_arista(Arista("O1", "A1", 5.0, 100, 50, estado="bloqueada"))
    assert len(g.aristas) == 0


# ── Tests de la red completa ──────────────────────────────────────────────────

def test_red_colombia_nodos(grafo_colombia):
    assert len(grafo_colombia.nodos) == 41
    assert len(grafo_colombia.obtener_nodos_por_tipo(TipoNodo.ORIGEN)) == 6
    assert len(grafo_colombia.obtener_nodos_por_tipo(TipoNodo.ACOPIO)) == 10
    assert len(grafo_colombia.obtener_nodos_por_tipo(TipoNodo.DESTINO)) == 25


def test_red_colombia_oferta_demanda(grafo_colombia):
    assert grafo_colombia.oferta_total() == 595.0
    assert grafo_colombia.demanda_total() == 307.0
    assert grafo_colombia.oferta_total() > grafo_colombia.demanda_total()


def test_red_colombia_conexa(grafo_colombia):
    assert grafo_colombia.validar_conectividad() is True


def test_to_dict(grafo_minimo):
    d = grafo_minimo.to_dict()
    assert "nodos" in d and "aristas" in d
    assert len(d["nodos"]) == 3
    assert len(d["aristas"]) == 2
