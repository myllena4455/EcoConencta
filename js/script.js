const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  balance: Number(localStorage.getItem('ecoBalance') || 1240),
  collections: JSON.parse(localStorage.getItem('ecoCollections') || 'null') || [
    { id: 'EC-78421', material: 'Plástico', weight: '8 kg', date: 'Hoje • 14h', status: 'Em Rota' },
    { id: 'EC-77106', material: 'Papel', weight: '5 kg', date: '17 Nov • 10h', status: 'Concluída' },
    { id: 'EC-76890', material: 'Vidro', weight: '12 kg', date: '14 Nov • 16h', status: 'Aceita' }
  ],
  calls: [
    { id: 'EC-78421', address: 'Rua Setúbal, 812 — Boa Viagem', info: 'Plástico • 8 kg', mins: 18, status: 'Pendente' },
    { id: 'EC-78603', address: 'Av. Herculano Bandeira, 220', info: 'Papel • 5 kg', mins: 24, status: 'Pendente' },
    { id: 'EC-78644', address: 'Rua Ernesto de Paula, 45 — Torre', info: 'Eletrônicos • 3 kg', mins: 31, status: 'Pendente' },
    { id: 'EC-78688', address: 'Rua da Mangueira, 90 — Ibura', info: 'Vidro • 10 kg', mins: 38, status: 'Pendente' }
  ],
  offlineQueue: JSON.parse(localStorage.getItem('ecoOfflineQueue') || '[]'),
  invoiceHashes: JSON.parse(localStorage.getItem('ecoInvoiceHashes') || '[]'),
  reportLocation: null,
  wizardStep: 1,
  rating: 5
};

function toast(message, icon = 'check-circle') {
  const item = document.createElement('div');
  item.className = 'toast';
  item.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  $('#toastContainer').appendChild(item);
  lucide.createIcons();
  setTimeout(() => item.remove(), 3500);
}

function switchModule(moduleName) {
  $$('.module').forEach(section => section.classList.toggle('active', section.id === `${moduleName}Module`));
  $$('.nav-item, .mobile-nav button').forEach(button => button.classList.toggle('active', button.dataset.module === moduleName));
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (moduleName === 'resident' && window.ecoMap) setTimeout(() => window.ecoMap.invalidateSize(), 100);
}

$$('[data-module]').forEach(button => button.addEventListener('click', () => switchModule(button.dataset.module)));
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#notificationButton').addEventListener('click', () => toast('Você tem 2 atualizações sobre suas coletas.', 'bell'));

