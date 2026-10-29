// ============================================================================
// CONEXIÓN A FIREBASE FIRESTORE - JNX GRAPHIC
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
let currentHistoryTab = 'activos'; // 'activos' | 'vencidos' | 'pagados' | 'cancelados'
window.loadedCloudQuotes = [];

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "PEGA_AQUI_TU_API_KEY") {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    console.log("✅ Conectado a Firebase Firestore - JNX Graphic");
  }
} catch (err) {
  console.error("Error inicializando Firebase:", err);
}

// ============================================================================
// GENERADOR DE CONSECUTIVO SECUENCIAL (JNX-00001, JNX-00002...)
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
    console.error("Error obteniendo consecutivo, usando fallback:", error);
    const snap = await db.collection("cotizaciones_jnx").get();
    return `JNX-${String(snap.size + 1).padStart(5, '0')}`;
  }
}

// ============================================================================
// GUARDAR COTIZACIÓN EN LA NUBE
// ============================================================================
async function saveQuoteToFirebase() {
  if (!db) {
    alert("⚠️ Error de conexión con Firebase. Verifica tu conexión a internet.");
    return;
  }

  const client = document.getElementById('clientName').value.trim() || 'Cliente General';
  const contact = document.getElementById('clientContact')?.value.trim() || '';
  const project = document.getElementById('projectDesc').value.trim() || 'Sin referencia';
  const itemsToSave = cart.length > 0 ? cart : (currentCalculation ? [currentCalculation] : []);

  if (itemsToSave.length === 0) {
    alert("⚠️ Por favor, configura o agrega al menos un producto antes de guardar la cotización.");
    return;
  }

  const transSel = document.getElementById('transportSelect');
  const globalTransport = transSel && transSel.value !== "" ? parseFloat(transSel.value) : 0;
  const urgSel = document.getElementById('urgencySelect');
  const globalUrgencyRate = urgSel && urgSel.value !== "" ? parseFloat(urgSel.value) : 0;

  let itemsSubtotal = 0;
  let itemsProfit = 0;
  itemsToSave.forEach(it => {
    itemsSubtotal += it.finalClientTotal;
    itemsProfit += it.netProfit;
  });

  const urgencyAmount = (itemsSubtotal + globalTransport) * globalUrgencyRate;
  const grandTotal = itemsSubtotal + globalTransport + urgencyAmount;
  const totalNetProfit = itemsProfit + urgencyAmount;

  const btnSave = document.getElementById('btnSaveCloudText');
  if (btnSave) btnSave.textContent = "Guardando en la nube...";

  try {
    const quoteFolio = await getNextFolioSequential();
    const now = new Date();

    await db.collection("cotizaciones_jnx").add({
      folio: quoteFolio,
      status: 'Activo', // 'Activo' | 'Pagado' | 'Cancelado'
      clientName: client,
      clientContact: contact,
      projectDesc: project,
      items: itemsToSave,
      transportCost: globalTransport,
      urgencyRate: globalUrgencyRate,
      urgencyAmount: urgencyAmount,
      grandTotal: Number(grandTotal.toFixed(2)),
      deposit50: Number((grandTotal * 0.5).toFixed(2)),
      netProfit: Number(totalNetProfit.toFixed(2)),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dateString: now.toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      timestampMs: now.getTime()
    });

    if (btnSave) {
      btnSave.textContent = "Guardar Cotización en la Nube (Firebase)";
    }

    alert(`✅ ¡Cotización registrada con éxito!\n\nFolio: ${quoteFolio}\nCliente: ${client}\nTotal: $${grandTotal.toFixed(2)}`);
    clearFullQuoterScreen();
  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("❌ Error al guardar en Firebase: " + error.message);
    if (btnSave) btnSave.textContent = "Guardar Cotización en la Nube (Firebase)";
  }
}

