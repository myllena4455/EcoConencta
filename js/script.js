const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  balance: Number(localStorage.getItem('ecoBalance') || 1240),
  collectorMoney: Number(localStorage.getItem('ecoCollectorMoney') || 620),
  collections: JSON.parse(localStorage.getItem('ecoCollections') || 'null') || [
    { id: 'EC-78421', material: 'Plástico', weight: '8 kg', date: 'Hoje • 14h', status: 'Em Rota' },
    { id: 'EC-77106', material: 'Papel', weight: '5 kg', date: '17 Nov • 10h', status: 'Concluída' },
    { id: 'EC-76890', material: 'Vidro', weight: '12 kg', date: '14 Nov • 16h', status: 'Aceita' }
  ],
  calls: JSON.parse(localStorage.getItem('ecoCalls') || 'null') || [
    { id: 'EC-78421', address: 'Rua Setúbal, 812 — Boa Viagem', info: 'Plástico • 8 kg', mins: 18, status: 'Pendente', lat: -8.1276, lng: -34.9018 },
    { id: 'EC-78603', address: 'Av. Herculano Bandeira, 220', info: 'Papel • 5 kg', mins: 24, status: 'Pendente', lat: -8.111, lng: -34.9335 },
    { id: 'EC-78644', address: 'Rua Ernesto de Paula, 45 — Torre', info: 'Eletrônicos • 3 kg', mins: 31, status: 'Pendente', lat: -8.0414, lng: -34.9134 },
    { id: 'EC-78688', address: 'Rua da Mangueira, 90 — Ibura', info: 'Vidro • 10 kg', mins: 38, status: 'Pendente', lat: -8.0954, lng: -34.8799 }
  ],
  reports: JSON.parse(localStorage.getItem('ecoReports') || '[]'),
  financialHistory: JSON.parse(localStorage.getItem('ecoFinancialHistory') || 'null') || [
    { type: 'entrada', description: 'Coleta EC-77106 concluída', value: 80, date: '17 Nov • 10:12' },
    { type: 'entrada', description: 'Coleta EC-76890 concluída', value: 65, date: '14 Nov • 16:35' },
    { type: 'saque', description: 'Saque para conta bancária', value: 100, date: '10 Nov • 09:00' }
  ],
  reportLocation: null,
  offlineQueue: JSON.parse(localStorage.getItem('ecoOfflineQueue') || '[]'),
  invoiceHashes: JSON.parse(localStorage.getItem('ecoInvoiceHashes') || '[]'),
  wizardStep: 1,
  rating: 5
};

state.calls = state.calls.filter(call => {
  const queued = state.offlineQueue.some(item => item.type === 'complete' && item.id === call.id);
  const collection = state.collections.find(item => item.id === call.id);
  return !queued && collection?.status !== 'Concluída';
});

function toast(message, icon = 'check-circle') {
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  $('#toastContainer').appendChild(item);
  lucide.createIcons();
  setTimeout(() => item.remove(), 3500);
}

function persist() {
  localStorage.setItem('ecoBalance', String(state.balance));
  localStorage.setItem('ecoCollectorMoney', String(state.collectorMoney));
  localStorage.setItem('ecoCollections', JSON.stringify(state.collections));
  localStorage.setItem('ecoCalls', JSON.stringify(state.calls));
  localStorage.setItem('ecoReports', JSON.stringify(state.reports));
  localStorage.setItem('ecoFinancialHistory', JSON.stringify(state.financialHistory));
  localStorage.setItem('ecoOfflineQueue', JSON.stringify(state.offlineQueue));
}

