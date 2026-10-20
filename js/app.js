let products = JSON.parse(localStorage.getItem('jnx_products')) || DEFAULT_PRODUCTS;
let techniques = JSON.parse(localStorage.getItem('jnx_techniques')) || TECHNIQUES;
let savedLogo = localStorage.getItem('jnx_custom_logo') || '';
let internalMode = false;
let includeItbms = false;
let cart = [];
let currentCalculation = null;

window.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  applySavedLogo();
  calculateAll();
  lucide.createIcons();
});

function populateSelects() {
  const prodSelect = document.getElementById('productSelect');
  prodSelect.innerHTML = '<option value="" disabled selected>Seleccione un producto...</option>' + products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  prodSelect.addEventListener('change', (e) => {
    if (e.target.value === 'banner') {
      document.getElementById('techniqueSelect').value = 'gran_formato';
      updateTechniqueVariants('gran_formato');
    }
    calculateAll();
  });

  const techSelect = document.getElementById('techniqueSelect');
  techSelect.innerHTML = '<option value="" disabled selected>Seleccione una técnica...</option>' + techniques.map((t, idx) => `<option value="${t.id}">${t.name}</option>`).join('');
  techSelect.addEventListener('change', (e) => {
    updateTechniqueVariants(e.target.value);
    calculateAll();
  });

  updateTechniqueVariants('');
}

function updateTechniqueVariants(techId) {
  const tech = techniques.find(t => t.id === techId);
  const placementSelect = document.getElementById('placementSelect');
  let options = '<option value="" disabled selected>Seleccione cobertura...</option>';
  if (tech && tech.variants && tech.variants.length > 0) {
    options += tech.variants.map(v => `<option value="${v.id}" data-mult="${v.multiplier}">${v.name}</option>`).join('');
  } else if (tech) {
    options += PLACEMENTS.map(pl => `<option value="${pl.id}" data-mult="${pl.multiplier}">${pl.name}</option>`).join('');
  }
  placementSelect.innerHTML = options;
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    savedLogo = e.target.result;
    localStorage.setItem('jnx_custom_logo', savedLogo);
    applySavedLogo();
  };
  reader.readAsDataURL(file);
}

function applySavedLogo() {
  if (savedLogo) {
    document.getElementById('headerLogoPreview').src = savedLogo;
    document.getElementById('headerLogoPreview').classList.remove('hidden');
    document.getElementById('headerLogoText').classList.add('hidden');

    document.getElementById('pdfLogoImg').src = savedLogo;
    document.getElementById('pdfLogoImg').classList.remove('hidden');
    document.getElementById('pdfLogoFallback').classList.add('hidden');
  }
}

function adjustQty(delta) {
  const input = document.getElementById('quantityInput');
  let val = parseInt(input.value) || 0;
  input.value = Math.max(1, val + delta);
  calculateAll();
}

function getVolumeEfficiencyMultiplier(qty) {
  if (qty >= 100) return 0.78;
  if (qty >= 50) return 0.84;
  if (qty >= 24) return 0.90;
  if (qty >= 12) return 0.95;
  return 1.00;
}

