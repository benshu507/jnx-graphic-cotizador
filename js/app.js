let products = JSON.parse(localStorage.getItem('jnx_products')) || JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
let techniques = JSON.parse(localStorage.getItem('jnx_techniques')) || JSON.parse(JSON.stringify(TECHNIQUES));
let supplierRates = JSON.parse(localStorage.getItem('jnx_supplier_rates')) || JSON.parse(JSON.stringify(DEFAULT_SUPPLIER_RATES));
let inHouseCosts = JSON.parse(localStorage.getItem('jnx_inhouse_costs')) || JSON.parse(JSON.stringify(DEFAULT_INHOUSE_COSTS));

let savedLogo = localStorage.getItem('jnx_custom_logo') || '';
let internalMode = false;
let includeItbms = true; // Siempre inicia activo
let isMixedSizes = false;
let cart = [];
let currentCalculation = null;
let manualPriceOverride = null;
let manualDepositRateOverride = false;

const SUPPLIER_LABELS = [
  { key: 'dtf_yard', label: '1 Yarda DTF Textil ($/yd)' },
  { key: 'dtf_half_yard', label: '1/2 Yarda DTF Textil' },
  { key: 'uv_dtf_a4', label: 'A4 de UV DTF' },
  { key: 'uv_dtf_a3', label: 'A3 de UV DTF' },
  { key: 'uv_dtf_yard', label: 'Yarda UV DTF ($/yd)' },
  { key: 'sub_sheet_a4', label: 'Impresión Papel Sublimación A4' },
  { key: 'sub_sheet_a3', label: 'Impresión Papel Sublimación A3' },
  { key: 'sub_yard', label: 'Yarda Papel Sublimación ($/yd)' },
  { key: 'embroidery_small', label: 'Bordado Pecho / Gorra (c/u)' },
  { key: 'embroidery_dual', label: 'Bordado Pecho + Manga (c/u)' },
  { key: 'embroidery_setup', label: 'Ponchado / Matriz Bordado' },
  { key: 'banner_sqft', label: 'Impresión Banner / Lona ($/pie²)' }
];

const INHOUSE_LABELS = [
  { key: 'press_single', label: 'Planchado 1 Cara (Luz + Mano Obra)' },
  { key: 'press_double', label: 'Planchado 2 Caras (Frente + Espalda)' },
  { key: 'uv_application', label: 'Colocación Manual Sticker DTF UV' },
  { key: 'banner_handling', label: 'Acabado / Empaque de Banner' }
];

window.addEventListener('DOMContentLoaded', () => {
  populateSelects();
  applySavedLogo();
  syncItbmsVisualState();
  calculateAll();
  lucide.createIcons();

  document.getElementById('designSelect').addEventListener('change', () => { manualPriceOverride = null; });
  document.getElementById('profitMarginInput').addEventListener('input', () => { manualPriceOverride = null; });
});

function populateSelects() {
  const prodSelect = document.getElementById('productSelect');
  prodSelect.innerHTML = '<option value="" disabled selected>Seleccione un producto...</option>' + products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  prodSelect.addEventListener('change', (e) => {
    updateTechniquesForProduct(e.target.value);
    checkIfTextile(e.target.value);
    manualPriceOverride = null;
    calculateAll();
  });

  const techSelect = document.getElementById('techniqueSelect');
  techSelect.innerHTML = '<option value="" disabled selected>Seleccione primero un producto...</option>';

  techSelect.addEventListener('change', (e) => {
    updateTechniqueVariants(e.target.value);
    manualPriceOverride = null;
    calculateAll();
  });

  updateTechniqueVariants('');
}

function checkIfTextile(productId) {
  const textileKeywords = ['tshirt', 'polo', 'abrigo', 'hoodie', 'sueter', 'pantalon', 'prenda'];
  const isTextile = textileKeywords.some(keyword => productId.toLowerCase().includes(keyword));

  const toggleBox = document.getElementById('mixedSizesToggleBox');
  if (isTextile) {
    toggleBox.classList.remove('hidden');
  } else {
    toggleBox.classList.add('hidden');
    if (isMixedSizes) {
      document.getElementById('mixedSizesCheckbox').checked = false;
      toggleMixedSizes();
    }
  }
}

function toggleMixedSizes() {
  isMixedSizes = document.getElementById('mixedSizesCheckbox').checked;
  const singleBox = document.getElementById('singleQuantityBox');
  const splitBox = document.getElementById('splitQuantityBox');

  if (isMixedSizes) {
    singleBox.classList.add('hidden');
    splitBox.classList.remove('hidden');
  } else {
    singleBox.classList.remove('hidden');
    splitBox.classList.add('hidden');
  }
  manualPriceOverride = null;
  calculateAll();
}

function updateTechniquesForProduct(productId) {
  const techSelect = document.getElementById('techniqueSelect');
  const product = products.find(p => p.id === productId);

  if (!product || !product.allowedTechniques) {
    techSelect.innerHTML = '<option value="" disabled selected>Seleccione una técnica...</option>';
    updateTechniqueVariants('');
    return;
  }

  const allowedTechs = techniques.filter(t => product.allowedTechniques.includes(t.id));
  techSelect.innerHTML = '<option value="" disabled selected>Seleccione una técnica...</option>' +
    allowedTechs.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  updateTechniqueVariants('');
}