function switchModule(moduleName) {
  $$('.module').forEach(section => section.classList.toggle('active', section.id === `${moduleName}Module`));
  $$('.nav-item, .mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.module === moduleName));
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (moduleName === 'resident' && window.ecoMap) setTimeout(() => window.ecoMap.invalidateSize(), 100);
  if (moduleName === 'collector' && window.collectorMap) setTimeout(() => window.collectorMap.invalidateSize(), 100);
  if (moduleName === 'catalog' && window.catalogMap) setTimeout(() => window.catalogMap.invalidateSize(), 100);
}

$$('[data-module]').forEach(button => button.addEventListener('click', () => switchModule(button.dataset.module)));
$$('[data-go-module]').forEach(button => {
  button.addEventListener('click', () => switchModule(button.dataset.goModule));
});
$('#menuButton')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#notificationButton')?.addEventListener('click', () => toast('Você tem 2 atualizações sobre suas coletas.', 'bell'));

function renderBalance() {
  $('#residentBalance').textContent = state.balance.toLocaleString('pt-BR');
  $('#walletBalance').textContent = state.balance.toLocaleString('pt-BR');
  $('#collectorAvailableMoney').textContent = state.collectorMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderCollections() {
  $('#collectionList').innerHTML = state.collections.map(item => {
    const icon = item.material === 'Papel' ? 'newspaper' : item.material === 'Eletrônicos' ? 'laptop' : item.material === 'Vidro' ? 'wine' : item.material === 'Metal' ? 'cog' : 'package';
    const statusClass = item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-');
    return `<div class="collection-item">
      <div class="collection-symbol"><i data-lucide="${icon}"></i></div>
      <div class="collection-info"><strong>${item.material} • ${item.weight}</strong><small>${item.date} • ${item.id}</small></div>
      <div class="collection-status"><b class="status-${statusClass}">${item.status}</b>${item.status === 'Concluída' ? `<button class="rate-button" data-id="${item.id}">Avaliar</button>` : ''}</div>
    </div>`;
  }).join('');
  $$('.rate-button').forEach(button => button.addEventListener('click', () => openModal('ratingModal')));
  lucide.createIcons();
}

let residentRouteLayer = null;
let collectorRouteLayer = null;
let collectorCallMarkers = [];

const pevs = [
  { name: 'Ecoponto Boa Viagem', lat: -8.1276, lng: -34.9018, address: 'Av. Domingos Ferreira, 3685 — Boa Viagem', materials: 'Plástico, papel, vidro e metal', hours: 'Seg–Sab 08h–18h' },
  { name: 'PEV Torre', lat: -8.0414, lng: -34.9134, address: 'Praça da Torre, s/n — Torre', materials: 'Plástico, papel, vidro e eletrônicos', hours: 'Seg–Sex 07h–17h' },
  { name: 'Cooperativa Ibura', lat: -8.111, lng: -34.9335, address: 'Av. Mascarenhas de Moraes, 4100 — Ibura', materials: 'Todos os recicláveis secos', hours: 'Seg–Sab 06h–16h' },
  { name: 'PEV Caxangá', lat: -8.0338, lng: -34.937, address: 'Av. Caxangá, 300 — Caxangá', materials: 'Plástico, papel e metal', hours: 'Todos os dias 08h–19h' }
];

function pinIcon(color) {
  return L.divIcon({
    className: 'eco-pin',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 4px 10px rgba(15,23,42,.25)"><div style="width:8px;height:8px;border-radius:50%;background:white;position:absolute;left:8px;top:8px"></div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28]
  });
}

function addReportMarkerToMaps(report) {
  const popup = `<b style="color:#EF4444">${report.title}</b><br>${report.description}<br><small>${report.address}</small>`;
  if (window.ecoMap) L.marker([report.lat, report.lng], { icon: pinIcon('#EF4444') }).addTo(window.ecoMap).bindPopup(popup);
  if (window.collectorMap) L.marker([report.lat, report.lng], { icon: pinIcon('#EF4444') }).addTo(window.collectorMap).bindPopup(popup);
}

function renderReports() {
  const list = $('#reportList');
  if (!list) return;
  if (!state.reports.length) {
    list.innerHTML = '<p class="gps-status">Nenhuma denúncia registrada ainda.</p>';
    return;
  }
  list.innerHTML = state.reports.map(item => `<article class="report-item"><div><h3>${item.title}</h3><p>${item.description}</p><small>${item.address} • ${item.createdAt}</small></div><span class="report-tag">Enviado às autoridades e catadores</span></article>`).join('');
}

function renderFinancialHistory() {
  const target = $('#financialHistory');
  if (!target) return;
  target.innerHTML = state.financialHistory.map(item => `<div class="financial-item"><span class="${item.type === 'entrada' ? 'green' : 'amber'}"><i data-lucide="${item.type === 'entrada' ? 'arrow-down-left' : 'arrow-up-right'}"></i></span><div><strong>${item.description}</strong><small>${item.date}</small></div><b>${item.type === 'entrada' ? '+' : '-'} R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>`).join('');
  lucide.createIcons();
}

function drawCollectorRoute() {
  if (!window.collectorMap) return;
  collectorCallMarkers.forEach(marker => window.collectorMap.removeLayer(marker));
  collectorCallMarkers = [];
  if (collectorRouteLayer) window.collectorMap.removeLayer(collectorRouteLayer);

  const points = state.calls.map(call => [call.lat, call.lng]);
  state.calls.forEach(call => {
    const marker = L.marker([call.lat, call.lng], { icon: pinIcon('#0284C7') }).addTo(window.collectorMap);
    marker.bindPopup(`<b>${call.address}</b><br>${call.info}<br>SLA: ${call.mins} minutos`);
    collectorCallMarkers.push(marker);
  });

  if (points.length > 1) {
    collectorRouteLayer = L.polyline(points, { color: '#10B981', weight: 4, dashArray: '6 8' }).addTo(window.collectorMap);
    window.collectorMap.fitBounds(collectorRouteLayer.getBounds(), { padding: [30, 30] });
  } else if (points.length === 1) {
    window.collectorMap.setView(points[0], 14);
  }
}

function renderCalls() {
  $('#callsList').innerHTML = state.calls.map(call => `<div class="call-item"><div class="sla-ring"><span>${call.mins}m</span></div><div class="call-info"><strong>${call.address}</strong><small>${call.info} • ${call.id}</small></div><div class="call-actions"><button class="secondary-button accept-call" data-id="${call.id}">Aceitar</button><button class="primary-button complete-call" data-id="${call.id}"><i data-lucide="check"></i></button></div></div>`).join('') || '<p class="gps-status">Nenhum chamado pendente.</p>';
  $('#pendingCount').textContent = String(state.calls.length);

  $$('.accept-call').forEach(button => button.addEventListener('click', () => {
    const call = state.calls.find(item => item.id === button.dataset.id);
    if (!call) return;
    button.textContent = 'Em rota';
    button.disabled = true;
    toast(`Chamado ${call.id} aceito e incluído na rota.`, 'route');
  }));

  $$('.complete-call').forEach(button => button.addEventListener('click', () => completeCall(button.dataset.id)));
  lucide.createIcons();
  drawCollectorRoute();
}

function recordCallCompletion(id) {
  state.balance += 40;
  state.collectorMoney += 55;
  state.financialHistory.unshift({
    type: 'entrada',
    description: `Coleta ${id} concluída`,
    value: 55,
    date: new Date().toLocaleDateString('pt-BR') + ' • ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  const collection = state.collections.find(item => item.id === id);
  if (collection) collection.status = 'Concluída';
}

function syncOfflineQueue() {
  const completedIds = [...new Set(state.offlineQueue
    .filter(item => item.type === 'complete')
    .map(item => item.id))];
  if (!completedIds.length) return;

  state.offlineQueue = state.offlineQueue.filter(item => item.type !== 'complete');
  completedIds.forEach(id => {
    state.calls = state.calls.filter(item => item.id !== id);
    recordCallCompletion(id);
  });

  persist();
  renderCalls();
  renderCollections();
  renderBalance();
  renderFinancialHistory();
  toast(`${completedIds.length} coleta(s) offline sincronizada(s).`, 'wifi');
}

function completeCall(id) {
  const call = state.calls.find(item => item.id === id);
  if (!call) return;

  state.calls = state.calls.filter(item => item.id !== id);
  if ($('#offlineToggle').checked) {
    state.offlineQueue.push({ id, type: 'complete', timestamp: Date.now() });
    persist();
    renderCalls();
    toast('Coleta concluída offline. Será sincronizada depois.', 'wifi-off');
    return;
  }

  recordCallCompletion(id);
  persist();
  renderCalls();
  renderCollections();
  renderBalance();
  renderFinancialHistory();
  toast('Coleta concluída! Morador recebeu moedas e catador recebeu pagamento.', 'coins');
}

function locateUser(addToMap = true, targetMap = window.ecoMap) {
  if (!navigator.geolocation) {
    toast('Geolocalização não suportada neste navegador.', 'circle-alert');
    return;
  }
  toast('Obtendo sua localização…', 'crosshair');
  navigator.geolocation.getCurrentPosition(position => {
    const coords = [position.coords.latitude, position.coords.longitude];
    if (addToMap && targetMap) {
      targetMap.setView(coords, 15);
      L.circleMarker(coords, { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }).addTo(targetMap).bindPopup('<b>Você está aqui</b>').openPopup();
    }
    toast('Localização atualizada.', 'map-pin');
  }, () => toast('Não foi possível acessar sua localização.', 'circle-alert'), { enableHighAccuracy: true, timeout: 10000 });
}

function initMaps() {
  window.ecoMap = L.map('map', { zoomControl: true }).setView([-8.0476, -34.877], 12);
  window.collectorMap = L.map('collectorMap', { zoomControl: true }).setView([-8.0476, -34.877], 12);
  window.catalogMap = L.map('catalogMap', { zoomControl: true }).setView([-8.0476, -34.877], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(window.ecoMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(window.collectorMap);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(window.catalogMap);

  pevs.forEach(pev => {
    const popup = `<b>${pev.name}</b><br><span>${pev.address}</span><br><b>Materiais:</b> ${pev.materials}<br><b>Horário:</b> ${pev.hours}`;
    L.marker([pev.lat, pev.lng], { icon: pinIcon('#0284C7') }).addTo(window.ecoMap).bindPopup(popup);
    L.marker([pev.lat, pev.lng], { icon: pinIcon('#0284C7') }).addTo(window.collectorMap).bindPopup(popup);
    L.marker([pev.lat, pev.lng], { icon: pinIcon('#0284C7') }).addTo(window.catalogMap).bindPopup(popup);
  });

  state.reports.forEach(addReportMarkerToMaps);
  drawCollectorRoute();
}

function openModal(id) {
  $('#' + id)?.classList.add('open');
}

function closeModal(modal) {
  modal?.classList.remove('open');
}

$$('.close-modal').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
  if (event.target === backdrop) closeModal(backdrop);
}));

$('#openWizard')?.addEventListener('click', () => {
  state.wizardStep = 1;
  updateWizard();
  openModal('wizardModal');
});

$('#weightRange')?.addEventListener('input', event => {
  $('#weightValue').textContent = `${event.target.value} kg`;
});

$('#wizardGps')?.addEventListener('click', () => {
  locateUser(false);
  $('#addressInput').value = 'Localização atual • Recife, PE';
});

const dateInput = $('#dateInput');
if (dateInput) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.value = tomorrow.toISOString().split('T')[0];
  dateInput.min = new Date().toISOString().split('T')[0];
}

function updateWizard() {
  $$('.wizard-step').forEach(step => step.classList.toggle('active', Number(step.dataset.step) === state.wizardStep));
  $$('.stepper span').forEach((step, index) => step.classList.toggle('active', index + 1 <= state.wizardStep));
  $('#wizardBack').disabled = state.wizardStep === 1;
  $('#wizardNext').innerHTML = state.wizardStep === 3 ? 'Confirmar coleta <i data-lucide="check"></i>' : 'Continuar <i data-lucide="arrow-right"></i>';

  if (state.wizardStep === 3) {
    const waste = $('input[name="waste"]:checked').value;
    $('#wizardSummary').innerHTML = `<div><span>Material</span><b>${waste}</b></div><div><span>Peso estimado</span><b>${$('#weightRange').value} kg</b></div><div><span>Endereço</span><b>${$('#addressInput').value}</b></div><div><span>Coleta</span><b>${new Date(dateInput.value + 'T12:00').toLocaleDateString('pt-BR')} • ${$('#shiftInput').value}</b></div>`;
  }

  lucide.createIcons();
}

$('#wizardBack')?.addEventListener('click', () => {
  if (state.wizardStep > 1) {
    state.wizardStep -= 1;
    updateWizard();
  }
});

$('#wizardNext')?.addEventListener('click', () => {
  if (state.wizardStep < 3) {
    state.wizardStep += 1;
    updateWizard();
    return;
  }

  const protocol = 'EC-' + Math.floor(10000 + Math.random() * 89999);
  const waste = $('input[name="waste"]:checked').value;

  state.collections.unshift({
    id: protocol,
    material: waste,
    weight: `${$('#weightRange').value} kg`,
    date: `${new Date(dateInput.value + 'T12:00').toLocaleDateString('pt-BR')} • ${$('#shiftInput').selectedOptions[0].textContent.split(' • ')[0]}`,
    status: 'Pendente'
  });

  persist();
  renderCollections();
  closeModal($('#wizardModal'));
  toast(`Coleta agendada! Protocolo ${protocol}`, 'calendar-check');
});

$('#openReport')?.addEventListener('click', () => openModal('reportModal'));
$('#openResidentReport')?.addEventListener('click', () => openModal('reportModal'));
$$('.open-report-global').forEach(button => button.addEventListener('click', () => openModal('reportModal')));

$('#reportPhoto')?.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $('#photoPreview').innerHTML = `<img class="photo-preview-img" src="${reader.result}" alt="Foto da denúncia">`;
  };
  reader.readAsDataURL(file);
});

