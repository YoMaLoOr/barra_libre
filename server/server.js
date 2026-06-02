import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });
console.log("WebSocket server en ws://localhost:3001");

const estado = {
  barrasActivas: [],
  bloqueados: []
};

const planes = {
  LC1: { tipo: "1H Low Cost", minutos: 60, copas: 6, premium: false },
  P1:  { tipo: "1H Premium", minutos: 60, copas: 6, premium: true },
  LC2: { tipo: "2H Low Cost", minutos: 120, copas: 12, premium: false },
  P2:  { tipo: "2H Premium", minutos: 120, copas: 12, premium: true },
  LC3: { tipo: "3H Low Cost", minutos: 180, copas: 18, premium: false },
  P3:  { tipo: "3H Premium", minutos: 180, copas: 18, premium: true }
};

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(msg);
    }
  });
}

function enviarEstado() {
  broadcast({
    type: "STATE_UPDATE",
    payload: estado
  });
}

function agregarBarra(cliente, planKey) {
  if (!planes[planKey]) return;

  const nombre = cliente.toLowerCase();
  if (estado.bloqueados.includes(nombre)) return;

  const p = planes[planKey];

  estado.barrasActivas.unshift({
    id: Math.random().toString(36).slice(2),
    cliente,
    tipo: p.tipo,
    isPremium: p.premium,
    segundosTotales: p.minutos * 60,
    segundosRestantes: p.minutos * 60,
    limiteCopas: p.copas,
    copasConsumidas: 0,
    copasSlot: 0,
    autoCopasDadas: 0
  });

  enviarEstado();
}

function servirCopa(id) {
  const barra = estado.barrasActivas.find(b => b.id === id);
  if (!barra) return;

  barra.copasConsumidas++;

  if (barra.isPremium && barra.copasConsumidas >= barra.limiteCopas) {
    bloquearCliente(barra.cliente);
    eliminarBarra(id);
  }

  enviarEstado();
}

function finalizarBarra(id) {
  const barra = estado.barrasActivas.find(b => b.id === id);
  if (!barra) return;

  eliminarBarra(id);
  bloquearCliente(barra.cliente);
  enviarEstado();
}

function bloquearCliente(cliente) {
  const nombre = cliente.toLowerCase();
  if (!estado.bloqueados.includes(nombre)) {
    estado.bloqueados.push(nombre);
  }
}

function eliminarBarra(id) {
  estado.barrasActivas = estado.barrasActivas.filter(b => b.id !== id);
}

setInterval(() => {
  estado.barrasActivas = estado.barrasActivas.filter(b => {
    b.segundosRestantes--;

    if (b.segundosRestantes <= 0) {
      bloquearCliente(b.cliente);
      return false;
    }

    if (b.isPremium) {
      const segundosConsumidos = b.segundosTotales - b.segundosRestantes;
      const slotActual = Math.floor(segundosConsumidos / 600);

      if (slotActual > b.autoCopasDadas) {
        b.autoCopasDadas = slotActual;
        b.copasConsumidas++;
        if (b.copasConsumidas >= b.limiteCopas) {
          bloquearCliente(b.cliente);
          eliminarBarra(b.id);
          return false;
        }
      }
    }

    return true;
  });

  enviarEstado();
}, 1000);

wss.on("connection", ws => {
  console.log("Cliente conectado");

  ws.send(JSON.stringify({
    type: "STATE_UPDATE",
    payload: estado
  }));

  ws.on("message", msg => {
    try {
      const data = JSON.parse(msg.toString());

      switch (data.type) {
        case "ADD_BARRA":
          agregarBarra(data.payload.cliente, data.payload.plan);
          break;
        case "SERVIR_COPA":
          servirCopa(data.payload.id);
          break;
        case "FINALIZAR_BARRA":
          finalizarBarra(data.payload.id);
          break;
        default:
          console.log("Mensaje desconocido:", data.type);
      }
    } catch (e) {
      console.error("Mensaje inválido", e);
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
  });
});