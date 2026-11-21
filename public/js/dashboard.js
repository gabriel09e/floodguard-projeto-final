const API_BASE = '';
const REFRESH_INTERVAL = 1000;

const STATUS = {
  normal: { label: 'Seguro', color: '#25a85b' },
  atencao: { label: 'Atenção', color: '#1769ff' },
  alerta: { label: 'Alerta', color: '#f6a313' },
  evacuacao: { label: 'Evacuação', color: '#e7474f' }
};

const LIMITS = {
  atencao: 5,
  alerta: 10,
  evacuacao: 15
};

let token = sessionStorage.getItem('floodguard_token');
let user = JSON.parse(sessionStorage.getItem('floodguard_user') || 'null');
let devices = [];
let readings = [];
let refreshTimer = null;
let currentRange = 15;
let currentDeviceId = 'all';
let dashboardDeviceId = null;
let dashboardSummary = null;
let lastAlertReadingKey = null;
let map = null;
let mapMarkers = null;
let mapCircle = null;
let editingDeviceId = null;
let mapMarker = null;

const $ = id => document.getElementById(id);

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  updateDate();

  if (token) {
    showApp();
    loadDashboard();
  } else {
    showLogin();
  }
});

function bindEvents() {
  $('login-form')?.addEventListener('submit', login);
  $('user-avatar')?.addEventListener('click', toggleProfileMenu);
  $('profile-logout')?.addEventListener('click', logout);
  document.addEventListener('click', closeProfileMenuOnOutside);
  $('device-add')?.addEventListener('click', () => openDeviceForm());
  $('device-cancel')?.addEventListener('click', closeDeviceForm);
  $('device-form')?.addEventListener('submit', saveDevice);
  $('history-refresh')?.addEventListener('click', loadDashboard);
  $('dashboard-device-filter')?.addEventListener('change', event => {
    dashboardDeviceId = event.target.value || null;
    renderEverything();
    updateMap();
  });
  $('station-cards')?.addEventListener('click', event => {
    const card = event.target.closest('[data-station-id]');
    if (!card) return;
    dashboardDeviceId = card.dataset.stationId;
    const select = $('dashboard-device-filter');
    if (select) select.value = dashboardDeviceId;
    renderEverything();
    updateMap();
  });
  $('history-device-filter')?.addEventListener('change', event => {
    currentDeviceId = event.target.value || 'all';
    renderCharts();
    renderHistoryTable();
  });
  $('simulation-form')?.addEventListener('submit', simulateReading);
  document.querySelectorAll('[data-sim-height]').forEach(button => {
    button.addEventListener('click', () => {
      const height = Number(button.dataset.simHeight);
      if ($('simulation-height')) $('simulation-height').value = height;
      if ($('simulation-trend')) $('simulation-trend').value = height < 5 ? 'estavel' : 'subindo';
    });
  });

  document.querySelectorAll('.nav-item[data-view]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  document.querySelectorAll('[data-view-target]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.viewTarget));
  });

  document.querySelectorAll('[data-range]').forEach(button => {
    button.addEventListener('click', () => {
      currentRange = Number(button.dataset.range);
      document.querySelectorAll('[data-range]').forEach(item => {
        item.classList.toggle('active', Number(item.dataset.range) === currentRange);
      });
      renderCharts();
    });
  });
}

function showLogin() {
  $('login-screen').hidden = false;
  $('app-shell').hidden = true;
  clearInterval(refreshTimer);
}

function showApp() {
  $('login-screen').hidden = true;
  $('app-shell').hidden = false;
  const name = user?.nome || user?.email || 'Mateus';
  $('user-avatar').textContent = name.trim().charAt(0).toUpperCase();
  renderProfile();
  renderDeviceManagement();
  renderHistoryDeviceFilter();
  renderSimulationDevices();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadDashboard, REFRESH_INTERVAL);
  setTimeout(setupMap, 50);
}

async function login(event) {
  event.preventDefault();
  const button = $('login-submit');
  const error = $('login-error');
  error.hidden = true;
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

  try {
    const email = $('login-email').value.trim();
    const senha = $('login-password').value;
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.token) {
      throw new Error(data.mensagem || 'Não foi possível entrar. Confira o e-mail e a senha.');
    }

    token = data.token;
    user = data.usuario || { email };
    sessionStorage.setItem('floodguard_token', token);
    sessionStorage.setItem('floodguard_user', JSON.stringify(user));

    showApp();
    await loadDashboard();
  } catch (error) {
    errorMessage(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Entrar no painel <i class="fa-solid fa-arrow-right"></i>';
  }
}

function renderProfile() {
  const role = user?.perfil === 'ADMIN' ? 'Administrador' : 'Operador';
  if ($('profile-name')) $('profile-name').textContent = user?.nome || user?.email || 'Usuário';
  if ($('profile-role')) $('profile-role').textContent = role;
}

function toggleProfileMenu(event) {
  event.stopPropagation();
  const menu = $('profile-menu');
  if (menu) menu.hidden = !menu.hidden;
}

function closeProfileMenuOnOutside(event) {
  const wrap = document.querySelector('.profile-wrap');
  const menu = $('profile-menu');
  if (menu && wrap && !wrap.contains(event.target)) menu.hidden = true;
}

function logout() {
  token = null;
  user = null;
  sessionStorage.removeItem('floodguard_token');
  sessionStorage.removeItem('floodguard_user');
  showLogin();
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    throw new Error(`Falha ao consultar ${path}: HTTP ${response.status}`);
  }

  return response.json();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      logout();
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    throw new Error(data.mensagem || `Falha na operação: HTTP ${response.status}`);
  }
  return data;
}