$('#captureReportGps')?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    toast('Geolocalização indisponível.', 'circle-alert');
    return;
  }

  navigator.geolocation.getCurrentPosition(position => {
    state.reportLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    $('#gpsStatus').textContent = `Capturado: ${state.reportLocation.lat.toFixed(5)}, ${state.reportLocation.lng.toFixed(5)}`;
    toast('Coordenadas capturadas.', 'crosshair');
  }, () => toast('Permita o acesso à localização.', 'circle-alert'), { enableHighAccuracy: true });
});

$('#submitReport')?.addEventListener('click', () => {
  const description = $('#reportDescription').value.trim();
  if (!$('#reportPhoto').files.length) {
    toast('A foto é obrigatória para a denúncia.', 'camera');
    return;
  }
  if (!description) {
    toast('Descreva o foco ambiental.', 'text');
    return;
  }
  if (!state.reportLocation) {
    toast('Capture as coordenadas GPS antes de enviar.', 'crosshair');
    return;
  }

  const report = {
    id: 'DC-' + Math.floor(1000 + Math.random() * 9000),
    title: 'Descarte irregular',
    description,
    lat: state.reportLocation.lat,
    lng: state.reportLocation.lng,
    address: `Lat ${state.reportLocation.lat.toFixed(5)} • Lng ${state.reportLocation.lng.toFixed(5)}`,
    createdAt: new Date().toLocaleDateString('pt-BR') + ' • ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };

  state.reports.unshift(report);
  state.balance += 50;
  persist();
  renderBalance();
  renderReports();
  addReportMarkerToMaps(report);

  if (window.ecoMap) window.ecoMap.setView([report.lat, report.lng], 16);

  closeModal($('#reportModal'));
  toast('Denúncia enviada para autoridades e disponível para catadores.', 'siren');

  $('#reportDescription').value = '';
  $('#gpsStatus').textContent = 'Localização ainda não capturada';
  $('#photoPreview').innerHTML = '<i data-lucide="camera"></i><strong>Adicionar foto</strong><span>Obrigatório para validar a ocorrência</span>';
  $('#reportPhoto').value = '';
  state.reportLocation = null;
  lucide.createIcons();
});

$$('#stars button').forEach(button => button.addEventListener('click', () => {
  state.rating = Number(button.dataset.rating);
  $$('#stars button').forEach((star, index) => star.classList.toggle('active', index < state.rating));
}));
$$('#stars button').forEach((button, index) => { if (index < state.rating) button.classList.add('active'); });
$('#submitRating')?.addEventListener('click', () => { closeModal($('#ratingModal')); toast('Avaliação enviada. Obrigado pelo feedback!', 'star'); });

$('#invoiceFile')?.addEventListener('change', event => {
  if (!event.target.files[0]) return;
  $('#invoicePreview').innerHTML = `<b>${event.target.files[0].name}</b>`;
  toast('Nota fiscal carregada para análise.', 'file-check');
});

async function sha256(text) {
  const bytes = typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

$('#validateInvoice')?.addEventListener('click', async () => {
  const button = $('#validateInvoice');
  button.disabled = true;
  button.innerHTML = 'Analisando documento…';

  await new Promise(resolve => setTimeout(resolve, 700));
  const file = $('#invoiceFile').files[0];
  const sample = file ? await file.arrayBuffer() : 'NF-SIMULADA-' + Math.floor(100000 + Math.random() * 899999);
  const hash = await sha256(sample);

  if (state.invoiceHashes.includes(hash)) {
    $('#validationResult').innerHTML = '<span style="color:#EF4444"><b>Duplicidade detectada.</b> Esta nota já foi registrada.</span>';
  } else {
    state.invoiceHashes.push(hash);
    localStorage.setItem('ecoInvoiceHashes', JSON.stringify(state.invoiceHashes));
    $('#validationResult').innerHTML = `<span style="color:#047857"><b>Nota validada com sucesso.</b><br>Hash antifraude: <code>${hash}</code></span>`;
  }

  button.disabled = false;
  button.innerHTML = '<i data-lucide="scan-line"></i> Validar com OCR/IA';
  lucide.createIcons();
  toast('Validação concluída.', 'shield-check');
});

$('#generateReport')?.addEventListener('click', () => {
  const partnerSelect = $('#partnerSelect');
  const partner = partnerSelect.value;
  const selectedOption = partnerSelect.selectedOptions[0];
  const profile = JSON.parse(localStorage.getItem('ecoProfile') || 'null');

  let partnerAddress = selectedOption?.dataset.partnerAddress || '';
  let partnerDocument = selectedOption?.dataset.partnerDocument || '';

  if (profile && profile.role === 'management') {
    const matchesProfile = partner === (profile.condoName || profile.entityName || profile.name);
    if (matchesProfile) {
      partnerAddress = profile.address || partnerAddress;
      partnerDocument = profile.document || partnerDocument;
    }
  }

  $('#certificatePartner').textContent = partner;
  const detailParts = [];
  if (partnerAddress) detailParts.push(partnerAddress);
  if (partnerDocument) detailParts.push(partnerDocument);
  $('#certificatePartnerDetails').textContent = detailParts.length ? detailParts.join(' • ') : 'Endereço não informado';
  const code = 'EC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 899999);
  $('#certificateCode').textContent = code;
  openModal('certificateModal');
  if (window.QRCode) {
    QRCode.toCanvas($('#qrcode'), `https://ecoconecta.recife.br/certificate/${code}`, { width: 100, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }, () => {});
  }
  toast('Laudo socioambiental gerado com rastreabilidade.', 'badge-check');
});

$('#printCertificate')?.addEventListener('click', () => window.print());
$('#viewAllCollections')?.addEventListener('click', () => toast('Todas as coletas foram carregadas.', 'list'));
$('#locateMe')?.addEventListener('click', () => locateUser(true, window.ecoMap));
$('#locateCollector')?.addEventListener('click', () => locateUser(true, window.collectorMap));
$('#locateCatalog')?.addEventListener('click', () => locateUser(true, window.catalogMap));
$('#poolButton')?.addEventListener('click', () => toast('Chamados agrupados em 3 rotas por proximidade.', 'route'));

$('#offlineToggle')?.addEventListener('change', event => {
  if (!event.target.checked && state.offlineQueue.length) {
    syncOfflineQueue();
  } else {
    toast(event.target.checked ? 'Modo offline ativado. Dados salvos no dispositivo.' : 'Conexão restaurada.', event.target.checked ? 'wifi-off' : 'wifi');
  }
});

$('#requestWithdrawal')?.addEventListener('click', () => {
  const value = Number($('#withdrawalAmount').value || 0);
  if (!value || value < 100) {
    toast('O saque mínimo é de R$ 100,00.', 'circle-alert');
    return;
  }
  if (value > state.collectorMoney) {
    toast('Saldo insuficiente para este saque.', 'circle-alert');
    return;
  }

  state.collectorMoney -= value;
  state.financialHistory.unshift({
    type: 'saque',
    description: 'Saque solicitado para conta bancária',
    value,
    date: new Date().toLocaleDateString('pt-BR') + ' • ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  persist();
  renderBalance();
  renderFinancialHistory();
  $('#withdrawalAmount').value = '';
  toast('Saque solicitado com sucesso.', 'banknote');
});

$$('[data-resident-view]').forEach(button => button.addEventListener('click', () => {
  $$('[data-resident-view]').forEach(item => item.classList.toggle('active', item === button));
  $('#residentOverview').hidden = button.dataset.residentView !== 'overview';
  $('#residentWallet').hidden = button.dataset.residentView !== 'wallet';
  $('#residentReport').hidden = button.dataset.residentView !== 'report';
  if (button.dataset.residentView === 'overview' && window.ecoMap) setTimeout(() => window.ecoMap.invalidateSize(), 100);
}));

$$('[data-collector-view]').forEach(button => button.addEventListener('click', () => {
  $$('[data-collector-view]').forEach(item => item.classList.toggle('active', item === button));
  $('#collectorOverview').hidden = button.dataset.collectorView !== 'overview';
  $('#collectorWallet').hidden = button.dataset.collectorView !== 'wallet';
  $('#collectorReports').hidden = button.dataset.collectorView !== 'reports';
  if (button.dataset.collectorView === 'overview' && window.collectorMap) setTimeout(() => window.collectorMap.invalidateSize(), 100);
}));

let selectedRole = 'resident';
const roleLabels = { resident: 'Morador', collector: 'Catador / Cooperativa', management: 'Empresa / Gestão' };

function onlyDigits(value) {
  return (value || '').replace(/\D/g, '');
}

function formatCpf(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function updateRegistrationFieldsByRole() {
  const isResident = selectedRole === 'resident';
  const isCollector = selectedRole === 'collector';
  const isManagement = selectedRole === 'management';

  $('#nameField').hidden = !isResident;
  $('#fullNameInput').required = isResident;

  $('#entityField').hidden = isResident;
  $('#entityNameInput').required = isCollector || isManagement;

  $('#condoNameField').hidden = !isManagement;
  $('#condoNameInput').required = isManagement;

  if (isResident) {
    $('#entityNameInput').value = '';
    $('#condoNameInput').value = '';
  } else if (isCollector) {
    $('#condoNameInput').value = '';
  }

  if (isResident) {
    $('#registrationTitle').textContent = 'Criar conta de morador';
    $('#registrationDescription').textContent = 'Agende coletas, acumule Moedas Verdes e acompanhe seus impactos.';
    $('#entityField').hidden = true;
    $('#documentField').firstChild.textContent = 'CPF';
    $('#documentInput').placeholder = '000.000.000-00';
    $('#registerAddressField').firstChild.textContent = 'Endereço principal';
    $('#registerAddressInput').placeholder = 'Rua, número, bairro e cidade';
    $('#registrationSubmit').innerHTML = 'Criar conta de morador <i data-lucide="arrow-right"></i>';
  } else if (isCollector) {
    $('#registrationTitle').textContent = 'Criar conta de catador';
    $('#registrationDescription').textContent = 'Cadastre seu CPF ou CNPJ para aceitar chamadas e receber pelas coletas.';
    $('#entityField').hidden = false;
    $('#entityNameInput').placeholder = 'Nome do catador ou nome da cooperativa';
    $('#documentField').firstChild.textContent = 'CPF ou CNPJ';
    $('#documentInput').placeholder = 'CPF ou CNPJ';
    $('#registerAddressField').firstChild.textContent = 'Área de atendimento';
    $('#registerAddressInput').placeholder = 'Bairro, cidade ou região atendida';
    $('#registrationSubmit').innerHTML = 'Criar conta de catador <i data-lucide="arrow-right"></i>';
  } else if (isManagement) {
    $('#registrationTitle').textContent = 'Criar conta de empresa ou condomínio';
    $('#registrationDescription').textContent = 'Informe os dados da organização que aparecerão nos laudos e certificados.';
    $('#entityField').hidden = false;
    $('#entityNameInput').placeholder = 'Razão social da empresa ou nome da cooperativa';
    $('#documentField').firstChild.textContent = 'CNPJ';
    $('#documentInput').placeholder = '00.000.000/0000-00';
    $('#registerAddressField').firstChild.textContent = 'Endereço da empresa ou condomínio';
    $('#registerAddressInput').placeholder = 'Rua, número, bairro, cidade e CEP';
    $('#registrationSubmit').innerHTML = 'Criar conta empresarial <i data-lucide="arrow-right"></i>';
  }

  if (isManagement) {
    $('#documentInput').value = formatCnpj($('#documentInput').value);
  } else if (isResident) {
    $('#documentInput').value = formatCpf($('#documentInput').value);
  }

  lucide.createIcons();
}

function syncPartnerSelectFromProfile() {
  const select = $('#partnerSelect');
  if (!select) return;
  const profile = JSON.parse(localStorage.getItem('ecoProfile') || 'null');
  if (!profile || profile.role !== 'management') return;

  const partnerName = profile.condoName || profile.entityName || profile.name;
  if (!partnerName) return;

  const existing = [...select.options].find(option => option.value === partnerName);
  if (!existing) {
    const option = document.createElement('option');
    option.value = partnerName;
    option.textContent = partnerName;
    option.dataset.partnerAddress = profile.address || '';
    option.dataset.partnerDocument = profile.document || '';
    select.prepend(option);
  }

  select.value = partnerName;
}

function showRegistrationStep(step) {
  $('#roleStep').hidden = step !== 'role';
  $('#registrationStep').hidden = step !== 'registration';
  $('#loginStep').hidden = step !== 'login';
  $('#authStepLabel').textContent = step === 'login' ? 'BEM-VINDO DE VOLTA' : step === 'registration' ? 'FINALIZE SEU CADASTRO' : 'COMECE AGORA';
  if (step === 'registration') {
    $('#registrationTitle').textContent = `Criar conta de ${roleLabels[selectedRole].toLowerCase()}`;
    updateRegistrationFieldsByRole();
  }
  const onboardingPanel = $('.onboarding-panel');
  if (onboardingPanel) onboardingPanel.scrollTo({ top: 0, behavior: 'smooth' });

  lucide.createIcons();
}

$$('.role-card').forEach(card => card.addEventListener('click', () => {
  $$('.role-card').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected');
  selectedRole = card.dataset.role;
  if (!$('#registrationStep').hidden) updateRegistrationFieldsByRole();
}));

$('#documentInput')?.addEventListener('input', event => {
  const digits = onlyDigits(event.target.value);
  if (selectedRole === 'management') {
    event.target.value = formatCnpj(digits);
  } else if (selectedRole === 'collector' && digits.length > 11) {
    event.target.value = formatCnpj(digits);
  } else {
    event.target.value = formatCpf(digits);
  }
});

$('#phoneInput')?.addEventListener('input', event => {
  event.target.value = formatPhone(event.target.value);
});

$('#continueRegistration')?.addEventListener('click', () => showRegistrationStep('registration'));
$('#backToRoles')?.addEventListener('click', () => showRegistrationStep('role'));
$('#backToRolesFromLogin')?.addEventListener('click', () => showRegistrationStep('role'));
$('#existingAccountButton')?.addEventListener('click', () => showRegistrationStep('login'));

$('#togglePassword')?.addEventListener('click', () => {
  const input = $('#passwordInput');
  input.type = input.type === 'password' ? 'text' : 'password';
});

function configureRole(role) {
  selectedRole = role;
  $$('.nav-item, .mobile-nav button').forEach(button => {
    const moduleName = button.dataset.module;
    if (moduleName === 'home' || moduleName === 'catalog') {
      button.style.display = '';
    } else {
      button.style.display = moduleName === role ? '' : 'none';
    }
  });
  switchModule(role);

  const roleLabel = roleLabels[role];
  const profile = JSON.parse(localStorage.getItem('ecoProfile') || 'null') || {
    name: 'Ana Ribeiro',
    role: roleLabel,
    phone: '(81) 99999-0000',
    email: 'ana.ribeiro@email.com',
    address: 'Rua Setúbal, 812 — Boa Viagem',
    document: '000.000.000-00',
    entityName: '',
    condoName: ''
  };

  $$('.profileName').forEach(element => { element.textContent = profile.name; });
  $$('.profileRole').forEach(element => { element.textContent = `${roleLabel} • Recife`; });
  $$('.profileInitials').forEach(element => {
    element.textContent = profile.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  });
  renderProfilePhoto(profile.photo);

  const greetingName = role === 'resident' ? profile.name.split(' ')[0] : profile.name;
  const residentGreeting = $('#residentGreeting');
  if (residentGreeting) residentGreeting.innerHTML = `Olá, ${greetingName}! <span>🌿</span>`;

  $('#profileRoleModal').textContent = `${roleLabel} • Recife`;
  $('#profileNameInput').value = profile.name;
  $('#profilePhoneInput').value = profile.phone;
  $('#profileEmailInput').value = profile.email;
  $('#profileAddressInput').value = profile.address;
  $('#profileDocumentInput').value = profile.document || '';
  $('#profileCondoNameInput').value = profile.condoName || '';

  renderProfilePhoto(profile.photo);
}

$('#registrationForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const documentDigits = onlyDigits($('#documentInput').value);
  const phoneDigits = onlyDigits($('#phoneInput').value);
  const validDocument = selectedRole === 'management'
    ? documentDigits.length === 14
    : selectedRole === 'collector'
      ? documentDigits.length === 11 || documentDigits.length === 14
      : documentDigits.length === 11;

  if (!validDocument) {
    const message = selectedRole === 'management'
      ? 'Informe um CNPJ válido com 14 dígitos.'
      : selectedRole === 'collector'
        ? 'Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.'
        : 'Informe um CPF válido com 11 dígitos.';
    toast(message, 'circle-alert');
    return;
  }
  if ($('#phoneInput').value.length < 10) {
    toast('Informe um telefone válido com DDD.', 'circle-alert');
    return;
  }

  const residentName = $('#fullNameInput').value.trim();
  const entityName = $('#entityNameInput').value.trim();
  const condoName = $('#condoNameInput').value.trim();
  const name = residentName || entityName || 'Usuário EcoConecta';
  const profile = {
    name,
    role: selectedRole,
    phone: $('#phoneInput').value.trim(),
    email: $('#emailInput').value.trim(),
    address: $('#registerAddressInput').value.trim(),
    document: $('#documentInput').value.trim(),
    entityName,
    condoName
  };
  localStorage.setItem('ecoProfile', JSON.stringify(profile));
  localStorage.setItem('ecoSession', JSON.stringify({ role: selectedRole, name, createdAt: Date.now() }));
  $('#onboarding').hidden = true;
  document.body.classList.remove('auth-pending');
  configureRole(selectedRole);
  toast(`Cadastro concluído como ${roleLabels[selectedRole]}.`, 'badge-check');
});

$('#loginForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const saved = JSON.parse(localStorage.getItem('ecoSession') || 'null') || { role: 'resident' };
  localStorage.setItem('ecoSession', JSON.stringify(saved));
  $('#onboarding').hidden = true;
  document.body.classList.remove('auth-pending');
  configureRole(saved.role || selectedRole);
  toast('Login realizado com sucesso.', 'log-in');
});

$$('.open-profile').forEach(button => button.addEventListener('click', () => openModal('profileModal')));

$('#profilePhotoInput')?.addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    toast('Escolha uma imagem de até 2 MB.', 'circle-alert');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    renderProfilePhoto(reader.result);
    window.pendingProfilePhoto = reader.result;
  };
  reader.readAsDataURL(file);
});

