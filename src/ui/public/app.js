// ===== State =====
let eventSource = null;
let reportData = null;
const stageOrder = ['scanning', 'hashing', 'lookup', 'classifying', 'copying', 'done'];

const CATEGORY_EMOJIS = {
  'client-side': '🖥️',
  'server-side': '🖧',
  'library': '📚',
  'gameplay': '🎮',
  'unknown': '❓',
};

const CATEGORY_COLORS = {
  'client-side': '#60a5fa',
  'server-side': '#f97316',
  'library': '#a78bfa',
  'gameplay': '#34d399',
  'unknown': '#64748b',
};

// ===== DOM Elements =====
const $ = (id) => document.getElementById(id);

const dom = {
  btnSplit: $('btnSplit'),
  inputPath: $('inputPath'),
  outputPath: $('outputPath'),
  concurrency: $('concurrency'),
  dryRun: $('dryRun'),
  connectionStatus: $('connectionStatus'),

  configSection: $('configSection'),
  progressSection: $('progressSection'),
  progressBar: $('progressBar'),
  progressPct: $('progressPct'),
  progressMessage: $('progressMessage'),

  resultsSection: $('resultsSection'),
  chartsSection: $('chartsSection'),
  tableSection: $('tableSection'),

  searchInput: $('searchInput'),
  filterCategory: $('filterCategory'),
  modTableBody: $('modTableBody'),
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  connectSSE();
  bindEvents();
});

