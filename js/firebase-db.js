// ============================================================================
// CONEXIÓN A FIREBASE FIRESTORE Y AUTH - JNX GRAPHIC
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyBE8jJURMf1yQ3x436S9pyHoPxjSvmdxTI",
  authDomain: "jnx-cotizador.firebaseapp.com",
  projectId: "jnx-cotizador",
  storageBucket: "jnx-cotizador.firebasestorage.app",
  messagingSenderId: "927178890030",
  appId: "1:927178890030:web:27c62727b91e50267238bf"
};

let db = null;
let auth = null;
let currentHistoryTab = 'activos'; // 'activos' | 'produccion' | 'vencidos' | 'pagados' | 'cancelados'
window.loadedCloudQuotes = [];
window.loadedClients = [];
let selectedDirectoryClientId = null;
window.editingQuoteId = null;
window.editingQuoteFolio = null;
window.editingQuoteAmountPaid = 0;
window.editingQuoteStatus = 'Activo';

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "PEGA_AQUI_TU_API_KEY") {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    if (firebase.auth) {
      auth = firebase.auth();
    }
    console.log("✅ Conectado a Firebase Firestore & Auth - JNX Graphic");
  }
} catch (err) {
  console.error("Error inicializando Firebase:", err);
}

if (auth) {
  auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('loginScreen');
    const appWrapper = document.getElementById('mainAppWrapper');

    if (user) {
      if (loginScreen) loginScreen.classList.add('hidden');
      if (appWrapper) appWrapper.classList.remove('hidden');
      loadClientsFromFirebase();
    } else {
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (appWrapper) appWrapper.classList.add('hidden');
    }
  });
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const errorEl = document.getElementById('loginErrorMsg');
  const btn = document.getElementById('btnLoginSubmit');

  if (!auth) return;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (errorEl) errorEl.classList.add('hidden');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Verificando acceso...";
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    let friendlyMsg = "Correo o contraseña incorrectos. Verifica tus datos.";
    if (err.code === 'auth/operation-not-allowed') {
      friendlyMsg = "⚠️ Activa Correo/Contraseña en Firebase Console (Authentication > Sign-in method).";
    } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      friendlyMsg = "Usuario o contraseña inválidos.";
    }
    if (errorEl) {
      errorEl.textContent = friendlyMsg;
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Ingresar al Cotizador";
    }
  }
}

async function handleAdminLogout() {
  if (!auth) return;
  if (confirm("¿Deseas cerrar tu sesión en JNX Graphic?")) {
    await auth.signOut();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', (e) => {
    const input = document.getElementById('clientName');
    const list = document.getElementById('clientAutocompleteList');
    if (input && list && !input.contains(e.target) && !list.contains(e.target)) {
      list.classList.add('hidden');
    }
  });
});

// ============================================================================
// GESTIÓN DE CLIENTES
// ============================================================================
function toggleClientModal() {
  const modal = document.getElementById('clientModal');
  if (modal.classList.contains('hidden')) {
    document.getElementById('newClientForm').reset();
    const currentTypedName = document.getElementById('clientName').value.trim();
    if (currentTypedName) {
      document.getElementById('newClientName').value = currentTypedName;
    }
    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    modal.classList.add('hidden');
  }
}

async function loadClientsFromFirebase() {
  if (!db) return;
  try {
    const snapshot = await db.collection("clientes_jnx").orderBy("name", "asc").get();
    const clients = [];
    snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
    window.loadedClients = clients;
  } catch (error) {
    console.error("Error cargando clientes:", error);
  }
}

