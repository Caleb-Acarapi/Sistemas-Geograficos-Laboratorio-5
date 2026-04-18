// ─────────────────────────────────────────────
//  MAPA  (sin cambios)
// ─────────────────────────────────────────────
const mapa = L.map("mapa").setView([-16.4897, -68.1193], 15);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(mapa);

// ─────────────────────────────────────────────
//  ESTADO
// ─────────────────────────────────────────────
let coordenadas = []; // puntos capturados en la sesión actual (no guardados aún)
let db = null; // instancia SQLite en memoria

// ─────────────────────────────────────────────
//  INICIO DE SQL.JS
// ─────────────────────────────────────────────
initSqlJs({
  locateFile: (file) =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`,
})
  .then((SQL) => {
    db = new SQL.Database();
    db.run(`
    CREATE TABLE IF NOT EXISTS coordenadas (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      lat   REAL    NOT NULL,
      lng   REAL    NOT NULL,
      fecha TEXT    NOT NULL
    )
  `);
    mostrarMensaje("Base de datos lista ✔");
  })
  .catch((err) => {
    mostrarMensaje("Error al iniciar la BD: " + err.message);
  });

// ─────────────────────────────────────────────
//  CLIC EN EL MAPA
// ─────────────────────────────────────────────
mapa.on("click", function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  const fecha = new Date().toLocaleString("es-BO");

  L.marker([lat, lng])
    .addTo(mapa)
    .bindPopup(`Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`)
    .openPopup();

  coordenadas.push({ lat, lng, fecha });
  actualizarLista();
});

// ─────────────────────────────────────────────
//  FUNCIÓN: actualizar lista HTML
// ─────────────────────────────────────────────
function actualizarLista() {
  const ul = document.getElementById("lista-coords");
  ul.innerHTML = "";
  coordenadas.forEach((c, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><span class="num">#${i + 1}</span>
        Lat: ${c.lat.toFixed(6)} &nbsp;|&nbsp; Lng: ${c.lng.toFixed(6)}
      </span>
      <span style="color:#336677;font-size:0.78rem">${c.fecha}</span>
    `;
    ul.appendChild(li);
  });
}

// ─────────────────────────────────────────────
//  BOTÓN: GUARDAR EN BASE DE DATOS
//  Inserta los puntos en la tabla SQLite (solo
//  en memoria, sin descargar nada).
//  Muestra una ventanita flotante de confirmación.
// ─────────────────────────────────────────────
document.getElementById("btn-guardar").addEventListener("click", () => {
  if (!db) {
    mostrarToast("⚠️ La BD aún no está lista.");
    return;
  }
  if (coordenadas.length === 0) {
    mostrarToast("⚠️ No hay coordenadas para guardar.");
    return;
  }

  coordenadas.forEach((c) => {
    db.run("INSERT INTO coordenadas (lat, lng, fecha) VALUES (?, ?, ?)", [
      c.lat,
      c.lng,
      c.fecha,
    ]);
  });

  // Consultar total acumulado en la BD
  const res = db.exec("SELECT COUNT(*) as total FROM coordenadas");
  const total = res[0].values[0][0];

  mostrarMensaje("Guardado en la base de datos");

  mostrarToast(
    `✔ ${coordenadas.length} punto(s) guardado(s).\nTotal en BD: ${total} coordenada(s).`,
  );

  coordenadas = [];
  actualizarLista();
});

// ─────────────────────────────────────────────
//  BOTÓN: EXPORTAR PDF
//  Lee TODOS los registros de la BD y genera el PDF.
// ─────────────────────────────────────────────
document.getElementById("btn-pdf").addEventListener("click", () => {
  if (!db) {
    mostrarToast("⚠️ La BD aún no está lista.");
    return;
  }

  const resultado = db.exec(
    "SELECT id, lat, lng, fecha FROM coordenadas ORDER BY id ASC",
  );

  if (!resultado.length || resultado[0].values.length === 0) {
    mostrarToast(
      "⚠️ No hay datos guardados en la BD.\nGuarda coordenadas primero.",
    );
    return;
  }

  const filas = resultado[0].values; // [[id, lat, lng, fecha], ...]

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Encabezado  coordenadas = [];
  doc.setFontSize(16);
  doc.setTextColor(0, 100, 120);
  doc.text("Reporte de Coordenadas - SIG-747", 14, 18);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString("es-BO")}`, 14, 25);

  doc.setDrawColor(0, 180, 200);
  doc.line(14, 28, 196, 28);

  // Cabecera de tabla
  doc.setFontSize(10);
  doc.setTextColor(0, 140, 160);
  doc.text("#", 14, 36);
  doc.text("Latitud", 24, 36);
  doc.text("Longitud", 80, 36);
  doc.text("Fecha / Hora", 136, 36);

  // Filas desde la BD
  doc.setTextColor(30);
  let y = 44;
  filas.forEach((fila, i) => {
    const [id, lat, lng, fecha] = fila;
    if (i % 2 === 0) {
      doc.setFillColor(235, 248, 250);
      doc.rect(13, y - 5, 183, 8, "F");
    }
    doc.setFontSize(9);
    doc.text(String(id), 14, y);
    doc.text(Number(lat).toFixed(6), 24, y);
    doc.text(Number(lng).toFixed(6), 80, y);
    doc.text(String(fecha), 136, y);
    y += 9;
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
  });

  doc.setFontSize(9);
  doc.setTextColor(0, 100, 120);
  doc.text(`Total de puntos en BD: ${filas.length}`, 14, y + 6);

  doc.save("reporte_coordenadas.pdf");
  mostrarMensaje("PDF generado con todos los datos de la BD.");
});

// ─────────────────────────────────────────────
//  BOTÓN: LIMPIAR lista visual (no toca la BD)
// ─────────────────────────────────────────────
document.getElementById("btn-limpiar").addEventListener("click", () => {
  coordenadas = [];
  actualizarLista();
  mostrarMensaje("Lista limpiada. Los datos en BD se conservan.");
});

// ─────────────────────────────────────────────
//  UTILIDAD: mensaje pequeño bajo los botones
// ─────────────────────────────────────────────
function mostrarMensaje(texto) {
  const el = document.getElementById("mensaje");
  el.textContent = texto;
  setTimeout(() => {
    el.textContent = "";
  }, 2000);
}

// ─────────────────────────────────────────────
//  UTILIDAD: ventanita flotante (toast)
//  Aparece centrada en pantalla y desaparece
//  automáticamente después de 3 segundos.
// ─────────────────────────────────────────────
function mostrarToast(texto) {
  const viejo = document.getElementById("toast");
  if (viejo) viejo.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.textContent = texto;

  Object.assign(toast.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "#001e30",
    color: "#50ffc5",
    border: "1px solid #00ddff",
    borderRadius: "10px",
    padding: "20px 30px",
    fontSize: "1rem",
    textAlign: "center",
    whiteSpace: "pre-line",
    boxShadow: "0 0 30px rgba(0,221,255,0.4)",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.3s ease",
    maxWidth: "360px",
    lineHeight: "1.6",
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