function saveCollections() { localStorage.setItem('ecoCollections', JSON.stringify(state.collections)); }
function renderCollections() {
  const list = $('#collectionList');
  list.innerHTML = state.collections.map(item => {
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
function renderBalance() { $('#residentBalance').textContent = state.balance.toLocaleString('pt-BR'); }
renderCollections(); renderBalance();

const pevs = [
  { name: 'Ecoponto Boa Viagem', lat: -8.1276, lng: -34.9018, address: 'Av. Domingos Ferreira, 3685 — Boa Viagem', materials: 'Plástico, papel, vidro e metal', hours: 'Seg–Sab 08h–18h' },
  { name: 'PEV Torre', lat: -8.0414, lng: -34.9134, address: 'Praça da Torre, s/n — Torre', materials: 'Plástico, papel, vidro e eletrônicos', hours: 'Seg–Sex 07h–17h' },
  { name: 'Cooperativa Ibura', lat: -8.1110, lng: -34.9335, address: 'Av. Mascarenhas de Moraes, 4100 — Ibura', materials: 'Todos os recicláveis secos', hours: 'Seg–Sab 06h–16h' },
  { name: 'PEV Caxangá', lat: -8.0338, lng: -34.9370, address: 'Av. Caxangá, 300 — Caxangá', materials: 'Plástico, papel e metal', hours: 'Todos os dias 08h–19h' }
];
const alerts = [
  { name: 'Bueiro obstruído', lat: -8.0525, lng: -34.8898, desc: 'Descarte irregular próximo ao canal. Risco alto.' },
  { name: 'Descarte próximo a canal', lat: -8.0954, lng: -34.8799, desc: 'Acúmulo de resíduos próximo ao canal de drenagem.' }
];

window.ecoMap = L.map('map', { zoomControl: true }).setView([-8.0476, -34.8770], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(window.ecoMap);

function pinIcon(color) {
  return L.divIcon({ className: 'eco-pin', html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 4px 10px rgba(15,23,42,.25)"><div style="width:8px;height:8px;border-radius:50%;background:white;position:absolute;left:8px;top:8px"></div></div>`, iconSize: [30,30], iconAnchor: [15,30], popupAnchor: [0,-28] });
}
pevs.forEach(pev => L.marker([pev.lat, pev.lng], { icon: pinIcon('#0284C7') }).addTo(window.ecoMap).bindPopup(`<b>${pev.name}</b><br><span>${pev.address}</span><br><b>Materiais:</b> ${pev.materials}<br><b>Horário:</b> ${pev.hours}`));
function addAlertMarker(alert) { L.marker([alert.lat, alert.lng], { icon: pinIcon('#EF4444') }).addTo(window.ecoMap).bindPopup(`<b style="color:#EF4444">${alert.name}</b><br>${alert.desc}`); }
alerts.forEach(addAlertMarker);

function locateUser(addToMap = true) {
  if (!navigator.geolocation) return toast('Geolocalização não suportada neste navegador.', 'circle-alert');
  toast('Obtendo sua localização…', 'crosshair');
  navigator.geolocation.getCurrentPosition(position => {
    const coords = [position.coords.latitude, position.coords.longitude];
    if (addToMap) {
      window.ecoMap.setView(coords, 15);
      L.circleMarker(coords, { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }).addTo(window.ecoMap).bindPopup('<b>Você está aqui</b>').openPopup();
    }
    toast('Localização atualizada.', 'map-pin');
  }, () => toast('Não foi possível acessar sua localização.', 'circle-alert'), { enableHighAccuracy: true, timeout: 10000 });
}
$('#locateMe').addEventListener('click', () => locateUser(true));

const openModal = id => $('#' + id).classList.add('open');
const closeModal = modal => modal.classList.remove('open');
$$('.close-modal').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
$$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(backdrop); }));

$('#openWizard').addEventListener('click', () => { state.wizardStep = 1; updateWizard(); openModal('wizardModal'); });
$('#weightRange').addEventListener('input', event => $('#weightValue').textContent = `${event.target.value} kg`);
$('#wizardGps').addEventListener('click', () => { locateUser(false); $('#addressInput').value = 'Localização atual • Recife, PE'; });
const dateInput = $('#dateInput');
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
 dateInput.value = tomorrow.toISOString().split('T')[0]; dateInput.min = new Date().toISOString().split('T')[0];

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
$('#wizardBack').addEventListener('click', () => { if (state.wizardStep > 1) { state.wizardStep--; updateWizard(); } });
$('#wizardNext').addEventListener('click', () => {
  if (state.wizardStep < 3) { state.wizardStep++; updateWizard(); return; }
  const protocol = 'EC-' + Math.floor(10000 + Math.random() * 89999);
  const waste = $('input[name="waste"]:checked').value;
  state.collections.unshift({ id: protocol, material: waste, weight: `${$('#weightRange').value} kg`, date: `${new Date(dateInput.value + 'T12:00').toLocaleDateString('pt-BR')} • ${$('#shiftInput').selectedOptions[0].textContent.split(' • ')[0]}`, status: 'Pendente' });
  saveCollections(); renderCollections(); closeModal($('#wizardModal')); toast(`Coleta agendada! Protocolo ${protocol}`, 'calendar-check');
});

function renderCalls() {
  $('#callsList').innerHTML = state.calls.map(call => `<div class="call-item"><div class="sla-ring"><span>${call.mins}m</span></div><div class="call-info"><strong>${call.address}</strong><small>${call.info} • ${call.id}</small></div><div class="call-actions"><button class="secondary-button accept-call" data-id="${call.id}">Aceitar</button><button class="primary-button complete-call" data-id="${call.id}"><i data-lucide="check"></i></button></div></div>`).join('') || '<p class="gps-status">Nenhum chamado pendente.</p>';
  $('#pendingCount').textContent = state.calls.length;
  $$('.accept-call').forEach(button => button.addEventListener('click', () => {
    const call = state.calls.find(item => item.id === button.dataset.id);
    button.textContent = 'Em rota'; button.disabled = true; toast(`Chamado ${call.id} aceite e incluído na rota.`, 'route');
  }));
  $$('.complete-call').forEach(button => button.addEventListener('click', () => completeCall(button.dataset.id)));
  lucide.createIcons();
}
function completeCall(id) {
  const call = state.calls.find(item => item.id === id); if (!call) return;
  const operation = () => {
    state.calls = state.calls.filter(item => item.id !== id); renderCalls();
    state.balance += 40; localStorage.setItem('ecoBalance', state.balance); renderBalance();
    const collection = state.collections.find(item => item.id === id);
    if (collection) collection.status = 'Concluída'; saveCollections(); renderCollections();
    toast(`Coleta concluída! 40 Moedas Verdes creditadas.`, 'coins');
  };
  if ($('#offlineToggle').checked) {
    state.offlineQueue.push({ id, type: 'complete', timestamp: Date.now() });
    localStorage.setItem('ecoOfflineQueue', JSON.stringify(state.offlineQueue));
    state.calls = state.calls.filter(item => item.id !== id); renderCalls(); toast('Coleta concluída offline. Será sincronizada depois.', 'wifi-off');
  } else operation();
}
$('#offlineToggle').addEventListener('change', event => {
  if (!event.target.checked && state.offlineQueue.length) {
    const count = state.offlineQueue.length;
    state.offlineQueue = []; localStorage.removeItem('ecoOfflineQueue');
    toast(`${count} coleta(s) offline sincronizada(s).`, 'wifi');
  } else toast(event.target.checked ? 'Modo offline ativado. Dados salvos no dispositivo.' : 'Conexão restaurada.', event.target.checked ? 'wifi-off' : 'wifi');
});
$('#poolButton').addEventListener('click', () => toast('Chamados agrupados em 3 rotas por proximidade.', 'route'));
renderCalls();

$('#openReport').addEventListener('click', () => openModal('reportModal'));
$('#reportPhoto').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => $('#photoPreview').innerHTML = `<img class="photo-preview-img" src="${reader.result}" alt="Foto da denúncia">`;
  reader.readAsDataURL(file);
});
$('#captureReportGps').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Geolocalização indisponível.', 'circle-alert');
  navigator.geolocation.getCurrentPosition(position => {
    state.reportLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    $('#gpsStatus').textContent = `Capturado: ${state.reportLocation.lat.toFixed(5)}, ${state.reportLocation.lng.toFixed(5)}`;
    toast('Coordenadas capturadas.', 'crosshair');
  }, () => toast('Permita o acesso à localização.', 'circle-alert'), { enableHighAccuracy: true });
});
$('#submitReport').addEventListener('click', () => {
  if (!$('#reportPhoto').files.length) return toast('A foto é obrigatória para a denúncia.', 'camera');
  if (!$('#reportDescription').value.trim()) return toast('Descreva o foco ambiental.', 'text');
  if (!state.reportLocation) return toast('Capture as coordenadas GPS antes de enviar.', 'crosshair');
  addAlertMarker({ name: 'Denúncia ambiental', lat: state.reportLocation.lat, lng: state.reportLocation.lng, desc: $('#reportDescription').value.trim() });
  window.ecoMap.setView([state.reportLocation.lat, state.reportLocation.lng], 16);
  closeModal($('#reportModal')); toast('Denúncia registrada e pino vermelho criado no mapa.', 'siren');
  $('#reportDescription').value = ''; $('#gpsStatus').textContent = 'Localização ainda não capturada'; $('#photoPreview').innerHTML = '<i data-lucide="camera"></i><strong>Adicionar foto</strong><span>Obrigatório para validar a ocorrência</span>'; state.reportLocation = null; lucide.createIcons();
});

