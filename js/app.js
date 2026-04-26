// =============================================
//   CPU SCHEDULER — app.js
//   Algoritmos: FCFS y SPN (No expulsivos)
// =============================================

// ──── PALETA DE COLORES PASTEL ─────────────
const COLORS = [
  { bar: '#f472b6', label: '#fff' }, // pink
  { bar: '#a78bfa', label: '#fff' }, // lavender
  { bar: '#34d399', label: '#fff' }, // mint
  { bar: '#fbbf24', label: '#fff' }, // peach
  { bar: '#60a5fa', label: '#fff' }, // sky
  { bar: '#fb923c', label: '#fff' }, // orange
  { bar: '#f87171', label: '#fff' }, // red-soft
  { bar: '#4ade80', label: '#fff' }, // green
];

// ──── ESTADO GLOBAL ────────────────────────
let processes   = [];
let algo        = 'FCFS';
let simRunning  = false;
let simPaused   = false;
let simTimer    = null;
let stepIndex   = 0;
let schedule    = [];
let metrics     = [];
let procCounter = 1;

// ──── INICIALIZACIÓN ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderProcessTable();
});

// ──── SELECCIÓN DE ALGORITMO ───────────────
function selectAlgo(a) {
  algo = a;
  document.getElementById('btn-fcfs').classList.toggle('active', a === 'FCFS');
  document.getElementById('btn-spn').classList.toggle('active',  a === 'SPN');

  const descs = {
    FCFS: `<span class="desc-icon">💡</span>
           <p><b>FCFS:</b> Los procesos se atienden en el orden en que llegan.
           ¡Simple y sin discriminación! Puede causar el efecto convoy si hay procesos muy largos al inicio.</p>`,
    SPN:  `<span class="desc-icon">⚡</span>
           <p><b>SPN:</b> El proceso con la menor ráfaga de CPU disponible se ejecuta primero.
           Minimiza el tiempo de espera promedio, pero puede dejar esperando a los procesos largos.</p>`
  };
  document.getElementById('algo-desc').innerHTML = descs[a];
}

// ──── AGREGAR PROCESO ──────────────────────
function addProcess() {
  const nameInput = document.getElementById('p-name');
  const atInput   = document.getElementById('p-at');
  const btInput   = document.getElementById('p-bt');

  const name = nameInput.value.trim() || ('P' + procCounter);
  const at   = parseInt(atInput.value)  || 0;
  const bt   = parseInt(btInput.value)  || 0;

  if (bt < 1) { showToast('⚠️ La ráfaga de CPU debe ser mayor a 0', 'warn'); return; }
  if (at < 0) { showToast('⚠️ El tiempo de llegada no puede ser negativo', 'warn'); return; }
  if (processes.find(p => p.name === name)) {
    showToast('⚠️ Ya existe un proceso con ese nombre', 'warn'); return;
  }

  processes.push({ name, at, bt });
  procCounter++;
  nameInput.value = '';
  atInput.value   = '';
  btInput.value   = '';
  nameInput.focus();
  renderProcessTable();
  showToast(`✅ Proceso ${name} agregado`, 'ok');
}

// ──── ELIMINAR PROCESO ─────────────────────
function removeProcess(i) {
  const name = processes[i].name;
  processes.splice(i, 1);
  renderProcessTable();
  showToast(`🗑️ Proceso ${name} eliminado`, 'warn');
}

// ──── LIMPIAR TODO ─────────────────────────
function clearAll() {
  if (processes.length === 0) return;
  processes   = [];
  procCounter = 1;
  renderProcessTable();
  resetSim(true);
  showToast('🌸 Lista limpiada', 'ok');
}