function clearFullQuoterScreen() {
  document.getElementById('clientName').value = "";
  if (document.getElementById('clientContact')) document.getElementById('clientContact').value = "";
  document.getElementById('projectDesc').value = "";

  const transSel = document.getElementById('transportSelect');
  if (transSel) transSel.value = "";
  const urgSel = document.getElementById('urgencySelect');
  if (urgSel) urgSel.value = "";

  clearCart();
  resetItemForm();
}

// ============================================================================
// HISTORIAL POR PESTAÑAS (ACTIVOS, VENCIDOS, PAGADOS, CANCELADOS)
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

  // Actualizar estilos visuales de las pestañas
  const tabs = ['activos', 'vencidos', 'pagados', 'cancelados'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab_${t}`);
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
  if (!db) {
    container.innerHTML = `<div class="p-6 text-center text-amber-400 text-xs">⚠️ Configura primero tus credenciales de Firebase.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Cargando cotizaciones desde Firebase...</div>`;

  try {
    const snapshot = await db.collection("cotizaciones_jnx").orderBy("createdAt", "desc").limit(60).get();
    if (snapshot.empty) {
      container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Aún no hay cotizaciones guardadas en la base de datos.</div>`;
      updateTabBadges([], [], [], []);
      return;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    window.loadedCloudQuotes = docs;

    renderFilteredQuotes();
  } catch (error) {
    console.error("Error cargando historial:", error);
    container.innerHTML = `<div class="p-6 text-center text-rose-400 text-xs">Error al conectar con Firestore: ${error.message}</div>`;
  }
}

function renderFilteredQuotes() {
  const container = document.getElementById('historyListContainer');
  const allDocs = window.loadedCloudQuotes || [];
  const nowMs = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Clasificación por criterios
  const cancelados = [];
  const pagados = [];
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
    } else if (diffMs > threeDaysMs) {
      // Vencidos: más de 3 días sin pagar ni cancelar
      vencidos.push(q);
    } else if (diffMs <= thirtyDaysMs) {
      // Activos: creados hace menos o igual a 30 días (y dentro de los 3 días vigentes)
      activos.push(q);
    } else {
      vencidos.push(q);
    }
  });

  updateTabBadges(activos, vencidos, pagados, cancelados);

  let currentList = [];
  if (currentHistoryTab === 'activos') currentList = activos;
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
    const isExpired = currentHistoryTab === 'vencidos';

    let badgeColor = "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30";
    let badgeText = q.folio || 'S/N';
    let statusLabel = "";

    if (isCancelled) {
      badgeColor = "bg-rose-500/20 text-rose-400 border border-rose-500/30 line-through";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">Cancelado</span>';
    } else if (isPaid) {
      badgeColor = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Pagado</span>';
    } else if (isExpired) {
      badgeColor = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
      statusLabel = '<span class="text-[10px] uppercase font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">Vencido</span>';
    }

    return `
      <div class="bg-slate-900/90 border ${isCancelled ? 'border-rose-900/40 opacity-70' : 'border-slate-800 hover:border-cyan-500/40'} rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded ${badgeColor}">
              ${badgeText}
            </span>
            <span class="text-xs text-slate-400">${q.dateString || ''}</span>
            ${statusLabel}
          </div>
          <p class="text-sm font-bold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">
            ${q.clientName} <span class="text-xs font-normal text-slate-400">• ${q.projectDesc}</span>
          </p>
          <p class="text-[11px] text-slate-400">
            ${(q.items || []).length} ítem(s) • Abono 50%: <span class="text-emerald-400 font-semibold">$${Number(q.deposit50 || 0).toFixed(2)}</span>
          </p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2 self-end md:self-center">
          <div class="text-right mr-2">
            <span class="block text-[10px] text-slate-400 uppercase">Total</span>
            <span class="text-base font-extrabold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">$${Number(q.grandTotal || 0).toFixed(2)}</span>
          </div>

          <!-- BOTÓN IMPRIMIR PDF DISPONIBLE EN TODOS -->
          <button onclick="printDirectQuoteFromCloud('${q.id}')" title="Descargar / Imprimir comprobante PDF"
            class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition flex items-center gap-1">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>PDF</span>
          </button>

          ${!isCancelled && !isPaid ? `
            <button onclick="restoreQuoteFromCloud('${q.id}')" title="Cargar al cotizador"
              class="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition">
              Cargar
            </button>
            <button onclick="markQuoteAsPaid('${q.id}', '${q.folio}')" title="Marcar como cobrado / pagado"
              class="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
              Pagado
            </button>
            <button onclick="cancelQuoteInCloud('${q.id}', '${q.folio}')" title="Cancelar cotización"
              class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition">
              Cancelar
            </button>
          ` : ''}

          ${isPaid ? `
            <button onclick="restoreQuoteFromCloud('${q.id}')" title="Cargar al cotizador"
              class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition">
              Cargar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateTabBadges(activos, vencidos, pagados, cancelados) {
  if (document.getElementById('badge_activos')) document.getElementById('badge_activos').textContent = activos.length;
  if (document.getElementById('badge_vencidos')) document.getElementById('badge_vencidos').textContent = vencidos.length;
  if (document.getElementById('badge_pagados')) document.getElementById('badge_pagados').textContent = pagados.length;
  if (document.getElementById('badge_cancelados')) document.getElementById('badge_cancelados').textContent = cancelados.length;
}