function calculateAll() {
  const prodId = document.getElementById('productSelect').value;
  const techId = document.getElementById('techniqueSelect').value;
  const placementSelect = document.getElementById('placementSelect');
  const selectedOption = placementSelect.options[placementSelect.selectedIndex];
  const placeMult = selectedOption && !selectedOption.disabled ? parseFloat(selectedOption.getAttribute('data-mult')) || 1.0 : null;

  const rawQty = document.getElementById('quantityInput').value;
  const qty = parseInt(rawQty) || 0;

  const transportSelect = document.getElementById('transportSelect').value;
  const designSelect = document.getElementById('designSelect').value;
  const urgencySelect = document.getElementById('urgencySelect').value;

  // Si faltan datos o no hay cantidad, mantener todo en $0.00
  if (!prodId || !techId || placeMult === null || qty <= 0 || transportSelect === "" || designSelect === "" || urgencySelect === "") {
    currentCalculation = null;

    document.getElementById('finalClientPrice').textContent = `$0.00`;
    document.getElementById('unitClientPrice').textContent = `$0.00 c/u`;
    document.getElementById('summaryProduct').textContent = '-';
    document.getElementById('summaryQty').textContent = '-';
    document.getElementById('summaryTech').textContent = '-';
    document.getElementById('summaryDeposit').textContent = `$0.00`;

    const itbmsRow = document.getElementById('itbmsSummaryRow');
    if (includeItbms) {
      itbmsRow.classList.remove('hidden');
      document.getElementById('summaryItbms').textContent = `+$0.00`;
    } else {
      itbmsRow.classList.add('hidden');
    }

    document.getElementById('costBlankText').textContent = `$0.00`;
    document.getElementById('costSupplierText').textContent = `$0.00`;
    document.getElementById('costInHouseText').textContent = `$0.00`;
    document.getElementById('costLogisticsText').textContent = `$0.00`;
    document.getElementById('totalInternalCostText').textContent = `$0.00`;
    document.getElementById('netProfitText').textContent = `$0.00`;

    const discBadge = document.getElementById('discountBadge');
    if (discBadge) discBadge.classList.add('hidden');

    return;
  }

  const transportCost = parseFloat(transportSelect) || 0;
  const designCost = parseFloat(designSelect) || 0;
  const urgencyRate = parseFloat(urgencySelect) || 0;
  const marginPercent = parseFloat(document.getElementById('profitMarginInput').value) || 45;

  const product = products.find(p => p.id === prodId) || products[0];
  const technique = techniques.find(t => t.id === techId) || techniques[0];

  const volMult = getVolumeEfficiencyMultiplier(qty);

  const totalBlankCost = product.blankCost * qty;
  const unitSupplierCost = technique.supplierCost * placeMult * volMult;
  const totalSupplierCost = unitSupplierCost * qty;
  const unitInHouseCost = product.pressCost * (placeMult > 1.2 ? 1.35 : 1.0);
  const totalInHouseCost = unitInHouseCost * qty;
  const totalLogisticsCost = transportCost + designCost;

  const totalInternalCost = totalBlankCost + totalSupplierCost + totalInHouseCost + totalLogisticsCost;
  const baseClientPrice = totalInternalCost * (1 + (marginPercent / 100));
  const subtotalClient = baseClientPrice * (1 + urgencyRate);

  const itbmsAmount = includeItbms ? subtotalClient * 0.07 : 0;
  const finalClientTotal = subtotalClient + itbmsAmount;

  const unitClientPrice = finalClientTotal / qty;
  const netProfit = subtotalClient - totalInternalCost;

  currentCalculation = {
    productName: product.name,
    techniqueName: technique.name,
    placementName: selectedOption ? selectedOption.text : '',
    qty,
    finalClientTotal,
    subtotalClient,
    itbmsAmount,
    unitClientPrice,
    totalInternalCost,
    netProfit
  };

  document.getElementById('finalClientPrice').textContent = `$${finalClientTotal.toFixed(2)}`;
  document.getElementById('unitClientPrice').textContent = `$${unitClientPrice.toFixed(2)} c/u`;
  document.getElementById('summaryProduct').textContent = product.name;
  document.getElementById('summaryQty').textContent = `${qty} ${qty === 1 ? 'unidad' : 'unidades'}`;
  document.getElementById('summaryTech').textContent = `${technique.name.split('(')[0]} (${selectedOption ? selectedOption.text.split('(')[0].trim() : ''})`;
  document.getElementById('summaryDeposit').textContent = `$${(finalClientTotal * 0.5).toFixed(2)}`;

  const itbmsRow = document.getElementById('itbmsSummaryRow');
  if (includeItbms) {
    itbmsRow.classList.remove('hidden');
    document.getElementById('summaryItbms').textContent = `+$${itbmsAmount.toFixed(2)}`;
  } else {
    itbmsRow.classList.add('hidden');
  }

  const discBadge = document.getElementById('discountBadge');
  if (qty >= 12) discBadge.classList.remove('hidden');
  else discBadge.classList.add('hidden');

  document.getElementById('marginBadge').textContent = `${marginPercent}%`;
  document.getElementById('costBlankText').textContent = `$${totalBlankCost.toFixed(2)}`;
  document.getElementById('costSupplierText').textContent = `$${totalSupplierCost.toFixed(2)}`;
  document.getElementById('costInHouseText').textContent = `$${totalInHouseCost.toFixed(2)}`;
  document.getElementById('costLogisticsText').textContent = `$${totalLogisticsCost.toFixed(2)}`;
  document.getElementById('totalInternalCostText').textContent = `$${totalInternalCost.toFixed(2)}`;
  document.getElementById('netProfitText').textContent = `$${netProfit.toFixed(2)}`;
}

function toggleItbms() {
  includeItbms = !includeItbms;
  const btn = document.getElementById('btnToggleItbms');
  const indicator = document.getElementById('itbmsIndicator');
  if (includeItbms) {
    btn.className = "p-3 rounded-xl border flex items-center justify-between transition bg-cyan-500/15 border-cyan-400 text-cyan-200 cursor-pointer";
    if (indicator) indicator.className = "w-4 h-4 rounded-full bg-cyan-400 translate-x-4 transition-transform";
  } else {
    btn.className = "p-3 rounded-xl border flex items-center justify-between transition bg-slate-950/60 border-slate-800 text-slate-400 cursor-pointer";
    if (indicator) indicator.className = "w-4 h-4 rounded-full bg-slate-700 translate-x-0 transition-transform";
  }
  calculateAll();
}