$$('#stars button').forEach(button => button.addEventListener('click', () => {
  state.rating = Number(button.dataset.rating);
  $$('#stars button').forEach((star, index) => star.classList.toggle('active', index < state.rating));
}));
$$('#stars button').forEach((button, index) => { if (index < state.rating) button.classList.add('active'); });
$('#submitRating').addEventListener('click', () => { closeModal($('#ratingModal')); toast('Avaliação enviada. Obrigado pelo feedback!', 'star'); });

$('#invoiceFile').addEventListener('change', event => {
  if (!event.target.files[0]) return;
  $('#invoicePreview').innerHTML = `<b>${event.target.files[0].name}</b>`;
  toast('Nota fiscal carregada para análise.', 'file-check');
});
async function sha256(text) {
  const bytes = new TextEncoder().encode(text + ':' + Date.now().toString());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32).toUpperCase();
}
$('#validateInvoice').addEventListener('click', async () => {
  const button = $('#validateInvoice'); button.disabled = true; button.innerHTML = 'Analisando documento…';
  await new Promise(resolve => setTimeout(resolve, 700));
  const sample = $('#invoiceFile').files[0]?.name || 'NF-SIMULADA-' + Math.floor(100000 + Math.random() * 899999);
  const hash = await sha256(sample);
  if (state.invoiceHashes.includes(hash)) {
    $('#validationResult').innerHTML = `<span style="color:#EF4444"><b>Duplicidade detectada.</b> Esta nota já foi registrada.</span>`;
  } else {
    state.invoiceHashes.push(hash); localStorage.setItem('ecoInvoiceHashes', JSON.stringify(state.invoiceHashes));
    $('#validationResult').innerHTML = `<span style="color:#047857"><b>Nota validada com sucesso.</b><br>Hash antifraude: <code>${hash}</code></span>`;
  }
  button.disabled = false; button.innerHTML = '<i data-lucide="scan-line"></i> Validar com OCR/IA'; lucide.createIcons();
  toast(state.invoiceHashes.includes(hash) ? 'Validação concluída.' : 'Nota fiscal validada e registrada.', 'shield-check');
});