// ===== Background Particles =====
function createParticles() {
  const container = $('particles');
  const colors = ['#60a5fa', '#a78bfa', '#34d399', '#f97316', '#22d3ee'];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = Math.random() * 4 + 2;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const duration = Math.random() * 20 + 15;
    const delay = Math.random() * 20;
    const left = Math.random() * 100;

    particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${left}%;
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
    `;

    container.appendChild(particle);
  }
}

// ===== SSE Connection =====
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/events');

  eventSource.onopen = () => {
    const dot = document.querySelector('.badge-dot');
    dot.classList.add('connected');
    dom.connectionStatus.textContent = 'Connected';
  };

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleProgress(data);
  };

  eventSource.onerror = () => {
    const dot = document.querySelector('.badge-dot');
    dot.classList.remove('connected');
    dom.connectionStatus.textContent = 'Reconnecting...';

    // Auto-reconnect
    setTimeout(() => connectSSE(), 3000);
  };
}

// ===== Event Bindings =====
function bindEvents() {
  dom.btnSplit.addEventListener('click', startSplit);
  dom.searchInput.addEventListener('input', filterTable);
  dom.filterCategory.addEventListener('change', filterTable);
}

// ===== Start Split =====
async function startSplit() {
  const input = dom.inputPath.value.trim();
  const output = dom.outputPath.value.trim();

  if (!input || !output) {
    shakeElement(dom.btnSplit);
    return;
  }

  dom.btnSplit.disabled = true;
  dom.progressSection.classList.remove('hidden');
  dom.progressSection.classList.remove('success', 'error');
  dom.resultsSection.classList.add('hidden');
  dom.chartsSection.classList.add('hidden');
  dom.tableSection.classList.add('hidden');

  // Reset stages
  document.querySelectorAll('.stage').forEach((s) => {
    s.classList.remove('active', 'done');
  });
  document.querySelectorAll('.stage-line').forEach((l) => {
    l.classList.remove('done');
  });

  try {
    await fetch('/api/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        output,
        dryRun: dom.dryRun.checked,
        format: 'both',
        concurrency: parseInt(dom.concurrency.value, 10) || 10,
      }),
    });
  } catch (err) {
    console.error('Failed to start split:', err);
    dom.btnSplit.disabled = false;
  }
}

// ===== Handle Progress Events =====
function handleProgress(event) {
  if (event.stage === 'connected') return;

  // Update progress bar
  dom.progressBar.style.width = `${event.percentage}%`;
  dom.progressPct.textContent = `${event.percentage}%`;
  dom.progressMessage.textContent = event.message;

  // Update stage indicators
  const currentIndex = stageOrder.indexOf(event.stage);
  if (currentIndex >= 0) {
    stageOrder.forEach((stage, i) => {
      const el = $(`stage-${stage}`);
      if (!el) return;

      if (i < currentIndex) {
        el.classList.remove('active');
        el.classList.add('done');
      } else if (i === currentIndex) {
        el.classList.add('active');
        el.classList.remove('done');
      } else {
        el.classList.remove('active', 'done');
      }
    });

    // Update stage lines
    const lines = document.querySelectorAll('.stage-line');
    lines.forEach((line, i) => {
      if (i < currentIndex) {
        line.classList.add('done');
      } else {
        line.classList.remove('done');
      }
    });
  }

  // Handle completion
  if (event.stage === 'done') {
    dom.progressSection.classList.add('success');
    $('stage-done').classList.add('done');
    $('stage-done').classList.remove('active');

    // Mark all stages as done
    stageOrder.forEach((stage) => {
      const el = $(`stage-${stage}`);
      if (el) {
        el.classList.add('done');
        el.classList.remove('active');
      }
    });
    document.querySelectorAll('.stage-line').forEach((l) => l.classList.add('done'));

    dom.btnSplit.disabled = false;
    loadReport();
  }

  if (event.stage === 'error') {
    dom.progressSection.classList.add('error');
    dom.btnSplit.disabled = false;
  }
}

// ===== Load Report =====
async function loadReport() {
  try {
    const res = await fetch('/api/report');
    if (!res.ok) return;
    reportData = await res.json();
    renderResults(reportData);
  } catch (err) {
    console.error('Failed to load report:', err);
  }
}

// ===== Render Results =====
function renderResults(data) {
  // Summary cards
  $('countClientSide').textContent = data.summary['client-side'] || 0;
  $('countServerSide').textContent = data.summary['server-side'] || 0;
  $('countLibrary').textContent = data.summary['library'] || 0;
  $('countGameplay').textContent = data.summary['gameplay'] || 0;
  $('countUnknown').textContent = data.summary['unknown'] || 0;

  dom.resultsSection.classList.remove('hidden');

  // Info card
  $('infoTotal').textContent = data.totalMods;
  $('infoDuration').textContent = `${(data.duration / 1000).toFixed(1)}s`;
  $('infoLoaders').textContent = data.detectedLoaders.join(', ') || '—';
  const versions = data.detectedGameVersions.slice(0, 5);
  $('infoVersions').textContent = versions.join(', ') +
    (data.detectedGameVersions.length > 5 ? ` (+${data.detectedGameVersions.length - 5})` : '') || '—';

  dom.chartsSection.classList.remove('hidden');

  // Draw pie chart
  drawPieChart(data.summary, data.totalMods);

  // Mod table
  renderTable(data.mods);
  dom.tableSection.classList.remove('hidden');
}

// ===== Pie Chart (Canvas) =====
function drawPieChart(summary, total) {
  const canvas = $('pieChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = 300 * dpr;
  canvas.height = 300 * dpr;
  canvas.style.width = '300px';
  canvas.style.height = '300px';
  ctx.scale(dpr, dpr);

  const cx = 150;
  const cy = 150;
  const radius = 110;
  const innerRadius = 60;

  const categories = ['client-side', 'server-side', 'library', 'gameplay', 'unknown'];
  const data = categories.map((cat) => ({
    category: cat,
    count: summary[cat] || 0,
    color: CATEGORY_COLORS[cat],
    emoji: CATEGORY_EMOJIS[cat],
  })).filter((d) => d.count > 0);

  // Clear
  ctx.clearRect(0, 0, 300, 300);

  if (data.length === 0) return;

  // Draw donut
  let startAngle = -Math.PI / 2;

  for (const slice of data) {
    const sliceAngle = (slice.count / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = slice.color;
    ctx.fill();

    // Label
    if (sliceAngle > 0.3) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = (radius + innerRadius) / 2;
      const lx = cx + Math.cos(midAngle) * labelRadius;
      const ly = cy + Math.sin(midAngle) * labelRadius;

      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const pct = Math.round((slice.count / total) * 100);
      ctx.fillText(`${pct}%`, lx, ly);
    }

    startAngle = endAngle;
  }

  // Center text
  ctx.font = '800 28px Inter, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);

  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('MODS', cx, cy + 14);

  // Legend
  const legendStartY = 280;
  const legendX = 10;
  const itemWidth = 300 / data.length;

  data.forEach((d, i) => {
    const x = legendX + i * itemWidth + itemWidth / 2;
    // dot
    ctx.beginPath();
    ctx.arc(x - 15, legendStartY, 4, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    // text
    ctx.font = '500 9px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`${d.count}`, x - 8, legendStartY + 3);
  });
}

// ===== Render Table =====
function renderTable(mods) {
  dom.modTableBody.innerHTML = '';

  mods.forEach((mod, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.category = mod.category;
    tr.dataset.name = (mod.projectTitle || mod.filename).toLowerCase();

    const icon = mod.iconUrl
      ? `<img class="mod-icon" src="${mod.iconUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="mod-icon" style="display:flex;align-items:center;justify-content:center;font-size:0.7rem">${CATEGORY_EMOJIS[mod.category] || '📦'}</div>`;

    const name = mod.projectTitle || mod.filename.replace('.jar', '');
    const loaders = (mod.loaders || []).map((l) => `<span class="loader-badge">${l}</span>`).join('') || '—';
    const link = mod.modrinthUrl
      ? `<a href="${mod.modrinthUrl}" target="_blank" class="link-btn">🔗 Modrinth</a>`
      : '<span style="color:var(--text-muted)">—</span>';

    tr.innerHTML = `
      <td style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem">${idx + 1}</td>
      <td>
        <div class="mod-name-cell">
          ${icon}
          <div>
            <div class="mod-name">${escapeHtml(name)}</div>
            <div class="mod-filename">${escapeHtml(mod.filename)}</div>
          </div>
        </div>
      </td>
      <td><span class="category-badge ${mod.category}">${CATEGORY_EMOJIS[mod.category] || ''} ${mod.category}</span></td>
      <td style="font-family:var(--font-mono);font-size:0.8rem;white-space:nowrap">${mod.sizeFormatted}</td>
      <td>${loaders}</td>
      <td>${link}</td>
    `;

    dom.modTableBody.appendChild(tr);
  });
}

// ===== Filter Table =====
function filterTable() {
  const search = dom.searchInput.value.toLowerCase();
  const category = dom.filterCategory.value;

  const rows = dom.modTableBody.querySelectorAll('tr');
  rows.forEach((row) => {
    const matchesSearch = !search || row.dataset.name.includes(search);
    const matchesCategory = category === 'all' || row.dataset.category === category;
    row.style.display = matchesSearch && matchesCategory ? '' : 'none';
  });
}

// ===== Utilities =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight; // trigger reflow
  el.style.animation = 'shake 0.5s ease-in-out';
  setTimeout(() => { el.style.animation = ''; }, 500);

  // Add shake keyframes if not exists
  if (!document.getElementById('shake-style')) {
    const style = document.createElement('style');
    style.id = 'shake-style';
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }
    `;
    document.head.appendChild(style);
  }
}
