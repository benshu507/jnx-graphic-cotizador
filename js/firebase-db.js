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

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "PEGA_AQUI_TU_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Conectado a Firebase Firestore - JNX Graphic");
  } else {
    console.warn("⚠️ Firebase aún no tiene las credenciales configuradas en js/firebase-db.js");
  }
} catch (err) {
  console.error("Error inicializando Firebase:", err);
}

// ============================================================================
// GENERADOR DE CONSECUTIVO SECUENCIAL (JNX-00001, JNX-00002...)
// ============================================================================
async function getNextFolioSequential() {
  const counterRef = db.collection("config_jnx").doc("contadores");

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let currentNumber = 0;

    if (doc.exists && doc.data().ultimoFolio) {
      currentNumber = doc.data().ultimoFolio;
    } else {
      // Si es la primera vez, busca si ya existía alguna cotización previa
      const snap = await db.collection("cotizaciones_jnx").get();
      currentNumber = snap.size;
    }

    const nextNumber = currentNumber + 1;
    transaction.set(counterRef, { ultimoFolio: nextNumber }, { merge: true });

    // Rellena con ceros hasta 5 dígitos: JNX-00001, JNX-00002, etc.
    const padded = String(nextNumber).padStart(5, '0');
    return `JNX-${padded}`;
  });
}

// ============================================================================
// GUARDAR COTIZACIÓN EN LA NUBE Y LIMPIAR PANTALLA
// ============================================================================
async function saveQuoteToFirebase() {
  if (!db) {
    alert("⚠️ Error de conexión con Firebase. Verifica tus credenciales.");
    return;
  }

  const client = document.getElementById('clientName').value.trim() || 'Cliente General';
  const contact = document.getElementById('clientContact')?.value.trim() || '';
  const project = document.getElementById('projectDesc').value.trim() || 'Sin referencia';
  const itemsToSave = cart.length > 0 ? cart : (currentCalculation ? [currentCalculation] : []);

  if (itemsToSave.length === 0) {
    alert("Por favor, configura o agrega al menos un producto antes de guardar la cotización.");
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
  if (btnSave) btnSave.textContent = "Generando folio y guardando...";

  try {
    // 1. Obtener el siguiente consecutivo atómico en Firebase
    const quoteFolio = await getNextFolioSequential();
    const now = new Date();

    // 2. Guardar en Firestore con status 'Activo'
    await db.collection("cotizaciones_jnx").add({
      folio: quoteFolio,
      status: 'Activo', // 'Activo' | 'Cancelado'
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
      dateString: now.toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });

    if (btnSave) {
      btnSave.textContent = `¡Guardada como ${quoteFolio}!`;
      setTimeout(() => { btnSave.textContent = "Guardar Cotización en la Nube (Firebase)"; }, 2500);
    }

    // 3. LIMPIEZA COMPLETA DE PANTALLA
    clearFullQuoterScreen();

  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("Error al guardar en Firebase: " + error.message);
    if (btnSave) btnSave.textContent = "Guardar Cotización en la Nube (Firebase)";
  }
}

// Función que deja en blanco y en 0.00 toda la pantalla
function clearFullQuoterScreen() {
  // Limpia datos del cliente
  document.getElementById('clientName').value = "";
  if (document.getElementById('clientContact')) document.getElementById('clientContact').value = "";
  document.getElementById('projectDesc').value = "";

  // Limpia selectores de logística y urgencia
  const transSel = document.getElementById('transportSelect');
  if (transSel) transSel.value = "";
  const urgSel = document.getElementById('urgencySelect');
  if (urgSel) urgSel.value = "";

  // Vacía el carrito acumulado y resetea formulario del producto
  clearCart();
  resetItemForm();
}

// ============================================================================
// HISTORIAL DE COTIZACIONES (CONSULTA, CARGA Y CANCELACIÓN)
// ============================================================================
async function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    await loadQuotesFromFirebase();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } else {
    modal.classList.add('hidden');
  }
}

async function loadQuotesFromFirebase() {
  const container = document.getElementById('historyListContainer');
  if (!db) {
    container.innerHTML = `<div class="p-6 text-center text-amber-400 text-xs">⚠️ Configura primero tus credenciales en <b>js/firebase-db.js</b>.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Cargando cotizaciones desde Firebase...</div>`;

  try {
    const snapshot = await db.collection("cotizaciones_jnx").orderBy("createdAt", "desc").limit(40).get();
    if (snapshot.empty) {
      container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Aún no hay cotizaciones guardadas en la base de datos.</div>`;
      return;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    window.loadedCloudQuotes = docs;

    container.innerHTML = docs.map((q, index) => {
      const isCancelled = q.status === 'Cancelado';

      return `
        <div class="bg-slate-900/90 border ${isCancelled ? 'border-rose-900/40 opacity-60' : 'border-slate-800 hover:border-cyan-500/40'} rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded ${isCancelled ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 line-through' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'}">
                ${q.folio || 'S/N'}
              </span>
              <span class="text-xs text-slate-400">${q.dateString || ''}</span>
              ${isCancelled ? '<span class="text-[10px] uppercase font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">Cancelado</span>' : ''}
            </div>
            <p class="text-sm font-bold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">
              ${q.clientName} <span class="text-xs font-normal text-slate-400">• ${q.projectDesc}</span>
            </p>
            <p class="text-[11px] text-slate-400">
              ${(q.items || []).length} ítem(s) • Abono 50%: <span class="text-emerald-400 font-semibold">$${Number(q.deposit50 || 0).toFixed(2)}</span>
            </p>
          </div>
          
          <div class="flex items-center gap-3 self-end sm:self-center">
            <div class="text-right mr-2">
              <span class="block text-xs text-slate-400">Total</span>
              <span class="text-base font-extrabold text-white ${isCancelled ? 'line-through text-slate-400' : ''}">$${Number(q.grandTotal || 0).toFixed(2)}</span>
            </div>
            ${!isCancelled ? `
              <button onclick="restoreQuoteFromCloud(${index})" class="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition">
                Cargar
              </button>
              <button onclick="cancelQuoteInCloud('${q.id}', '${q.folio}')" title="Marcar como cancelado" class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-700 transition">
                Cancelar
              </button>
            ` : `
              <span class="text-[11px] text-slate-500 italic">No disponible</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error("Error cargando historial:", error);
    container.innerHTML = `<div class="p-6 text-center text-rose-400 text-xs">Error al conectar con Firestore: ${error.message}</div>`;
  }
}

function restoreQuoteFromCloud(index) {
  const q = (window.loadedCloudQuotes || [])[index];
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

// En lugar de borrar el documento, se le coloca status: 'Cancelado'
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