async function loadDashboard() {
  if (!token) return;

  $('api-chip')?.classList.add('loading');

  try {
    const result = await Promise.all([
      apiGet('/dispositivos'),
      apiGet('/leituras'),
      apiGet('/dashboard/resumo')
    ]);

    devices = Array.isArray(result[0]) ? result[0] : [];
    if (!dashboardDeviceId && devices.length) {
      const active = devices.find(device => device.ativo) || devices[0];
      dashboardDeviceId = String(active.id);
    }
    const previousLatest = latestReading();
    readings = Array.isArray(result[1]) ? result[1] : [];
    dashboardSummary = result[2] || null;

    setOnline(true);
    renderEverything();
    checkRealtimeAlert(previousLatest);
  } catch (error) {
    setOnline(false);
    showToast(error.message);
  } finally {
    $('api-chip')?.classList.remove('loading');
  }
}

function renderEverything() {
  safeRender(renderStations);
  safeRender(renderDashboardDeviceFilter);
  safeRender(renderHero);
  safeRender(renderScore);
  safeRender(renderTimeLevels);
  safeRender(renderEvents);
  safeRender(renderRecent);
  safeRender(renderAnalysis);
  safeRender(renderSystem);
  safeRender(renderCharts);
  safeRender(renderHistoryTable);
  safeRender(renderHistoryDeviceFilter);
  safeRender(renderDeviceManagement);
  safeRender(renderSimulationDevices);
  safeRender(renderAlerts);
  safeRender(updateNavCount);
  safeRender(updateMap);
}

function safeRender(fn) {
  try {
    fn();
  } catch (error) {
    console.error(`FloodGuard: erro em ${fn.name}`, error);
  }
}

function setOnline(online) {
  const chip = $('api-chip');
  if (!chip) return;
  chip.classList.toggle('online', online);
  chip.innerHTML = online
    ? '<i class="fa-solid fa-wifi"></i><b>Sistema Online</b>'
    : '<i class="fa-solid fa-triangle-exclamation"></i><b>API Indisponível</b>';

  if ($('system-last-update')) {
    $('system-last-update').textContent = new Date().toLocaleTimeString('pt-BR');
  }

  const sistema = dashboardSummary?.sistema || {};
  const mqttActive = sistema.mqtt === true;
  const espActive = sistema.online === true && devices.some(device => device.ativo !== false);
  setComponentChip('esp-chip', online && espActive);
  setComponentChip('mqtt-chip', online && mqttActive);
  setComponentChip('db-chip', online);
}

function setComponentChip(id, connected) {
  const chip = $(id);
  if (!chip) return;
  chip.classList.toggle('offline', !connected);
  const status = chip.querySelector('em');
  const dot = chip.querySelector('span');
  if (status) status.textContent = connected ? 'Conectado' : 'Aguardando';
  if (dot) dot.style.background = connected ? 'var(--green)' : 'var(--muted)';
}

function validReadings() {
  return readings
    .filter(item => Number.isFinite(Number(item.altura)) && Number.isFinite(new Date(item.data).getTime()))
    .slice()
    .sort((a, b) => new Date(a.data) - new Date(b.data));
}

function heightCm(value) {
  return Number(value);
}

function latestReading() {
  return dashboardReadings().at(-1) || null;
}

function statusFromLevel(level) {
  if (level >= LIMITS.evacuacao) return 'evacuacao';
  if (level >= LIMITS.alerta) return 'alerta';
  if (level >= LIMITS.atencao) return 'atencao';
  return 'normal';
}

function normalizeStatus(item) {
  const level = heightCm(item.altura);
  return statusFromLevel(level);
}

function statusInfo(status) {
  return STATUS[status] || STATUS.normal;
}

function calcSpeed() {
  const data = dashboardReadings().slice(-10);
  if (data.length < 2) return 0;

  const t0 = new Date(data[0].data).getTime();
  const points = data.map(item => ({
    x: (new Date(item.data).getTime() - t0) / 60000,
    y: heightCm(item.altura)
  }));

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const numerator = points.reduce((sum, p) => sum + (p.x - meanX) * (p.y - meanY), 0);
  const denominator = points.reduce((sum, p) => sum + (p.x - meanX) ** 2, 0);
  return denominator > 0 ? numerator / denominator : 0;
}

function riskScore(level) {
  const critical = LIMITS.evacuacao;
  return Math.max(0, Math.min(100, Math.round((level / critical) * 100)));
}

function estimateCritical(level, speed, trend) {
  if (level >= LIMITS.evacuacao) return '0 min';
  if (trend !== 'subindo' || speed <= 0) return '--';

  const minutes = (LIMITS.evacuacao - level) / speed;

  if (!Number.isFinite(minutes) || minutes <= 0) return '--';

  // Previsões muito longas com poucas leituras não são confiáveis.
  if (minutes > 1440) return 'sem previsão confiável';

  return minutes < 1 ? '< 1 min' : `${Math.ceil(minutes)} min`;
}

function renderDashboardDeviceFilter() {
  const select = $('dashboard-device-filter');
  if (!select) return;

  if (!dashboardDeviceId && devices.length) {
    const active = devices.find(device => device.ativo) || devices[0];
    dashboardDeviceId = String(active.id);
  }

  if (!devices.length) {
    select.innerHTML = '<option value="">Nenhum dispositivo cadastrado</option>';
    return;
  }

  select.innerHTML = devices.map(device =>
    `<option value="${escapeHtml(String(device.id))}">${escapeHtml(device.nome || device.device_id)} · ${escapeHtml(device.device_id || '')}</option>`
  ).join('');

  if (dashboardDeviceId && devices.some(device => String(device.id) === String(dashboardDeviceId))) {
    select.value = String(dashboardDeviceId);
  }

  const device = devices.find(item => String(item.id) === String(dashboardDeviceId));
  const subtitle = $('station-overview-subtitle');

  if (subtitle) {
    subtitle.textContent = device
      ? `Detalhamento atual: ${device.nome || device.device_id} · ${device.device_id}`
      : 'Visão geral de todos os dispositivos';
  }
}

