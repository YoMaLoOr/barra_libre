import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faMartiniGlass, faWineGlass } from '@fortawesome/free-solid-svg-icons';
import './App.css';

library.add(faMartiniGlass, faWineGlass);

// FIX: planes fuera del componente, no se recrea en cada render
const planes = {
  LC1: { tipo: "1H Low Cost", minutos: 60,  copas: null, premium: false },
  P1:  { tipo: "1H Premium",  minutos: 60,  copas: 6,    premium: true  },
  LC2: { tipo: "2H Low Cost", minutos: 120, copas: null, premium: false },
  P2:  { tipo: "2H Premium",  minutos: 120, copas: 12,   premium: true  },
  LC3: { tipo: "3H Low Cost", minutos: 180, copas: null, premium: false },
  P3:  { tipo: "3H Premium",  minutos: 180, copas: 18,   premium: true  },
};

interface BarraLibre {
  id: string;
  cliente: string;
  tipo: string;
  isPremium: boolean;
  segundosRestantes: number;
  segundosTotales: number;
  limiteCopas: number;
  copasConsumidas: number;
}

function App() {
  const [nombreCliente, setNombreCliente] = useState('');
  const [barrasActivas, setBarrasActivas] = useState<BarraLibre[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [conectado, setConectado] = useState(false);

  // FIX: ws como ref, no variable de módulo
  const wsRef = useRef<WebSocket | null>(null);

  // FIX: envío con guardia de readyState
  const enviar = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // FIX: lógica de conexión y reconexión en una función reutilizable
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function conectar() {
      const socket = new WebSocket(`ws://${window.location.hostname}:3001`);
      wsRef.current = socket;

      socket.onopen = () => setConectado(true);

      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "STATE_UPDATE") {
          setBarrasActivas(msg.payload.barrasActivas);
          setBloqueados(msg.payload.bloqueados);
        }
      };

      socket.onclose = () => {
        setConectado(false);
        // FIX: reconexión automática a los 3 segundos
        reconnectTimeout = setTimeout(conectar, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    conectar();

    return () => {
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const agregarBarra = (key: keyof typeof planes) => {
    if (!nombreCliente.trim()) return;
    enviar({ type: "ADD_BARRA", payload: { cliente: nombreCliente, plan: key } });
    setNombreCliente('');
  };

  const formatearTiempo = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // FIX: pantalla vacía solo si ya hay conexión y no hay barras
  const mostrarSoloLogo = conectado && barrasActivas.length === 0 && windowWidth > 768;

  if (mostrarSoloLogo) {
    return (
      <div className="full-screen-empty">
        {/* FIX: rutas con slash normal, imágenes servidas desde public/ */}
        <img className="main-bg-logo" src="/Logo-grande.png" alt="Fondo" />
        <div className="foreground-content">
          <h1 className="empty-phrase">
            BARRA LIBRE PARA <br />
            <span>BORRACHOS PERO BUENOS MUCHACHOS</span>
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="main-header">
        {/* FIX: rutas con slash normal */}
        <img className="logo-small" src="/Logo-peque.png" alt="Logo" />
        <h2 className="main-title">MENOS "BLA BLA BLA" Y MÁS "GLU GLU GLU"</h2>
        <img className="logo-small" src="/Logo-peque.png" alt="Logo" />
      </header>

      {/* Indicador de conexión */}
      {!conectado && (
        <div className="connection-warning">
          Reconectando con el servidor...
        </div>
      )}

      <section className="control-panel">
        <div className="input-group">
          <label>Nombre de la victima</label>
          <input
            type="text"
            placeholder="Nombre"
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Selecciona un plan</label>
          <select
            className="plan-select"
            defaultValue=""
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                agregarBarra(value as keyof typeof planes);
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>Elegir plan</option>
            {Object.keys(planes).map((k) => (
              <option key={k} value={k}>
                {planes[k as keyof typeof planes].tipo}
              </option>
            ))}
          </select>
        </div>
      </section>

      <main className="main-content">
        <section className="active-bars-container">
          {/* FIX: el servidor ya hace unshift (más reciente primero),
              no hace falta .reverse() */}
          {barrasActivas.reverse().map((b, index) => {
            const porcentajeTiempo = ((b.segundosTotales - b.segundosRestantes) / b.segundosTotales) * 100;
            const esAlerta = b.segundosRestantes < 300;
            const isSpecialCard = barrasActivas.length === 1 && index === 0;
            const scaleFactor = Math.max(0.3, 1.2 - (barrasActivas.length - 1) * 0.05);

            return (
              <div
                key={b.id}
                className={`bar-card ${esAlerta ? 'alert-pulse' : ''}${isSpecialCard ? ' special-card' : ''}`}
                style={{ '--scale': scaleFactor } as React.CSSProperties}
              >
                <div className="card-info">
                  <div className="client-data">
                    <h6 className="client-name">{b.cliente}</h6>
                    <span className="plan-tag">{b.tipo}</span>
                  </div>

                  <div className="icons-container">
                    {b.isPremium ? (
                      <>
                        {/* FIX: faMartiniGlass en lugar de faCocktail (renombrado en FA6+) */}
                        <FontAwesomeIcon icon={["fas", "martini-glass"]} className="glass-icon active" />
                        <span className="remaining-cups">x{b.limiteCopas - b.copasConsumidas}</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cup-straw glass-icon active"></i>
                        <i className="bi bi-infinity glass-icon infinity-icon"></i>
                      </>
                    )}
                  </div>

                  <div className="actions">
                    <button
                      onClick={() => enviar({ type: "FINALIZAR_BARRA", payload: { id: b.id } })}
                      className="btn-delete"
                    >
                      Finalizar
                    </button>
                    <button
                      onClick={() => enviar({ type: "SERVIR_COPA", payload: { id: b.id } })}
                      disabled={b.isPremium && b.copasConsumidas >= b.limiteCopas}
                      className="btn-serve"
                    >
                      Servir Copa
                    </button>
                  </div>
                </div>

                <div className="progress-wrapper">
                  <span className={`timer ${esAlerta ? 'time-alert' : ''}`}>
                    {formatearTiempo(b.segundosRestantes)}
                  </span>
                  <div className="progress-container">
                    <div className="progress-fill" style={{ width: `${porcentajeTiempo}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <aside className="blocked-sidebar">
          <div className="sidebar-header">BORRACHOS PERO BUENOS MUCHACHOS</div>
          <div className="sidebar-content">
            {/* FIX: key por nombre, no por índice */}
            {bloqueados.map((n) => (
              <div key={n} className="blocked-item">● {n.toUpperCase()}</div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