// ============================================================================
// ACCIONES: CARGAR, PAGAR, CANCELAR E IMPRIMIR DIRECTO
// ============================================================================
function restoreQuoteFromCloud(docId) {
  const q = (window.loadedCloudQuotes || []).find(item => item.id === docId);
  if (!q || q.status === 'Cancelado') return;

  document.getElementById('clientName').value = q.clientName || '';
  if (document.getElementById('clientContact')) document.getElementById('clientContact').value = q.clientContact || '';
  document.getElementById('projectDesc').value = q.projectDesc || '';

  if (q.transportCost !== undefined) {
    document.getElementById('transportSelect').value = String(q.transportCost);
  }
  if (q.urgencyRate !== undefined) {
    document.getElementById('urgencySelect').value = String(q.urgencyRate);
  }

  cart = Array.isArray(q.items) ? q.items.map(it => ({ ...it, id: Date.now() + Math.random() })) : [];
  renderCart();
  toggleHistoryModal();
}

async function markQuoteAsPaid(docId, folio) {
  if (!confirm(`¿Deseas marcar la cotización ${folio} como PAGADA?`)) return;

  try {
    await db.collection("cotizaciones_jnx").doc(docId).update({
      status: 'Pagado',
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

// IMPRIMIR PDF DIRECTAMENTE DESDE LA NUBE SIN REEMPLAZAR LA PANTALLA ACTUAL
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
  const grandTotal = Number(q.grandTotal || 0);
  const deposit = Number(q.deposit50 || (grandTotal * 0.5));

  if (document.getElementById('pdfQuoteNumber')) document.getElementById('pdfQuoteNumber').textContent = `N° ${q.folio || 'JNX-00000'}`;
  if (document.getElementById('pdfDate')) document.getElementById('pdfDate').textContent = `Fecha: ${q.dateString || 'Cotización Oficial'}`;
  if (document.getElementById('pdfClientName')) document.getElementById('pdfClientName').textContent = q.clientName || 'Cliente General';
  if (document.getElementById('pdfClientContact')) document.getElementById('pdfClientContact').textContent = q.clientContact ? `Contacto / RUC: ${q.clientContact}` : '';
  if (document.getElementById('pdfProjectDesc')) document.getElementById('pdfProjectDesc').textContent = q.projectDesc || 'Pedido de Personalización';

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

  if (document.getElementById('pdfGrandTotal')) document.getElementById('pdfGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  if (document.getElementById('pdfDeposit')) document.getElementById('pdfDeposit').textContent = `$${deposit.toFixed(2)}`;

  window.print();
}