function renderProfilePhoto(photo) {
  if (!photo) return;

  const preview = $('#profilePhotoPreview');
  if (preview) preview.innerHTML = `<img src="${photo}" alt="Foto do perfil">`;

  $$('.avatar.profileInitials').forEach(avatar => {
    avatar.innerHTML = `<img src="${photo}" alt="Foto do perfil">`;
  });
}

$('#saveProfile')?.addEventListener('click', () => {
  const previousProfile = JSON.parse(localStorage.getItem('ecoProfile') || 'null') || {};
  const profile = {
    ...previousProfile,
    name: $('#profileNameInput').value.trim() || previousProfile.name || 'Usuário EcoConecta',
    phone: $('#profilePhoneInput').value,
    email: $('#profileEmailInput').value,
    address: $('#profileAddressInput').value,
    document: $('#profileDocumentInput').value,
    condoName: $('#profileCondoNameInput').value.trim() || previousProfile.condoName || '',
    photo: window.pendingProfilePhoto || previousProfile.photo || ''
  };

  window.pendingProfilePhoto = null;

  localStorage.setItem('ecoProfile', JSON.stringify(profile));
  $$('.profileName').forEach(element => { element.textContent = profile.name; });
  $$('.profileInitials').forEach(element => {
    element.textContent = profile.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
  });
  renderProfilePhoto(profile.photo);

  const savedRole = previousProfile.role || selectedRole;
  const greetingName = savedRole === 'resident' ? profile.name.split(' ')[0] : profile.name;
  const residentGreeting = $('#residentGreeting');
  if (residentGreeting) residentGreeting.innerHTML = `Olá, ${greetingName}! <span>🌿</span>`;

  syncPartnerSelectFromProfile();
  closeModal($('#profileModal'));
  toast('Informações do perfil atualizadas.', 'save');
});