$('#generateReport').addEventListener('click', () => {
  const partner = $('#partnerSelect').value;
  $('#certificatePartner').textContent = partner;
  const code = 'EC-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 899999);
  $('#certificateCode').textContent = code;
  openModal('certificateModal');
  if (window.QRCode) QRCode.toCanvas($('#qrcode'), `https://ecoconecta.recife.br/certificate/${code}`, { width: 100, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } }, () => {});
  toast('Laudo socioambiental gerado com rastreabilidade.', 'badge-check');
});
$('#printCertificate').addEventListener('click', () => window.print());

$('#viewAllCollections').addEventListener('click', () => toast('Todas as coletas foram carregadas.', 'list'));

window.addEventListener('load', () => { if (window.lucide) lucide.createIcons(); });
lucide.createIcons();

document.documentElement.lang = 'pt-BR';
document.documentElement.setAttribute('xml:lang', 'pt-BR');

$('#exportReport')?.addEventListener('click', () => {
  const conteudo = [
    'EcoConecta — Relatório Gerencial de Recife',
    'Período: Novembro de 2026',
    'Toneladas recuperadas: 248,6 t',
    'Pontos críticos evitados: 37',
    'Catadores ativos: 312',
    'Moedas circulando: 186 mil'
  ].join('\n');
  const arquivo = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = 'relatorio-gerencial-ecoconecta.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Relatório gerencial exportado em português.', 'download');
});

let selectedRole = 'resident';
const roleLabels = { resident: 'Morador', collector: 'Catador / Cooperativa', management: 'Empresa / Gestão' };

function showRegistrationStep(step) {
  $('#roleStep').hidden = step !== 'role';
  $('#registrationStep').hidden = step !== 'registration';
  $('#loginStep').hidden = step !== 'login';
  $('#authStepLabel').textContent = step === 'login' ? 'BEM-VINDO DE VOLTA' : step === 'registration' ? 'FINALIZE SEU CADASTRO' : 'COMECE AGORA';
  if (step === 'registration') {
    $('#registrationTitle').textContent = `Criar conta de ${roleLabels[selectedRole].toLowerCase()}`;
    $('#entityField').hidden = selectedRole === 'resident';
  }
  lucide.createIcons();
}

$$('.role-card').forEach(card => card.addEventListener('click', () => {
  $$('.role-card').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected'); selectedRole = card.dataset.role;
}));

$('#continueRegistration').addEventListener('click', () => showRegistrationStep('registration'));
$('#backToRoles').addEventListener('click', () => showRegistrationStep('role'));
$('#backToRolesFromLogin').addEventListener('click', () => showRegistrationStep('role'));
$('#existingAccountButton').addEventListener('click', () => showRegistrationStep('login'));

