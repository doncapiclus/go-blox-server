/**
 * GO-BLOX MULTIPLAYER SERVER
 * ───────────────────────────────────────────────
 * Instalar dependencias:
 *   npm install express cors
 *
 * Ejecutar:
 *   node server.js
 *
 * Endpoints:
 *   POST /state   → ESP32 / Player Web envían su posición
 *   GET  /players → Lista todos los jugadores activos (dashboard)
 *   GET  /        → Sirve el dashboard HTML embebido
 * ───────────────────────────────────────────────
 */

const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Estado de jugadores ───────────────────────
const PLAYER_TIMEOUT_MS = 8000; // se borra si no envía en 8s
const players = new Map();      // id → { id, x, y, rot, lastSeen, source }

function cleanStalePlayers() {
  const now = Date.now();
  for (const [id, p] of players) {
    if (now - p.lastSeen > PLAYER_TIMEOUT_MS) {
      console.log(`[SERVER] Player removido por timeout: ${id}`);
      players.delete(id);
    }
  }
}

// Limpieza periódica
setInterval(cleanStalePlayers, 2000);

// ── POST /state ───────────────────────────────
// Body: { id, x, y, rot, source? }   (source: "esp32" | "web")
// Responde: array con TODOS los demás jugadores activos
app.post("/state", (req, res) => {
  const { id, x, y, rot, source = "esp32" } = req.body;

  if (!id || x === undefined || y === undefined || rot === undefined) {
    return res.status(400).json({ error: "Campos requeridos: id, x, y, rot" });
  }

  players.set(id, {
    id,
    x: parseFloat(x),
    y: parseFloat(y),
    rot: parseFloat(rot),
    lastSeen: Date.now(),
    source,
  });

  // Devolver todos excepto quien pregunta
  const others = [];
  for (const [pid, p] of players) {
    if (pid !== id) {
      others.push({ id: p.id, x: p.x, y: p.y, rot: p.rot });
    }
  }

  res.json(others);
});

// ── GET /players ──────────────────────────────
// Para el dashboard: devuelve todos los jugadores con metadatos
app.get("/players", (req, res) => {
  const list = [];
  for (const [, p] of players) {
    list.push({
      ...p,
      age: Date.now() - p.lastSeen,
    });
  }
  res.json(list);
});

// ── GET /kick/:id ─────────────────────────────
app.delete("/kick/:id", (req, res) => {
  const id = req.params.id;
  if (players.has(id)) {
    players.delete(id);
    console.log(`[SERVER] Player kickeado: ${id}`);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: "Jugador no encontrado" });
});

// ── GET / → dashboard ────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// ── Start ─────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n╔══════════════════════════════╗`);
  console.log(`║  GO-BLOX SERVER  :${PORT}       ║`);
  console.log(`╚══════════════════════════════╝`);
  console.log(`  Dashboard → http://localhost:${PORT}`);
  console.log(`  Endpoint  → POST http://localhost:${PORT}/state\n`);
});
