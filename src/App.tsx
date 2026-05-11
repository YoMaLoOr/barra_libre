import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCocktail, faGlassMartiniAlt } from '@fortawesome/free-solid-svg-icons';
import './App.css';

library.add(faCocktail, faGlassMartiniAlt);

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

let ws: WebSocket;

function App() {
  const [nombreCliente, setNombreCliente] = useState('');
  const [barrasActivas, setBarrasActivas] = useState<BarraLibre[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const planes = {
  LC1: { tipo: "1H Low Cost", minutos: 60, copas: 6, premium: false },
  P1:  { tipo: "1H Premium", minutos: 60, copas: 6, premium: true },
  LC2: { tipo: "2H Low Cost", minutos: 120, copas: 12, premium: false },
  P2:  { tipo: "2H Premium", minutos: 120, copas: 12, premium: true },
  LC3: { tipo: "3H Low Cost", minutos: 180, copas: 18, premium: false },
  P3:  { tipo: "3H Premium", minutos: 180, copas: 18, premium: true }
};

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    ws = new WebSocket(`ws://${window.location.hostname}:3001`);

    ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === "STATE_UPDATE") {
      setBarrasActivas(msg.payload.barrasActivas);
      setBloqueados(msg.payload.bloqueados);
    }
  };

    return () => {
      ws.close();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const agregarBarra = (key: keyof typeof planes) => {
  if (!nombreCliente.trim()) return;

  ws.send(JSON.stringify({
    type: "ADD_BARRA",
    payload: {
      cliente: nombreCliente,
      plan: key
    }
  }));

  setNombreCliente('');
};

  const formatearTiempo = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const mostrarSoloLogo = barrasActivas.length === 0 && windowWidth > 768;

  if (mostrarSoloLogo) {
  return (
    <div className="full-screen-empty">
      <img className="main-bg-logo" src="..\Logo-grande.png" alt="Fondo" />
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
        <img className="logo-small" src="..\Logo-peque.png" alt="Logo" />
        <h2 className="main-title">MENOS "BLA BLA BLA" Y MÁS "GLU GLU GLU"</h2>
        <img className="logo-small" src="..\Logo-peque.png" alt="Logo" />
      </header>
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
          {[...barrasActivas].reverse().map((b, index) => {
              const porcentajeTiempo = ((b.segundosTotales - b.segundosRestantes) / b.segundosTotales) * 100;
              const esAlerta = b.segundosRestantes < 300;
              const isSpecialCard = barrasActivas.length === 1 && index === 0;
              const scaleFactor = Math.max(0.3, 1.2 - (barrasActivas.length - 1) * 0.05);

              return (
                <div key={b.id} className={`bar-card ${esAlerta ? 'alert-pulse' : ''}${isSpecialCard ? ' special-card' : ''}`} style={{ '--scale': scaleFactor } as React.CSSProperties}>
                  <div className="card-info">
                    <div className="client-data">
                      <h6 className="client-name">{b.cliente}</h6>
                      <span className="plan-tag">{b.tipo}</span>
                    </div>

                    <div className="icons-container">
                      {b.isPremium ? (
                        <>
                          <FontAwesomeIcon icon={["fas", "cocktail"]} className="glass-icon active" />
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
                        onClick={() =>
                          ws.send(
                            JSON.stringify({
                              type: "FINALIZAR_BARRA",
                              payload: { id: b.id }
                            })
                          )
                        }
                        className="btn-delete"
                      >
                        Finalizar
                      </button>
                      <button 
                        onClick={() => ws.send(JSON.stringify({ type: "SERVIR_COPA", payload: { id: b.id } }))}
                        disabled={b.copasConsumidas >= b.limiteCopas}
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
                      <div
                        className="progress-fill"
                        style={{ width: `${porcentajeTiempo}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </section>
        <aside className="blocked-sidebar">
          <div className="sidebar-header">BORRACHOS PERO BUENOS MUCHACHOS</div>
          <div className="sidebar-content">
            {bloqueados.map((n, i) => (
              <div key={i} className="blocked-item">● {n.toUpperCase()}</div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;