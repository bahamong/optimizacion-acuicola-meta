import { useState, useEffect } from 'react'
import {
  FaDatabase, FaMapMarkedAlt, FaChartBar, FaFish,
  FaAngleLeft, FaAngleRight, FaExclamation,
} from 'react-icons/fa'
import './Sidebar.css'

const ITEMS = [
  { id: 'datos',   icono: FaDatabase,     label: 'Datos de la Red' },
  { id: 'mapa',    icono: FaMapMarkedAlt, label: 'Visualización'   },
  { id: 'evaluar', icono: FaChartBar,     label: 'Evaluar'         },
]

const LS_KEY = 'sidebar-colapsada'

export default function Sidebar({ vistaActual, onCambiar, sincronizado }) {
  const [colapsada, setColapsada] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === 'true' } catch { return false }
  })

  // Persistir el estado expandido/colapsado entre recargas
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, String(colapsada)) } catch { /* ignore */ }
  }, [colapsada])

  return (
    <nav className={`sidebar ${colapsada ? 'colapsada' : ''}`}>
      <div className="sidebar-logo">
        <FaFish className="sidebar-logo-icon" />
        {!colapsada && (
          <div>
            <p className="sidebar-logo-title">Acuícola</p>
            <p className="sidebar-logo-sub">Real del Meta</p>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setColapsada(c => !c)}
          title={colapsada ? 'Expandir menú' : 'Contraer menú'}
        >
          {colapsada ? <FaAngleRight /> : <FaAngleLeft />}
        </button>
      </div>

      <ul className="sidebar-menu">
        {ITEMS.map(item => {
          const Icono = item.icono
          return (
            <li key={item.id}>
              <button
                className={`sidebar-item ${vistaActual === item.id ? 'activo' : ''}`}
                onClick={() => onCambiar(item.id)}
                title={colapsada ? item.label : undefined}
              >
                <Icono className="sidebar-icono" />
                {!colapsada && <span className="sidebar-label">{item.label}</span>}
                {item.id === 'evaluar' && !sincronizado && (
                  <span className="sidebar-alerta" title="Aplica los datos primero">
                    <FaExclamation />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {!colapsada && (
        <div className="sidebar-footer">
          <p>Optimización Logística</p>
          <p>AG + Gradiente + Grafos</p>
        </div>
      )}
    </nav>
  )
}