function renderHero() {
  const reading = latestReading();
  if (!reading) {
    $('current-level').textContent = '--';
    $('current-status').textContent = '--';
    $('current-speed').textContent = '--';
    $('critical-time').textContent = '--';
    return;
  }

  const level = heightCm(reading.altura);
  const status = statusInfo(normalizeStatus(reading));
  const speed = calcSpeed();
  const trend = reading.tendencia || (speed > 0.05 ? 'subindo' : speed < -0.05 ? 'descendo' : 'estavel');
  const date = new Date(reading.data);

  $('current-level').textContent = `${level.toFixed(1)} cm`;
  $('current-status').textContent = status.label;
  $('current-status').style.color = status.color;
  $('risk-description').textContent = riskDescription(normalizeStatus(reading));
  $('level-updated').textContent = `Atualizado às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  $('current-speed').textContent = `${speed >= 0 ? '+' : ''}${speed.toFixed(2)} cm/min`;
  $('trend-description').textContent = speed > 1 ? 'Subida acelerada' : speed > 0.05 ? 'Subindo' : speed < -0.05 ? 'Descendo' : 'Estável';
  $('critical-time').textContent = estimateCritical(level, speed, trend);
  $('critical-description').textContent = trend === 'subindo' && speed > 0 ? 'até o nível crítico (≥ 15 cm)' : 'sem previsão de subida';
}

function riskDescription(status) {
  return {
    normal: 'Nível dentro da faixa segura',
    atencao: 'Monitoramento reforçado',
    alerta: 'Nível elevado',
    evacuacao: 'Nível crítico'
  }[status] || 'Aguardando dados';
}

function renderScore() {
  const reading = latestReading();
  const level = reading ? heightCm(reading.altura) : 0;
  const score = riskScore(level);
  const label = score >= 80 ? 'Risco Muito Alto' : score >= 60 ? 'Alto Risco' : score >= 35 ? 'Risco Moderado' : 'Baixo Risco';

  $('risk-score').textContent = score;
  $('risk-score-label').textContent = label;
  $('analysis-score').textContent = `${score}/100`;
  $('analysis-score-text').textContent = label;

  const degrees = score * 3.6;
  $('score-ring').style.background = `conic-gradient(var(--blue) 0deg, var(--purple) ${Math.max(1, degrees * .65)}deg, #dfe7f1 ${degrees}deg 360deg)`;
}

function dashboardReadings() {
  const all = validReadings();
  if (!dashboardDeviceId) return all;
  return all.filter(item =>
    String(item.dispositivo_id) === String(dashboardDeviceId) ||
    String(item.dispositivo?.id) === String(dashboardDeviceId) ||
    String(item.dispositivo?.device_id) === String(dashboardDeviceId) ||
    String(item.device_id) === String(dashboardDeviceId)
  );
}

function dashboardRangeFilteredReadings() {
  const all = dashboardReadings();
  if (!all.length || currentRange === 0) return all;
  const cutoff = Date.now() - currentRange * 60000;
  return all.filter(item => new Date(item.data).getTime() >= cutoff);
}

function latestReadingForDevice(device) {
  const related = validReadings().filter(item =>
    String(item.dispositivo_id) === String(device.id) ||
    String(item.dispositivo?.id) === String(device.id) ||
    String(item.dispositivo?.device_id) === String(device.device_id) ||
    String(item.device_id) === String(device.device_id)
  );
  return related.at(-1) || null;
}

function rangeFilteredReadings() {
  const all = validReadings();
  if (!all.length || currentRange === 0) return all;
  const cutoff = Date.now() - currentRange * 60000;
  return all.filter(item => new Date(item.data).getTime() >= cutoff);
}

function filteredReadings() {
  let all = rangeFilteredReadings();
  if (currentDeviceId !== 'all') {
    all = all.filter(item => String(item.dispositivo_id) === String(currentDeviceId) || String(item.dispositivo?.id) === String(currentDeviceId));
  }
  return all;
}

function renderHistoryDeviceFilter() {
  const select = $('history-device-filter');
  if (!select) return;
  const previous = currentDeviceId;
  select.innerHTML = '<option value="all">Todos os dispositivos</option>' + devices.map(device =>
    `<option value="${Number(device.id)}">${escapeHtml(device.nome || device.device_id)} (${escapeHtml(device.device_id || '')})</option>`
  ).join('');
  select.value = devices.some(device => String(device.id) === String(previous)) ? previous : 'all';
  currentDeviceId = select.value;
}

function renderSimulationDevices() {
  const select = $('simulation-device');
  const wrap = $('simulation-panel');

  if (!select || !wrap) return;

  wrap.hidden = !isAdmin();
  if (!isAdmin()) return;

  // Guarda o dispositivo atualmente selecionado
  const previousDeviceId = select.value;

  const activeDevices = devices.filter(device => device.ativo !== false);

  select.innerHTML = activeDevices.map(device =>
    `<option value="${escapeHtml(device.device_id)}">${escapeHtml(device.nome || device.device_id)} (${escapeHtml(device.device_id)})</option>`
  ).join('');

  if (!select.options.length) {
    select.innerHTML = '<option value="">Nenhum dispositivo ativo</option>';
    return;
  }

  // Mantém o dispositivo que o usuário escolheu
  if (activeDevices.some(device => device.device_id === previousDeviceId)) {
    select.value = previousDeviceId;
  } else {
    select.value = activeDevices[0].device_id;
  }
}

async function simulateReading(event) {
  event.preventDefault();
  if (!isAdmin()) return showToast('Somente administradores podem usar o simulador.');

  const deviceId = $('simulation-device')?.value;
  const altura = Number($('simulation-height')?.value);
  const tendencia = $('simulation-trend')?.value || 'subindo';
  const selected = devices.find(device => device.device_id === deviceId);
  const related = validReadings().filter(item => item.dispositivo_id === selected?.id || item.dispositivo?.device_id === deviceId);
  const last = related.at(-1);
  const distancia = Number.isFinite(Number(last?.distancia)) ? Number(last.distancia) : 0;

  if (!deviceId || !Number.isFinite(altura) || altura < 0) {
    return showToast('Informe um nível válido e selecione um dispositivo.');
  }

  try {
    await apiRequest('/simulacao', {
      method: 'POST',
      body: JSON.stringify({
        device_id: deviceId,
        altura,
        distancia,
        tendencia,
        data: new Date().toISOString()
      })
    });
    showToast(`Simulação registrada: ${altura.toFixed(1)} cm.`);
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function checkRealtimeAlert(previousLatest) {
  const latest = latestReading();
  if (!latest) return;
  const key = `${latest.id ?? ''}-${latest.data}-${latest.altura}`;
  if (lastAlertReadingKey === null) {
    lastAlertReadingKey = key;
    return;
  }
  if (key === lastAlertReadingKey) return;
  lastAlertReadingKey = key;

  const status = normalizeStatus(latest);
  const sameDevicePrevious = previousLatest && (
    String(previousLatest.dispositivo_id ?? '') === String(latest.dispositivo_id ?? '') ||
    String(previousLatest.dispositivo?.device_id ?? '') === String(latest.dispositivo?.device_id ?? '')
  );
  const previousStatus = sameDevicePrevious ? normalizeStatus(previousLatest) : 'normal';
  const severity = { normal: 0, atencao: 1, alerta: 2, evacuacao: 3 };

  if (severity[status] >= 2 && severity[status] > severity[previousStatus]) {
    const info = statusInfo(status);
    const message = status === 'evacuacao'
      ? `EVACUAÇÃO: nível crítico de ${heightCm(latest.altura).toFixed(1)} cm atingido.`
      : `ALERTA: nível de ${heightCm(latest.altura).toFixed(1)} cm atingiu ${info.label}.`;
    showToast(message);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`FloodGuard • ${info.label}`, { body: message });
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

function renderCharts() {
  renderSvgChart('level-chart', dashboardRangeFilteredReadings(), false);
  renderSvgChart('history-chart', filteredReadings(), true);
  renderMiniSvgChart('prediction-chart', dashboardReadings().slice(-12), '#6b4de6');
  renderMiniSvgChart('speed-chart', validReadings().slice(-10).map((item, index, arr) => ({
    data: item.data,
    value: index ? (heightCm(item.altura) - heightCm(arr[index - 1].altura)) : 0
  })), '#6b4de6');

  const data = filteredReadings();
  if ($('history-max')) $('history-max').textContent = data.length ? `${Math.max(...data.map(r => heightCm(r.altura))).toFixed(1)} cm` : '--';
  if ($('history-min')) $('history-min').textContent = data.length ? `${Math.min(...data.map(r => heightCm(r.altura))).toFixed(1)} cm` : '--';
  if ($('history-avg')) $('history-avg').textContent = data.length ? `${(data.reduce((s, r) => s + heightCm(r.altura), 0) / data.length).toFixed(1)} cm` : '--';
  if ($('history-count')) $('history-count').textContent = data.length;

  renderPredictionText();
  renderSpeedText();
}

function renderHistoryTable() {
  const body = $('history-readings');
  if (!body) return;

  const data = filteredReadings().slice().reverse();
  const total = validReadings().length;
  if ($('history-total')) $('history-total').textContent = `${total} leitura${total === 1 ? '' : 's'} no histórico`;

  if (!data.length) {
    body.innerHTML = '<tr><td colspan="6">Nenhuma leitura encontrada neste período.</td></tr>';
    return;
  }

  body.innerHTML = data.map(item => {
    const info = statusInfo(normalizeStatus(item));
    const device = item.dispositivo?.device_id || devices.find(d => d.id === item.dispositivo_id)?.device_id || '--';
    const distance = Number.isFinite(Number(item.distancia)) ? `${Number(item.distancia).toFixed(1)} cm` : '--';
    const trend = item.tendencia === 'subindo' ? 'Subindo' : item.tendencia === 'descendo' ? 'Descendo' : 'Estável';
    return `<tr><td>${new Date(item.data).toLocaleString('pt-BR')}</td><td>${escapeHtml(device)}</td><td>${distance}</td><td><b>${heightCm(item.altura).toFixed(1)} cm</b></td><td>${trend}</td><td><span class="status-pill" style="color:${info.color};background:${info.color}18">${info.label}</span></td></tr>`;
  }).join('');
}

function renderSvgChart(id, data, full) {
  const canvas = $(id);
  if (!canvas) return;

  const box = canvas.parentElement;

  if (!data.length) {
    if (id === 'level-chart') {
      $('chart-empty').hidden = false;
    }
    return;
  }

  if (id === 'level-chart') {
    $('chart-empty').hidden = true;
  }

  const width = Math.max(420, box.clientWidth || 700);
  const height = full ? 400 : 250;

  const padding = {
    left: 46,
    right: full ? 22 : 112,
    top: 18,
    bottom: 34
  };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = data.map(item =>
    Number(item.value ?? heightCm(item.altura))
  );

  const max = Math.max(
    LIMITS.evacuacao * 1.15,
    Math.ceil(Math.max(...values, LIMITS.evacuacao) / 5) * 5
  );

  const min = 0;

  const x = i =>
    padding.left +
    (data.length === 1
      ? plotW / 2
      : (i / (data.length - 1)) * plotW);

  const y = value =>
    padding.top +
    plotH -
    ((value - min) / (max - min)) * plotH;

  const points = data.map((item, i) => [
    x(i),
    y(heightCm(item.altura))
  ]);

  const line = points
    .map((p, i) =>
      `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
    )
    .join(' ');

  const area = `
    ${line}
    L ${points.at(-1)[0]} ${padding.top + plotH}
    L ${points[0][0]} ${padding.top + plotH}
    Z
  `;

  const grid = [0, max / 4, max / 2, max * .75, max]
    .map(v => `
      <line
        x1="${padding.left}"
        y1="${y(v)}"
        x2="${width - padding.right}"
        y2="${y(v)}"
        stroke="#e7eef6"
      />

      <text
        x="${padding.left - 8}"
        y="${y(v) + 4}"
        text-anchor="end"
        font-size="10"
        fill="#71809a"
      >
        ${v.toFixed(0)}
      </text>
    `)
    .join('');

  const thresholdLines = [
    [LIMITS.atencao, '#1769ff', 'Atenção'],
    [LIMITS.alerta, '#f6a313', 'Alerta'],
    [LIMITS.evacuacao, '#e7474f', 'Evacuação']
  ]
    .map(([value, color, label]) => `
      <line
        x1="${padding.left}"
        y1="${y(value)}"
        x2="${width - padding.right}"
        y2="${y(value)}"
        stroke="${color}"
        stroke-width="1.5"
        stroke-dasharray="6 5"
        opacity=".8"
      />

      ${
        full
          ? `
            <text
              x="${width - padding.right - 4}"
              y="${y(value) - 5}"
              text-anchor="end"
              font-size="10"
              font-weight="700"
              fill="${color}"
            >
              ${label} (${value.toFixed(1)} cm)
            </text>
          `
          : ''
      }
    `)
    .join('');

  /*
   * Tooltip único do gráfico.
   * Ele fica escondido até o usuário passar o mouse
   * sobre um dos pontos.
   */
  const tooltip = `
    <g
      id="${id}-tooltip"
      class="chart-tooltip"
      visibility="hidden"
      pointer-events="none"
    >
      <rect
        class="chart-tooltip-bg"
        x="0"
        y="0"
        width="190"
        height="112"
        rx="10"
        fill="#172033"
        opacity=".96"
      />

      <text
        class="chart-tooltip-date"
        x="12"
        y="20"
        font-size="11"
        font-weight="700"
        fill="#ffffff"
      ></text>

      <text
        class="chart-tooltip-level"
        x="12"
        y="42"
        font-size="11"
        fill="#ffffff"
      ></text>

      <text
        class="chart-tooltip-distance"
        x="12"
        y="61"
        font-size="11"
        fill="#ffffff"
      ></text>

      <text
        class="chart-tooltip-trend"
        x="12"
        y="80"
        font-size="11"
        fill="#ffffff"
      ></text>

      <text
        class="chart-tooltip-status"
        x="12"
        y="99"
        font-size="11"
        font-weight="700"
        fill="#ffffff"
      ></text>
    </g>
  `;

  /*
   * Pontos do gráfico.
   */
  const circles = points
    .map(([px, py], i) => {
      const item = data[i];
      const date = new Date(item.data);

      const dateText = date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const level = heightCm(item.altura);

      const distance = Number.isFinite(Number(item.distancia))
        ? `${Number(item.distancia).toFixed(1)} cm`
        : '--';

      const trend =
        item.tendencia === 'subindo'
          ? 'Subindo'
          : item.tendencia === 'descendo'
            ? 'Descendo'
            : 'Estável';

      const status = statusInfo(normalizeStatus(item));

      return `
        <circle
          cx="${px}"
          cy="${py}"
          r="5"
          fill="#ffffff"
          stroke="#1769ff"
          stroke-width="2"
          class="chart-point"
          data-tooltip-date="${escapeHtml(dateText)}"
          data-tooltip-level="${escapeHtml(level.toFixed(1) + ' cm')}"
          data-tooltip-distance="${escapeHtml(distance)}"
          data-tooltip-trend="${escapeHtml(trend)}"
          data-tooltip-status="${escapeHtml(status.label)}"
          data-tooltip-color="${escapeHtml(status.color)}"
        />
      `;
    })
    .join('');

  /*
   * Horários continuam no eixo X.
   * A data completa aparece no tooltip.
   */
  const labelsX = data
    .map((item, i) => {
      if (
        i % Math.max(1, Math.ceil(data.length / 6)) !== 0 &&
        i !== data.length - 1
      ) {
        return '';
      }

      const d = new Date(item.data);

      return `
        <text
          x="${x(i)}"
          y="${height - 10}"
          text-anchor="middle"
          font-size="10"
          fill="#71809a"
        >
          ${d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </text>
      `;
    })
    .join('');

  const svg = `
    <svg
      class="data-svg"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="none"
      role="img"
      aria-label="Histórico do nível da água"
    >
      ${grid}
      ${thresholdLines}

      <path
        d="${area}"
        fill="rgba(23,105,255,.12)"
      />

      <path
        d="${line}"
        fill="none"
        stroke="#1769ff"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${circles}
      ${labelsX}
      ${tooltip}
    </svg>
  `;

  canvas.outerHTML = `
    <div id="${id}" class="svg-chart-host">
      ${svg}
    </div>
  `;

  /*
   * Interação do tooltip.
   */
  const chart = $(id);
  if (!chart) return;

  const tooltipElement = chart.querySelector(`#${id}-tooltip`);

  chart.querySelectorAll('.chart-point').forEach(point => {
    point.addEventListener('mouseenter', () => {
      if (!tooltipElement) return;

      const px = Number(point.getAttribute('cx'));
      const py = Number(point.getAttribute('cy'));

      const tooltipWidth = 190;
      const tooltipHeight = 112;

      let tooltipX = px + 12;
      let tooltipY = py - tooltipHeight - 12;

      if (tooltipX + tooltipWidth > width) {
        tooltipX = px - tooltipWidth - 12;
      }

      if (tooltipY < 5) {
        tooltipY = py + 12;
      }

      tooltipElement.setAttribute(
        'transform',
        `translate(${tooltipX}, ${tooltipY})`
      );

      tooltipElement.setAttribute('visibility', 'visible');

      const dateText = tooltipElement.querySelector('.chart-tooltip-date');
      const levelText = tooltipElement.querySelector('.chart-tooltip-level');
      const distanceText = tooltipElement.querySelector('.chart-tooltip-distance');
      const trendText = tooltipElement.querySelector('.chart-tooltip-trend');
      const statusText = tooltipElement.querySelector('.chart-tooltip-status');

      if (dateText) {
        dateText.textContent = point.dataset.tooltipDate;
      }

      if (levelText) {
        levelText.textContent = `Nível: ${point.dataset.tooltipLevel}`;
      }

      if (distanceText) {
        distanceText.textContent = `Distância: ${point.dataset.tooltipDistance}`;
      }

      if (trendText) {
        trendText.textContent = `Tendência: ${point.dataset.tooltipTrend}`;
      }

      if (statusText) {
        statusText.textContent = `Status: ${point.dataset.tooltipStatus}`;
        statusText.setAttribute(
          'fill',
          point.dataset.tooltipColor || '#ffffff'
        );
      }
    });

    point.addEventListener('mouseleave', () => {
      if (tooltipElement) {
        tooltipElement.setAttribute('visibility', 'hidden');
      }
    });
  });
}

function renderMiniSvgChart(id, data, color) {
  const canvas = $(id);
  if (!canvas || !data.length) return;
  const width = Math.max(160, canvas.parentElement?.clientWidth || 200);
  const height = 65;
  const values = data.map(item => Number(item.value ?? heightCm(item.altura)));
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const points = data.map((item, i) => {
    const px = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
    const py = height - ((Number(item.value ?? heightCm(item.altura)) - min) / (max - min)) * (height - 8) - 4;
    return [px, py];
  });
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ');
  canvas.outerHTML = `<svg id="${id}" class="mini-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" /></svg>`;
}

function renderPredictionText() {
  const latest = latestReading();
  const speed = calcSpeed();
  if (!latest) return;
  const level = heightCm(latest.altura);
  const trend = latest.tendencia || (speed > 0.05 ? 'subindo' : speed < -0.05 ? 'descendo' : 'estavel');
  const minutes = trend === 'subindo' && speed > 0 ? (LIMITS.evacuacao - level) / speed : Infinity;
  const horizon = 8;
  const prediction = trend === 'subindo' && speed > 0 ? Math.min(LIMITS.evacuacao, level + speed * horizon) : level;
  const reliable = Number.isFinite(minutes) && minutes > 0 && minutes <= 1440;
  $('prediction-level').textContent = `${prediction.toFixed(1)} cm`;
  $('prediction-time').textContent = trend === 'subindo' && speed > 0 && minutes > 0
    ? (reliable ? `em ~${Math.ceil(minutes)} min para 15 cm` : 'sem previsão confiável')
    : 'sem tendência de subida';
  $('analysis-prediction').textContent = `${prediction.toFixed(1)} cm`;
  $('analysis-prediction-time').textContent = trend === 'subindo' && speed > 0
    ? (reliable ? `projeção linear em ${horizon} min` : 'previsão não confiável')
    : 'sem tendência';
}

function renderSpeedText() {
  const speed = calcSpeed();
  const text = `${speed >= 0 ? '+' : ''}${speed.toFixed(2)} cm/min`;
  $('speed-big').textContent = text;
  $('analysis-speed').textContent = text;
  const badge = speed > 1 ? 'Subida acelerada' : speed > .05 ? 'Subindo' : speed < -.05 ? 'Descendo' : 'Estável';
  $('speed-badge').textContent = badge;
  $('analysis-speed-text').textContent = badge;
  $('analysis-accelerated').textContent = speed > 1 ? 'SIM' : 'NÃO';
}

function renderTimeLevels() {
  const counts = { normal: 0, atencao: 0, alerta: 0, evacuacao: 0 };
  dashboardReadings().forEach(item => { const status = normalizeStatus(item); if (counts[status] !== undefined) counts[status] += 1; });
  const total = readings.length || 1;
  const values = [
    ['safe', 'normal'], ['att', 'atencao'], ['ale', 'alerta'], ['eva', 'evacuacao']
  ];
  values.forEach(([bar, status]) => {
    const percentage = Math.round((counts[status] / total) * 100);
    if ($(`bar-${bar}`)) $(`bar-${bar}`).style.width = `${percentage}%`;
    if ($(`pct-${bar}`)) $(`pct-${bar}`).textContent = `${percentage}%`;
  });
}

function renderEvents() {
  const sorted = dashboardReadings().slice().reverse();
  const list = $('events-list');
  if (!list) return;
  if (!sorted.length) {
    list.innerHTML = '<div class="empty-state">Nenhum evento registrado.</div>';
  } else {
    list.innerHTML = sorted.slice(0, 3).map(item => {
      const info = statusInfo(normalizeStatus(item));
      return `<div class="event-item"><div class="event-icon" style="color:${info.color};background:${info.color}18"><i class="fa-solid ${normalizeStatus(item) === 'normal' ? 'fa-circle-check' : normalizeStatus(item) === 'atencao' ? 'fa-water' : 'fa-triangle-exclamation'}"></i></div><div><strong>${info.label}</strong><small>Nível: ${heightCm(item.altura).toFixed(1)} cm</small></div><span>${new Date(item.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
    }).join('');
  }

  if ($('alert-timeline')) {
    $('alert-timeline').innerHTML = sorted.map(item => {
      const info = statusInfo(normalizeStatus(item));
      return `<div class="timeline-item"><i class="timeline-dot" style="background:${info.color}"></i><time>${new Date(item.data).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time><strong>${info.label} · ${heightCm(item.altura).toFixed(1)} cm</strong></div>`;
    }).join('');
  }
}

function renderRecent() {
  const body = $('recent-readings');
  if (!body) return;
  const data = dashboardReadings().slice(-5).reverse();
  body.innerHTML = data.length ? data.map(item => {
    const info = statusInfo(normalizeStatus(item));
    return `<tr><td>${new Date(item.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td><td><b>${heightCm(item.altura).toFixed(1)}</b></td><td><span class="status-pill" style="color:${info.color};background:${info.color}18">${info.label}</span></td></tr>`;
  }).join('') : '<tr><td colspan="3">Nenhuma leitura</td></tr>';
}

function renderStations() {
  const body = $('stations-body');
  if (!body) return;

  const stationText = `${devices.length} ${devices.length === 1 ? 'estação' : 'estações'}`;

  // Atualiza todos os elementos com esse ID, caso exista mais de um no HTML.
  document.querySelectorAll('#station-count').forEach(element => {
    element.textContent = stationText;
  });

  if (!devices.length) {
    body.innerHTML = '<tr><td colspan="4" class="table-message">Nenhuma estação cadastrada.</td></tr>';
    return;
  }

  body.innerHTML = devices.map(device => {
    const related = validReadings().filter(item =>
      String(item.dispositivo_id) === String(device.id) ||
      String(item.dispositivo?.id) === String(device.id) ||
      String(item.dispositivo?.device_id) === String(device.device_id) ||
      String(item.device_id) === String(device.device_id)
    );

    const reading = related.at(-1);
    const info = reading ? statusInfo(normalizeStatus(reading)) : null;

    return `
      <tr>
        <td>
          <strong>${escapeHtml(device.nome || device.device_id || 'Estação')}</strong>
          <small>${escapeHtml(device.device_id || '')}</small>
        </td>
        <td>${escapeHtml(device.localizacao || 'Não informada')}</td>
        <td>
          ${
            reading
              ? new Date(reading.data).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Sem leitura'
          }
        </td>
        <td>
          <span
            class="status-pill"
            style="color:${info?.color || 'var(--muted)'};background:${info ? `${info.color}18` : '#eef2f6'}"
          >
            ${info?.label || (device.ativo ? 'Ativa' : 'Inativa')}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAnalysis() {
  const reading = latestReading();
  if (!reading) {
    $('analysis-explanation').textContent = 'Aguardando dados do sensor.';
    return;
  }
  const level = heightCm(reading.altura);
  const speed = calcSpeed();
  $('analysis-explanation').textContent = `O nível atual é ${level.toFixed(1)} cm e foi classificado pelo sistema como ${statusInfo(normalizeStatus(reading)).label}. A velocidade estimada pela série recente é ${speed.toFixed(2)} cm/min. ${speed > 1 ? 'A subida está acelerada e merece atenção.' : 'Não há evidência de subida acelerada neste momento.'}`;
}

function renderSystem() {
  $('system-reading-count').textContent = readings.length;
  $('system-device-count').textContent = devices.length;
  $('system-risk-count').textContent = getRiskDevices().length;
  const sistema = dashboardSummary?.sistema || {};
  const mqttActive = sistema.mqtt === true;
  const espActive = sistema.online === true && devices.some(device => device.ativo !== false);
  $('system-esp').textContent = espActive ? 'Conectado' : 'Aguardando';
  $('system-mqtt').textContent = mqttActive ? 'Conectado' : 'Aguardando';
  $('system-db').textContent = 'Conectado';
}

function getRiskDevices() {
  const severity = {
    normal: 0,
    atencao: 1,
    alerta: 2,
    evacuacao: 3
  };

  return devices.filter(device => {
    const reading = latestReadingForDevice(device);
    if (!reading) return false;

    const status = normalizeStatus(reading);
    return severity[status] >= 2;
  });
}

function renderAlerts() {
  const riskDevices = getRiskDevices();

  const banner = $('alert-banner');
  if (!banner) return;

  if (riskDevices.length === 0) {
    banner.className = 'alert-banner safe';
    banner.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      <div>
        <strong>Nenhum alerta crítico</strong>
        <span>As estações monitoradas não registram Alerta ou Evacuação.</span>
      </div>
    `;
    return;
  }

  const stationsHtml = riskDevices.map(device => {
    const reading = latestReadingForDevice(device);

    if (!reading) return '';

    const status = normalizeStatus(reading);
    const info = statusInfo(status);

    const level = heightCm(reading.altura).toFixed(1);
    const time = new Date(reading.data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="alert-station">
        <div class="alert-station-icon"
             style="color:${info.color};background:${info.color}18">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>

        <div class="alert-station-info">
          <strong>${escapeHtml(device.nome || 'Estação')}</strong>
          <small>
            ${escapeHtml(device.device_id || '')}
            · ${level} cm
            · ${time}
          </small>
        </div>

        <span
          class="status-pill"
          style="color:${info.color};background:${info.color}18"
        >
          ${info.label}
        </span>
      </div>
    `;
  }).join('');

  banner.className = 'alert-banner danger';

  banner.innerHTML = `
    <div class="alert-header">
      <i class="fa-solid fa-triangle-exclamation"></i>

      <div>
        <strong>
          ${riskDevices.length}
          ${riskDevices.length === 1 ? 'estação em risco' : 'estações em risco'}
        </strong>

        <span>
          Estações que apresentam nível de Alerta ou Evacuação.
        </span>
      </div>
    </div>

    <div class="alert-stations-list">
      ${stationsHtml}
    </div>
  `;
}

function updateNavCount() {
  const element = $('nav-alert-count');
  if (!element) return;

  const count = getRiskDevices().length;

  element.textContent = count;
  element.hidden = count === 0;
}

function switchView(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));

  const info = {
    dashboard: ['Dashboard', 'Visão geral do sistema em tempo real'],
    history: ['Histórico', 'Evolução das leituras do FloodGuard'],
    analysis: ['Análises', 'Indicadores e projeções do monitoramento'],
    alerts: ['Alertas', 'Central de ocorrências e risco'],
    system: ['Sistema', 'Saúde dos componentes'],
    settings: ['Configurações', 'Parâmetros e arquitetura']
  };

  $('page-title').textContent = info[view][0];
  $('page-subtitle').textContent = info[view][1];

  if (view === 'history') { renderCharts(); renderHistoryTable(); }
  if (view === 'settings') { renderDeviceManagement(); renderSimulationDevices(); }
  if (view === 'dashboard') setTimeout(updateMap, 100);
}

function isAdmin() {
  return user?.perfil === 'ADMIN';
}

function renderDeviceManagement() {
  const section = $('device-management');
  if (!section) return;
  section.hidden = !isAdmin();
  if (!isAdmin()) return;

  const list = $('device-list');
  if (!list) return;
  if (!devices.length) {
    list.innerHTML = '<div class="empty-state device-empty">Nenhum dispositivo cadastrado.</div>';
    return;
  }

  list.innerHTML = devices.map(device => `<div class="device-row">
    <div class="device-main"><div class="device-icon"><i class="fa-solid fa-microchip"></i></div><div><strong>${escapeHtml(device.nome || device.device_id)}</strong><span>${escapeHtml(device.device_id || '')} · ${escapeHtml(device.localizacao || 'Sem localização')}</span></div></div>
    <div class="device-meta"><span class="status-pill ${device.ativo === false ? 'inactive' : ''}">${device.ativo === false ? 'Inativo' : 'Ativo'}</span><div class="device-actions"><button class="icon-button" title="Editar" onclick="editDevice(${Number(device.id)})"><i class="fa-solid fa-pen"></i></button><button class="icon-button danger" title="Excluir" onclick="deleteDevice(${Number(device.id)})"><i class="fa-solid fa-trash"></i></button></div></div>
  </div>`).join('');
}

function openDeviceForm(device = null) {
  if (!isAdmin()) return showToast('Somente administradores podem cadastrar dispositivos.');
  editingDeviceId = device?.id || null;
  $('device-form-wrap').hidden = false;
  $('device-form-id').value = device?.id || '';
  $('device-device-id').value = device?.device_id || '';
  $('device-device-id').disabled = Boolean(device);
  $('device-name').value = device?.nome || '';
  $('device-location').value = device?.localizacao || '';
  $('device-latitude').value = device?.latitude ?? '';
  $('device-longitude').value = device?.longitude ?? '';
  $('device-active').checked = device?.ativo !== false;
}

function closeDeviceForm() {
  editingDeviceId = null;
  if ($('device-form-wrap')) $('device-form-wrap').hidden = true;
  $('device-form')?.reset();
  if ($('device-device-id')) $('device-device-id').disabled = false;
  if ($('device-active')) $('device-active').checked = true;
}

async function saveDevice(event) {
  event.preventDefault();
  if (!isAdmin()) return;

  const payload = {
    device_id: $('device-device-id').value.trim(),
    nome: $('device-name').value.trim(),
    localizacao: $('device-location').value.trim(),
    latitude: $('device-latitude').value === '' ? null : Number($('device-latitude').value),
    longitude: $('device-longitude').value === '' ? null : Number($('device-longitude').value),
    ativo: $('device-active').checked
  };

  try {
    if (!payload.device_id || !payload.nome || !payload.localizacao) throw new Error('Device ID, nome e localização são obrigatórios.');
    const path = editingDeviceId ? `/dispositivos/${editingDeviceId}` : '/dispositivos';
    const method = editingDeviceId ? 'PUT' : 'POST';
    const wasEditing = Boolean(editingDeviceId);
    await apiRequest(path, { method, body: JSON.stringify(payload) });
    closeDeviceForm();
    showToast(wasEditing ? 'Dispositivo atualizado.' : 'Dispositivo cadastrado.');
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

window.editDevice = function(id) {
  const device = devices.find(item => Number(item.id) === Number(id));
  if (device) openDeviceForm(device);
};

window.deleteDevice = async function(id) {
  if (!isAdmin()) return;
  const device = devices.find(item => Number(item.id) === Number(id));
  if (!device) return;
  if (!window.confirm(`Excluir o dispositivo "${device.nome || device.device_id}"?`)) return;
  try {
    await apiRequest(`/dispositivos/${id}`, { method: 'DELETE' });
    showToast('Dispositivo excluído.');
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
};

function getDeviceCoordinates() {
  const device = devices.find(item => item.latitude != null || item.lat != null || item.longitude != null || item.lng != null) || devices[0];
  const lat = Number(device?.latitude ?? device?.lat ?? device?.localizacao?.latitude ?? -12.9714);
  const lng = Number(device?.longitude ?? device?.lng ?? device?.localizacao?.longitude ?? -38.5014);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return [-12.9714, -38.5014];
}

function setupMap() {
  if (!window.L || map || !$('risk-map')) return;

  try {
    const coordinates = getDeviceCoordinates();

    map = L.map('risk-map', {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true
    }).setView(coordinates, 16);

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri' }
    ).addTo(map);

    mapMarkers = L.layerGroup().addTo(map);
    mapCircle = L.circle(coordinates, {
      radius: 180,
      color: '#1769ff',
      fillColor: '#1769ff',
      fillOpacity: .14,
      weight: 2
    }).addTo(map);

    updateMapMarkers();

    setTimeout(() => map.invalidateSize(), 150);
  } catch (error) {
    console.error('Mapa:', error);
  }
}

function updateMapMarkers() {
  if (!map || !window.L) return;

  if (!mapMarkers) {
    mapMarkers = L.layerGroup().addTo(map);
  }

  const device = devices.find(
    d => String(d.id) === String(dashboardDeviceId)
  ) || devices[0];

  if (!device) {
    console.log('Mapa: nenhum dispositivo carregado ainda.');
    return;
  }

  const lat = Number(device.latitude ?? device.lat);
  const lng = Number(device.longitude ?? device.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.log('Mapa: coordenadas inválidas:', device);
    return;
  }

  const reading = latestReadingForDevice(device);
  const status = reading ? normalizeStatus(reading) : null;
  const info = status ? statusInfo(status) : null;

  const popupContent = `
    <strong>${escapeHtml(device.nome || 'Estação FloodGuard')}</strong><br>
    ${escapeHtml(device.device_id || '')}<br>
    ${
      reading
        ? `Nível: ${heightCm(reading.altura).toFixed(1)} cm<br>
           Status: ${escapeHtml(info?.label || status || 'Sem leitura')}`
        : 'Sem leitura registrada'
    }
  `;

  if (!mapMarker) {
    mapMarker = L.marker([lat, lng]).addTo(mapMarkers);
    mapMarker.bindPopup(popupContent);
  } else {
    mapMarker.setLatLng([lat, lng]);
    mapMarker.setPopupContent(popupContent);
  }

  if (mapCircle) {
    mapCircle.setLatLng([lat, lng]);

    mapCircle.setStyle({
      color: info?.color || '#1769ff',
      fillColor: info?.color || '#1769ff'
    });
  }

  map.setView([lat, lng], 16, {
    animate: false
  });
}

function updateMap() {
  if (!map) {
    setupMap();
    return;
  }

  updateMapMarkers();
}

function updateDate() {
  const element = $('current-date');
  if (element) {
    element.textContent = new Intl.DateTimeFormat('pt-BR', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).format(new Date());
  }
  if ($('footer-year')) $('footer-year').textContent = new Date().getFullYear();
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function errorMessage(message) {
  const element = $('login-error');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
}
