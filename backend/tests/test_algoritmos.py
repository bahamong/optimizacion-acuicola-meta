"""
Tests para Dijkstra, FlujoMaximo, ValidadorRestricciones, AG y Gradiente.
Ejecutar: pytest tests/test_algoritmos.py -v
"""

import pytest
from models.arista import Arista
from models.grafo import GrafoRed
from models.nodo import Nodo, TipoNodo
from grafos.dijkstra import DijkstraCalculator
from grafos.flujo_maximo import FlujoMaximo
from algoritmos.validador import ValidadorRestricciones
from utils.helpers import construir_red_acuicola


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def grafo_simple():
    """Grafo de 3 nodos para pruebas básicas."""
    g = GrafoRed()
    g.agregar_nodo(Nodo("O1", TipoNodo.ORIGEN, "Orig", "M", "D", 4.0, -72.0, 100, oferta=100))
    g.agregar_nodo(Nodo("A1", TipoNodo.ACOPIO, "Aco", "M", "D", 4.5, -73.0, 150, tasa_merma=0.01))
    g.agregar_nodo(Nodo("D1", TipoNodo.DESTINO, "Dest", "M", "D", 5.0, -74.0, 50, demanda=50))
    g.agregar_arista(Arista("O1", "A1", 5.0, 100, 50))
    g.agregar_arista(Arista("A1", "D1", 10.0, 80, 30))
    return g


@pytest.fixture
def grafo_colombia():
    return construir_red_acuicola()


# ── Dijkstra ──────────────────────────────────────────────────────────────────

class TestDijkstra:
    def test_ruta_existe(self, grafo_simple):
        calc = DijkstraCalculator(grafo_simple)
        path, costo = calc.ruta_minimo_costo("O1", "D1")
        assert path == ["O1", "A1", "D1"]
        assert abs(costo - 15.0) < 1e-6  # 5 + 10

    def test_ruta_no_existe(self, grafo_simple):
        calc = DijkstraCalculator(grafo_simple)
        path, costo = calc.ruta_minimo_costo("D1", "O1")  # grafo dirigido, no hay vuelta
        assert path is None
        assert costo == float("inf")

    def test_ruta_con_detalle(self, grafo_simple):
        calc = DijkstraCalculator(grafo_simple)
        r = calc.ruta_con_detalle("O1", "D1")
        assert r["existe"] is True
        assert r["saltos"] == 2
        assert r["costo_total"] == 15.0

    def test_ruta_mismo_nodo(self, grafo_simple):
        calc = DijkstraCalculator(grafo_simple)
        path, costo = calc.ruta_minimo_costo("O1", "O1")
        assert path == ["O1"]
        assert costo == 0.0

    def test_aristas_criticas(self, grafo_simple):
        criticas = DijkstraCalculator(grafo_simple).aristas_criticas()
        assert isinstance(criticas, list)

    def test_colombia_ruta_o1_d1(self, grafo_colombia):
        calc = DijkstraCalculator(grafo_colombia)
        path, costo = calc.ruta_minimo_costo("O1", "D1")
        assert path is not None
        assert costo < float("inf")


# ── Flujo Máximo ──────────────────────────────────────────────────────────────

class TestFlujoMaximo:
    def test_flujo_basico(self, grafo_simple):
        calc = FlujoMaximo(grafo_simple)
        valor, flujos = calc.calcular("O1", "D1")
        assert valor > 0  # debe poder mandar algo

    def test_flujo_limitado_por_arista(self, grafo_simple):
        calc = FlujoMaximo(grafo_simple)
        valor, _ = calc.calcular("O1", "D1")
        # La arista A1→D1 tiene cap=80, por lo que el flujo máximo es ≤ 80
        assert valor <= 80.0

    def test_cuello_botella(self, grafo_simple):
        calc = FlujoMaximo(grafo_simple)
        cuello = calc.cuello_de_botella("O1", "D1")
        assert cuello is not None  # existe cuello en grafo de 2 aristas

    def test_reporte_keys(self, grafo_simple):
        calc = FlujoMaximo(grafo_simple)
        rep = calc.reporte("O1", "D1")
        assert "flujo_maximo" in rep
        assert "cuello_botella" in rep
        assert "detalle_flujos" in rep

    def test_nodos_inexistentes(self, grafo_simple):
        calc = FlujoMaximo(grafo_simple)
        valor, _ = calc.calcular("X", "Y")
        assert valor == 0.0