$('#togglePassword').addEventListener('click', () => {
  const input = $('#passwordInput'); input.type = input.type === 'password' ? 'text' : 'password';
});

function configureRole(role) {
  selectedRole = role;
  $$('.nav-item, .mobile-nav button').forEach(button => {
    button.style.display = button.dataset.module === role ? '' : 'none';
  });
  switchModule(role);
  const roleLabel = roleLabels[role];
  const profile = JSON.parse(localStorage.getItem('ecoProfile') || 'null') || { name: 'Ana Ribeiro', role: roleLabel, phone: '(81) 99999-0000', email: 'ana.ribeiro@email.com', address: 'Rua Setúbal, 812 — Boa Viagem' };
  $$('.profileName').forEach(element => element.textContent = profile.name);
  $$('.profileRole').forEach(element => element.textContent = `${roleLabel} • Recife`);
  $$('.profileInitials').forEach(element => element.textContent = profile.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase());
  $('#profileRoleModal').textContent = `${roleLabel} • Recife`;
  $('#profileNameInput').value = profile.name; $('#profilePhoneInput').value = profile.phone;
  $('#profileEmailInput').value = profile.email; $('#profileAddressInput').value = profile.address;
}

$('#registrationForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#fullNameInput').value.trim() || $('#entityNameInput').value.trim() || 'Usuário EcoConecta';
  const profile = { name, phone: '(81) 99999-0000', email: $('#emailInput').value.trim(), address: 'Recife, PE' };
  localStorage.setItem('ecoProfile', JSON.stringify(profile));
  localStorage.setItem('ecoSession', JSON.stringify({ role: selectedRole, name, createdAt: Date.now() }));
  $('#onboarding').hidden = true; document.body.classList.remove('auth-pending');
  configureRole(selectedRole); toast(`Cadastro concluído como ${roleLabels[selectedRole]}.`, 'badge-check');
});

$('#loginForm').addEventListener('submit', event => {
  event.preventDefault();
  const saved = JSON.parse(localStorage.getItem('ecoSession') || 'null') || { role: 'resident' };
  localStorage.setItem('ecoSession', JSON.stringify(saved));
  $('#onboarding').hidden = true; document.body.classList.remove('auth-pending');
  configureRole(saved.role || selectedRole); toast('Login realizado com sucesso.', 'log-in');
});

$$('.open-profile').forEach(button => button.addEventListener('click', () => openModal('profileModal')));

$('#profilePhotoInput').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => $('#profilePhotoPreview').innerHTML = `<img src="${reader.result}" alt="Foto do perfil">`;
  reader.readAsDataURL(file);
});

$('#saveProfile').addEventListener('click', () => {
  const profile = { name: $('#profileNameInput').value.trim() || 'Usuário EcoConecta', phone: $('#profilePhoneInput').value, email: $('#profileEmailInput').value, address: $('#profileAddressInput').value };
  localStorage.setItem('ecoProfile', JSON.stringify(profile));
  $$('.profileName').forEach(element => element.textContent = profile.name);
  $$('.profileInitials').forEach(element => element.textContent = profile.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase());
  closeModal($('#profileModal')); toast('Informações do perfil atualizadas.', 'save');
});

$('#darkModeToggle').addEventListener('change', event => {
  document.body.classList.toggle('dark-mode', event.target.checked);
  localStorage.setItem('ecoDarkMode', event.target.checked ? '1' : '0');
});

$('#logoutButton').addEventListener('click', () => {
  localStorage.removeItem('ecoSession'); closeModal($('#profileModal'));
  document.body.classList.add('auth-pending'); $('#onboarding').hidden = false; showRegistrationStep('role');
  toast('Você saiu da sua conta.', 'log-out');
});

$('.forgot-password')?.addEventListener('click', () => toast('Um link de recuperação foi enviado para seu e-mail ou telefone.', 'mail'));

const savedSession = JSON.parse(localStorage.getItem('ecoSession') || 'null');
if (savedSession) { $('#onboarding').hidden = true; document.body.classList.remove('auth-pending'); configureRole(savedSession.role || 'resident'); }
else { document.body.classList.add('auth-pending'); $('#onboarding').hidden = false; }

if (localStorage.getItem('ecoDarkMode') === '1') { document.body.classList.add('dark-mode'); $('#darkModeToggle').checked = true; }