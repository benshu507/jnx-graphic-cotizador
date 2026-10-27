// ============================================================================
// CONEXIÓN A FIREBASE FIRESTORE - JNX GRAPHIC
// ============================================================================

// 1. PEGA AQUÍ TUS CREDENCIALES DE FIREBASE:
const firebaseConfig = {
  apiKey: "AIzaSyBE8jJURMf1yQ3x436S9pyHoPxjSvmdxTI",
  authDomain: "jnx-cotizador.firebaseapp.com",
  projectId: "jnx-cotizador",
  storageBucket: "jnx-cotizador.firebasestorage.app",
  messagingSenderId: "927178890030",
  appId: "1:927178890030:web:27c62727b91e50267238bf"
};

let db = null;

// Inicializar Firebase de forma segura
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
// GUARDAR COTIZACIÓN EN LA NUBE (FIRESTORE)
// ============================================================================
async function saveQuoteToFirebase() {
  if (!db) {
    alert("⚠️ Primero debes pegar tus credenciales de Firebase en el archivo js/firebase-db.js");
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

  const now = new Date();
  const quoteFolio = `JNX-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

  const btnSave = document.getElementById('btnSaveCloudText');
  if (btnSave) btnSave.textContent = "Guardando...";

  try {
    await db.collection("cotizaciones_jnx").add({
      folio: quoteFolio,
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
      btnSave.textContent = "¡Guardada en Nube!";
      setTimeout(() => { btnSave.textContent = "Guardar en Nube"; }, 2500);
    }
  } catch (error) {
    console.error("Error al guardar en Firebase:", error);
    alert("Error al guardar en Firebase: " + error.message);
    if (btnSave) btnSave.textContent = "Guardar en Nube";
  }
}

// ============================================================================
// ABRIR HISTORIAL Y CARGAR COTIZACIONES DESDE LA NUBE
// ============================================================================
async function toggleHistoryModal() {
  const modal = document.getElementById('historyModal');
  if (modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    await loadQuotesFromFirebase();
    lucide.createIcons();
  } else {
    modal.classList.add('hidden');
  }
}

async function loadQuotesFromFirebase() {
  const container = document.getElementById('historyListContainer');
  if (!db) {
    container.innerHTML = `<div class="p-6 text-center text-amber-400 text-xs">⚠️ Configura primero tus credenciales en <b>js/firebase-db.js</b> para ver tu historial en la nube.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Cargando cotizaciones desde Firebase...</div>`;

  try {
    const snapshot = await db.collection("cotizaciones_jnx").orderBy("createdAt", "desc").limit(30).get();
    if (snapshot.empty) {
      container.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs">Aún no hay cotizaciones guardadas en la base de datos.</div>`;
      return;
    }

    const docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
    window.loadedCloudQuotes = docs;

    container.innerHTML = docs.map((q, index) => `
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-cyan-500/40 transition">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">${q.folio || 'S/N'}</span>
            <span class="text-xs text-slate-400">${q.dateString || ''}</span>
          </div>
          <p class="text-sm font-bold text-white">${q.clientName} <span class="text-xs font-normal text-slate-400">• ${q.projectDesc}</span></p>
          <p class="text-[11px] text-slate-400">${(q.items || []).length} ítem(s) • Abono 50%: <span class="text-emerald-400 font-semibold">$${Number(q.deposit50 || 0).toFixed(2)}</span></p>
        </div>
        <div class="flex items-center gap-3 self-end sm:self-center">
          <div class="text-right mr-2">
            <span class="block text-xs text-slate-400">Total Cliente</span>
            <span class="text-base font-extrabold text-white">$${Number(q.grandTotal || 0).toFixed(2)}</span>
          </div>
          <button onclick="restoreQuoteFromCloud(${index})" class="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition">
            Cargar
          </button>
          <button onclick="deleteQuoteFromCloud('${q.id}')" class="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition">
            ✕
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error("Error cargando historial:", error);
    container.innerHTML = `<div class="p-6 text-center text-rose-400 text-xs">Error al conectar con Firestore: ${error.message}</div>`;
  }
}

function restoreQuoteFromCloud(index) {
  const q = (window.loadedCloudQuotes || [])[index];
  if (!q) return;

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

async function deleteQuoteFromCloud(docId) {
  if (!confirm("¿Seguro que deseas eliminar esta cotización de la nube?")) return;
  try {
    await db.collection("cotizaciones_jnx").doc(docId).delete();
    await loadQuotesFromFirebase();
  } catch (err) {
    alert("No se pudo eliminar: " + err.message);
  }
}