function toggleInternalMode() {
  internalMode = !internalMode;
  const panel = document.getElementById('internalAuditPanel');
  const btn = document.getElementById('btnToggleMode');
  const modeText = document.getElementById('modeText');
  const cartProfitRow = document.getElementById('cartInternalProfitRow');

  if (internalMode) {
    panel.classList.remove('hidden');
    if (cartProfitRow) cartProfitRow.classList.remove('hidden');
    btn.className = "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border bg-amber-500/20 text-amber-300 border-amber-500/40";
    modeText.textContent = "Modo Interno Activo (Viendo Costos)";
  } else {
    panel.classList.add('hidden');
    if (cartProfitRow) cartProfitRow.classList.add('hidden');
    btn.className = "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20";
    modeText.textContent = "Modo Cliente (Costos Ocultos)";
  }
}

function addItemToCart() {
  if (!currentCalculation) {
    alert("Por favor, completa todas las opciones (Producto, Cantidad, Técnica, Transporte, Arte y Prioridad) para configurar el precio.");
    return;
  }
  cart.push({ id: Date.now(), ...currentCalculation });
  renderCart();
}

function removeCartItem(id) {
  cart = cart.filter(item => item.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartContainer');
  const totalsBox = document.getElementById('cartTotalsBox');

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Si no agregas varios ítems aquí, el PDF y el mensaje de WhatsApp usarán automáticamente el producto configurado arriba.</p>`;
    totalsBox.classList.add('hidden');
    return;
  }

  totalsBox.classList.remove('hidden');
  let grandTotal = 0;
  let totalProfit = 0;

  container.innerHTML = cart.map(item => {
    grandTotal += item.finalClientTotal;
    totalProfit += item.netProfit;
    return `
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
        <div>
          <p class="text-xs font-bold text-white">${item.qty}x ${item.productName}</p>
          <p class="text-[11px] text-slate-400">${item.techniqueName.split('(')[0]} • $${item.unitClientPrice.toFixed(2)} c/u</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-extrabold text-cyan-400">$${item.finalClientTotal.toFixed(2)}</span>
          <button onclick="removeCartItem(${item.id})" class="text-slate-500 hover:text-red-400 text-xs font-bold">✕</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  document.getElementById('cartDepositTotal').textContent = `$${(grandTotal * 0.5).toFixed(2)}`;
  if (document.getElementById('cartTotalProfit')) {
    document.getElementById('cartTotalProfit').textContent = `$${totalProfit.toFixed(2)}`;
  }
}

function printQuotePDF() {
  const client = document.getElementById('clientName').value.trim() || 'Cliente General';
  const contact = document.getElementById('clientContact')?.value.trim() || '';
  const project = document.getElementById('projectDesc').value.trim() || 'Servicio de Personalización JNX';
  const itemsToPrint = cart.length > 0 ? cart : (currentCalculation ? [currentCalculation] : []);

  if (itemsToPrint.length === 0) {
    alert("Agregue al menos un producto a la cotización.");
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' });
  const quoteNum = `N° JNX-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

  if (document.getElementById('pdfQuoteNumber')) document.getElementById('pdfQuoteNumber').textContent = quoteNum;
  if (document.getElementById('pdfDate')) document.getElementById('pdfDate').textContent = `Fecha: ${dateStr}`;
  if (document.getElementById('pdfClientName')) document.getElementById('pdfClientName').textContent = client;
  if (document.getElementById('pdfClientContact')) document.getElementById('pdfClientContact').textContent = contact ? `Contacto / RUC: ${contact}` : '';
  if (document.getElementById('pdfProjectDesc')) document.getElementById('pdfProjectDesc').textContent = project;

  let grandTotal = 0;
  const tbody = document.getElementById('pdfTableBody');
  if (tbody) {
    tbody.innerHTML = itemsToPrint.map(item => {
      grandTotal += item.finalClientTotal;
      const cleanTech = item.techniqueName.split('(')[0].trim();
      const cleanPlace = item.placementName ? item.placementName.split('(')[0].trim() : '';
      return `
        <tr>
          <td class="py-3.5 px-4 font-bold text-slate-900">${item.qty}</td>
          <td class="py-3.5 px-4">
            <p class="font-bold text-slate-900 text-sm">${item.productName}</p>
            <p class="text-slate-600">Técnica: ${cleanTech} • Cobertura: ${cleanPlace}</p>
          </td>
          <td class="py-3.5 px-4 text-right font-semibold text-slate-800">$${item.unitClientPrice.toFixed(2)}</td>
          <td class="py-3.5 px-4 text-right font-extrabold text-slate-900">$${item.finalClientTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }

  const half = grandTotal * 0.5;
  if (document.getElementById('pdfSubtotal')) document.getElementById('pdfSubtotal').textContent = `$${grandTotal.toFixed(2)}`;
  if (document.getElementById('pdfGrandTotal')) document.getElementById('pdfGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  if (document.getElementById('pdfDeposit')) document.getElementById('pdfDeposit').textContent = `$${half.toFixed(2)}`;
  if (document.getElementById('pdfBalance')) document.getElementById('pdfBalance').textContent = `$${half.toFixed(2)}`;

  window.print();
}

function copyWhatsAppQuote() {
  const client = document.getElementById('clientName').value.trim() || 'Estimado Cliente';
  const project = document.getElementById('projectDesc').value.trim();
  const itemsToQuote = cart.length > 0 ? cart : (currentCalculation ? [currentCalculation] : []);

  if (itemsToQuote.length === 0) {
    alert("Agregue al menos un producto a la cotización.");
    return;
  }

  let total = 0;
  let lines = itemsToQuote.map(item => {
    total += item.finalClientTotal;
    const techClean = item.techniqueName ? item.techniqueName.split('(')[0].trim() : '';
    return `▪ *${item.qty}x ${item.productName}*\n   Trabajo: ${techClean}\n   Unitario: $${item.unitClientPrice.toFixed(2)} | Subtotal: *$${item.finalClientTotal.toFixed(2)}*`;
  }).join('\n\n');

  const deposit = total * 0.5;
  const hasItbms = itemsToQuote.some(item => item.itbmsAmount > 0);
  const itbmsText = hasItbms ? `\n🧾 _Incluye ITBMS (7%)_` : '';

  const text = `*COTIZACIÓN OFICIAL - JNX GRAPHIC* 🎨\n` +
    `👤 *Cliente:* ${client}\n` +
    (project ? `📌 *Proyecto:* ${project}\n` : '') +
    `----------------------------------\n` +
    `${lines}\n` +
    `----------------------------------\n` +
    `💰 *TOTAL A PAGAR: $${total.toFixed(2)}*${itbmsText}\n` +
    `✅ *Abono 50% para iniciar:* $${deposit.toFixed(2)}\n\n` +
    `_Cotización válida por 7 días. Incluye control de calidad y acabado profesional._`;

  navigator.clipboard.writeText(text).then(() => {
    const btnText = document.getElementById('copyBtnText');
    if (btnText) {
      btnText.textContent = "¡Copiado!";
      setTimeout(() => {
        btnText.textContent = "Copiar para WhatsApp";
      }, 2500);
    } else {
      alert("¡Cotización copiada al portapapeles para WhatsApp!");
    }
  });
}

function toggleConfigModal() {
  const modal = document.getElementById('configModal');
  if (modal.classList.contains('hidden')) {
    renderConfigInputs();
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

function renderConfigInputs() {
  document.getElementById('modalProductsConfig').innerHTML = products.map((p, i) => `
    <div class="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
      <span class="text-slate-200 font-medium truncate">${p.name}</span>
      <input type="number" step="0.05" id="cfg_prod_${i}" value="${p.blankCost}" class="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-bold">
    </div>
  `).join('');

  document.getElementById('modalTechConfig').innerHTML = techniques.map((t, i) => `
    <div class="bg-slate-800/70 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
      <span class="text-slate-200 font-medium truncate">${t.name.split('(')[0]}</span>
      <input type="number" step="0.05" id="cfg_tech_${i}" value="${t.supplierCost}" class="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-white font-bold">
    </div>
  `).join('');
}

function saveCustomCosts() {
  products.forEach((p, i) => {
    const val = parseFloat(document.getElementById(`cfg_prod_${i}`).value);
    if (!isNaN(val)) p.blankCost = val;
  });
  techniques.forEach((t, i) => {
    const val = parseFloat(document.getElementById(`cfg_tech_${i}`).value);
    if (!isNaN(val)) t.supplierCost = val;
  });

  localStorage.setItem('jnx_products', JSON.stringify(products));
  localStorage.setItem('jnx_techniques', JSON.stringify(techniques));
  calculateAll();
  toggleConfigModal();
}

function resetDefaultCosts() {
  localStorage.removeItem('jnx_products');
  localStorage.removeItem('jnx_techniques');
  products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  techniques = JSON.parse(JSON.stringify(TECHNIQUES));
  renderConfigInputs();
  calculateAll();
}