function updateTechniqueVariants(techId) {
  const tech = techniques.find(t => t.id === techId);
  const placementSelect = document.getElementById('placementSelect');
  let options = '<option value="" disabled selected>Seleccione cobertura...</option>';

  if (tech && tech.variants && tech.variants.length > 0) {
    options += tech.variants.map(v => `<option value="${v.id}" data-mult="${v.multiplier}">${v.name}</option>`).join('');
  }
  placementSelect.innerHTML = options;
  placementSelect.addEventListener('change', () => { manualPriceOverride = null; });
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

function adjustQty(inputId, delta) {
  const input = document.getElementById(inputId);
  let val = parseInt(input.value) || 0;
  input.value = Math.max(0, val + delta);
  if (inputId === 'quantityInput') {
    input.value = Math.max(1, parseInt(input.value) || 1);
  }
  manualPriceOverride = null;
  calculateAll();
}

function getVolumeEfficiencyMultiplier(qty) {
  if (qty >= 100) return 0.78;
  if (qty >= 50) return 0.84;
  if (qty >= 24) return 0.90;
  if (qty >= 12) return 0.95;
  return 1.00;
}

function syncItbmsVisualState() {
  const btn = document.getElementById('btnToggleItbms');
  const title = document.getElementById('itbmsTitle');
  const indicator = document.getElementById('itbmsIndicator');
  const track = document.getElementById('itbmsTrack');
  if (!btn || !title || !indicator || !track) return;

  if (includeItbms) {
    btn.className = "w-full p-2 rounded-xl border border-cyan-500 bg-cyan-900/20 flex items-center justify-between transition cursor-pointer";
    title.className = "text-xs font-bold text-cyan-400 leading-tight";
    indicator.className = "w-4 h-4 rounded-full bg-cyan-400 translate-x-4 transition-transform";
    track.className = "w-9 h-5 rounded-full bg-slate-800 p-0.5 transition flex items-center border border-cyan-500/50";
  } else {
    btn.className = "w-full p-2 rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-between transition cursor-pointer hover:border-cyan-500/50";
    title.className = "text-xs font-bold text-slate-200 leading-tight";
    indicator.className = "w-4 h-4 rounded-full bg-slate-500 translate-x-0 transition-transform";
    track.className = "w-9 h-5 rounded-full bg-slate-800 p-0.5 transition flex items-center border border-slate-700";
  }
}

function resetItemForm() {
  document.getElementById('productSelect').value = "";
  document.getElementById('techniqueSelect').innerHTML = '<option value="" disabled selected>Seleccione primero un producto...</option>';
  document.getElementById('placementSelect').innerHTML = '<option value="" disabled selected>Seleccione cobertura...</option>';

  document.getElementById('quantityInput').value = "";
  document.getElementById('qtyAdults').value = "0";
  document.getElementById('qtyKids').value = "0";

  document.getElementById('designSelect').value = "";

  document.getElementById('mixedSizesCheckbox').checked = false;
  isMixedSizes = false;
  document.getElementById('singleQuantityBox').classList.remove('hidden');
  document.getElementById('splitQuantityBox').classList.add('hidden');
  document.getElementById('mixedSizesToggleBox').classList.add('hidden');

  // Mantener ITBMS activo por defecto para cada nuevo artículo
  includeItbms = true;
  syncItbmsVisualState();

  manualPriceOverride = null;
  document.getElementById('manualPriceIndicator').classList.add('hidden');
  document.getElementById('profitMarginInput').value = 55;

  calculateAll();
}

function toggleItbms() {
  includeItbms = !includeItbms;
  syncItbmsVisualState();
  calculateAll();
}

function applyManualPrice() {
  const manualInput = parseFloat(document.getElementById('unitClientPriceInput').value);
  if (!isNaN(manualInput) && manualInput > 0) {
    manualPriceOverride = manualInput;
    document.getElementById('manualPriceIndicator').classList.remove('hidden');
  } else {
    manualPriceOverride = null;
    document.getElementById('manualPriceIndicator').classList.add('hidden');
  }
  calculateAll();
}

function calculateAll() {
  const prodId = document.getElementById('productSelect').value;
  const techId = document.getElementById('techniqueSelect').value;
  const placementSelect = document.getElementById('placementSelect');
  const selectedOption = placementSelect.options[placementSelect.selectedIndex];
  const variantId = selectedOption && !selectedOption.disabled ? selectedOption.value : null;
  const placeMult = selectedOption && !selectedOption.disabled ? parseFloat(selectedOption.getAttribute('data-mult')) || 1.0 : null;
  const designSelect = document.getElementById('designSelect').value;

  let qtyAdults = 0;
  let qtyKids = 0;
  let totalQty = 0;

  if (isMixedSizes) {
    qtyAdults = parseInt(document.getElementById('qtyAdults').value) || 0;
    qtyKids = parseInt(document.getElementById('qtyKids').value) || 0;
    totalQty = qtyAdults + qtyKids;
  } else {
    totalQty = parseInt(document.getElementById('quantityInput').value) || 0;
    qtyAdults = totalQty;
  }

  if (!prodId || !techId || placeMult === null || totalQty <= 0 || designSelect === "") {
    currentCalculation = null;

    document.getElementById('finalClientPrice').textContent = `$0.00`;
    document.getElementById('unitClientPriceInput').value = `0.00`;
    document.getElementById('summaryProduct').textContent = '-';
    document.getElementById('summaryQty').textContent = '-';
    document.getElementById('summaryTech').textContent = '-';
    document.getElementById('summaryDeposit').textContent = `$0.00`;

    document.getElementById('itbmsSummaryRow').classList.add('hidden');
    document.getElementById('manualPriceIndicator').classList.add('hidden');

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

  if (manualPriceOverride === null) {
    document.getElementById('manualPriceIndicator').classList.add('hidden');
  }

  const designCost = parseFloat(designSelect) || 0;
  const marginPercent = parseFloat(document.getElementById('profitMarginInput').value) || 55;

  const product = products.find(p => p.id === prodId) || products[0];
  const technique = techniques.find(t => t.id === techId) || techniques[0];
  const variantObj = (technique.variants || []).find(v => v.id === variantId) || {};
  const volMult = getVolumeEfficiencyMultiplier(totalQty);

  // 1. Costo de prendas en blanco
  const costAdultBlank = product.blankCost;
  const costKidBlank = product.blankCost * 0.80;
  const totalBlankCost = (costAdultBlank * qtyAdults) + (costKidBlank * qtyKids);

  // 2. Costo de Proveedor y 3. Planchado en Casa
  let totalSupplierCost = 0;
  let totalInHouseCost = 0;

  if (techId === 'dtf') {
    const rawYards = totalQty * (variantObj.yardsPerUnit || 0.14) * 1.08;
    if (rawYards <= 0.5) {
      totalSupplierCost = supplierRates.dtf_half_yard;
    } else {
      totalSupplierCost = rawYards * supplierRates.dtf_yard;
    }
    const unitPress = variantObj.presses === 2 ? inHouseCosts.press_double : inHouseCosts.press_single;
    totalInHouseCost = totalQty * unitPress;
  } else if (techId === 'sublimacion_parcial') {
    const costA4 = (variantObj.sheetsA4 || 0) * supplierRates.sub_sheet_a4;
    const costA3 = (variantObj.sheetsA3 || 0) * supplierRates.sub_sheet_a3;
    totalSupplierCost = totalQty * (costA4 + costA3) * volMult;
    const unitPress = variantObj.presses === 2 ? inHouseCosts.press_double : inHouseCosts.press_single;
    totalInHouseCost = totalQty * unitPress;
  } else if (techId === 'sublimacion_full') {
    const rawYards = totalQty * (variantObj.yardsPerUnit || 0.28);
    totalSupplierCost = rawYards * supplierRates.sub_yard * volMult;
    totalInHouseCost = totalQty * inHouseCosts.press_double;
  } else if (techId === 'dtf_uv') {
    const rawYardsUV = totalQty * (variantObj.yardsPerUnit || 0.06) * 1.10;
    if (rawYardsUV <= 0.18) {
      totalSupplierCost = supplierRates.uv_dtf_a4;
    } else if (rawYardsUV <= 0.36) {
      totalSupplierCost = supplierRates.uv_dtf_a3;
    } else {
      totalSupplierCost = rawYardsUV * supplierRates.uv_dtf_yard;
    }
    totalInHouseCost = totalQty * inHouseCosts.uv_application;
  } else if (techId === 'bordado') {
    const unitEmb = variantObj.type === 'dual' ? supplierRates.embroidery_dual : supplierRates.embroidery_small;
    const setupFee = totalQty < 12 ? supplierRates.embroidery_setup : 0;
    totalSupplierCost = (totalQty * unitEmb * volMult) + setupFee;
    totalInHouseCost = totalQty * inHouseCosts.press_single;
  } else if (techId === 'gran_formato') {
    const sqft = variantObj.sqft || 6;
    totalSupplierCost = totalQty * sqft * supplierRates.banner_sqft * volMult;
    totalInHouseCost = totalQty * inHouseCosts.banner_handling;
  } else {
    totalSupplierCost = technique.supplierCost * placeMult * volMult * totalQty;
    totalInHouseCost = product.pressCost * totalQty;
  }

  const totalInternalCost = totalBlankCost + totalSupplierCost + totalInHouseCost + designCost;
  const directOutOfPocketCost = totalBlankCost + totalSupplierCost + designCost;

  let unitClientPrice = 0;
  let finalClientTotal = 0;
  let subtotalClient = 0;
  let itbmsAmount = 0;

  if (manualPriceOverride !== null) {
    subtotalClient = manualPriceOverride * totalQty;
    itbmsAmount = includeItbms ? subtotalClient * 0.07 : 0;
    finalClientTotal = subtotalClient + itbmsAmount;
    unitClientPrice = finalClientTotal / totalQty;

    const priceInput = document.getElementById('unitClientPriceInput');
    if (priceInput && document.activeElement !== priceInput) {
      priceInput.value = Number(manualPriceOverride).toFixed(2);
    }
  } else {
    subtotalClient = totalInternalCost * (1 + (marginPercent / 100));
    itbmsAmount = includeItbms ? subtotalClient * 0.07 : 0;
    finalClientTotal = subtotalClient + itbmsAmount;
    unitClientPrice = finalClientTotal / totalQty;
    document.getElementById('unitClientPriceInput').value = (subtotalClient / totalQty).toFixed(2);
  }

  const netProfit = subtotalClient - totalInternalCost;

  let qtyText = `${totalQty} unidades`;
  if (isMixedSizes && qtyKids > 0) {
    qtyText = `${totalQty} unds (${qtyAdults} Ad / ${qtyKids} Ni)`;
  }

  currentCalculation = {
    prodId,
    techId,
    variantId,
    designValue: designSelect,
    isMixedSizes,
    qtyAdults,
    qtyKids,
    includeItbms,
    manualPriceOverride,
    marginPercent,
    productName: product.name,
    techniqueName: technique.name,
    placementName: selectedOption ? selectedOption.text : '',
    qty: totalQty,
    qtyText: qtyText,
    finalClientTotal,
    subtotalClient,
    itbmsAmount,
    unitClientPrice,
    totalInternalCost,
    directOutOfPocketCost,
    netProfit
  };

  document.getElementById('finalClientPrice').textContent = `$${finalClientTotal.toFixed(2)}`;
  document.getElementById('summaryProduct').textContent = product.name;
  document.getElementById('summaryQty').textContent = qtyText;
  document.getElementById('summaryTech').textContent = `${technique.name.split('(')[0]} (${selectedOption ? selectedOption.text.split('(')[0].trim() : ''})`;
  document.getElementById('summaryDeposit').textContent = `$${subtotalClient.toFixed(2)}`;

  const itbmsRow = document.getElementById('itbmsSummaryRow');
  if (includeItbms) {
    itbmsRow.classList.remove('hidden');
    document.getElementById('summaryItbms').textContent = `+$${itbmsAmount.toFixed(2)}`;
  } else {
    itbmsRow.classList.add('hidden');
  }

  const discBadge = document.getElementById('discountBadge');
  if (totalQty >= 12) discBadge.classList.remove('hidden');
  else discBadge.classList.add('hidden');

  document.getElementById('marginBadge').textContent = `${marginPercent}%`;
  document.getElementById('costBlankText').textContent = `$${totalBlankCost.toFixed(2)}`;
  document.getElementById('costSupplierText').textContent = `$${totalSupplierCost.toFixed(2)}`;
  document.getElementById('costInHouseText').textContent = `$${totalInHouseCost.toFixed(2)}`;
  document.getElementById('costLogisticsText').textContent = `$${designCost.toFixed(2)}`;
  document.getElementById('totalInternalCostText').textContent = `$${totalInternalCost.toFixed(2)}`;
  document.getElementById('netProfitText').textContent = `$${netProfit.toFixed(2)}`;
}

function addItemToCart() {
  if (!currentCalculation) {
    alert("Por favor, completa todas las opciones (Producto, Cantidad, Técnica, Cobertura y Diseño) para configurar el ítem.");
    return;
  }
  cart.push({ id: Date.now(), ...currentCalculation });
  manualDepositRateOverride = false; // Recalcular automáticamente según la suma de Costo Total Ítem
  renderCart();
  resetItemForm();
}

function removeCartItem(id) {
  cart = cart.filter(item => item.id !== id);
  manualDepositRateOverride = false;
  renderCart();
}

function editCartItem(id) {
  const item = cart.find(it => it.id === id);
  if (!item) return;

  cart = cart.filter(it => it.id !== id);
  manualDepositRateOverride = false;
  renderCart();

  const prodObj = products.find(p => p.id === item.prodId || p.name === item.productName);
  if (!prodObj) return;

  const prodSelect = document.getElementById('productSelect');
  prodSelect.value = prodObj.id;
  updateTechniquesForProduct(prodObj.id);
  checkIfTextile(prodObj.id);

  const techObj = techniques.find(t => t.id === item.techId || t.name === item.techniqueName);
  if (techObj) {
    document.getElementById('techniqueSelect').value = techObj.id;
    updateTechniqueVariants(techObj.id);

    const placeSelect = document.getElementById('placementSelect');
    if (item.variantId) {
      placeSelect.value = item.variantId;
    } else if (item.placementName) {
      const opt = Array.from(placeSelect.options).find(o => o.text === item.placementName);
      if (opt) placeSelect.value = opt.value;
    }
  }

  if (item.isMixedSizes) {
    document.getElementById('mixedSizesCheckbox').checked = true;
    isMixedSizes = true;
    document.getElementById('singleQuantityBox').classList.add('hidden');
    document.getElementById('splitQuantityBox').classList.remove('hidden');
    document.getElementById('qtyAdults').value = item.qtyAdults || 0;
    document.getElementById('qtyKids').value = item.qtyKids || 0;
  } else {
    document.getElementById('mixedSizesCheckbox').checked = false;
    isMixedSizes = false;
    document.getElementById('singleQuantityBox').classList.remove('hidden');
    document.getElementById('splitQuantityBox').classList.add('hidden');
    document.getElementById('quantityInput').value = item.qty || 1;
  }

  document.getElementById('designSelect').value = item.designValue !== undefined ? String(item.designValue) : "0";
  if (item.marginPercent) {
    document.getElementById('profitMarginInput').value = item.marginPercent;
  }

  const shouldHaveItbms = item.includeItbms !== undefined ? item.includeItbms : (Number(item.itbmsAmount || 0) > 0);
  if (includeItbms !== shouldHaveItbms) {
    toggleItbms();
  }

  const qtyVal = Number(item.qty) || 1;
  let savedBaseUnit = null;

  if (item.manualPriceOverride !== undefined && item.manualPriceOverride !== null) {
    savedBaseUnit = Number(item.manualPriceOverride);
  } else if (item.subtotalClient !== undefined) {
    savedBaseUnit = Number(item.subtotalClient) / qtyVal;
  } else if (item.unitClientPrice !== undefined) {
    savedBaseUnit = shouldHaveItbms
      ? (Number(item.unitClientPrice) / 1.07)
      : Number(item.unitClientPrice);
  }

  if (savedBaseUnit !== null && !isNaN(savedBaseUnit)) {
    manualPriceOverride = Number(savedBaseUnit.toFixed(2));
    document.getElementById('unitClientPriceInput').value = manualPriceOverride.toFixed(2);
    document.getElementById('manualPriceIndicator').classList.remove('hidden');
  } else {
    manualPriceOverride = null;
    document.getElementById('manualPriceIndicator').classList.add('hidden');
  }

  calculateAll();
}

function clearCart() {
  cart = [];
  manualDepositRateOverride = false;
  if (document.getElementById('depositRateSelect')) {
    document.getElementById('depositRateSelect').value = "0.60";
  }
  renderCart();
}

// ============================================================================
// SECCIÓN RETRAÍDA: LOGÍSTICA, URGENCIA Y DESCUENTOS
// ============================================================================
function toggleExtrasSection(forceOpen = null) {
  const body = document.getElementById('extrasSectionBody');
  const icon = document.getElementById('extrasChevronIcon');
  if (!body) return;

  const shouldOpen = forceOpen !== null ? forceOpen : body.classList.contains('hidden');
  if (shouldOpen) {
    body.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    body.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
}

function updateExtrasAppliedBadge(hasTransport, hasUrgency, hasDiscount) {
  const badge = document.getElementById('extrasActiveBadge');
  if (!badge) return;
  if (hasTransport || hasUrgency || hasDiscount) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleCustomDiscountInput() {
  const sel = document.getElementById('discountSelect');
  const box = document.getElementById('customDiscountBox');
  const label = document.getElementById('customDiscountLabel');
  if (!sel || !box) return;

  if (sel.value === 'custom_pct') {
    box.classList.remove('hidden');
    if (label) label.textContent = 'Porcentaje (%)';
  } else if (sel.value === 'custom_fixed') {
    box.classList.remove('hidden');
    if (label) label.textContent = 'Monto Fijo ($ USD)';
  } else {
    box.classList.add('hidden');
  }
}

function getCommercialDiscountData(baseAmount) {
  const sel = document.getElementById('discountSelect');
  if (!sel || sel.value === '0') {
    return { discountAmount: 0, label: '' };
  }

  const customReason = document.getElementById('discountReasonInput')?.value.trim();
  const customVal = parseFloat(document.getElementById('customDiscountValue')?.value) || 0;
  let discountAmount = 0;
  let defaultLabel = 'Descuento Comercial';

  if (sel.value === 'custom_pct') {
    const pct = Math.min(100, Math.max(0, customVal));
    discountAmount = baseAmount * (pct / 100);
    defaultLabel = `Descuento (${pct}%)`;
  } else if (sel.value === 'custom_fixed') {
    discountAmount = Math.min(baseAmount, Math.max(0, customVal));
    defaultLabel = 'Descuento Especial';
  } else {
    const rate = parseFloat(sel.value) || 0;
    discountAmount = baseAmount * rate;
    defaultLabel = `Descuento (${Math.round(rate * 100)}%)`;
  }

  const finalLabel = customReason ? `${defaultLabel} • ${customReason}` : defaultLabel;
  return {
    discountAmount: Number(discountAmount.toFixed(2)),
    label: finalLabel
  };
}

// ============================================================================
// PORCENTAJE DE ABONO GLOBAL AUTOMÁTICO (INICIA EN 60% Y CUBRE COSTO TOTAL ÍTEM)
// ============================================================================
function handleManualDepositRateChange() {
  manualDepositRateOverride = true;
  renderCart();
}

function getSelectedDepositRate() {
  const sel = document.getElementById('depositRateSelect');
  return sel && sel.value ? parseFloat(sel.value) : 0.60;
}

function updatePdfTermsByRate(depositRate) {
  const pct = Math.round((depositRate || 0.60) * 100);
  const rem = 100 - pct;
  const t1 = document.getElementById('pdfTerm1');

  if (!t1) return;

  if (pct >= 100) {
    t1.innerHTML = `1. <strong>Forma de Pago:</strong> Este pedido requiere el 100% de pago adelantado para iniciar producción (no reembolsable).`;
  } else {
    t1.innerHTML = `1. <strong>Forma de Pago:</strong> Todo pedido requiere el ${pct}% de abono inicial para iniciar producción (no reembolsable) y el ${rem}% restante se cancela contra entrega.`;
  }
}

function renderCart() {
  const container = document.getElementById('cartContainer');
  const totalsBox = document.getElementById('cartTotalsBox');
  const coverageAlert = document.getElementById('depositCoverageAlert');
  const autoTag = document.getElementById('autoDepositTag');
  const depSelect = document.getElementById('depositRateSelect');

  const transSel = document.getElementById('transportSelect');
  const globalTransport = transSel && transSel.value !== "" ? parseFloat(transSel.value) : 0;
  const urgSel = document.getElementById('urgencySelect');
  const globalUrgencyRate = urgSel && urgSel.value !== "" ? parseFloat(urgSel.value) : 0;

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-6">Aún no has agregado artículos al pedido formal.</p>`;
    totalsBox.classList.add('hidden');
    if (coverageAlert) coverageAlert.classList.add('hidden');
    if (depSelect) depSelect.value = "0.60";
    if (autoTag) autoTag.textContent = "Base 60%";
    updateExtrasAppliedBadge(globalTransport > 0, globalUrgencyRate > 0, false);
    return;
  }

  totalsBox.classList.remove('hidden');
  let itemsSubtotal = 0;
  let itemsProfit = 0;
  let sumTotalItemCosts = 0; // Suma de 'Costo Total Ítem' de todas las líneas agregadas

  container.innerHTML = cart.map(item => {
    itemsSubtotal += item.finalClientTotal;
    itemsProfit += item.netProfit;
    sumTotalItemCosts += Number(item.totalInternalCost || 0);

    return `
      <div class="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 transition">
        <div class="min-w-0">
          <p class="text-xs font-bold text-white truncate">${item.qtyText} de ${item.productName}</p>
          <p class="text-[11px] text-slate-400 truncate">${item.techniqueName.split('(')[0]} • $${item.unitClientPrice.toFixed(2)} c/u</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-sm font-extrabold text-cyan-400 mr-1">$${item.finalClientTotal.toFixed(2)}</span>
          <button onclick="editCartItem(${item.id})" title="Editar este artículo en el configurador"
            class="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-400 border border-slate-700 transition">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="removeCartItem(${item.id})" title="Eliminar artículo"
            class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-bold transition">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('cartItemsSubtotal').textContent = `$${itemsSubtotal.toFixed(2)}`;

  const trRow = document.getElementById('cartTransportRow');
  if (globalTransport > 0) {
    trRow.classList.remove('hidden');
    document.getElementById('cartTransportCost').textContent = `+$${globalTransport.toFixed(2)}`;
  } else {
    trRow.classList.add('hidden');
  }

  const preUrgencyTotal = itemsSubtotal + globalTransport;

  const urgRow = document.getElementById('cartUrgencyRow');
  const urgencyAmount = preUrgencyTotal * globalUrgencyRate;
  if (urgencyAmount > 0) {
    urgRow.classList.remove('hidden');
    document.getElementById('cartUrgencyCost').textContent = `+$${urgencyAmount.toFixed(2)}`;
  } else {
    urgRow.classList.add('hidden');
  }

  const subtotalBeforeDiscount = preUrgencyTotal + urgencyAmount;
  const { discountAmount, label: discountLabel } = getCommercialDiscountData(subtotalBeforeDiscount);

  const discRow = document.getElementById('cartDiscountRow');
  if (discountAmount > 0 && discRow) {
    discRow.classList.remove('hidden');
    document.getElementById('cartDiscountLabel').textContent = `${discountLabel}:`;
    document.getElementById('cartDiscountCost').textContent = `-$${discountAmount.toFixed(2)}`;
  } else if (discRow) {
    discRow.classList.add('hidden');
  }

  updateExtrasAppliedBadge(globalTransport > 0, urgencyAmount > 0, discountAmount > 0);

  const grandTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);

  // Cálculo automático del porcentaje de abono basado en la suma de 'Costo Total Ítem'
  let depositRate = getSelectedDepositRate();
  if (!manualDepositRateOverride && grandTotal > 0) {
    if (grandTotal * 0.60 >= sumTotalItemCosts) {
      depositRate = 0.60;
    } else if (grandTotal * 0.70 >= sumTotalItemCosts) {
      depositRate = 0.70;
    } else {
      depositRate = 1.00;
    }
    if (depSelect) depSelect.value = depositRate.toFixed(2);
  }

  const depositPct = Math.round(depositRate * 100);
  const depositAmount = grandTotal * depositRate;
  const totalNetProfit = itemsProfit + urgencyAmount - discountAmount;

  if (autoTag) {
    autoTag.textContent = manualDepositRateOverride ? `Manual (${depositPct}%)` : `Auto (${depositPct}%)`;
  }

  document.getElementById('cartGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  if (document.getElementById('cartDepositLabel')) {
    document.getElementById('cartDepositLabel').textContent = depositPct === 100
      ? `Pago total requerido (100%):`
      : `Abono requerido (${depositPct}%):`;
  }
  document.getElementById('cartDepositTotal').textContent = `$${depositAmount.toFixed(2)}`;

  if (document.getElementById('cartTotalProfit')) {
    document.getElementById('cartTotalProfit').textContent = `$${totalNetProfit.toFixed(2)}`;
  }

  // Indicador de cobertura contra la suma de 'Costo Total Ítem' (visible en Modo Interno)
  if (coverageAlert) {
    if (internalMode && sumTotalItemCosts > 0) {
      coverageAlert.classList.remove('hidden');
      const diff = depositAmount - sumTotalItemCosts;
      if (diff >= 0) {
        coverageAlert.className = "mt-2 text-[11px] px-2.5 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-2";
        coverageAlert.innerHTML = `<span>✓ Cubre Costo Total Ítems ($${sumTotalItemCosts.toFixed(2)})</span><span class="font-bold">+$${diff.toFixed(2)}</span>`;
      } else {
        coverageAlert.className = "mt-2 text-[11px] px-2.5 py-1.5 rounded-lg border bg-amber-500/10 border-amber-500/40 text-amber-300 flex items-center justify-between gap-2";
        coverageAlert.innerHTML = `<span>⚠️ Faltan $${Math.abs(diff).toFixed(2)} vs Costo Total ($${sumTotalItemCosts.toFixed(2)})</span><span class="font-bold underline cursor-pointer" onclick="manualDepositRateOverride=false; renderCart();">Auto-ajustar</span>`;
      }
    } else {
      coverageAlert.classList.add('hidden');
    }
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

  const transSel = document.getElementById('transportSelect');
  const globalTransport = transSel && transSel.value !== "" ? parseFloat(transSel.value) : 0;
  const urgSel = document.getElementById('urgencySelect');
  const globalUrgencyRate = urgSel && urgSel.value !== "" ? parseFloat(urgSel.value) : 0;
  const depositRate = getSelectedDepositRate();
  const depositPct = Math.round(depositRate * 100);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' });
  const quoteNum = window.editingQuoteFolio
    ? `N° ${window.editingQuoteFolio}`
    : `N° JNX-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

  if (document.getElementById('pdfQuoteNumber')) document.getElementById('pdfQuoteNumber').textContent = quoteNum;
  if (document.getElementById('pdfDate')) document.getElementById('pdfDate').textContent = `Fecha: ${dateStr}`;
  if (document.getElementById('pdfClientName')) document.getElementById('pdfClientName').textContent = client;
  if (document.getElementById('pdfClientContact')) document.getElementById('pdfClientContact').textContent = contact ? `Contacto / RUC: ${contact}` : '';
  if (document.getElementById('pdfProjectDesc')) document.getElementById('pdfProjectDesc').textContent = project;

  const deliveryVal = document.getElementById('deliveryDate')?.value || '';
  if (document.getElementById('pdfDeliveryDate')) {
    document.getElementById('pdfDeliveryDate').textContent = deliveryVal ? `Entrega estimada: ${deliveryVal}` : '';
  }

  let itemsSubtotal = 0;
  const tbody = document.getElementById('pdfTableBody');
  if (tbody) {
    tbody.innerHTML = itemsToPrint.map(item => {
      itemsSubtotal += item.finalClientTotal;
      const cleanTech = item.techniqueName.split('(')[0].trim();
      const cleanPlace = item.placementName ? item.placementName.split('(')[0].trim() : '';
      return `
        <tr>
          <td class="py-3.5 px-4 font-bold text-slate-900">${item.qtyText}</td>
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

  if (document.getElementById('pdfSubtotal')) document.getElementById('pdfSubtotal').textContent = `$${itemsSubtotal.toFixed(2)}`;

  const pdfTransRow = document.getElementById('pdfTransportRow');
  if (globalTransport > 0) {
    pdfTransRow.classList.remove('hidden');
    document.getElementById('pdfTransportCost').textContent = `+$${globalTransport.toFixed(2)}`;
  } else {
    pdfTransRow.classList.add('hidden');
  }

  const urgencyAmount = (itemsSubtotal + globalTransport) * globalUrgencyRate;
  const pdfUrgRow = document.getElementById('pdfUrgencyRow');
  if (urgencyAmount > 0) {
    pdfUrgRow.classList.remove('hidden');
    document.getElementById('pdfUrgencyCost').textContent = `+$${urgencyAmount.toFixed(2)}`;
  } else {
    pdfUrgRow.classList.add('hidden');
  }

  const subtotalBeforeDiscount = itemsSubtotal + globalTransport + urgencyAmount;
  const { discountAmount, label: discountLabel } = getCommercialDiscountData(subtotalBeforeDiscount);

  const pdfDiscRow = document.getElementById('pdfDiscountRow');
  if (discountAmount > 0 && pdfDiscRow) {
    pdfDiscRow.classList.remove('hidden');
    document.getElementById('pdfDiscountLabel').textContent = `${discountLabel}:`;
    document.getElementById('pdfDiscountCost').textContent = `-$${discountAmount.toFixed(2)}`;
  } else if (pdfDiscRow) {
    pdfDiscRow.classList.add('hidden');
  }

  const grandTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const deposit = grandTotal * depositRate;

  updatePdfTermsByRate(depositRate);

  if (document.getElementById('pdfGrandTotal')) document.getElementById('pdfGrandTotal').textContent = `$${grandTotal.toFixed(2)}`;
  if (document.getElementById('pdfDepositLabel')) {
    document.getElementById('pdfDepositLabel').textContent = depositPct >= 100
      ? `Pago total requerido (100%):`
      : `Abono ${depositPct}% para iniciar:`;
  }
  if (document.getElementById('pdfDeposit')) document.getElementById('pdfDeposit').textContent = `$${deposit.toFixed(2)}`;
  if (document.getElementById('pdfBalanceRow')) document.getElementById('pdfBalanceRow').classList.add('hidden');

  const hasItbms = itemsToPrint.some(item => Number(item.itbmsAmount || 0) > 0 || item.includeItbms === true);
  const itbmsNoteEl = document.getElementById('pdfItbmsNote');
  if (itbmsNoteEl) {
    if (hasItbms) itbmsNoteEl.classList.remove('hidden');
    else itbmsNoteEl.classList.add('hidden');
  }

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

  const transSel = document.getElementById('transportSelect');
  const globalTransport = transSel && transSel.value !== "" ? parseFloat(transSel.value) : 0;

  const urgSel = document.getElementById('urgencySelect');
  const globalUrgencyRate = urgSel && urgSel.value !== "" ? parseFloat(urgSel.value) : 0;
  const depositRate = getSelectedDepositRate();
  const depositPct = Math.round(depositRate * 100);

  let itemsSubtotal = 0;
  let lines = itemsToQuote.map(item => {
    itemsSubtotal += item.finalClientTotal;
    const techClean = item.techniqueName ? item.techniqueName.split('(')[0].trim() : '';
    return `▪ *${item.qtyText} de ${item.productName}*\n   Trabajo: ${techClean}\n   Unitario: $${item.unitClientPrice.toFixed(2)} | Subtotal: *$${item.finalClientTotal.toFixed(2)}*`;
  }).join('\n\n');

  const urgencyAmount = (itemsSubtotal + globalTransport) * globalUrgencyRate;
  const subtotalBeforeDiscount = itemsSubtotal + globalTransport + urgencyAmount;
  const { discountAmount, label: discountLabel } = getCommercialDiscountData(subtotalBeforeDiscount);
  const grandTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const deposit = grandTotal * depositRate;

  let extraLines = "";
  if (globalTransport > 0) extraLines += `\n🚚 Logística/Transporte: +$${globalTransport.toFixed(2)}`;
  if (urgencyAmount > 0) extraLines += `\n⚡ Recargo Express: +$${urgencyAmount.toFixed(2)}`;
  if (discountAmount > 0) extraLines += `\n🏷️ *${discountLabel}: -$${discountAmount.toFixed(2)}*`;

  const hasItbms = itemsToQuote.some(item => Number(item.itbmsAmount || 0) > 0 || item.includeItbms === true);
  const itbmsText = hasItbms ? `\n🧾 _Precios unitarios ya incluyen ITBMS (7%)_` : '';
  const depositLine = depositPct >= 100
    ? `✅ *Pago total adelantado (100%):* $${deposit.toFixed(2)}`
    : `✅ *Abono ${depositPct}% para iniciar:* $${deposit.toFixed(2)}`;

  const text = `*COTIZACIÓN OFICIAL - JNX GRAPHIC* 🎨\n` +
    `👤 *Cliente:* ${client}\n` +
    (project ? `📌 *Proyecto:* ${project}\n` : '') +
    (document.getElementById('deliveryDate')?.value ? `📅 *Entrega estimada:* ${document.getElementById('deliveryDate').value}\n` : '') +
    `----------------------------------\n` +
    `${lines}\n` +
    `----------------------------------` +
    `${extraLines}\n` +
    `💰 *TOTAL A PAGAR: $${grandTotal.toFixed(2)}*${itbmsText}\n` +
    `${depositLine}\n\n` +
    `_Cotización válida por 7 días. Incluye control de calidad y acabado profesional._`;

  navigator.clipboard.writeText(text).then(() => {
    const btnText = document.getElementById('copyBtnText');
    if (btnText) {
      btnText.textContent = "¡Copiado!";
      setTimeout(() => {
        btnText.textContent = "WhatsApp";
      }, 2500);
    } else {
      alert("¡Cotización copiada al portapapeles para WhatsApp!");
    }
  });
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

  renderCart();
}

function toggleConfigModal() {
  const modal = document.getElementById('configModal');
  if (modal.classList.contains('hidden')) {
    renderConfigInputs();
    modal.classList.remove('hidden');
    lucide.createIcons();
  } else {
    modal.classList.add('hidden');
  }
}

function renderConfigInputs() {
  document.getElementById('modalProductsConfig').innerHTML = products.map((p, i) => `
    <div class="flex items-center justify-between gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/90">
      <span class="text-xs font-medium text-slate-300 leading-snug">${p.name}</span>
      <div class="relative w-20 shrink-0">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        <input type="number" step="0.05" min="0" id="cfg_prod_${i}" value="${p.blankCost}"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-5 pr-2 text-right text-xs font-bold text-white focus:border-cyan-400 focus:outline-none">
      </div>
    </div>
  `).join('');

  document.getElementById('modalSupplierConfig').innerHTML = SUPPLIER_LABELS.map(({ key, label }) => `
    <div class="flex items-center justify-between gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/90">
      <span class="text-xs font-medium text-slate-300 leading-snug">${label}</span>
      <div class="relative w-20 shrink-0">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        <input type="number" step="0.05" min="0" id="cfg_sup_${key}" value="${supplierRates[key]}"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-5 pr-2 text-right text-xs font-bold text-white focus:border-fuchsia-400 focus:outline-none">
      </div>
    </div>
  `).join('');

  document.getElementById('modalInHouseConfig').innerHTML = INHOUSE_LABELS.map(({ key, label }) => `
    <div class="flex items-center justify-between gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/90">
      <span class="text-xs font-medium text-slate-300 leading-snug">${label}</span>
      <div class="relative w-20 shrink-0">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        <input type="number" step="0.05" min="0" id="cfg_inh_${key}" value="${inHouseCosts[key]}"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 pl-5 pr-2 text-right text-xs font-bold text-white focus:border-amber-400 focus:outline-none">
      </div>
    </div>
  `).join('');
}

function saveCustomCosts() {
  products.forEach((p, i) => {
    const val = parseFloat(document.getElementById(`cfg_prod_${i}`).value);
    if (!isNaN(val)) p.blankCost = val;
  });

  SUPPLIER_LABELS.forEach(({ key }) => {
    const val = parseFloat(document.getElementById(`cfg_sup_${key}`).value);
    if (!isNaN(val)) supplierRates[key] = val;
  });

  INHOUSE_LABELS.forEach(({ key }) => {
    const val = parseFloat(document.getElementById(`cfg_inh_${key}`).value);
    if (!isNaN(val)) inHouseCosts[key] = val;
  });

  localStorage.setItem('jnx_products', JSON.stringify(products));
  localStorage.setItem('jnx_supplier_rates', JSON.stringify(supplierRates));
  localStorage.setItem('jnx_inhouse_costs', JSON.stringify(inHouseCosts));

  calculateAll();
  toggleConfigModal();
}

function resetDefaultCosts() {
  localStorage.removeItem('jnx_products');
  localStorage.removeItem('jnx_supplier_rates');
  localStorage.removeItem('jnx_inhouse_costs');

  products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  supplierRates = JSON.parse(JSON.stringify(DEFAULT_SUPPLIER_RATES));
  inHouseCosts = JSON.parse(JSON.stringify(DEFAULT_INHOUSE_COSTS));

  renderConfigInputs();
  calculateAll();
}

// ============================================================================
// MENÚ DESPLEGABLE DEL ENCABEZADO
// ============================================================================
function toggleHeaderDropdown() {
  const menu = document.getElementById('headerDropdownMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('headerMenuWrapper');
  const menu = document.getElementById('headerDropdownMenu');
  if (wrapper && menu && !wrapper.contains(e.target)) {
    menu.classList.add('hidden');
  }
});