# ── Validador de Restricciones ────────────────────────────────────────────────

class TestValidador:
    def test_solucion_valida(self, grafo_simple):
        flujos = {("O1", "A1"): 50.0, ("A1", "D1"): 50.0}
        stock = {"A1": 0.0}
        val = ValidadorRestricciones(grafo_simple)
        reporte = val.validar_completo(flujos, stock)
        # Puede haber desequilibrio de balance; lo importante es checar oferta y demanda
        assert reporte["violaciones_oferta"] == []
        assert reporte["violaciones_demanda"] == []

    def test_violacion_oferta(self, grafo_simple):
        flujos = {("O1", "A1"): 150.0, ("A1", "D1"): 50.0}  # excede oferta=100
        stock = {"A1": 0.0}
        val = ValidadorRestricciones(grafo_simple)
        reporte = val.validar_completo(flujos, stock)
        assert len(reporte["violaciones_oferta"]) > 0

    def test_violacion_demanda(self, grafo_simple):
        flujos = {("O1", "A1"): 20.0, ("A1", "D1"): 20.0}  # solo 20, demanda=50
        stock = {"A1": 0.0}
        val = ValidadorRestricciones(grafo_simple)
        reporte = val.validar_completo(flujos, stock)
        assert len(reporte["violaciones_demanda"]) > 0
        assert reporte["deficit_total"] == pytest.approx(30.0, abs=1e-3)

    def test_violacion_capacidad(self, grafo_simple):
        flujos = {("O1", "A1"): 50.0, ("A1", "D1"): 90.0}  # cap A1→D1 = 80
        stock = {"A1": 0.0}
        val = ValidadorRestricciones(grafo_simple)
        reporte = val.validar_completo(flujos, stock)
        assert len(reporte["violaciones_capacidad"]) > 0

    def test_alerta_calidad(self, grafo_simple):
        # Degradar calidad del acopio A1
        grafo_simple.obtener_nodo("A1").tasa_calidad = 0.3
        val = ValidadorRestricciones(grafo_simple)
        alertas = val.verificar_calidad()
        assert len(alertas) > 0
        assert alertas[0]["nodo"] == "A1"


# ── Algoritmo Genético (prueba rápida) ───────────────────────────────────────

class TestAlgoritmoGenetico:
    def test_ag_retorna_resultado(self, grafo_colombia):
        from algoritmos.genetico import AlgoritmoGenetico
        from config import AG_GENERACIONES
        import config
        # Reducir generaciones para la prueba
        config.AG_GENERACIONES = 10
        config.AG_POBLACION = 10

        ag = AlgoritmoGenetico(grafo_colombia)
        resultado = ag.ejecutar()

        assert "mejor_individuo" in resultado
        assert "mejor_fitness" in resultado
        assert "rutas_activas" in resultado
        assert resultado["num_rutas_activas"] >= 0

        # Restaurar
        config.AG_GENERACIONES = AG_GENERACIONES
        config.AG_POBLACION = 60

    def test_ag_cromosoma_longitud(self, grafo_colombia):
        from algoritmos.genetico import AlgoritmoGenetico
        import config
        config.AG_GENERACIONES = 5
        config.AG_POBLACION = 5

        ag = AlgoritmoGenetico(grafo_colombia)
        resultado = ag.ejecutar()
        assert len(resultado["mejor_individuo"]) == len(grafo_colombia.aristas)

        config.AG_GENERACIONES = 150
        config.AG_POBLACION = 60


# ── Método de Gradiente (prueba rápida) ──────────────────────────────────────

class TestMetodoGradiente:
    def test_gradiente_sin_rutas(self, grafo_simple):
        from algoritmos.gradiente import MetodoGradiente
        grad = MetodoGradiente(grafo_simple, [])  # sin rutas activas
        resultado = grad.ejecutar()
        assert resultado["exito"] is False

    def test_gradiente_con_rutas(self, grafo_simple):
        from algoritmos.gradiente import MetodoGradiente
        rutas = list(grafo_simple.aristas.values())
        grad = MetodoGradiente(grafo_simple, rutas)
        resultado = grad.ejecutar()
        assert "costo_minimo" in resultado
        assert resultado["costo_minimo"] >= 0