async function saveNewClientToFirebase(event) {
  event.preventDefault();
  if (!db) return;

  const name = document.getElementById('newClientName').value.trim();
  const phone = document.getElementById('newClientPhone').value.trim();
  const ruc = document.getElementById('newClientRuc').value.trim();
  const email = document.getElementById('newClientEmail').value.trim();
  const clientType = document.getElementById('newClientType').value;
  const address = document.getElementById('newClientAddress').value.trim();
  const notes = document.getElementById('newClientNotes').value.trim();

  if (!name || !phone) {
    alert("El nombre y el teléfono son obligatorios.");
    return;
  }

  const btnSubmit = document.getElementById('btnSaveClientSubmit');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span>Guardando...</span>`;
  }

  try {
    const now = new Date();
    const clientData = {
      name, phone, ruc, email, clientType, address, notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dateString: now.toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' })
    };

    const docRef = await db.collection("clientes_jnx").add(clientData);
    const savedClient = { id: docRef.id, ...clientData };

    window.loadedClients.push(savedClient);
    window.loadedClients.sort((a, b) => a.name.localeCompare(b.name));

    selectClientFromAutocomplete(savedClient);
    toggleClientModal();
    alert(`✅ Cliente "${name}" guardado exitosamente.`);
  } catch (error) {
    alert("❌ Error al guardar el cliente: " + error.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i><span>Guardar Cliente</span>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

function handleClientSearchInput(query) {
  document.getElementById('selectedClientId').value = "";
  const badge = document.getElementById('clientLinkedBadge');
  if (badge) badge.classList.add('hidden');

  const list = document.getElementById('clientAutocompleteList');
  const term = query.trim().toLowerCase();

  if (!term || window.loadedClients.length === 0) {
    list.classList.add('hidden');
    return;
  }

  const matches = window.loadedClients.filter(c =>
    (c.name && c.name.toLowerCase().includes(term)) ||
    (c.phone && c.phone.toLowerCase().includes(term)) ||
    (c.ruc && c.ruc.toLowerCase().includes(term))
  ).slice(0, 8);

  if (matches.length === 0) {
    list.innerHTML = `
      <div class="p-3 text-xs text-slate-400 flex items-center justify-between">
        <span>No se encontró "${query}"</span>
        <button type="button" onclick="toggleClientModal()" class="text-cyan-400 font-bold hover:underline">+ Registrar</button>
      </div>
    `;
    list.classList.remove('hidden');
    return;
  }

  list.innerHTML = matches.map(c => {
    const contactDisplay = [c.phone, c.ruc ? `RUC: ${c.ruc}` : ''].filter(Boolean).join(' • ');
    return `
      <button type="button" onclick="selectClientById('${c.id}')"
        class="w-full text-left px-3.5 py-2.5 hover:bg-slate-900 transition flex flex-col gap-0.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white">${c.name}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 border border-slate-700">${c.clientType || 'Cliente'}</span>
        </div>
        <span class="text-[11px] text-slate-400">${contactDisplay || 'Sin contacto registrado'}</span>
      </button>
    `;
  }).join('');

  list.classList.remove('hidden');
}

function selectClientById(clientId) {
  const client = window.loadedClients.find(c => c.id === clientId);
  if (client) selectClientFromAutocomplete(client);
}

function selectClientFromAutocomplete(client) {
  document.getElementById('clientName').value = client.name || '';
  document.getElementById('selectedClientId').value = client.id || '';

  const contactParts = [];
  if (client.phone) contactParts.push(client.phone);
  if (client.ruc) contactParts.push(`RUC: ${client.ruc}`);
  document.getElementById('clientContact').value = contactParts.join(' / ');

  const badge = document.getElementById('clientLinkedBadge');
  if (badge) badge.classList.remove('hidden');

  const list = document.getElementById('clientAutocompleteList');
  if (list) list.classList.add('hidden');
}

// ============================================================================
// CONSECUTIVO SECUENCIAL Y GUARDADO DE COTIZACIÓN
// ============================================================================
async function getNextFolioSequential() {
  const counterRef = db.collection("config_jnx").doc("contadores");
  try {
    const doc = await counterRef.get();
    let nextNumber = 1;
    if (doc.exists && typeof doc.data().ultimoFolio === 'number') {
      nextNumber = doc.data().ultimoFolio + 1;
    } else {
      const snap = await db.collection("cotizaciones_jnx").get();
      nextNumber = snap.size + 1;
    }
    await counterRef.set({ ultimoFolio: nextNumber }, { merge: true });
    return `JNX-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    const snap = await db.collection("cotizaciones_jnx").get();
    return `JNX-${String(snap.size + 1).padStart(5, '0')}`;
  }
}