$('#darkModeToggle')?.addEventListener('change', event => {
  document.body.classList.toggle('dark-mode', event.target.checked);
  localStorage.setItem('ecoDarkMode', event.target.checked ? '1' : '0');
});

$('#logoutButton')?.addEventListener('click', () => {
  localStorage.removeItem('ecoSession');
  closeModal($('#profileModal'));
  document.body.classList.add('auth-pending');
  $('#onboarding').hidden = false;
  showRegistrationStep('role');
  toast('Você saiu da sua conta.', 'log-out');
});

$('.forgot-password')?.addEventListener('click', () => toast('Um link de recuperação foi enviado para seu e-mail ou telefone.', 'mail'));

$('#exportReport')?.addEventListener('click', () => {
  const content = [
    'EcoConecta — Relatório Gerencial de Recife',
    'Período: Novembro de 2026',
    'Toneladas recuperadas: 248,6 t',
    'Pontos críticos evitados: 37',
    'Catadores ativos: 312',
    'Moedas circulando: 186 mil'
  ].join('\n');
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'relatorio-gerencial-ecoconecta.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Relatório gerencial exportado em português.', 'download');
});

function init() {
  document.documentElement.lang = 'pt-BR';
  document.documentElement.setAttribute('xml:lang', 'pt-BR');

  initMaps();
  if (state.offlineQueue.length) {
    syncOfflineQueue();
  }
  renderBalance();
  renderCollections();
  renderCalls();
  renderReports();
  renderFinancialHistory();

  const savedSession = JSON.parse(localStorage.getItem('ecoSession') || 'null');
  if (savedSession) {
    $('#onboarding').hidden = true;
    document.body.classList.remove('auth-pending');
    configureRole(savedSession.role || 'resident');
  } else {
    document.body.classList.add('auth-pending');
    $('#onboarding').hidden = false;
  }

  if (localStorage.getItem('ecoDarkMode') === '1') {
    document.body.classList.add('dark-mode');
    $('#darkModeToggle').checked = true;
  }

  lucide.createIcons();
}

window.addEventListener('load', init);