// ──── CARGAR ARCHIVO ───────────────────────
function loadFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (ev) {
    const lines  = ev.target.result
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));

    let loaded = 0;
    const errors = [];

    lines.forEach((line, idx) => {
      // Separadores: coma, punto y coma, tabulador, barra
      const parts = line.split(/[,;\t|]+/).map(s => s.trim());
      if (parts.length < 3) { errors.push(idx + 1); return; }

      const name = parts[0];
      const at   = parseFloat(parts[1]);
      const bt   = parseFloat(parts[2]);

      if (isNaN(at) || isNaN(bt) || bt < 1) { errors.push(idx + 1); return; }
      if (processes.find(p => p.name === name)) { errors.push(idx + 1); return; }

      processes.push({ name, at: Math.round(at), bt: Math.round(bt) });
      loaded++;
    });

    procCounter = processes.length + 1;
    renderProcessTable();

    if (errors.length) {
      showToast(`📂 ${loaded} procesos cargados · ${errors.length} errores en líneas: ${errors.join(', ')}`, 'warn');
    } else {
      showToast(`🎉 ¡${loaded} procesos cargados exitosamente!`, 'ok');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ──── RENDERIZAR TABLA DE PROCESOS ─────────
function renderProcessTable() {
  const tbody    = document.getElementById('process-tbody');
  const empty    = document.getElementById('empty-state');
  const tableWrap= document.getElementById('table-wrap');
  const counter  = document.getElementById('process-count');

  counter.textContent = processes.length === 1
    ? '1 proceso'
    : `${processes.length} procesos`;

  if (!processes.length) {
    tbody.innerHTML      = '';
    empty.style.display  = 'block';
    tableWrap.style.display = 'none';
    return;
  }

  empty.style.display     = 'none';
  tableWrap.style.display = '';

  tbody.innerHTML = processes.map((p, i) => {
    const c = COLORS[i % COLORS.length];
    return `<tr>
      <td>
        <span class="color-dot" style="background:${c.bar}"></span>
        <b>${p.name}</b>
      </td>
      <td>${p.at}</td>
      <td>${p.bt}</td>
      <td>
        <button class="del-btn" onclick="removeProcess(${i})" title="Eliminar">
          <i class="fa fa-times"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ──── ALGORITMOS DE PLANIFICACIÓN ──────────

function computeFCFS(procs) {
  const sorted = [...procs].sort((a, b) => a.at !== b.at ? a.at - b.at : procs.indexOf(a) - procs.indexOf(b));
  const sched = [];
  let time = 0;

  for (const p of sorted) {
    if (time < p.at) time = p.at; // CPU idle
    sched.push({ name: p.name, start: time, end: time + p.bt });
    time += p.bt;
  }
  return sched;
}

function computeSPN(procs) {
  const ps    = procs.map(p => ({ ...p, done: false }));
  const sched = [];
  let time      = 0;
  let completed = 0;
  const n       = ps.length;

  while (completed < n) {
    const available = ps.filter(p => !p.done && p.at <= time);
    if (!available.length) {
      time = Math.min(...ps.filter(p => !p.done).map(p => p.at));
      continue;
    }
    // Selecciona el de menor ráfaga; empate → menor tiempo de llegada
    const chosen = available.reduce((a, b) =>
      a.bt < b.bt ? a :
      a.bt === b.bt && a.at <= b.at ? a : b
    );
    sched.push({ name: chosen.name, start: time, end: time + chosen.bt });
    time += chosen.bt;
    chosen.done = true;
    completed++;
  }
  return sched;
}

function buildMetrics(procs, sched) {
  return procs.map(p => {
    const entry = sched.find(s => s.name === p.name);
    const ct  = entry.end;
    const tat = ct - p.at;
    const wt  = tat - p.bt;
    return { name: p.name, at: p.at, bt: p.bt, start: entry.start, ct, tat, wt };
  });
}

// ──── EJECUTAR SIMULACIÓN ──────────────────
function runSimulation() {
  if (!processes.length) { showToast('⚠️ Agrega al menos un proceso primero', 'warn'); return; }
  resetSim(true);

  schedule = algo === 'FCFS' ? computeFCFS(processes) : computeSPN(processes);
  metrics  = buildMetrics(processes, schedule);

  const totalTime = Math.max(...schedule.map(s => s.end));

  stepIndex  = 0;
  simRunning = true;
  simPaused  = false;

  document.getElementById('gantt-panel').style.display   = '';
  document.getElementById('results-panel').style.display = 'none';
  document.getElementById('pause-btn').style.display     = '';
  document.getElementById('reset-btn').style.display     = '';

  initGantt(totalTime);
  setStatus('running', 'Simulando...');
  animateStep(totalTime);
}

// ──── INICIALIZAR DIAGRAMA DE GANTT ────────
function initGantt(totalTime) {
  const unit    = Math.min(48, Math.max(16, Math.floor(680 / totalTime)));
  const W       = totalTime * unit;
  const procOrder = [...new Set(schedule.map(s => s.name))];
  const rowH    = 40;

  let html = `<div class="gantt-inner" style="position:relative">`;

  // Filas
  procOrder.forEach((name, ri) => {
    const pi = processes.findIndex(p => p.name === name);
    const c  = COLORS[pi % COLORS.length];
    const top = ri * rowH;

    html += `
      <div style="display:flex;align-items:center;height:${rowH}px">
        <div class="gantt-process-label" style="color:${c.bar}">${name}</div>
        <div style="flex:1;position:relative;height:${rowH}px">
          <div class="gantt-bg-stripe" style="top:${(rowH-30)/2}px"></div>
        </div>
      </div>`;
  });

  html += `</div>`; // close gantt-inner wrapper for labels

  // Área de barras absoluta (superpuesta)
  html += `<div id="gantt-abs" style="position:absolute;top:0;left:55px;right:0;pointer-events:none">`;

  // Cursor de tiempo
  html += `<div class="gantt-cursor" id="time-cursor" style="background:${COLORS[0].bar}aa;height:${procOrder.length*rowH}px"></div>`;

  html += `</div>`; // close gantt-abs

  // Ticks de tiempo
  html += `<div class="gantt-ticks" style="margin-left:55px;width:${W}px">`;
  const tickStep = totalTime <= 20 ? 1 : totalTime <= 50 ? 5 : Math.ceil(totalTime / 15);
  for (let t = 0; t <= totalTime; t++) {
    if (t % tickStep === 0 || t === totalTime) {
      html += `<span class="gantt-tick" style="left:${t * unit}px">${t}</span>`;
    }
  }
  html += `</div>`;

  document.getElementById('gantt-container').innerHTML =
    `<div style="position:relative;min-width:${W+80}px">${html}</div>`;

  // Guardar en window para usar en animación
  window._ganttUnit  = unit;
  window._ganttOrder = procOrder;
  window._ganttRowH  = rowH;
}

// ──── ANIMACIÓN PASO A PASO ────────────────
function animateStep(totalTime) {
  if (!simRunning) return;
  if (simPaused)  { simTimer = setTimeout(() => animateStep(totalTime), 100); return; }
  if (stepIndex >= schedule.length) { finishSim(); return; }

  const step  = schedule[stepIndex];
  const unit  = window._ganttUnit;
  const order = window._ganttOrder;
  const rowH  = window._ganttRowH;

  const pi    = processes.findIndex(p => p.name === step.name);
  const c     = COLORS[pi % COLORS.length];
  const ri    = order.indexOf(step.name);

  const absArea = document.getElementById('gantt-abs');
  if (!absArea) { finishSim(); return; }

  const top   = ri * rowH + (rowH - 26) / 2;
  const left  = step.start * unit;
  const width = (step.end - step.start) * unit;

  const bar = document.createElement('div');
  bar.className = 'gantt-bar';
  bar.style.cssText = `
    top:${top}px;
    left:${left}px;
    width:0;
    background:${c.bar};
    color:${c.label};
    position:absolute;
  `;
  bar.title = `${step.name} | Inicio: ${step.start} | Fin: ${step.end} | Duración: ${step.end - step.start}`;
  absArea.appendChild(bar);

  // Cursor de tiempo
  const cursor = document.getElementById('time-cursor');
  if (cursor) {
    cursor.style.opacity = '1';
    cursor.style.left    = (step.start * unit) + 'px';
    cursor.style.background = c.bar + '88';
  }

  setStatus('running', `⚡ Ejecutando ${step.name} · t = ${step.start} → ${step.end}`);

  // Animación de expansión
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.width = width + 'px';
      setTimeout(() => {
        if (width > 30) bar.textContent = step.name;
        if (cursor) cursor.style.left = (step.end * unit) + 'px';
      }, 350);
    });
  });

  stepIndex++;
  const speed = parseInt(document.getElementById('speed').value);
  const delay = Math.max(150, 1400 - speed * 220);
  simTimer = setTimeout(() => animateStep(totalTime), delay);
}

// ──── FINALIZAR SIMULACIÓN ─────────────────
function finishSim() {
  simRunning = false;
  document.getElementById('pause-btn').style.display = 'none';

  const cursor = document.getElementById('time-cursor');
  if (cursor) cursor.style.opacity = '0';

  setStatus('done', '🎉 ¡Simulación completada!');
  renderResults();
  document.getElementById('results-panel').style.display = '';
  setTimeout(() => {
    document.getElementById('results-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 300);
}

// ──── RENDERIZAR RESULTADOS ────────────────
function renderResults() {
  const n      = metrics.length;
  const avgTAT = (metrics.reduce((s, m) => s + m.tat, 0) / n).toFixed(2);
  const avgWT  = (metrics.reduce((s, m) => s + m.wt,  0) / n).toFixed(2);
  const totalT = Math.max(...schedule.map(s => s.end));
  const totalBT= processes.reduce((s, p) => s + p.bt, 0);
  const cpuUse = ((totalBT / totalT) * 100).toFixed(1);

  document.getElementById('avg-metrics').innerHTML = `
    <div class="metric-card pink">
      <div class="metric-val">${avgTAT}</div>
      <div class="metric-lbl">TAT promedio</div>
    </div>
    <div class="metric-card lavender">
      <div class="metric-val">${avgWT}</div>
      <div class="metric-lbl">Espera promedio</div>
    </div>
    <div class="metric-card mint">
      <div class="metric-val">${cpuUse}%</div>
      <div class="metric-lbl">Uso de CPU</div>
    </div>
    <div class="metric-card peach">
      <div class="metric-val">${n}</div>
      <div class="metric-lbl">Procesos totales</div>
    </div>`;

  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = metrics.map((m, i) => {
    const c = COLORS[i % COLORS.length];
    return `<tr>
      <td><span class="color-dot" style="background:${c.bar}"></span><b>${m.name}</b></td>
      <td>${m.at}</td>
      <td>${m.bt}</td>
      <td>${m.start}</td>
      <td>${m.ct}</td>
      <td class="tat-cell">${m.tat}</td>
      <td class="wt-cell">${m.wt}</td>
    </tr>`;
  }).join('');
}

// ──── CONTROLES DE SIMULACIÓN ──────────────
function pauseResume() {
  simPaused = !simPaused;
  const icon = document.getElementById('pause-icon');
  const text = document.getElementById('pause-text');
  icon.className = simPaused ? 'fa fa-play' : 'fa fa-pause';
  text.textContent = simPaused ? 'Reanudar' : 'Pausar';
  if (!simPaused) setStatus('running', 'Simulando...');
  else            setStatus('idle', '⏸ Pausado');
}

function resetSim(silent = false) {
  clearTimeout(simTimer);
  simRunning = false;
  simPaused  = false;
  stepIndex  = 0;
  schedule   = [];
  metrics    = [];
  document.getElementById('pause-btn').style.display     = 'none';
  document.getElementById('reset-btn').style.display     = 'none';
  document.getElementById('gantt-panel').style.display   = 'none';
  document.getElementById('results-panel').style.display = 'none';
  document.getElementById('gantt-container').innerHTML   = '';
  const cursor = document.getElementById('time-cursor');
  if (cursor) cursor.style.opacity = '0';
  if (!silent) setStatus('idle', 'Listo');
}

function updateSpeed() {
  const v = document.getElementById('speed').value;
  document.getElementById('speed-label').textContent = '×' + v;
}

// ──── UTILIDADES ───────────────────────────
function setStatus(state, text) {
  const dot  = document.getElementById('status-dot');
  const txt  = document.getElementById('status-text');
  const pill = document.getElementById('status-pill');
  if (!dot || !txt || !pill) return;
  txt.textContent = text;
  dot.className   = 'status-dot' + (state === 'running' ? ' running' : '');
  pill.style.background = state === 'running' ? 'var(--mint-light)' : 'var(--pink-light)';
  pill.style.color      = state === 'running' ? 'var(--mint-deep)'  : 'var(--pink-deep)';
}

// Toast notification
function showToast(msg, type = 'ok') {
  const old = document.getElementById('_toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = '_toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
    background: type === 'ok' ? 'var(--mint-light)' : 'var(--peach-light)',
    color:      type === 'ok' ? 'var(--mint-deep)'  : 'var(--peach-deep)',
    border:     `1.5px solid ${type === 'ok' ? 'var(--mint)' : '#fde68a'}`,
    padding: '.7rem 1.2rem', borderRadius: '999px',
    fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: '.85rem',
    boxShadow: '0 4px 20px rgba(0,0,0,.12)', zIndex: '9999',
    animation: 'slideIn .3s ease',
    pointerEvents: 'none',
  });
  document.body.appendChild(t);
  const style = document.createElement('style');
  style.textContent = `@keyframes slideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`;
  document.head.appendChild(style);
  setTimeout(() => t.remove(), 3000);
}

// Drag & drop sobre la zona de archivo
const fileDrop = document.getElementById('fileDrop');
if (fileDrop) {
  fileDrop.addEventListener('dragover', e => {
    e.preventDefault();
    fileDrop.style.borderColor = 'var(--lavender-deep)';
    fileDrop.style.background  = '#ddd6fe';
  });
  fileDrop.addEventListener('dragleave', () => {
    fileDrop.style.borderColor = '';
    fileDrop.style.background  = '';
  });
  fileDrop.addEventListener('drop', e => {
    e.preventDefault();
    fileDrop.style.borderColor = '';
    fileDrop.style.background  = '';
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file], value: '' } };
    loadFile(fakeEvent);
  });
}