async function saveQuoteToFirebase() {
  if (!db) {
    alert("⚠️ Error de conexión con Firebase.");
    return;
  }

  const client = document.getElementById('clientName').value.trim() || 'Cliente General';
  const clientId = document.getElementById('selectedClientId')?.value.trim() || null;
  const contact = document.getElementById('clientContact')?.value.trim() || '';
  const project = document.getElementById('projectDesc').value.trim() || 'Sin referencia';
  const deliveryDate = document.getElementById('deliveryDate')?.value || '';
  const itemsToSave = cart.length > 0 ? cart : (currentCalculation ? [currentCalculation] : []);

  if (itemsToSave.length === 0) {
    alert("⚠️ Por favor, configura o agrega al menos un producto antes de guardar la cotización.");
    return;
  }

  const transSel = document.getElementById('transportSelect');
  const globalTransport = transSel && transSel.value !== "" ? parseFloat(transSel.value) : 0;
  const urgSel = document.getElementById('urgencySelect');
  const globalUrgencyRate = urgSel && urgSel.value !== "" ? parseFloat(urgSel.value) : 0;
  const depositRate = typeof getSelectedDepositRate === 'function' ? getSelectedDepositRate() : 0.60;

  let itemsSubtotal = 0;
  let itemsProfit = 0;
  itemsToSave.forEach(it => {
    itemsSubtotal += it.finalClientTotal;
    itemsProfit += it.netProfit;
  });

  const urgencyAmount = (itemsSubtotal + globalTransport) * globalUrgencyRate;
  const subtotalBeforeDiscount = itemsSubtotal + globalTransport + urgencyAmount;
  const { discountAmount, label: discountLabel } = typeof getCommercialDiscountData === 'function'
    ? getCommercialDiscountData(subtotalBeforeDiscount)
    : { discountAmount: 0, label: '' };

  const grandTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const depositAmount = Number((grandTotal * depositRate).toFixed(2));
  const totalNetProfit = itemsProfit + urgencyAmount - discountAmount;

  const btnSave = document.getElementById('btnSaveCloudText');
  if (btnSave) btnSave.textContent = window.editingQuoteId ? "Actualizando cotización..." : "Guardando en la nube...";

  try {
    const now = new Date();

    if (window.editingQuoteId) {
      const prevPaid = Number(window.editingQuoteAmountPaid || 0);
      const newBalanceDue = Math.max(0, Number((grandTotal - prevPaid).toFixed(2)));

      await db.collection("cotizaciones_jnx").doc(window.editingQuoteId).update({
        clientId: clientId,
        clientName: client,
        clientContact: contact,
        projectDesc: project,
        deliveryDate: deliveryDate,
        items: itemsToSave,
        transportCost: globalTransport,
        urgencyRate: globalUrgencyRate,
        urgencyAmount: urgencyAmount,
        discountAmount: discountAmount,
        discountLabel: discountLabel,
        grandTotal: Number(grandTotal.toFixed(2)),
        depositRate: depositRate,
        deposit50: depositAmount,
        balanceDue: newBalanceDue,
        netProfit: Number(totalNetProfit.toFixed(2)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const updatedFolio = window.editingQuoteFolio;
      alert(`✅ ¡Cotización actualizada con éxito!\n\nFolio mantenido: ${updatedFolio}\nCliente: ${client}\nNuevo Total: $${grandTotal.toFixed(2)}`);
      clearFullQuoterScreen();
      return;
    }

    const quoteFolio = await getNextFolioSequential();

    await db.collection("cotizaciones_jnx").add({
      folio: quoteFolio,
      status: 'Activo',
      clientId: clientId,
      clientName: client,
      clientContact: contact,
      projectDesc: project,
      deliveryDate: deliveryDate,
      items: itemsToSave,
      transportCost: globalTransport,
      urgencyRate: globalUrgencyRate,
      urgencyAmount: urgencyAmount,
      discountAmount: discountAmount,
      discountLabel: discountLabel,
      grandTotal: Number(grandTotal.toFixed(2)),
      depositRate: depositRate,
      deposit50: depositAmount,
      amountPaid: 0,
      balanceDue: Number(grandTotal.toFixed(2)),
      payments: [],
      netProfit: Number(totalNetProfit.toFixed(2)),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dateString: now.toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      timestampMs: now.getTime()
    });

    alert(`✅ ¡Cotización registrada con éxito!\n\nFolio: ${quoteFolio}\nCliente: ${client}\nTotal: $${grandTotal.toFixed(2)}`);
    clearFullQuoterScreen();
  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("❌ Error al guardar en Firebase: " + error.message);
  } finally {
    if (btnSave) {
      btnSave.textContent = window.editingQuoteId
        ? `Actualizar Cotización (${window.editingQuoteFolio})`
        : "Guardar Cotización en la Nube (Firebase)";
    }
  }
}

function clearFullQuoterScreen() {
  window.editingQuoteId = null;
  window.editingQuoteFolio = null;
  window.editingQuoteAmountPaid = 0;
  window.editingQuoteStatus = 'Activo';

  if (document.getElementById('editingFolioBadge')) {
    document.getElementById('editingFolioBadge').classList.add('hidden');
  }
  if (document.getElementById('btnSaveCloudText')) {
    document.getElementById('btnSaveCloudText').textContent = "Guardar Cotización en la Nube (Firebase)";
  }

  document.getElementById('clientName').value = "";
  if (document.getElementById('selectedClientId')) document.getElementById('selectedClientId').value = "";
  if (document.getElementById('clientLinkedBadge')) document.getElementById('clientLinkedBadge').classList.add('hidden');
  if (document.getElementById('clientContact')) document.getElementById('clientContact').value = "";
  document.getElementById('projectDesc').value = "";
  if (document.getElementById('deliveryDate')) document.getElementById('deliveryDate').value = "";

  const transSel = document.getElementById('transportSelect');
  if (transSel) transSel.value = "";
  const urgSel = document.getElementById('urgencySelect');
  if (urgSel) urgSel.value = "";

  if (document.getElementById('discountSelect')) document.getElementById('discountSelect').value = "0";
  if (document.getElementById('customDiscountValue')) document.getElementById('customDiscountValue').value = "0";
  if (document.getElementById('discountReasonInput')) document.getElementById('discountReasonInput').value = "";
  if (typeof toggleCustomDiscountInput === 'function') toggleCustomDiscountInput();
  if (typeof toggleExtrasSection === 'function') toggleExtrasSection(false);

  if (document.getElementById('depositRateSelect')) document.getElementById('depositRateSelect').value = "0.60";

  clearCart();
  resetItemForm();
}

// ============================================================================
// HISTORIAL CON 5 PESTAÑAS (ACTIVOS, EN PRODUCCIÓN, VENCIDOS, PAGADOS, CANCELADOS)
// ============================================================================
async function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    await loadQuotesFromFirebase();
  } else {
    modal.classList.add('hidden');
  }
}

function switchHistoryTab(tabName) {
  currentHistoryTab = tabName;

  const tabs = ['activos', 'produccion', 'vencidos', 'pagados', 'cancelados'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab_${t}`);
    if (!btn) return;
    if (t === tabName) {
      btn.className = "history-tab px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20";
    } else {
      btn.className = "history-tab px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200";
    }
  });

  renderFilteredQuotes();
}

async function loadQuotesFromFirebase() {
  const container = document.getElementById('historyListContainer');
  if (!db) return;

  container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Cargando cotizaciones desde Firebase...</div>`;

  try {
    const snapshot = await db.collection("cotizaciones_jnx").orderBy("createdAt", "desc").limit(80).get();
    if (snapshot.empty) {
      container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Aún no hay cotizaciones guardadas.</div>`;
      updateTabBadges([], [], [], [], []);
      return;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    window.loadedCloudQuotes = docs;

    renderFilteredQuotes();
  } catch (error) {
    container.innerHTML = `<div class="p-6 text-center text-rose-400 text-xs">Error al conectar: ${error.message}</div>`;
  }
}

function getDeliveryAlertBadge(deliveryDateStr, status) {
  if (!deliveryDateStr || status === 'Pagado' || status === 'Cancelado') return '';
  const todayStr = new Date().toISOString().split('T')[0];

  if (deliveryDateStr < todayStr) {
    return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">⚠️ Entrega Atrasada (${deliveryDateStr})</span>`;
  } else if (deliveryDateStr === todayStr) {
    return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">🔥 Entrega HOY</span>`;
  } else {
    return `<span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">📅 Entrega: ${deliveryDateStr}</span>`;
  }
}

function renderFilteredQuotes() {
  const container = document.getElementById('historyListContainer');
  const allDocs = window.loadedCloudQuotes || [];
  const nowMs = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const cancelados = [];
  const pagados = [];
  const produccion = [];
  const vencidos = [];
  const activos = [];

  allDocs.forEach(q => {
    const status = q.status || 'Activo';
    const createdAtMs = q.createdAt ? (q.createdAt.toMillis ? q.createdAt.toMillis() : (q.timestampMs || nowMs)) : (q.timestampMs || nowMs);
    const diffMs = nowMs - createdAtMs;

    if (status === 'Cancelado') {
      cancelados.push(q);
    } else if (status === 'Pagado') {
      pagados.push(q);
    } else if (status === 'En Producción') {
      produccion.push(q);
    } else if (diffMs > threeDaysMs) {
      vencidos.push(q);
    } else if (diffMs <= thirtyDaysMs) {
      activos.push(q);
    } else {
      vencidos.push(q);
    }
  });

  updateTabBadges(activos, produccion, vencidos, pagados, cancelados);

  let currentList = [];
  if (currentHistoryTab === 'activos') currentList = activos;
  else if (currentHistoryTab === 'produccion') currentList = produccion;
  else if (currentHistoryTab === 'vencidos') currentList = vencidos;
  else if (currentHistoryTab === 'pagados') currentList = pagados;
  else if (currentHistoryTab === 'cancelados') currentList = cancelados;

  if (currentList.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 text-xs">No hay cotizaciones en la sección <b>${currentHistoryTab.toUpperCase()}</b>.</div>`;
    return;
  }

  container.innerHTML = currentList.map(q => {
    const isCancelled = q.status === 'Cancelado';
    const isPaid = q.status === 'Pagado';
    const isInProduction = q.status === 'En Producción';
    const isExpired = currentHistoryTab === 'vencidos';

    const grandTotal = Number(q.grandTotal || 0);
    const amountPaid = isPaid ? grandTotal : Number(q.amountPaid || 0);
    const balanceDue = isPaid ? 0 : Math.max(0, grandTotal - amountPaid);
    const depRate = Number(q.depositRate || 0.60);
    const depPct = Math.round(depRate * 100);
    const suggestedDep = Number(q.deposit50 || (grandTotal * depRate));

    let badgeColor = "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30";
    let statusLabel = "";

    if (isCancelled) {
      badgeColor = "bg-rose-500/20 text-rose-400 border border-rose-500/30 line-through";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">Cancelado</span>';
    } else if (isPaid) {
      badgeColor = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Pagado 100%</span>';
    } else if (isInProduction) {
      badgeColor = "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-700">⚙️ En Producción</span>';
    } else if (isExpired) {
      badgeColor = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">Vencido</span>';
    }

    const deliveryAlert = getDeliveryAlertBadge(q.deliveryDate, q.status);

    const financialLine = (amountPaid > 0 && !isPaid)
      ? `Abonado: <span class="text-emerald-400 font-bold">$${amountPaid.toFixed(2)}</span> • Saldo Pendiente: <span class="text-amber-400 font-extrabold">$${balanceDue.toFixed(2)}</span>`
      : `Abono ${depPct}% sugerido: <span class="text-emerald-400 font-semibold">$${suggestedDep.toFixed(2)}</span>`;

    return `
      <div class="bg-slate-900/90 border ${isCancelled ? 'border-rose-900/40 opacity-70' : isInProduction ? 'border-indigo-500/40' : 'border-slate-800 hover:border-cyan-500/40'} rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded ${badgeColor}">
              ${q.folio || 'S/N'}
            </span>
            <span class="text-xs text-slate-400">${q.dateString || ''}</span>
            ${statusLabel}
            ${deliveryAlert}
          </div>
          <p class="text-sm font-bold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">
            ${q.clientName} <span class="text-xs font-normal text-slate-400">• ${q.projectDesc}</span>
          </p>
          <p class="text-[11px] text-slate-400">
            ${(q.items || []).length} ítem(s) • ${financialLine}
          </p>
        </div>
        
        <div class="flex flex-wrap md:flex-nowrap items-center gap-1.5 self-end md:self-center shrink-0">
          <div class="text-right mr-1.5 shrink-0">
            <span class="block text-[9px] text-slate-400 uppercase">Total</span>
            <span class="text-sm font-extrabold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">$${grandTotal.toFixed(2)}</span>
          </div>

          <button onclick="printDirectQuoteFromCloud('${q.id}')" title="Descargar / Imprimir comprobante PDF"
            class="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-[11px] font-bold transition flex items-center gap-1 shrink-0">
            <i data-lucide="printer" class="w-3 h-3"></i>
            <span>PDF</span>
          </button>

          ${!isCancelled && !isPaid ? `
            <button onclick="openPaymentModal('${q.id}')" title="Registrar Abono / Producción"
              class="px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition flex items-center gap-1 shrink-0">
              <i data-lucide="wallet" class="w-3 h-3"></i>
              <span>Abonar</span>
            </button>
            <button onclick="restoreQuoteFromCloud('${q.id}')" title="Cargar al cotizador"
              class="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition shrink-0">
              Cargar
            </button>
            <button onclick="markQuoteAsPaid('${q.id}', '${q.folio}')" title="Liquidar 100% y marcar Pagado"
              class="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shrink-0">
              Pagado
            </button>
            <button onclick="cancelQuoteInCloud('${q.id}', '${q.folio}')" title="Cancelar cotización"
              class="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-[11px] font-semibold border border-slate-700 transition shrink-0">
              Cancelar
            </button>
          ` : ''}

          ${isPaid ? `
            <button onclick="restoreQuoteFromCloud('${q.id}')" title="Cargar al cotizador"
              class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-[11px] transition shrink-0">
              Cargar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateTabBadges(activos, produccion, vencidos, pagados, cancelados) {
  if (document.getElementById('badge_activos')) document.getElementById('badge_activos').textContent = activos.length;
  if (document.getElementById('badge_produccion')) document.getElementById('badge_produccion').textContent = produccion.length;
  if (document.getElementById('badge_vencidos')) document.getElementById('badge_vencidos').textContent = vencidos.length;
  if (document.getElementById('badge_pagados')) document.getElementById('badge_pagados').textContent = pagados.length;
  if (document.getElementById('badge_cancelados')) document.getElementById('badge_cancelados').textContent = cancelados.length;
}

// ============================================================================
// MODAL Y LÓGICA DE ABONOS PARCIALES / PRODUCCIÓN
// ============================================================================
let activePaymentQuote = null;

function openPaymentModal(docId) {
  const q = (window.loadedCloudQuotes || []).find(item => item.id === docId);
  if (!q) return;
  activePaymentQuote = q;

  const grandTotal = Number(q.grandTotal || 0);
  const paidSoFar = Number(q.amountPaid || 0);
  const remaining = Math.max(0, grandTotal - paidSoFar);
  const depRate = Number(q.depositRate || 0.60);

  document.getElementById('payModalDocId').value = docId;
  document.getElementById('payModalSubtitle').textContent = `${q.folio} • ${q.clientName}`;
  document.getElementById('payModalTotal').textContent = `$${grandTotal.toFixed(2)}`;
  document.getElementById('payModalPaidSoFar').textContent = `$${paidSoFar.toFixed(2)}`;
  document.getElementById('payModalRemaining').textContent = `$${remaining.toFixed(2)}`;

  const suggestedAmount = paidSoFar === 0 ? (grandTotal * depRate) : remaining;
  document.getElementById('payModalAmount').value = suggestedAmount.toFixed(2);
  document.getElementById('payModalDeliveryDate').value = q.deliveryDate || '';
  document.getElementById('payModalRef').value = '';

  document.getElementById('paymentModal').classList.remove('hidden');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  activePaymentQuote = null;
}

function fillHalfOrRemainingPayment() {
  if (!activePaymentQuote) return;
  const grandTotal = Number(activePaymentQuote.grandTotal || 0);
  const paidSoFar = Number(activePaymentQuote.amountPaid || 0);
  const remaining = Math.max(0, grandTotal - paidSoFar);
  const depRate = Number(activePaymentQuote.depositRate || 0.60);
  const val = paidSoFar === 0 ? (grandTotal * depRate) : remaining;
  document.getElementById('payModalAmount').value = val.toFixed(2);
}

async function submitQuotePayment(event) {
  event.preventDefault();
  if (!db || !activePaymentQuote) return;

  const docId = document.getElementById('payModalDocId').value;
  const currentFolio = activePaymentQuote.folio || 'S/N';
  const amount = parseFloat(document.getElementById('payModalAmount').value);
  const method = document.getElementById('payModalMethod').value;
  const newDeliveryDate = document.getElementById('payModalDeliveryDate').value;
  const ref = document.getElementById('payModalRef').value.trim();

  if (isNaN(amount) || amount <= 0) {
    alert("Ingresa un monto de abono válido.");
    return;
  }

  const grandTotal = Number(activePaymentQuote.grandTotal || 0);
  const prevPaid = Number(activePaymentQuote.amountPaid || 0);
  const newTotalPaid = Number((prevPaid + amount).toFixed(2));
  const newBalanceDue = Math.max(0, Number((grandTotal - newTotalPaid).toFixed(2)));

  const newStatus = newBalanceDue <= 0.01 ? 'Pagado' : 'En Producción';

  const paymentRecord = {
    amount: Number(amount.toFixed(2)),
    method,
    reference: ref,
    date: new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  const existingPayments = Array.isArray(activePaymentQuote.payments) ? [...activePaymentQuote.payments] : [];
  existingPayments.push(paymentRecord);

  const btn = document.getElementById('btnSubmitPayment');
  btn.disabled = true;
  btn.textContent = "Registrando...";

  try {
    await db.collection("cotizaciones_jnx").doc(docId).update({
      status: newStatus,
      amountPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      deliveryDate: newDeliveryDate,
      payments: existingPayments,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closePaymentModal();

    alert(newStatus === 'Pagado'
      ? `✅ Pago registrado. La orden ${currentFolio} ha sido liquidada al 100% y movida a PAGADOS.`
      : `⚙️ Abono de $${amount.toFixed(2)} (${method}) registrado.\n\nLa orden ${currentFolio} pasó a EN PRODUCCIÓN.\nSaldo pendiente: $${newBalanceDue.toFixed(2)}`
    );

    await loadQuotesFromFirebase();
  } catch (err) {
    alert("❌ Error al registrar el abono: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar Abono";
  }
}

// ============================================================================
// ACCIONES: CARGAR, PAGAR 100%, CANCELAR E IMPRIMIR DIRECTO
// ============================================================================
function restoreQuoteFromCloud(docId) {
  const q = (window.loadedCloudQuotes || []).find(item => item.id === docId);
  if (!q || q.status === 'Cancelado') return;

  window.editingQuoteId = q.id;
  window.editingQuoteFolio = q.folio || 'S/N';
  window.editingQuoteAmountPaid = Number(q.amountPaid || 0);
  window.editingQuoteStatus = q.status || 'Activo';

  const editBadge = document.getElementById('editingFolioBadge');
  const editText = document.getElementById('editingFolioText');
  if (editBadge && editText) {
    editText.textContent = `Editando: ${window.editingQuoteFolio}`;
    editBadge.classList.remove('hidden');
  }

  const btnSave = document.getElementById('btnSaveCloudText');
  if (btnSave) {
    btnSave.textContent = `Actualizar Cotización (${window.editingQuoteFolio})`;
  }

  document.getElementById('clientName').value = q.clientName || '';
  if (document.getElementById('selectedClientId')) document.getElementById('selectedClientId').value = q.clientId || '';
  if (document.getElementById('clientLinkedBadge')) {
    if (q.clientId) document.getElementById('clientLinkedBadge').classList.remove('hidden');
    else document.getElementById('clientLinkedBadge').classList.add('hidden');
  }
  if (document.getElementById('clientContact')) document.getElementById('clientContact').value = q.clientContact || '';
  document.getElementById('projectDesc').value = q.projectDesc || '';
  if (document.getElementById('deliveryDate')) document.getElementById('deliveryDate').value = q.deliveryDate || '';

  const hasTransport = q.transportCost !== undefined && Number(q.transportCost) > 0;
  const hasUrgency = q.urgencyRate !== undefined && Number(q.urgencyRate) > 0;
  const hasDiscount = q.discountAmount !== undefined && Number(q.discountAmount) > 0;

  if (q.transportCost !== undefined) {
    document.getElementById('transportSelect').value = String(q.transportCost);
  }
  if (q.urgencyRate !== undefined) {
    document.getElementById('urgencySelect').value = String(q.urgencyRate);
  }

  if (hasDiscount && document.getElementById('discountSelect')) {
    document.getElementById('discountSelect').value = "custom_fixed";
    document.getElementById('customDiscountValue').value = Number(q.discountAmount).toFixed(2);
    const cleanReason = (q.discountLabel || '').split('•')[1]?.trim() || '';
    if (document.getElementById('discountReasonInput')) document.getElementById('discountReasonInput').value = cleanReason;
    if (typeof toggleCustomDiscountInput === 'function') toggleCustomDiscountInput();
  } else if (document.getElementById('discountSelect')) {
    document.getElementById('discountSelect').value = "0";
    if (typeof toggleCustomDiscountInput === 'function') toggleCustomDiscountInput();
  }

  if (typeof toggleExtrasSection === 'function') {
    toggleExtrasSection(hasTransport || hasUrgency || hasDiscount);
  }

  if (document.getElementById('depositRateSelect')) {
    document.getElementById('depositRateSelect').value = q.depositRate ? Number(q.depositRate).toFixed(2) : "0.60";
    manualDepositRateOverride = Boolean(q.depositRate);
  }

  cart = Array.isArray(q.items) ? q.items.map(it => ({ ...it, id: Date.now() + Math.random() })) : [];
  renderCart();

  const histModal = document.getElementById('historyModal');
  if (histModal && !histModal.classList.contains('hidden')) {
    histModal.classList.add('hidden');
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function markQuoteAsPaid(docId, folio) {
  const q = (window.loadedCloudQuotes || []).find(item => item.id === docId);
  const grandTotal = q ? Number(q.grandTotal || 0) : 0;

  if (!confirm(`¿Confirmas que la cotización ${folio} ha sido liquidada al 100% ($${grandTotal.toFixed(2)})?`)) return;

  try {
    await db.collection("cotizaciones_jnx").doc(docId).update({
      status: 'Pagado',
      amountPaid: grandTotal,
      balanceDue: 0,
      paidAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadQuotesFromFirebase();
  } catch (err) {
    alert("No se pudo actualizar a Pagado: " + err.message);
  }
}

async function cancelQuoteInCloud(docId, folio) {
  if (!confirm(`¿Deseas marcar la cotización ${folio} como CANCELADA?\n(El consecutivo se mantendrá y no se perderá la correlación numérica).`)) return;

  try {
    await db.collection("cotizaciones_jnx").doc(docId).update({
      status: 'Cancelado',
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadQuotesFromFirebase();
  } catch (err) {
    alert("No se pudo cancelar la cotización: " + err.message);
  }
}

function printDirectQuoteFromCloud(docId) {
  const q = (window.loadedCloudQuotes || []).find(item => item.id === docId);
  if (!q) return;

  const itemsToPrint = Array.isArray(q.items) && q.items.length > 0 ? q.items : [];
  if (itemsToPrint.length === 0) {
    alert("Esta cotización no contiene productos para imprimir.");
    return;
  }

  const globalTransport = Number(q.transportCost || 0);
  const urgencyAmount = Number(q.urgencyAmount || 0);
  const discountAmount = Number(q.discountAmount || 0);
  const grandTotal = Number(q.grandTotal || 0);
  const amountPaid = Number(q.amountPaid || 0);
  const depRate = Number(q.depositRate || 0.60);
  const depPct = Math.round(depRate * 100);
  const deposit50 = Number(q.deposit50 || (grandTotal * depRate));

  if (typeof updatePdfTermsByRate === 'function') updatePdfTermsByRate(depRate);

  if (document.getElementById('pdfQuoteNumber')) document.getElementById('pdfQuoteNumber').textContent = `N° ${q.folio || 'JNX-00000'}`;
  if (document.getElementById('pdfDate')) document.getElementById('pdfDate').textContent = `Fecha: ${q.dateString || 'Cotización Oficial'}`;
  if (document.getElementById('pdfClientName')) document.getElementById('pdfClientName').textContent = q.clientName || 'Cliente General';
  if (document.getElementById('pdfClientContact')) document.getElementById('pdfClientContact').textContent = q.clientContact ? `Contacto / RUC: ${q.clientContact}` : '';
  if (document.getElementById('pdfProjectDesc')) document.getElementById('pdfProjectDesc').textContent = q.projectDesc || 'Pedido de Personalización';
  if (document.getElementById('pdfDeliveryDate')) {
    document.getElementById('pdfDeliveryDate').textContent = q.deliveryDate ? `Entrega estimada: ${q.deliveryDate}` : '';
  }

  let itemsSubtotal = 0;
  const tbody = document.getElementById('pdfTableBody');
  if (tbody) {
    tbody.innerHTML = itemsToPrint.map(item => {
      itemsSubtotal += Number(item.finalClientTotal || 0);
      const cleanTech = item.techniqueName ? item.techniqueName.split('(')[0].trim() : 'Personalización';
      const cleanPlace = item.placementName ? item.placementName.split('(')[0].trim() : '';
      return `
        <tr>
          <td class="py-3.5 px-4 font-bold text-slate-900">${item.qtyText || item.qty}</td>
          <td class="py-3.5 px-4">
            <p class="font-bold text-slate-900 text-sm">${item.productName}</p>
            <p class="text-slate-600">Técnica: ${cleanTech} • Cobertura: ${cleanPlace}</p>
          </td>
          <td class="py-3.5 px-4 text-right font-semibold text-slate-800">$${Number(item.unitClientPrice || 0).toFixed(2)}</td>
          <td class="py-3.5 px-4 text-right font-extrabold text-slate-900">$${Number(item.finalClientTotal || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  if (document.getElementById('pdfSubtotal')) document.getElementById('pdfSubtotal').textContent = `$${itemsSubtotal.toFixed(2)}`;

  const pdfTransRow = document.getElementById('pdfTransportRow');
  if (globalTransport > 0 && pdfTransRow) {
    pdfTransRow.classList.remove('hidden');
    document.getElementById('pdfTransportCost').textContent = `+$${globalTransport.toFixed(2)}`;
  } else if (pdfTransRow) {
    pdfTransRow.classList.add('hidden');
  }

  const pdfUrgRow = document.getElementById('pdfUrgencyRow');
  if (urgencyAmount > 0 && pdfUrgRow) {
    pdfUrgRow.classList.remove('hidden');
    document.getElementById('pdfUrgencyCost').textContent = `+$${urgencyAmount.toFixed(2)}`;
  } else if (pdfUrgRow) {
    pdfUrgRow.classList.add('hidden');
  }

  const pdfDiscRow = document.getElementById('pdfDiscountRow');
  if (discountAmount > 0 && pdfDiscRow) {
    pdfDiscRow.classList.remove('hidden');
    document.getElementById('pdfDiscountLabel').textContent = `${q.discountLabel || 'Descuento Comercial'}:`;
    document.getElementById('pdfDiscountCost').textContent = `-$${discountAmount.toFixed(2)}`;
  } else if (pdfDiscRow) {
    pdfDiscRow.classList.add('hidden');
  }

  if (document.getElementById('pdfGrandTotal')) document.getElementById('pdfGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;

  const depLabel = document.getElementById('pdfDepositLabel');
  const depVal = document.getElementById('pdfDeposit');
  const balRow = document.getElementById('pdfBalanceRow');
  const balVal = document.getElementById('pdfBalance');

  if (q.status === 'Pagado') {
    if (depLabel) depLabel.textContent = 'Total Pagado (100%):';
    if (depVal) depVal.textContent = `$${grandTotal.toFixed(2)}`;
    if (balRow) balRow.classList.add('hidden');
  } else if (amountPaid > 0) {
    const remaining = Math.max(0, grandTotal - amountPaid);
    if (depLabel) depLabel.textContent = 'Abono Recibido:';
    if (depVal) depVal.textContent = `$${amountPaid.toFixed(2)}`;
    if (balRow && balVal) {
      balRow.classList.remove('hidden');
      balVal.textContent = `$${remaining.toFixed(2)}`;
    }
  } else {
    if (depLabel) depLabel.textContent = depPct >= 100 ? 'Pago total requerido (100%):' : `Abono ${depPct}% para iniciar:`;
    if (depVal) depVal.textContent = `$${deposit50.toFixed(2)}`;
    if (balRow) balRow.classList.add('hidden');
  }

  const hasItbms = itemsToPrint.some(item => Number(item.itbmsAmount || 0) > 0 || item.includeItbms === true);
  const itbmsNoteEl = document.getElementById('pdfItbmsNote');
  if (itbmsNoteEl) {
    if (hasItbms) itbmsNoteEl.classList.remove('hidden');
    else itbmsNoteEl.classList.add('hidden');
  }

  window.print();
}

// ============================================================================
// DIRECTORIO DE CLIENTES E HISTORIAL INDIVIDUAL POR CLIENTE
// ============================================================================
async function toggleClientsDirectoryModal() {
  const modal = document.getElementById('clientsDirectoryModal');
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    document.getElementById('directorySearchInput').value = '';
    selectedDirectoryClientId = null;

    await Promise.all([
      loadClientsFromFirebase(),
      ensureQuotesLoadedForDirectory()
    ]);

    filterClientsDirectory('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    modal.classList.add('hidden');
  }
}

async function ensureQuotesLoadedForDirectory() {
  if (!db) return;
  try {
    const snapshot = await db.collection("cotizaciones_jnx").orderBy("createdAt", "desc").limit(150).get();
    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    window.loadedCloudQuotes = docs;
  } catch (err) {
    console.error("Error cargando cotizaciones para directorio:", err);
  }
}

function filterClientsDirectory(query) {
  const container = document.getElementById('directoryClientsList');
  const term = query.trim().toLowerCase();
  const clients = window.loadedClients || [];

  if (clients.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-8">No hay clientes registrados aún.</p>`;
    return;
  }

  const filtered = clients.filter(c =>
    (c.name && c.name.toLowerCase().includes(term)) ||
    (c.phone && c.phone.toLowerCase().includes(term)) ||
    (c.ruc && c.ruc.toLowerCase().includes(term)) ||
    (c.clientType && c.clientType.toLowerCase().includes(term))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-8">No se encontraron coincidencias para "${query}".</p>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isSelected = c.id === selectedDirectoryClientId;
    const clientQuotesCount = (window.loadedCloudQuotes || []).filter(q =>
      (q.clientId && q.clientId === c.id) ||
      (!q.clientId && q.clientName && q.clientName.trim().toLowerCase() === c.name.trim().toLowerCase())
    ).length;

    return `
      <button type="button" onclick="viewClientHistoryDetail('${c.id}')"
        class="w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2 ${isSelected ? 'bg-cyan-500/15 border-cyan-500 text-white' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-200'}">
        <div class="min-w-0">
          <p class="text-xs font-bold truncate">${c.name}</p>
          <p class="text-[11px] text-slate-400 truncate">${c.phone || 'Sin teléfono'} ${c.ruc ? '• RUC: ' + c.ruc : ''}</p>
        </div>
        <span class="shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${clientQuotesCount > 0 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}">
          ${clientQuotesCount} cot.
        </span>
      </button>
    `;
  }).join('');
}

function viewClientHistoryDetail(clientId) {
  selectedDirectoryClientId = clientId;
  filterClientsDirectory(document.getElementById('directorySearchInput').value);

  const client = (window.loadedClients || []).find(c => c.id === clientId);
  const detailContainer = document.getElementById('directoryClientDetail');
  if (!client || !detailContainer) return;

  const clientQuotes = (window.loadedCloudQuotes || []).filter(q =>
    (q.clientId && q.clientId === client.id) ||
    (!q.clientId && q.clientName && q.clientName.trim().toLowerCase() === client.name.trim().toLowerCase())
  );

  let totalPaid = 0;
  let totalActive = 0;
  clientQuotes.forEach(q => {
    if (q.status === 'Pagado') totalPaid += Number(q.grandTotal || 0);
    else if (q.status !== 'Cancelado') {
      totalPaid += Number(q.amountPaid || 0);
      totalActive += Number(q.balanceDue !== undefined ? q.balanceDue : q.grandTotal || 0);
    }
  });

  const quotesHTML = clientQuotes.length === 0
    ? `<p class="text-xs text-slate-500 text-center py-6 bg-slate-950/50 rounded-xl border border-slate-800/70">Este cliente aún no tiene cotizaciones registradas.</p>`
    : clientQuotes.map(q => {
      const isCancelled = q.status === 'Cancelado';
      const isPaid = q.status === 'Pagado';
      const isProd = q.status === 'En Producción';
      let statusTag = `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400">Activo</span>`;
      if (isCancelled) statusTag = `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">Cancelado</span>`;
      if (isPaid) statusTag = `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Pagado</span>`;
      if (isProd) statusTag = `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">En Producción</span>`;

      return `
          <div class="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-white">${q.folio || 'S/N'}</span>
                ${statusTag}
                <span class="text-[11px] text-slate-500">${q.dateString || ''}</span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">${q.projectDesc || 'Sin proyecto'} • <span class="text-slate-400">${(q.items || []).length} ítem(s)</span></p>
            </div>
            <div class="flex items-center gap-2 self-end sm:self-center">
              <span class="text-sm font-extrabold text-white mr-1">$${Number(q.grandTotal || 0).toFixed(2)}</span>
              <button onclick="printDirectQuoteFromCloud('${q.id}')" title="Imprimir PDF"
                class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition">
                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
              </button>
              ${!isCancelled ? `
                <button onclick="toggleClientsDirectoryModal(); restoreQuoteFromCloud('${q.id}');"
                  class="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition">
                  Cargar
                </button>
              ` : ''}
            </div>
          </div>
        `;
    }).join('');

  detailContainer.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">${client.clientType || 'Cliente'}</span>
          <h4 class="text-base font-extrabold text-white mt-1">${client.name}</h4>
          <div class="text-xs text-slate-400 space-y-0.5 mt-1">
            <p>📞 ${client.phone || 'N/A'} ${client.ruc ? `• 🆔 RUC: ${client.ruc}` : ''}</p>
            ${client.email ? `<p>✉️ ${client.email}</p>` : ''}
            ${client.address ? `<p>📍 ${client.address}</p>` : ''}
            ${client.notes ? `<p class="text-amber-300/90 italic mt-1">📝 "${client.notes}"</p>` : ''}
          </div>
        </div>
        <button onclick="startNewQuoteForClient('${client.id}')"
          class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition flex items-center gap-1.5">
          <i data-lucide="file-plus" class="w-3.5 h-3.5"></i>
          <span>Nueva Cotización</span>
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span class="block text-[10px] text-slate-400 uppercase">Cotizaciones</span>
          <span class="text-sm font-extrabold text-white">${clientQuotes.length}</span>
        </div>
        <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span class="block text-[10px] text-slate-400 uppercase">Total Cobrado</span>
          <span class="text-sm font-extrabold text-emerald-400">$${totalPaid.toFixed(2)}</span>
        </div>
        <div class="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <span class="block text-[10px] text-slate-400 uppercase">Saldo por Cobrar</span>
          <span class="text-sm font-extrabold text-cyan-400">$${totalActive.toFixed(2)}</span>
        </div>
      </div>

      <div class="space-y-2">
        <h5 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Historial de Cotizaciones</h5>
        ${quotesHTML}
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function startNewQuoteForClient(clientId) {
  clearFullQuoterScreen();
  selectClientById(clientId);
  toggleClientsDirectoryModal();
}