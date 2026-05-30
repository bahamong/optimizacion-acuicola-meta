import './Sidebar.css'

const ITEMS = [
  { id: 'datos',   icono: '🗄️', label: 'Datos de la Red' },
  { id: 'mapa',    icono: '🗺️', label: 'Visualización'   },
  { id: 'evaluar', icono: '📊', label: 'Evaluar'          },
]

export default function Sidebar({ vistaActual, onCambiar, sincronizado }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🐟</span>
        <div>
          <p className="sidebar-logo-title">Acuícola</p>
          <p className="sidebar-logo-sub">Real del Meta</p>
        </div>
      </div>

      <ul className="sidebar-menu">
        {ITEMS.map(item => (
          <li key={item.id}>
            <button
              className={`sidebar-item ${vistaActual === item.id ? 'activo' : ''}`}
              onClick={() => onCambiar(item.id)}
            >
              <span className="sidebar-icono">{item.icono}</span>
              <span className="sidebar-label">{item.label}</span>
              {/* Alerta si intentan optimizar sin datos sincronizados */}
              {item.id === 'evaluar' && !sincronizado && (
                <span className="sidebar-alerta" title="Aplica los datos primero">!</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <p>Optimización Logística</p>
        <p>AG + Gradiente + Grafos</p>
      </div>
    </nav>
  )
}
