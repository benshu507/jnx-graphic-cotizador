const DEFAULT_PRODUCTS = [
  {
    id: 'tshirt_algodon', name: 'T-Shirt Algodón Clásico', blankCost: 2.75, pressCost: 0.65,
    allowedTechniques: ['dtf', 'bordado']
  },
  {
    id: 'tshirt_dryfit', name: 'T-Shirt Dry-Fit / Poli-Algodón (Sublimable)', blankCost: 3.00, pressCost: 0.70,
    allowedTechniques: ['sublimacion_parcial', 'sublimacion_full', 'dtf', 'bordado']
  },
  {
    id: 'polo_dryfit', name: 'Suéter Tipo Polo (Dry-Fit / Piqué)', blankCost: 5.50, pressCost: 0.80,
    allowedTechniques: ['bordado', 'dtf', 'sublimacion_parcial']
  },
  {
    id: 'abrigo_hoodie', name: 'Abrigo / Hoodie Personalizado', blankCost: 9.50, pressCost: 1.00,
    allowedTechniques: ['dtf', 'bordado']
  },
  {
    id: 'gorra', name: 'Gorra (Trucker / Plana / Clásica)', blankCost: 2.25, pressCost: 0.60,
    allowedTechniques: ['dtf', 'bordado', 'sublimacion_parcial']
  },
  {
    id: 'taza_11oz', name: 'Taza Cerámica 11oz', blankCost: 1.35, pressCost: 0.55,
    allowedTechniques: ['sublimacion_parcial', 'dtf_uv']
  },
  {
    id: 'termo_tumbler', name: 'Termo / Vaso Acero Inoxidable', blankCost: 4.50, pressCost: 0.75,
    allowedTechniques: ['dtf_uv', 'sublimacion_parcial']
  },
  {
    id: 'libreta_b6', name: 'Libreta Corporativa / B6', blankCost: 1.85, pressCost: 0.50,
    allowedTechniques: ['dtf_uv']
  },
  {
    id: 'bolso_tote', name: 'Bolso Tote Bag / Mochila Sublimable', blankCost: 1.90, pressCost: 0.60,
    allowedTechniques: ['sublimacion_parcial', 'dtf', 'bordado']
  },
  {
    id: 'prenda_cliente', name: 'Prenda traída por el Cliente (Solo Servicio)', blankCost: 0.00, pressCost: 1.00,
    allowedTechniques: ['dtf', 'bordado', 'sublimacion_parcial']
  },
  {
    id: 'banner', name: 'Banner / Lona Publicitaria (Gran Formato)', blankCost: 0.00, pressCost: 1.50,
    allowedTechniques: ['gran_formato']
  }
];

const TECHNIQUES = [
  {
    id: 'dtf',
    name: 'Estampado DTF Textil (Proveedor + Plancha en Casa)',
    supplierCost: 2.25,
    variants: [
      { id: 'logo_chest', name: 'Logo Pecho / Manga (10x10cm)', multiplier: 0.75 },
      { id: 'front_a4', name: 'Frente Estándar (Tamaño A4)', multiplier: 1.00 },
      { id: 'front_full', name: 'Frente Grande (Tamaño A3)', multiplier: 1.35 },
      { id: 'front_back', name: 'Combo: Logo Pecho + Espalda Grande', multiplier: 1.75 }
    ]
  },
  {
    id: 'sublimacion_parcial',
    name: 'Sublimación Estándar (Papel Proveedor + Plancha en Casa)',
    supplierCost: 1.25,
    variants: [
      { id: 'sub_mug', name: 'Taza / Cilíndrico Estándar', multiplier: 0.80 },
      { id: 'sub_a4', name: 'Estampado Parcial A4 (1 Cara)', multiplier: 1.00 },
      { id: 'sub_a3', name: 'Estampado Grande A3 (1 Cara)', multiplier: 1.30 },
      { id: 'sub_dual', name: 'Frente + Espalda (2 Caras)', multiplier: 1.75 }
    ]
  },
  {
    id: 'sublimacion_full',
    name: 'Full Sublimación Completa',
    supplierCost: 4.50,
    variants: [
      { id: 'full_tshirt', name: 'Full Sublimación Todo el Suéter', multiplier: 1.00 }
    ]
  },
  {
    id: 'dtf_uv',
    name: 'Impresión DTF UV Rígidos (Proveedor + Aplicación)',
    supplierCost: 2.60,
    variants: [
      { id: 'uv_small', name: 'Logo Pequeño (Termos / Bolígrafos)', multiplier: 0.80 },
      { id: 'uv_medium', name: 'Logo Mediano (Libretas B6 / Tazas)', multiplier: 1.00 },
      { id: 'uv_large', name: 'Arte Grande (Cajas / Acrílicos)', multiplier: 1.50 }
    ]
  },
  {
    id: 'bordado',
    name: 'Bordado Computarizado (Servicio con Proveedor)',
    supplierCost: 3.50,
    variants: [
      { id: 'emb_chest', name: 'Logo Pecho o Frente de Gorra', multiplier: 1.00 },
      { id: 'emb_dual', name: 'Logo Pecho + Manga / Espalda', multiplier: 1.60 }
    ]
  },
  {
    id: 'gran_formato',
    name: 'Gran Formato: Banners y Viniles (Impresión y Ojetes)',
    supplierCost: 1.35,
    variants: [
      { id: 'ban_2x3', name: 'Banner 2x3 Pies (Con Ojetes)', multiplier: 1.00 },
      { id: 'ban_3x5', name: 'Banner 3x5 Pies (Con Ojetes)', multiplier: 1.50 },
      { id: 'ban_4x8', name: 'Banner 4x8 Pies (Con Ojetes)', multiplier: 2.20 }
    ]
  }
];

// Mantenemos PLACEMENTS por si acaso, aunque ya se maneja por 'variants'
const PLACEMENTS = [
  { id: '1_logo', name: '1 Ubicación Pequeña (Logo Pecho / Gorra / Libreta)', multiplier: 0.75 },
  { id: '1_frente', name: '1 Lado Estándar (Frente o Espalda A4/A3)', multiplier: 1.00 },
  { id: 'frente_espalda', name: '2 Lados (Pecho + Espalda Completa)', multiplier: 1.75 },
  { id: 'full_combos', name: '3 Ubicaciones (Frente + Espalda + Manga)', multiplier: 2.20 }
];