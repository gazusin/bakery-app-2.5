

"use client";

import { parseISO, isValid, differenceInDays, addDays, format as formatDateFns, compareDesc, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { type SimulatedRecipe, type SimulatedRecipeItem } from '@/app/price-comparison/page'; // Importar tipos

// --- Event Dispatcher ---
export function dispatchDataUpdateEvent(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('data-updated', { detail: { key } }));
  }
}

// --- New Interface for Exchange Rate History ---
export interface ExchangeRateEntry {
  date: string; // "YYYY-MM-DD"
  rate: number;
}


// --- Storage Key Constants ---
export const KEYS = {
  USER_PROFILE: 'bakery_user_profile_data',
  COMPANY_ACCOUNTS: 'bakery_company_accounts_data', // Será por sede
  EXCHANGE_RATE: 'bakery_exchange_rate', // Legacy key for today's rate
  EXCHANGE_RATE_HISTORY: 'bakery_exchange_rate_history', // New key for history
  PRODUCTS: 'bakery_products_data', // Será por sede
  PRODUCTION_LOG: 'bakery_production_log_data', // Será por sede
  RECIPES: 'bakery_recipes_data', // Será por sede
  SUPPLIERS: 'bakery_suppliers_data', // Global - Los proveedores son globales
  RAW_MATERIAL_OPTIONS: 'bakery_raw_material_options', // Global - Lista de MP es global
  PURCHASE_ORDERS: 'bakery_purchase_orders_data', // Será por sede
  RAW_MATERIAL_INVENTORY: 'bakery_raw_material_inventory', // Será por sede
  WEEKLY_GOALS: 'bakery_weekly_goals_data', // Será por sede
  MONTHLY_GOALS: 'bakery_monthly_goals_data', // Será por sede
  SALES: 'bakery_sales_data', // Global
  CUSTOMERS: 'bakery_customers_data', // Global
  PAYMENTS: 'bakery_payments_data', // Global
  ACCOUNT_TRANSACTIONS: 'bakery_account_transactions_data', // Será por sede
  EMPLOYEES: 'bakery_employees_data', // Será por sede
  EXPENSES: 'bakery_expenses_data', // Será por sede
  INVENTORY_TRANSFERS: 'bakery_inventory_transfers_data', // Global
  EXPENSE_FIXED_CATEGORIES: 'bakery_expense_fixed_categories', // AHORA POR SEDE
  EXPENSE_VARIABLE_CATEGORIES: 'bakery_expense_variable_categories', // AHORA POR SEDE
  ACTIVE_BRANCH_ID: 'bakery_active_branch_id', // Global
  PENDING_FUND_TRANSFERS: 'bakery_pending_fund_transfers_data', // Global
  CUSTOM_CONVERSION_RULES: 'bakery_custom_conversion_rules_global',
  WEEKLY_LOSS_REPORTS: 'bakery_weekly_loss_reports_data',
  WEEKLY_PROFIT_REPORTS: 'bakery_weekly_profit_reports_data', // Nuevo
  COMPARISON_RECIPES: 'bakery_comparison_recipes', // Nueva clave para recetas de comparación
} as const;

export const COMPANY_ACCOUNTS_STORAGE_KEY_BASE = KEYS.COMPANY_ACCOUNTS;
export const RAW_MATERIAL_INVENTORY_STORAGE_KEY_BRANCH_BASE = KEYS.RAW_MATERIAL_INVENTORY;
export const ACCOUNT_TRANSACTIONS_STORAGE_KEY_BASE = KEYS.ACCOUNT_TRANSACTIONS;
export const EXPENSES_STORAGE_KEY_BASE = KEYS.EXPENSES;
export const WEEKS_IN_MONTH = 365.25 / 12 / 7;


// --- User Credentials (Simulated) ---
export const SIMULATED_ADMIN_USERNAME = "admin";
export const SIMULATED_USER_PASSWORD = "pan123";

// --- Branch Management ---
export interface Branch {
  id: string;
  name: string;
}
export const availableBranches: Branch[] = [
  { id: 'panaderia_principal', name: 'Panadería' },
  { id: 'productos_elaborados', name: 'Productos' },
];

// --- Branch LocalStorage ---
export function getActiveBranchId(): string | null {
  if (typeof window === 'undefined') return availableBranches[0]?.id || null;
  const activeId = localStorage.getItem(KEYS.ACTIVE_BRANCH_ID);
  const isValidBranch = availableBranches.some(b => b.id === activeId);
  if (isValidBranch) return activeId;
  if (availableBranches.length > 0) {
    // No establecer automáticamente aquí, dejar que SelectBranchPage lo maneje
    // localStorage.setItem(KEYS.ACTIVE_BRANCH_ID, availableBranches[0].id);
    // return availableBranches[0].id;
  }
  return null;
}
export function setActiveBranchId(branchId: string): void {
  if (typeof window !== 'undefined') {
    if (availableBranches.some(b => b.id === branchId)) {
      localStorage.setItem(KEYS.ACTIVE_BRANCH_ID, branchId);
      dispatchDataUpdateEvent(KEYS.ACTIVE_BRANCH_ID);
    } else {
      console.error(`Intento de establecer una sede inválida: ${branchId}`);
    }
  }
}

// --- Storage Key Generation ---
const GLOBAL_KEYS: readonly string[] = [
  KEYS.USER_PROFILE,
  KEYS.ACTIVE_BRANCH_ID,
  KEYS.EXCHANGE_RATE,
  KEYS.EXCHANGE_RATE_HISTORY,
  KEYS.SUPPLIERS,
  KEYS.RAW_MATERIAL_OPTIONS,
  KEYS.CUSTOM_CONVERSION_RULES,
  KEYS.CUSTOMERS,
  KEYS.SALES,
  KEYS.PAYMENTS,
  KEYS.PENDING_FUND_TRANSFERS,
  KEYS.INVENTORY_TRANSFERS,
  KEYS.WEEKLY_LOSS_REPORTS,
  KEYS.WEEKLY_PROFIT_REPORTS,
  KEYS.COMPARISON_RECIPES
];

function getStorageKey(baseKey: string): string {
  if (GLOBAL_KEYS.includes(baseKey)) {
    return baseKey;
  }
  // For all other keys, they are branch-specific
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) {
    console.warn(`getStorageKey: No active branch ID for non-global key '${baseKey}'. Falling back to a default key. This may cause issues.`);
    return `${baseKey}_default_branch_PLEASE_SELECT_BRANCH`;
  }
  return `${baseKey}_${activeBranchId}`;
}


function getStorageKeyForBranch(baseKey: string, branchId: string): string {
  if (GLOBAL_KEYS.includes(baseKey as any)) return baseKey; // Global keys don't change
  if (!availableBranches.some(b => b.id === branchId)) {
    console.warn(`getStorageKeyForBranch: BranchId '${branchId}' no es válido. Usando 'default_branch_ERROR'.`);
    return `${baseKey}_default_branch_ERROR`;
  }
  return `${baseKey}_${branchId}`;
}


// --- Helper: Default Data ---
function getDefaultObjectStructure(key: string, baseKey?: string): any {
  const k = baseKey || key;
  if (k === KEYS.USER_PROFILE) {
    const defaultPermissions = allModules.reduce((acc, moduleKey) => {
      const permKey = normalizeModuleKey(moduleKey);
      acc[permKey] = true;
      return acc;
    }, {} as UserPermissions);
    return {
      fullName: "Administrador Principal",
      email: SIMULATED_ADMIN_USERNAME,
      phone: "",
      moduleAccess: defaultPermissions,
    };
  }
  if (k === KEYS.COMPANY_ACCOUNTS) { // This is for a specific branch now
    return {
      vesElectronic: { balance: 0, currency: 'VES', lastTransactionDate: undefined },
      usdCash: { balance: 0, currency: 'USD', lastTransactionDate: undefined },
      vesCash: { balance: 0, currency: 'VES', lastTransactionDate: undefined },
    };
  }
  if (k === KEYS.CUSTOMERS || k === KEYS.SALES || k === KEYS.PAYMENTS || k === KEYS.PENDING_FUND_TRANSFERS || k === KEYS.INVENTORY_TRANSFERS || k === KEYS.SUPPLIERS || k === KEYS.RAW_MATERIAL_OPTIONS || k === KEYS.CUSTOM_CONVERSION_RULES || k === KEYS.WEEKLY_LOSS_REPORTS || k === KEYS.WEEKLY_PROFIT_REPORTS || k === KEYS.EXCHANGE_RATE_HISTORY || k === KEYS.COMPARISON_RECIPES) {
    return []; // Global arrays default to empty
  }
  // For branch-specific arrays if key is not global
  if ([KEYS.PRODUCTS, KEYS.PRODUCTION_LOG, KEYS.RECIPES, KEYS.PURCHASE_ORDERS, KEYS.RAW_MATERIAL_INVENTORY, KEYS.WEEKLY_GOALS, KEYS.MONTHLY_GOALS, KEYS.ACCOUNT_TRANSACTIONS, KEYS.EMPLOYEES, KEYS.EXPENSES, KEYS.EXPENSE_FIXED_CATEGORIES, KEYS.EXPENSE_VARIABLE_CATEGORIES].includes(k as any)) {
    return [];
  }
  if (k === KEYS.EXCHANGE_RATE) return 0;
  return {}; // Default for other non-array, non-object global types
}

// --- Storage (Load/Save) ---
function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function loadFromLocalStorage<T>(baseKey: string, isObject = false): T {
  const key = getStorageKey(baseKey);
  if (typeof window === 'undefined')
    return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
  const raw = localStorage.getItem(key);
  if (raw === null)
    return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
  const parsed = safeParse<T>(raw, isObject ? getDefaultObjectStructure(key, baseKey) : [] as T);
  if (isObject && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as T;
  if (!isObject && Array.isArray(parsed)) return parsed as T;
  return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
}

function saveToLocalStorage<T>(baseKey: string, data: T): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(baseKey);
  if (key.includes("_default_branch_PLEASE_SELECT_BRANCH") && !GLOBAL_KEYS.includes(baseKey as any)) {
    console.warn(`Intentando guardar datos para una clave de sede no seleccionada: ${key}. Operación omitida.`);
    return;
  }
  localStorage.setItem(key, JSON.stringify(data));
  dispatchDataUpdateEvent(baseKey);
}

export function loadFromLocalStorageForBranch<T>(baseKey: string, branchId: string, isObject = false): T {
  const key = getStorageKeyForBranch(baseKey, branchId);
  if (typeof window === 'undefined')
    return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
  const raw = localStorage.getItem(key);
  if (raw === null)
    return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
  const parsed = safeParse<T>(raw, isObject ? getDefaultObjectStructure(key, baseKey) : [] as T);
  if (isObject && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as T;
  if (!isObject && Array.isArray(parsed)) return parsed as T;
  return (isObject ? getDefaultObjectStructure(key, baseKey) : []) as T;
}
export function saveToLocalStorageForBranch<T>(baseKey: string, branchId: string, data: T): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKeyForBranch(baseKey, branchId);
  localStorage.setItem(key, JSON.stringify(data));
  dispatchDataUpdateEvent(baseKey);
}

// --- Nueva Interface para Reglas de Conversión Personalizadas ---
export interface CustomConversionRule {
  id: string;
  purchaseUnit: string;
  materialNameMatcher?: string;
  baseUnit: 'kg' | 'g' | 'l' | 'ml' | 'unidad';
  factor: number;
}

// --- Default Conversion Rules ---
const defaultCustomConversionRules: CustomConversionRule[] = [
  { id: 'ccr-manteca-caja', purchaseUnit: 'Caja', materialNameMatcher: 'manteca', baseUnit: 'kg', factor: 15 },
  { id: 'ccr-guayaba-caja', purchaseUnit: 'Caja', materialNameMatcher: 'guayaba', baseUnit: 'kg', factor: 20 },
  { id: 'ccr-mantequilla-caja', purchaseUnit: 'Caja', materialNameMatcher: 'mantequilla', baseUnit: 'kg', factor: 15 },
  { id: 'ccr-sal-saco', purchaseUnit: 'Saco', materialNameMatcher: 'sal', baseUnit: 'kg', factor: 20 },
  { id: 'ccr-bolsas-paquete', purchaseUnit: 'Paquete', materialNameMatcher: 'bolsas', baseUnit: 'unidad', factor: 1000 },
  { id: 'ccr-vainillin-caja', purchaseUnit: 'Caja', materialNameMatcher: 'vainillin', baseUnit: 'kg', factor: 0.454 },
  { id: 'ccr-levadura-paquete', purchaseUnit: 'Paquete', materialNameMatcher: 'levadura', baseUnit: 'kg', factor: 0.5 },
  { id: 'ccr-arequipe-galon', purchaseUnit: 'Galon', materialNameMatcher: 'arequipe', baseUnit: 'kg', factor: 5 },
  { id: 'ccr-etiquetas-paquete', purchaseUnit: 'Paquete', materialNameMatcher: 'etiquetas', baseUnit: 'unidad', factor: 1000 },
];


// --- Funciones para Cargar y Guardar Reglas de Conversión Personalizadas (AHORA GLOBALES) ---
export function loadCustomConversionRules(): CustomConversionRule[] {
  if (typeof window === 'undefined') return JSON.parse(JSON.stringify(defaultCustomConversionRules));
  const raw = localStorage.getItem(KEYS.CUSTOM_CONVERSION_RULES);
  if (raw === null) {
    // Si no hay nada, guardar las por defecto y devolverlas
    saveCustomConversionRules(defaultCustomConversionRules);
    return defaultCustomConversionRules;
  }
  const rules = safeParse<CustomConversionRule[]>(raw, []);
  return Array.isArray(rules) ? rules : [];
}


export function saveCustomConversionRules(rules: CustomConversionRule[]): void {
  const validRules = rules.filter(rule =>
    rule.id && rule.purchaseUnit && rule.baseUnit && typeof rule.factor === 'number' && rule.factor > 0 && VALID_BASE_UNITS.some(bu => bu === normalizeUnit(rule.baseUnit))
  ).map(rule => ({
    ...rule,
    purchaseUnit: rule.purchaseUnit.trim(),
    materialNameMatcher: rule.materialNameMatcher?.trim().toLowerCase() || undefined,
    baseUnit: normalizeUnit(rule.baseUnit) as 'kg' | 'g' | 'l' | 'ml' | 'unidad'
  }));
  saveToLocalStorage<CustomConversionRule[]>(KEYS.CUSTOM_CONVERSION_RULES, validRules);
}


// --- Unit Conversion Utilities ---
export const VALID_BASE_UNITS: ('kg' | 'g' | 'l' | 'ml' | 'unidad')[] = ['kg', 'g', 'l', 'ml', 'unidad'];

export function normalizeUnit(unit: string | undefined): string {
  if (typeof unit !== 'string' || !unit) return 'unidad';
  let u = unit.toLowerCase().trim();
  const unitMap: Record<string, string> = {
    'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
    'g': 'g', 'gramo': 'g', 'gramos': 'g', 'gr': 'g',
    'l': 'l', 'litro': 'l', 'litros': 'l', 'lt': 'l',
    'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
    'galon': 'galon', 'galón': 'galon', 'galones': 'galon', 'gallon': 'galon', 'galones(es)': 'galon', 'gal': 'galon',
    'unidad': 'unidad', 'unidades': 'unidad', 'und': 'unidad', 'unit': 'unidad', 'unid': 'unidad', 'unidad(es)': 'unidad',
    'docena': 'docena', 'docenas': 'docena', 'docena(s)': 'docena',
    'paquete': 'paquete', 'paquetes': 'paq', 'paquete(s)': 'paquete',
    'caja': 'caja', 'cajas': 'caja', 'caja(s)': 'caja',
    'saco': 'saco', 'sacos': 'saco', 'saco(s)': 'saco',
    'bandeja': 'bandeja', 'bandejas': 'bandeja', 'bandeja(s)': 'bandeja'
  };
  return unitMap[u] || u;
}

export const unitConversionsTable: Record<string, { toBaseUnit: 'g' | 'ml' | 'unidad', factor: number }> = {
  'kg': { toBaseUnit: 'g', factor: 1000 },
  'l': { toBaseUnit: 'ml', factor: 1000 },
  'galon': { toBaseUnit: 'ml', factor: 3785.41 }
};

export const materialSpecificSackConversions: Record<string, { factor: number; baseUnit: 'g' | 'ml' | 'unidad' }> = {
  'harina de trigo': { factor: 45000, baseUnit: 'g' },
  'harina': { factor: 45000, baseUnit: 'g' },
  'azucar': { factor: 50000, baseUnit: 'g' },
  'azúcar': { factor: 50000, baseUnit: 'g' },
};

export const materialSpecificBoxConversions: Record<string, { factor: number; baseUnit: 'g' | 'ml' | 'unidad' }> = {
  'aceite': { factor: 20000, baseUnit: 'ml' },
  'papelón': { factor: 8400, baseUnit: 'g' },
  'papelon': { factor: 8400, baseUnit: 'g' },
};

export function convertMaterialToBaseUnit(
  quantityInput: number | string,
  unit: string,
  materialName?: string
): { quantity: number; unit: string } {
  const normalizedPurchaseUnit = normalizeUnit(unit);
  const numQuantity = Number(quantityInput);

  if (isNaN(numQuantity)) {
    return { quantity: 0, unit: normalizedPurchaseUnit || 'unidad' };
  }

  // 1. Si ya es una unidad base, no hacer nada más.
  if (VALID_BASE_UNITS.includes(normalizedPurchaseUnit as any)) {
    return { quantity: numQuantity, unit: normalizedPurchaseUnit };
  }

  const lowerMaterialName = materialName?.toLowerCase().trim();

  // 2. Reglas personalizadas (MÁXIMA PRIORIDAD)
  const customRules = loadCustomConversionRules();
  if (lowerMaterialName) {
    for (const rule of customRules) {
      if (rule.materialNameMatcher && normalizeUnit(rule.purchaseUnit) === normalizedPurchaseUnit) {
        const matchers = rule.materialNameMatcher.split(',').map(m => m.trim().toLowerCase());
        if (matchers.some(matcher => lowerMaterialName.includes(matcher))) {
          return convertMaterialToBaseUnit(numQuantity * rule.factor, rule.baseUnit, materialName);
        }
      }
    }
  }
  for (const rule of customRules) {
    if (!rule.materialNameMatcher && normalizeUnit(rule.purchaseUnit) === normalizedPurchaseUnit) {
      return convertMaterialToBaseUnit(numQuantity * rule.factor, rule.baseUnit, materialName);
    }
  }

  // 3. Conversiones específicas de material (saco, caja) - como respaldo
  if (lowerMaterialName && normalizedPurchaseUnit === 'saco') {
    for (const keyword in materialSpecificSackConversions) {
      if (lowerMaterialName.includes(keyword)) {
        const conversion = materialSpecificSackConversions[keyword];
        return convertMaterialToBaseUnit(numQuantity * conversion.factor, conversion.baseUnit, materialName);
      }
    }
  }
  if (lowerMaterialName && normalizedPurchaseUnit === 'caja') {
    for (const keyword in materialSpecificBoxConversions) {
      if (lowerMaterialName.includes(keyword)) {
        const conversion = materialSpecificBoxConversions[keyword];
        return convertMaterialToBaseUnit(numQuantity * conversion.factor, conversion.baseUnit, materialName);
      }
    }
  }

  // 4. Conversiones genéricas (kg -> g, l -> ml, galon -> ml)
  const genericConversion = unitConversionsTable[normalizedPurchaseUnit as keyof typeof unitConversionsTable];
  if (genericConversion) {
    return { quantity: numQuantity * genericConversion.factor, unit: genericConversion.toBaseUnit };
  }

  // 5. Caso especial para `paquete de bolsas`
  if (lowerMaterialName && lowerMaterialName.includes('bolsa') && normalizedPurchaseUnit === 'paquete') {
    return { quantity: numQuantity * 1000, unit: 'unidad' };
  }

  console.warn(`Unidad de compra '${unit}' (normalizada: '${normalizedPurchaseUnit}') para material '${materialName || 'desconocido'}' no tiene conversión a unidad base estándar. Se devolverá la unidad original '${unit}'.`);
  return { quantity: numQuantity, unit: unit };
}



// --- Types, Models, Data ---
export type AccountType = 'vesElectronic' | 'usdCash' | 'vesCash';
export const accountTypes: AccountType[] = ['vesElectronic', 'usdCash', 'vesCash'];
export const accountTypeNames: Record<AccountType, string> = {
  vesElectronic: "VES Electrónico",
  usdCash: "USD Efectivo",
  vesCash: "VES Efectivo"
};

export interface UserPermissions { [moduleId: string]: boolean; }
export const allModules = [
  "Panel Principal", "Stock de producción", "Producción", "Recetas", "Proveedores",
  "Órdenes de Compra", "Inventario Materia Prima", "Comparación de Precios", "Reorden Inteligente",
  "Metas de Producción", "Ventas", "Clientes", "Cuentas por Cobrar", "Verificación de Pagos", "Movimientos de Cuenta",
  "Empleados", "Gastos", "Reportes", "Perfil de Usuario", "Transferencias MP", "Transferencias Fondos"
];
function normalizeModuleKey(moduleKey: string) {
  return moduleKey.toLowerCase().replace(/ /g, '-').replace(/[óòôõö]/g, 'o').replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n');
}
export interface Product { id: string; name: string; category: string; stock: number; unitPrice: number; lastUpdated: string; image: string; aiHint?: string; sourceBranchId?: string; sourceBranchName?: string; }
export interface ProductionLogEntry {
  id: string;
  date: string;
  product: string;
  batchSizeMultiplier: number;
  expectedQuantity: number;
  actualQuantity: number;
  unitPrice: number;
  staff: string;
  batchNumber?: string;
  timestamp?: string;
  bagUsed?: string;
  labelUsed?: string;
}
export interface ProductionGoal { id: string; product: string; target: number; achieved: number; status: string; period: 'weekly' | 'monthly'; startDate: string; }
export interface RecipeIngredientItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredientItem[];
  instructions?: string;
  costPerUnit: number; // For non-intermediate products, this is the SALE price. For 'No despachable', it's the production cost.
  expectedYield?: number;
  lastUpdated: string;
  isIntermediate?: boolean;
  isResoldProduct?: boolean; // New flag for resold products
  outputUnit?: 'kg' | 'l';
  category?: string;
  aiHint?: string;
  batchSizeMultiplier?: number;
}

export interface PriceHistoryEntry {
  price: number;
  date: string;
}
export interface SupplierPriceListItem {
  id: string;
  rawMaterialName: string;
  unit: string;
  priceHistory: PriceHistoryEntry[];
}
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  priceList?: SupplierPriceListItem[];
  priceListUSDCash?: SupplierPriceListItem[]; // Nueva lista de precios para USD en efectivo
}
export interface PurchaseOrderItem { id: string; rawMaterialName: string; quantity: number; unit: string; unitPrice: number; subtotal: number; }
export type PurchaseOrderStatus = 'Pagado' | 'Pendiente' | 'Cancelado' | 'Recibido';
export const purchaseOrderStatusList: PurchaseOrderStatus[] = ['Pagado', 'Pendiente', 'Cancelado', 'Recibido'];

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDelivery: string;
  items: PurchaseOrderItem[];
  totalCost: number;
  status: PurchaseOrderStatus;
  paymentSplits?: PaymentSplit[];
  timestamp?: string;
  exchangeRateOnOrderDate?: number;
  notes?: string;
}
export type PaymentMethodType = 'Efectivo USD' | 'Efectivo VES' | 'Pago Móvil (VES)' | 'Transferencia (VES)' | 'Otro' | 'Crédito a Favor' | 'Nota de Crédito';
export const paymentMethodList: PaymentMethodType[] = (['Efectivo USD', 'Efectivo VES', 'Pago Móvil (VES)', 'Transferencia (VES)', 'Otro', 'Crédito a Favor'] as PaymentMethodType[]).sort((a, b) => a.localeCompare(b));
export const salePaymentMethods: Sale['paymentMethod'][] = ['Pagado', 'Crédito'];

export interface PaymentSplit {
  id: string;
  amount: number;
  currency: 'USD' | 'VES';
  paymentMethod: PaymentMethodType;
  exchangeRateAtPayment?: number;
  paidToBranchId: string;
  paidToAccountId: AccountType;
  referenceNumber?: string;
  items?: PurchaseOrderItem[];
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  sourceBranchId: string;
  sourceBranchName: string;
}

export interface SaleBranchDetail {
  branchId: string;
  branchName: string;
  items: SaleItem[];
  totalAmount: number;
  amountPaidUSD: number;
}

export interface Sale {
  id: string;
  date: string;
  itemsPerBranch: SaleBranchDetail[];
  changes?: SaleItem[];
  samples?: SaleItem[];
  customerId?: string;
  customerName?: string;
  totalAmount: number;
  paymentMethod: 'Pagado' | 'Crédito';
  dueDate?: string;
  paymentSplits?: PaymentSplit[]; // Usado si paymentMethod es 'Pagado'
  amountPaidUSD: number;
  status?: SaleStatus;
  timestamp?: string;
  notes?: string;
  creditNoteTargetInvoiceId?: string; // Para identificar a qué factura se aplica la nota de crédito
}

export type SaleStatus = 'Completada' | 'Pendiente de Pago' | 'Vencida' | 'Pagada Parcialmente';

export interface Customer {
  id: string;
  name: string;
  contact: string;
  phone?: string; // Added phone property
  email?: string;
  address?: string;
  workZone?: string;
  lastOrder?: string;
}

export type PaymentStatus = 'pendiente de verificación' | 'verificado' | 'rechazado';
export type PaymentSource = 'invoice' | 'balance_adjustment';


export interface PaymentBranchApplication {
  branchId: string;
  amount: number;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  paymentDate: string;
  amountPaidInput: number;
  currencyPaidInput: 'USD' | 'VES';
  exchangeRateAtPayment?: number;
  amountAppliedToDebtUSD: number;
  amountAppliedPerBranch_USD?: PaymentBranchApplication[];
  paymentMethod: PaymentMethodType;
  paidToAccountId?: AccountType;
  paidToBranchId?: string;
  status: PaymentStatus;
  referenceNumber?: string;
  notes?: string;
  verifiedBy?: string;
  verificationDate?: string;
  appliedToInvoiceId?: string;
  paymentSource: PaymentSource;
  creationTimestamp?: string;
  parentPaymentId?: string; // Nuevo para agrupar pagos
}

export type TransactionType = 'ingreso' | 'egreso';
export interface AccountTransaction {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  currency: 'USD' | 'VES';
  accountId: AccountType;
  exchangeRateOnTransactionDate?: number;
  amountInOtherCurrency?: number;
  category?: string;
  sourceModule: 'Ventas (Pago Cliente)' | 'Gastos Operativos' | 'Nómina' | 'Compra de Materia Prima' | 'Ajuste Manual Ingreso' | 'Ajuste Manual Egreso' | 'Transferencia de Fondos';
  sourceId?: string;
  relatedSaleId?: string;
  relatedPaymentId?: string;
  balanceAfterTransaction?: number;
  timestamp?: string;
}
export interface AccountBalance {
  balance: number;
  currency: 'USD' | 'VES';
  lastTransactionDate?: string;
}
export interface CompanyAccountsData { // Representa las cuentas de UNA sede
  vesElectronic: AccountBalance;
  usdCash: AccountBalance;
  vesCash: AccountBalance;
}
export interface Employee { id: string; name: string; role: string; contact: string; hireDate: string; status: string; salary?: number; }
export interface Expense {
  id: string;
  date: string;
  mainCategoryType?: 'Fijo' | 'Variable' | string;
  category: string;
  description: string;
  amount: number; // Siempre en USD para el gasto, la transacción de cuenta se hace en la moneda de la cuenta
  paidTo: string;
  sourceModule?: 'Compra de Materia Prima' | 'Gastos Operativos';
  sourceId?: string;
  paymentAccountId?: AccountType; // La cuenta desde donde se pagó
  timestamp?: string;
}
export interface UserProfile { fullName: string; email: string; phone: string; moduleAccess: UserPermissions; }
export interface RawMaterialInventoryItem { name: string; quantity: number; unit: string; }
export interface InventoryTransfer {
  id: string;
  date: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  materialName: string;
  quantity: number;
  unit: string;
  notes?: string;
  timestamp?: string;
}
export interface ExpenseFixedCategory { name: string; monthlyAmount?: number; }

export interface DirectIngredient {
  name: string;
  quantity: number;
  unit: string;
  isIntermediate: boolean;
  originalRecipeUnit?: string;
}

export interface PendingFundTransfer {
  id: string;
  saleId: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  amountUSD: number;
  amountVES?: number; // Nuevo
  originalPaymentAccountId?: AccountType;
  originalPaymentCurrency?: 'USD' | 'VES';
  exchangeRateAtPayment?: number; // Añadido
  fromAccountId?: AccountType;
  toAccountId?: AccountType;
  creationTimestamp: string;
  status: 'pendiente' | 'completada';
  completionTimestamp?: string;
  notes?: string;
  parentPaymentId?: string;
  isFromCreditNote?: boolean;
}

export interface LossEntry {
  type: 'Merma' | 'Cambio' | 'Muestra';
  date: string;
  productName: string;
  quantity: number;
  costPerUnitUSD: number;
  totalCostUSD: number;
  customerId?: string;
  customerName?: string;
  saleId?: string;
  sourceBranchId: string;
  sourceBranchName: string;
}

export interface WeeklyLossReport {
  id: string; // e.g., WLR-YYYY-MM-DD
  weekStartDate: string;
  weekEndDate: string;
  generatedOn: string;
  totalLossUSD: number;
  entries: LossEntry[];
}

export interface ProfitEntry {
  date: string;
  productName: string;
  quantitySold: number;
  salePricePerUnitUSD: number;
  costPerUnitUSD: number;
  profitPerUnitUSD: number;
  sourceBranchId: string;
  sourceBranchName: string;
  saleId: string;
}

export interface WeeklyProfitReport {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedOn: string;
  totalRevenueUSD: number;
  totalCostsUSD: number;
  totalProfitUSD: number;
  entries: ProfitEntry[];
}


// --- Global Data Variables ---
export let productsData: Product[] = [];
export let productionLogData: ProductionLogEntry[] = [];
export let recipesData: Recipe[] = [];
export let suppliersData: Supplier[] = []; // Global
export let rawMaterialOptions: string[] = []; // Global
export let purchaseOrdersData: PurchaseOrder[] = [];
export let rawMaterialInventoryData: RawMaterialInventoryItem[] = [];
export let weeklyGoalsData: ProductionGoal[] = [];
export let monthlyGoalsData: ProductionGoal[] = [];
export let employeesData: Employee[] = [];
export let expensesData: Expense[] = [];
export let customConversionRulesData: CustomConversionRule[] = [];


// Datos GLOBALES
export let salesData: Sale[] = [];
export let customersData: Customer[] = [];
export let paymentsData: Payment[] = [];
export let inventoryTransfersData: InventoryTransfer[] = [];
export let userProfileData: UserProfile = getDefaultObjectStructure(KEYS.USER_PROFILE, KEYS.USER_PROFILE) as UserProfile;
export let pendingFundTransfersData: PendingFundTransfer[] = [];
export let weeklyLossReportsData: WeeklyLossReport[] = [];
export let weeklyProfitReportsData: WeeklyProfitReport[] = []; // Nuevo


// --- Default Expense Categories ---
const defaultFixedExpenseCategories: ExpenseFixedCategory[] = [];
const defaultVariableExpenseCategories: string[] = [];


// --- Initial Data for Recipes (Empty by default now) ---
const initialRecipesDataInternal: Recipe[] = [];


// --- Expense Categories Functions (AHORA POR SEDE) ---
export function loadExpenseFixedCategories(branchId?: string): ExpenseFixedCategory[] {
  const currentBranchId = branchId || getActiveBranchId();
  if (!currentBranchId) {
    console.warn("loadExpenseFixedCategories: No branch ID provided and no active branch.");
    return [];
  }
  const key = getStorageKeyForBranch(KEYS.EXPENSE_FIXED_CATEGORIES, currentBranchId);
  let workingCategories: ExpenseFixedCategory[];

  if (typeof window === 'undefined') {
    workingCategories = JSON.parse(JSON.stringify(defaultFixedExpenseCategories));
  } else {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      workingCategories = JSON.parse(JSON.stringify(defaultFixedExpenseCategories));
    } else {
      const storedCategories = safeParse<ExpenseFixedCategory[]>(raw, []);
      if (!Array.isArray(storedCategories) || (storedCategories.length > 0 && !storedCategories.every(cat => typeof cat === 'object' && cat !== null && 'name' in cat && typeof cat.name === 'string'))) {
        workingCategories = JSON.parse(JSON.stringify(defaultFixedExpenseCategories));
      } else {
        workingCategories = storedCategories;
      }
    }
  }

  workingCategories = workingCategories.filter(cat => cat.name.toLowerCase() !== 'compra de materia prima');

  const nominaIndex = workingCategories.findIndex(cat => cat.name.toLowerCase() === 'nómina');
  if (nominaIndex === -1) {
    workingCategories.push({ name: "Nómina" });
  } else {
    workingCategories[nominaIndex] = { name: "Nómina" }; // Asegurar que no tenga monto editable aquí
  }
  return workingCategories.sort((a, b) => a.name.localeCompare(b.name));
}


export function saveExpenseFixedCategories(branchId: string, categories: ExpenseFixedCategory[]): void {
  if (!branchId) {
    console.error("saveExpenseFixedCategories: Branch ID is required.");
    return;
  }
  const uniqueCategoriesMap = new Map<string, ExpenseFixedCategory>();
  let nominaExists = false;
  categories.forEach(cat => {
    if (cat && typeof cat.name === 'string' && cat.name.trim() !== "") {
      const nameTrimmed = cat.name.trim();
      const nameLower = nameTrimmed.toLowerCase();
      if (!uniqueCategoriesMap.has(nameLower)) {
        const categoryToSave: ExpenseFixedCategory = { name: nameTrimmed };
        if (nameLower === 'nómina') {
          nominaExists = true;
        } else if (typeof cat.monthlyAmount === 'number' && cat.monthlyAmount >= 0) {
          categoryToSave.monthlyAmount = cat.monthlyAmount;
        }
        uniqueCategoriesMap.set(nameLower, categoryToSave);
      }
    }
  });

  if (!nominaExists) {
    uniqueCategoriesMap.set('nómina', { name: "Nómina" });
  }
  const dataToSave = Array.from(uniqueCategoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  saveToLocalStorageForBranch<ExpenseFixedCategory[]>(KEYS.EXPENSE_FIXED_CATEGORIES, branchId, dataToSave);
}

export function addExpenseFixedCategory(branchId: string, categoryName: string, monthlyAmount?: number): boolean {
  if (!branchId) return false;
  const trimmedCategoryName = categoryName.trim();
  if (!trimmedCategoryName || trimmedCategoryName.toLowerCase() === 'compra de materia prima') return false;

  const currentCategories = loadExpenseFixedCategories(branchId);
  if (currentCategories.find(c => c.name.toLowerCase() === trimmedCategoryName.toLowerCase())) {
    return false;
  }
  const newCategory: ExpenseFixedCategory = { name: trimmedCategoryName };
  if (trimmedCategoryName.toLowerCase() !== 'nómina' && typeof monthlyAmount === 'number' && monthlyAmount >= 0) {
    newCategory.monthlyAmount = monthlyAmount;
  }
  saveExpenseFixedCategories(branchId, [...currentCategories, newCategory]);
  return true;
}

export function removeExpenseFixedCategory(branchId: string, categoryNameToRemove: string): void {
  if (!branchId) return;
  const trimmedCategoryToRemove = categoryNameToRemove.trim().toLowerCase();
  if (trimmedCategoryToRemove === 'nómina' || trimmedCategoryToRemove === 'compra de materia prima') {
    console.warn(`Attempted to remove protected category: ${categoryNameToRemove}`);
    return;
  }
  const currentCategories = loadExpenseFixedCategories(branchId);
  const initialLength = currentCategories.length;
  const updatedCategories = currentCategories.filter(
    c => c.name.toLowerCase() !== trimmedCategoryToRemove
  );

  if (updatedCategories.length < initialLength) {
    saveExpenseFixedCategories(branchId, updatedCategories);
  } else {
    console.warn(`Category to remove not found in fixed list for branch ${branchId}: ${categoryNameToRemove}`);
  }
}

export function loadExpenseVariableCategories(branchId?: string): string[] {
  const currentBranchId = branchId || getActiveBranchId();
  if (!currentBranchId) {
    console.warn("loadExpenseVariableCategories: No branch ID provided and no active branch.");
    return [];
  }
  let categories = loadFromLocalStorageForBranch<string[]>(KEYS.EXPENSE_VARIABLE_CATEGORIES, currentBranchId);
  categories = Array.isArray(categories) ? categories : [];
  categories = categories.filter(cat => typeof cat === 'string' && cat.toLowerCase() !== 'compra de materia prima');
  return categories.sort((a, b) => a.localeCompare(b));
}

export function saveExpenseVariableCategories(branchId: string, categories: string[]): void {
  if (!branchId) {
    console.error("saveExpenseVariableCategories: Branch ID is required.");
    return;
  }
  const dataToSave = [...new Set(categories.filter(cat => typeof cat === 'string' && cat.trim() !== '' && cat.toLowerCase() !== 'compra de materia prima'))].sort((a, b) => a.localeCompare(b));
  saveToLocalStorageForBranch<string[]>(KEYS.EXPENSE_VARIABLE_CATEGORIES, branchId, dataToSave);
}

export function addExpenseVariableCategory(branchId: string, category: string): boolean {
  if (!branchId) return false;
  const trimmedCategory = category.trim();
  if (!trimmedCategory || trimmedCategory.toLowerCase() === 'compra de materia prima') return false;
  const currentCategories = loadExpenseVariableCategories(branchId);
  if (currentCategories.find(c => c.toLowerCase() === trimmedCategory.toLowerCase())) {
    return false;
  }
  saveExpenseVariableCategories(branchId, [...currentCategories, trimmedCategory]);
  return true;
}

export function removeExpenseVariableCategory(branchId: string, categoryToRemove: string): void {
  if (!branchId) return;
  const trimmedCategoryToRemove = categoryToRemove.trim().toLowerCase();
  if (trimmedCategoryToRemove === 'compra de materia prima') return;
  const currentCategories = loadExpenseVariableCategories(branchId);
  const updatedCategories = currentCategories.filter(c => c.toLowerCase() !== trimmedCategoryToRemove);
  if (updatedCategories.length < currentCategories.length) {
    saveExpenseVariableCategories(branchId, updatedCategories);
  }
}


// --- Specific Load/Save Functions ---
export function loadUserProfileFromLocalStorage(): UserProfile { // Global
  const loadedProfile = loadFromLocalStorage<UserProfile>(KEYS.USER_PROFILE, true);
  const defaultPermissions = allModules.reduce((acc, moduleKey) => {
    const permKey = normalizeModuleKey(moduleKey);
    acc[permKey] = true;
    return acc;
  }, {} as UserPermissions);

  return {
    fullName: typeof loadedProfile.fullName === 'string' && loadedProfile.fullName.trim() ? loadedProfile.fullName : "Administrador Principal",
    email: typeof loadedProfile.email === 'string' && loadedProfile.email.trim() ? loadedProfile.email : SIMULATED_ADMIN_USERNAME,
    phone: typeof loadedProfile.phone === 'string' ? loadedProfile.phone : "",
    moduleAccess: (typeof loadedProfile.moduleAccess === 'object' && loadedProfile.moduleAccess !== null && Object.keys(loadedProfile.moduleAccess).length > 0)
      ? loadedProfile.moduleAccess
      : defaultPermissions,
  };
}
export function saveUserProfileData(data: UserProfile): void { // Global
  userProfileData = data;
  saveToLocalStorage<UserProfile>(KEYS.USER_PROFILE, userProfileData);
}

export function loadCompanyAccountsData(branchIdToLoad?: string): CompanyAccountsData {
  const branchId = branchIdToLoad || getActiveBranchId();
  if (!branchId) {
    console.error("loadCompanyAccountsData: No branchId provided and no active branch selected.");
    return getDefaultObjectStructure(KEYS.COMPANY_ACCOUNTS, KEYS.COMPANY_ACCOUNTS) as CompanyAccountsData;
  }
  const loadedAccounts = loadFromLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, branchId, true);
  const defaultStructure = getDefaultObjectStructure(KEYS.COMPANY_ACCOUNTS, KEYS.COMPANY_ACCOUNTS) as CompanyAccountsData;

  return JSON.parse(JSON.stringify({
    vesElectronic: {
      balance: typeof loadedAccounts.vesElectronic?.balance === 'number' ? loadedAccounts.vesElectronic.balance : defaultStructure.vesElectronic.balance,
      currency: 'VES',
      lastTransactionDate: typeof loadedAccounts.vesElectronic?.lastTransactionDate === 'string' ? loadedAccounts.vesElectronic.lastTransactionDate : undefined,
    },
    usdCash: {
      balance: typeof loadedAccounts.usdCash?.balance === 'number' ? loadedAccounts.usdCash.balance : defaultStructure.usdCash.balance,
      currency: 'USD',
      lastTransactionDate: typeof loadedAccounts.usdCash?.lastTransactionDate === 'string' ? loadedAccounts.usdCash?.lastTransactionDate : undefined,
    },
    vesCash: {
      balance: typeof loadedAccounts.vesCash?.balance === 'number' ? loadedAccounts.vesCash.balance : defaultStructure.vesCash.balance,
      currency: 'VES',
      lastTransactionDate: typeof loadedAccounts.vesCash?.lastTransactionDate === 'string' ? loadedAccounts.vesCash?.lastTransactionDate : undefined,
    },
  }));
}

export function saveCompanyAccountsData(branchIdToSave: string, data: CompanyAccountsData): void {
  if (!branchIdToSave) {
    console.error("saveCompanyAccountsData: No branchId provided.");
    return;
  }
  saveToLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, branchIdToSave, data);
}


export function saveExchangeRate(rate: number, date?: Date): void {
  if (typeof window === 'undefined') return;
  const targetDate = date || new Date();
  const targetDateStr = formatDateFns(targetDate, "yyyy-MM-dd");

  let history = loadFromLocalStorage<ExchangeRateEntry[]>(KEYS.EXCHANGE_RATE_HISTORY, false);
  if (!Array.isArray(history)) {
    history = [];
  }
  const entryIndex = history.findIndex(entry => entry.date === targetDateStr);

  if (rate >= 0) {
    if (entryIndex > -1) {
      history[entryIndex].rate = rate;
    } else {
      history.push({ date: targetDateStr, rate });
    }
  }

  history.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));

  localStorage.setItem(KEYS.EXCHANGE_RATE_HISTORY, JSON.stringify(history));

  // Also update the main rate if the date is today
  const todayStr = formatDateFns(new Date(), "yyyy-MM-dd");
  if (!date || isSameDay(targetDate, new Date())) {
    localStorage.setItem(KEYS.EXCHANGE_RATE, (rate >= 0 ? rate : 0).toString());
  }

  dispatchDataUpdateEvent(KEYS.EXCHANGE_RATE);
  dispatchDataUpdateEvent(KEYS.EXCHANGE_RATE_HISTORY);
}

export function removeExchangeRate(dateToRemove: string): void {
  if (typeof window === 'undefined' || !dateToRemove) return;

  let history = loadFromLocalStorage<ExchangeRateEntry[]>(KEYS.EXCHANGE_RATE_HISTORY, false);
  if (!Array.isArray(history)) {
    return; // Nothing to remove
  }

  const initialLength = history.length;
  const updatedHistory = history.filter(entry => entry.date !== dateToRemove);

  if (updatedHistory.length < initialLength) {
    localStorage.setItem(KEYS.EXCHANGE_RATE_HISTORY, JSON.stringify(updatedHistory));

    // Check if the deleted rate was today's rate
    const todayStr = formatDateFns(new Date(), "yyyy-MM-dd");
    if (dateToRemove === todayStr) {
      // Find the new "latest" rate to set as the current rate
      const newLatestRateEntry = updatedHistory.length > 0 ? updatedHistory[0] : null;
      const newRate = newLatestRateEntry ? newLatestRateEntry.rate : 0;
      localStorage.setItem(KEYS.EXCHANGE_RATE, newRate.toString());
    }

    dispatchDataUpdateEvent(KEYS.EXCHANGE_RATE);
    dispatchDataUpdateEvent(KEYS.EXCHANGE_RATE_HISTORY);
  }
}

export function loadExchangeRate(targetDate?: Date): number {
  if (typeof window === 'undefined') return 0;

  const history = loadFromLocalStorage<ExchangeRateEntry[]>(KEYS.EXCHANGE_RATE_HISTORY, false);

  if (!Array.isArray(history) || history.length === 0) {
    const legacyRate = localStorage.getItem(KEYS.EXCHANGE_RATE);
    return legacyRate ? parseFloat(legacyRate) : 0;
  }

  const searchDate = targetDate || new Date();
  const searchDateStr = formatDateFns(searchDate, "yyyy-MM-dd");

  const exactMatch = history.find(entry => entry.date === searchDateStr);
  if (exactMatch) {
    return exactMatch.rate;
  }

  // Find the most recent entry on or before the targetDate
  const olderEntry = history.find(entry => entry.date <= searchDateStr);

  if (olderEntry) {
    return olderEntry.rate;
  }

  return 0; // Return 0 if no suitable rate is found
}


export function initializeRawMaterialOptions(): string[] { // Global
  let storedOptions = loadFromLocalStorage<string[]>(KEYS.RAW_MATERIAL_OPTIONS);
  const defaultSampleOptions: string[] = [];

  if (!Array.isArray(storedOptions)) {
    rawMaterialOptions = [...defaultSampleOptions].sort((a, b) => a.localeCompare(b));
  } else {
    const validStoredOptions = storedOptions.filter(opt => typeof opt === 'string' && opt.trim() !== '');
    const mergedOptions = [...new Set([...validStoredOptions, ...defaultSampleOptions])];
    rawMaterialOptions = mergedOptions.sort((a, b) => a.localeCompare(b));
  }
  saveToLocalStorage<string[]>(KEYS.RAW_MATERIAL_OPTIONS, rawMaterialOptions);
  return rawMaterialOptions;
}

export function getCurrentRawMaterialOptions(): string[] { // Global
  return [...rawMaterialOptions];
}

export function saveRawMaterialOptionsData(options: string[]): void { // Global
  const uniqueSortedOptions = [...new Set(options.filter(opt => typeof opt === 'string' && opt.trim() !== ''))].sort((a, b) => a.localeCompare(b));
  rawMaterialOptions = uniqueSortedOptions;
  saveToLocalStorage<string[]>(KEYS.RAW_MATERIAL_OPTIONS, rawMaterialOptions);
}

export function addRawMaterialOption(option: string): boolean { // Global
  const trimmedOption = option.trim();
  if (trimmedOption && !rawMaterialOptions.find(o => o.toLowerCase() === trimmedOption.toLowerCase())) {
    const updatedOptions = [...rawMaterialOptions, trimmedOption];
    saveRawMaterialOptionsData(updatedOptions);
    return true;
  }
  return false;
}

export function removeRawMaterialOption(optionToRemove: string): void { // Global
  const initialLength = rawMaterialOptions.length;
  const trimmedOptionToRemove = optionToRemove.trim().toLowerCase();
  const updatedOptions = rawMaterialOptions.filter(option => option.toLowerCase().trim() !== trimmedOptionToRemove);

  if (updatedOptions.length < initialLength) {
    saveRawMaterialOptionsData(updatedOptions);
  }
}

export function loadRawMaterialInventoryData(branchIdToLoad?: string): RawMaterialInventoryItem[] {
  const branchId = branchIdToLoad || getActiveBranchId();
  if (!branchId) {
    console.error("loadRawMaterialInventoryData: No branchId and no active branch.");
    return [];
  }
  let inventory = loadFromLocalStorageForBranch<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY, branchId);
  inventory = Array.isArray(inventory) ? inventory : [];
  const aggregatedInventory = filterAndAggregateInventoryItems(inventory);
  if (branchId === getActiveBranchId()) {
    rawMaterialInventoryData = aggregatedInventory;
  }
  return aggregatedInventory;
}


function filterAndAggregateInventoryItems(data: RawMaterialInventoryItem[]): RawMaterialInventoryItem[] {
  if (!Array.isArray(data)) {
    console.warn("filterAndAggregateInventoryItems: received non-array data. Returning empty array.", data);
    return [];
  }
  const uniqueDataMap = new Map<string, RawMaterialInventoryItem>();
  for (const item of data) {
    if (!item || !item.name || typeof item.quantity !== 'number' || !item.unit) continue;

    const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(
      item.quantity,
      item.unit,
      item.name
    );

    if (!VALID_BASE_UNITS.includes(baseUnit as any)) {
      console.warn(`Ítem de inventario con unidad base resultante inválida '${baseUnit}' para '${item.name}' será ignorado al agregar/guardar.`);
      continue;
    }

    const finalBaseUnit = baseUnit;
    const finalBaseQuantity = baseQuantity;

    const key = `${item.name.trim().toLowerCase()}-${finalBaseUnit}`;
    const currentEntry = uniqueDataMap.get(key);
    if (currentEntry) {
      currentEntry.quantity += Number(finalBaseQuantity);
    } else {
      uniqueDataMap.set(key, { ...item, name: item.name.trim(), unit: finalBaseUnit, quantity: Number(finalBaseQuantity) });
    }
  }
  return Array.from(uniqueDataMap.values())
    .map(item => ({ ...item, quantity: Number(Number(item.quantity).toFixed(4)) }))
    .filter(item => item.quantity > 0.0001);
}


export function saveRawMaterialInventoryData(branchIdToSave: string, data: RawMaterialInventoryItem[]): void {
  if (!branchIdToSave) {
    console.error("saveRawMaterialInventoryData: No branchId provided.");
    return;
  }
  const aggregatedData = filterAndAggregateInventoryItems(data);
  saveToLocalStorageForBranch<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY, branchIdToSave, aggregatedData);
  if (branchIdToSave === getActiveBranchId()) {
    rawMaterialInventoryData = aggregatedData;
  }
}


export function loadAllProductsFromAllBranches(): Product[] { // Global
  const allProductsCombined: Product[] = [];
  availableBranches.forEach(branch => {
    const branchProducts = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branch.id);
    if (Array.isArray(branchProducts)) {
      branchProducts.forEach(p => {
        allProductsCombined.push({ ...p, sourceBranchId: branch.id, sourceBranchName: branch.name });
      });
    }
  });
  return allProductsCombined.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadProductsForBranch(branchId: string): Product[] { // Specific Branch
  return loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId);
}
export function saveProductsDataForBranch(branchId: string, data: Product[]): void { // Specific Branch
  saveToLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId, data);
  if (getActiveBranchId() === branchId) {
    productsData = data;
  }
}


export function loadPurchaseOrdersFromStorage(branchId?: string): PurchaseOrder[] { // For specific or active branch
  const idToLoad = branchId || getActiveBranchId();
  if (!idToLoad) {
    console.error("loadPurchaseOrdersFromStorage: Branch ID not provided and no active branch.");
    return [];
  }
  const loaded = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, idToLoad);
  return Array.isArray(loaded) ? loaded : [];
}

export interface PricePointInfo {
  supplierId: string;
  supplierName: string;
  pricePerBaseUnit: number;
  baseUnit: string;
  originalUnitPrice: number;
  originalUnit: string;
  lastUpdated: string;
}

export function getCurrentPriceFromHistory(priceHistory: PriceHistoryEntry[] | undefined): PriceHistoryEntry | null {
  if (!priceHistory || priceHistory.length === 0) return null;
  return priceHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)))[0];
}

function getPricePointInfoForStrategy(
  rawMaterialName: string,
  strategy: 'lowest' | 'highest' = 'lowest',
  targetPriceListType?: 'default' | 'usdCash'
): PricePointInfo | null {
  let optimalPricePoint: PricePointInfo | null = null;
  const lowerRawMaterialName = rawMaterialName.toLowerCase();

  suppliersData.forEach(supplier => {
    const listsToSearch: (SupplierPriceListItem[] | undefined)[] = [];
    if (targetPriceListType) {
      listsToSearch.push(targetPriceListType === 'usdCash' ? supplier.priceListUSDCash : supplier.priceList);
    } else {
      listsToSearch.push(supplier.priceList, supplier.priceListUSDCash);
    }

    for (const list of listsToSearch) {
      if (!list) continue;

      for (const priceItem of list) {
        if (priceItem.rawMaterialName.toLowerCase() === lowerRawMaterialName) {
          const currentPriceEntry = getCurrentPriceFromHistory(priceItem.priceHistory);
          if (!currentPriceEntry) continue;

          const conversionResult = convertMaterialToBaseUnit(1, priceItem.unit, rawMaterialName);
          if (!VALID_BASE_UNITS.includes(conversionResult.unit as any) || conversionResult.quantity <= 0) continue;

          const pricePerBaseUnit = currentPriceEntry.price / conversionResult.quantity;

          if (optimalPricePoint === null ||
            (strategy === 'lowest' && pricePerBaseUnit < optimalPricePoint.pricePerBaseUnit) ||
            (strategy === 'highest' && pricePerBaseUnit > optimalPricePoint.pricePerBaseUnit)) {

            optimalPricePoint = {
              supplierId: supplier.id,
              supplierName: supplier.name,
              pricePerBaseUnit: pricePerBaseUnit,
              baseUnit: conversionResult.unit,
              originalUnitPrice: currentPriceEntry.price,
              originalUnit: priceItem.unit,
              lastUpdated: currentPriceEntry.date,
            };
          }
        }
      }
    }
  });
  return optimalPricePoint;
}


export function getLowestPriceInfo(rawMaterialName: string, targetPriceListType?: 'default' | 'usdCash'): PricePointInfo | null {
  return getPricePointInfoForStrategy(rawMaterialName, 'lowest', targetPriceListType);
}

export function getHighestPriceInfo(rawMaterialName: string, targetPriceListType?: 'default' | 'usdCash'): PricePointInfo | null {
  return getPricePointInfoForStrategy(rawMaterialName, 'highest', targetPriceListType);
}

export function getBestPriceInfo(rawMaterialName: string, targetPriceListType?: 'default' | 'usdCash'): PricePointInfo | null {
  return getPricePointInfoForStrategy(rawMaterialName, 'lowest', targetPriceListType);
}

export function calculatePackagingCost(quantity: number): { minCost: number; maxCost: number } {
  if (quantity <= 0) {
    return { minCost: 0, maxCost: 0 };
  }

  const packagingMaterials = ["Bolsas", "Etiquetas"];
  let totalMinCost = 0;
  let totalMaxCost = 0;

  packagingMaterials.forEach(material => {
    const lowestPrice = getLowestPriceInfo(material);
    const highestPrice = getHighestPriceInfo(material);

    let minItemCost = 0;
    let maxItemCost = 0;

    if (lowestPrice && normalizeUnit(lowestPrice.baseUnit) === 'unidad') {
      minItemCost = lowestPrice.pricePerBaseUnit;
    }
    if (highestPrice && normalizeUnit(highestPrice.baseUnit) === 'unidad') {
      maxItemCost = highestPrice.pricePerBaseUnit;
    }

    totalMinCost += quantity * (minItemCost > 0 ? minItemCost : maxItemCost > 0 ? maxItemCost : 0);
    totalMaxCost += quantity * (maxItemCost > 0 ? maxItemCost : minItemCost > 0 ? minItemCost : 0);
  });

  return { minCost: totalMinCost, maxCost: totalMaxCost };
}


export const updateSupplierPriceList = (order: PurchaseOrder) => { // Global
  if (!order.supplierId || order.status !== 'Pagado') return;

  let currentSuppliersList = [...suppliersData];
  const supplierIndex = currentSuppliersList.findIndex(s => s.id === order.supplierId);

  if (supplierIndex !== -1) {
    const supplierToUpdate = { ...currentSuppliersList[supplierIndex] };
    let priceListChanged = false;

    order.paymentSplits?.forEach(split => {
      const targetPriceListName = split.paymentMethod === 'Efectivo USD' ? 'priceListUSDCash' : 'priceList';
      let targetPriceList = supplierToUpdate[targetPriceListName] ? [...(supplierToUpdate[targetPriceListName]!)] : [];

      split.items?.forEach(orderItem => {
        if (orderItem.rawMaterialName && orderItem.unit && Number(orderItem.unitPrice) >= 0) {
          const priceItemIndex = targetPriceList.findIndex(
            pli => pli.rawMaterialName === orderItem.rawMaterialName && pli.unit === orderItem.unit
          );
          const orderDateToUse = order.timestamp ? formatDateFns(parseISO(order.timestamp), "yyyy-MM-dd") : order.orderDate;


          if (priceItemIndex !== -1) {
            const priceListItem = { ...targetPriceList[priceItemIndex] };
            priceListItem.priceHistory = priceListItem.priceHistory ? [...priceListItem.priceHistory] : [];

            const existingHistoryEntryIndex = priceListItem.priceHistory.findIndex(entry => entry.date === orderDateToUse);

            if (existingHistoryEntryIndex !== -1) {
              if (priceListItem.priceHistory[existingHistoryEntryIndex].price !== Number(orderItem.unitPrice)) {
                priceListItem.priceHistory[existingHistoryEntryIndex].price = Number(orderItem.unitPrice);
                priceListChanged = true;
              }
            } else {
              priceListItem.priceHistory.push({ date: orderDateToUse, price: Number(orderItem.unitPrice) });
              priceListChanged = true;
            }
            priceListItem.priceHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
            targetPriceList[priceItemIndex] = priceListItem;
          } else {
            targetPriceList.push({
              id: `spl-${order.supplierId}-${targetPriceListName}-${orderItem.rawMaterialName.replace(/\s+/g, '')}-${Date.now()}`,
              rawMaterialName: orderItem.rawMaterialName,
              unit: orderItem.unit,
              priceHistory: [{ date: orderDateToUse, price: Number(orderItem.unitPrice) }],
            });
            priceListChanged = true;
          }
        }
      });
      supplierToUpdate[targetPriceListName] = targetPriceList;
    });


    if (priceListChanged) {
      currentSuppliersList[supplierIndex] = supplierToUpdate;
      saveSuppliersData(currentSuppliersList);
    }
  }
};

export const updateCompanyAccountAndExpensesForPO = (
  order: PurchaseOrder,
  operation: 'add' | 'subtract',
  currentGlobalRate: number,
  originalOrder?: PurchaseOrder
) => {
  const activeBranchIdForPO = getActiveBranchId();
  if (!activeBranchIdForPO) {
    console.error("updateCompanyAccountAndExpensesForPO: No active branch for PO finances.");
    return;
  }

  let companyAccountsForBranch = loadCompanyAccountsData(activeBranchIdForPO);
  let accountTransactionsForBranch = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, activeBranchIdForPO);
  let expensesForBranch = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchIdForPO);

  const processSplits = (splits: PaymentSplit[], op: 'add' | 'subtract') => {
    splits.forEach(split => {
      const accountIdForTx = split.paidToAccountId;
      const accountUsed = companyAccountsForBranch[accountIdForTx];

      if (!accountUsed) {
        console.error(`Error: Account ${accountTypeNames[accountIdForTx]} not found for split in branch ${activeBranchIdForPO}.`);
        return; // Skip this split if account not found
      }

      let transactionAmountInAccountCurrency = split.amount;
      let amountOfSplitInUSD = 0; // Será el total de items del split en USD

      if (split.items && split.items.length > 0) {
        amountOfSplitInUSD = split.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      } else if (op === 'subtract' && originalOrder && originalOrder.paymentSplits) {
        // Para revertir, si el split original no tenía items (legado), usar el 'amount' del split
        const originalSplit = originalOrder.paymentSplits.find(os => os.id === split.id);
        if (originalSplit?.currency === 'USD') {
          amountOfSplitInUSD = originalSplit.amount;
        } else if (originalSplit?.currency === 'VES') {
          const rateForRevert = originalSplit.exchangeRateAtPayment || currentGlobalRate;
          amountOfSplitInUSD = rateForRevert > 0 ? originalSplit.amount / rateForRevert : 0;
        }
      }


      let amountInOtherCurrencyForTx: number | undefined = undefined;


      if (accountUsed.currency === 'VES') {
        if (currentGlobalRate <= 0) {
          console.warn(`OC ${order.id}, pago desde cuenta VES sin tasa de cambio válida. El monto de la transacción será 0.`);
          transactionAmountInAccountCurrency = 0;
        } else {
          transactionAmountInAccountCurrency = amountOfSplitInUSD * currentGlobalRate;
        }
        amountInOtherCurrencyForTx = amountOfSplitInUSD;
      } else { // La cuenta es USD
        transactionAmountInAccountCurrency = amountOfSplitInUSD;
        if (currentGlobalRate > 0) {
          amountInOtherCurrencyForTx = amountOfSplitInUSD * currentGlobalRate;
        }
      }


      if (op === 'add') {
        const newAccountTx: AccountTransaction = {
          id: `TRN-POC-SPLIT-${order.id}-${split.id.slice(-4)}-${Date.now().toString().slice(-3)}`,
          date: order.orderDate,
          description: `Pago OC: ${order.supplierName}, OC#: ${order.id} (Método: ${split.paymentMethod}, Ref: ${split.referenceNumber || 'N/A'})`,
          type: 'egreso',
          accountId: accountIdForTx,
          amount: parseFloat(transactionAmountInAccountCurrency.toFixed(2)),
          currency: accountUsed.currency,
          exchangeRateOnTransactionDate: currentGlobalRate > 0 ? currentGlobalRate : undefined,
          amountInOtherCurrency: amountInOtherCurrencyForTx ? parseFloat(amountInOtherCurrencyForTx.toFixed(2)) : undefined,
          category: 'Compra de Materia Prima',
          sourceModule: 'Compra de Materia Prima',
          sourceId: order.id,
          timestamp: order.timestamp || new Date().toISOString(),
          balanceAfterTransaction: accountUsed.balance
        };
        accountUsed.balance = parseFloat((accountUsed.balance - transactionAmountInAccountCurrency).toFixed(2));
        newAccountTx.balanceAfterTransaction = accountUsed.balance;
        accountUsed.lastTransactionDate = order.timestamp || new Date().toISOString();
        accountTransactionsForBranch = [newAccountTx, ...accountTransactionsForBranch];
      } else {
        const originalTxIndex = accountTransactionsForBranch.findIndex(tx =>
          tx.sourceId === order.id &&
          tx.sourceModule === 'Compra de Materia Prima' &&
          tx.accountId === accountIdForTx &&
          (
            (tx.currency === 'VES' && tx.amountInOtherCurrency && Math.abs(tx.amountInOtherCurrency - amountOfSplitInUSD) < 0.01) ||
            (tx.currency === 'USD' && Math.abs(tx.amount - amountOfSplitInUSD) < 0.01)
          ) &&
          tx.description.includes(`(Método: ${split.paymentMethod}`)
        );

        if (originalTxIndex !== -1) {
          const originalTx = accountTransactionsForBranch[originalTxIndex];
          accountUsed.balance = parseFloat((accountUsed.balance + originalTx.amount).toFixed(2));
          // No actualizar lastTransactionDate aquí al eliminar
          accountTransactionsForBranch.splice(originalTxIndex, 1);
        }
      }
    });
  };

  if (operation === 'add' && order.status === 'Pagado' && order.paymentSplits && order.paymentSplits.length > 0) {
    processSplits(order.paymentSplits, 'add');
    const newExpenseEntry: Expense = {
      id: `EXP-PO-${order.id}`, date: order.orderDate, category: 'Compra de Materia Prima', mainCategoryType: 'Variable',
      description: `Compra a ${order.supplierName}, OC#: ${order.id}`,
      amount: order.totalCost, paidTo: order.supplierName,
      sourceModule: 'Compra de Materia Prima', sourceId: order.id,
      timestamp: order.timestamp || new Date().toISOString(),
      paymentAccountId: order.paymentSplits[0]?.paidToAccountId // Asignar la cuenta del primer split como referencia para el gasto
    };
    expensesForBranch = [newExpenseEntry, ...expensesForBranch];

  } else if (operation === 'subtract' && originalOrder && originalOrder.status === 'Pagado' && originalOrder.paymentSplits && originalOrder.paymentSplits.length > 0) {
    processSplits(originalOrder.paymentSplits, 'subtract');
    expensesForBranch = expensesForBranch.filter(exp => !(exp.sourceId === originalOrder.id && exp.sourceModule === 'Compra de Materia Prima'));
  }


  saveAccountTransactionsData(activeBranchIdForPO, accountTransactionsForBranch);
  saveCompanyAccountsData(activeBranchIdForPO, companyAccountsForBranch);
  saveExpensesData(activeBranchIdForPO, expensesForBranch);
};


export const updateRawMaterialInventoryFromOrder = (
  order: PurchaseOrder,
  operation: 'add' | 'subtract',
  recipesForBranch?: Recipe[]
) => {
  const activeBranchIdForPO = getActiveBranchId();
  if (!activeBranchIdForPO) {
    console.error("updateRawMaterialInventoryFromOrder: No active branch ID. Cannot update inventory.");
    return;
  }

  let branchInventory = loadRawMaterialInventoryData(activeBranchIdForPO);
  let branchProducts = loadProductsForBranch(activeBranchIdForPO); // Cargar productos de producción
  const allBranchRecipes = recipesForBranch || loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchIdForPO);

  const itemsToProcess = order.status === 'Pagado' && order.paymentSplits && order.paymentSplits.length > 0
    ? order.paymentSplits.flatMap(split => split.items || [])
    : order.items;

  itemsToProcess.forEach(item => {
    if (!item.rawMaterialName || !(item.quantity > 0) || !item.unit) return;

    const recipeInfo = allBranchRecipes.find(r => r.name.toLowerCase() === item.rawMaterialName.toLowerCase());

    // Si es un producto de reventa, actualizar el stock de producción
    if (recipeInfo && recipeInfo.isResoldProduct) {
      const productIndex = branchProducts.findIndex(p => p.name.toLowerCase() === item.rawMaterialName.toLowerCase());
      const unitsToAdd = (recipeInfo.expectedYield || 1) * item.quantity;

      if (productIndex !== -1) {
        if (operation === 'add') {
          branchProducts[productIndex].stock += unitsToAdd;
        } else {
          branchProducts[productIndex].stock = Math.max(0, branchProducts[productIndex].stock - unitsToAdd);
        }
        branchProducts[productIndex].lastUpdated = formatDateFns(new Date(), "yyyy-MM-dd");
      } else if (operation === 'add') {
        if (!recipeInfo) {
          console.error(`No se encontró receta para el producto de reventa "${item.rawMaterialName}", no se puede añadir al stock.`);
          return;
        }
        branchProducts.push({
          id: recipeInfo.id,
          name: recipeInfo.name,
          category: recipeInfo.category || 'Reventa',
          stock: unitsToAdd,
          unitPrice: recipeInfo.costPerUnit,
          lastUpdated: formatDateFns(new Date(), "yyyy-MM-dd"),
          image: "https://placehold.co/40x40.png",
          aiHint: recipeInfo.aiHint || 'producto revendido',
          sourceBranchId: activeBranchIdForPO,
          sourceBranchName: availableBranches.find(b => b.id === activeBranchIdForPO)?.name || 'Desconocida'
        });
      }
    } else { // Si es materia prima, actualizar el inventario de materia prima
      const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(item.quantity, item.unit, item.rawMaterialName);
      if (!VALID_BASE_UNITS.some(bu => bu === normalizeUnit(baseUnit))) {
        console.warn(`Unidad base inválida '${baseUnit}' para ${item.rawMaterialName} en OC ${order.id}. Saltando.`);
        return;
      }

      const itemIndex = branchInventory.findIndex(
        invItem => invItem.name.toLowerCase() === item.rawMaterialName.toLowerCase() && normalizeUnit(invItem.unit) === normalizeUnit(baseUnit)
      );

      if (operation === 'add') {
        if (itemIndex !== -1) {
          branchInventory[itemIndex].quantity += baseQuantity;
        } else {
          branchInventory.push({ name: item.rawMaterialName, quantity: baseQuantity, unit: baseUnit });
        }
      } else { // 'subtract'
        if (itemIndex !== -1) {
          branchInventory[itemIndex].quantity = Math.max(0, branchInventory[itemIndex].quantity - baseQuantity);
        } else {
          console.warn(`Attempted to subtract ${item.rawMaterialName} which is not in inventory for branch ${activeBranchIdForPO} during order operation.`);
        }
      }
    }
  });

  // Guardar ambos inventarios
  saveRawMaterialInventoryData(activeBranchIdForPO, branchInventory.filter(item => item.quantity > 0.0001));
  saveProductsDataForBranch(activeBranchIdForPO, branchProducts);
};


export function calculateDynamicRecipeCost(
  recipeId: string,
  priceStrategy: 'lowest' | 'highest' = 'lowest',
  allRecipesDataLocal?: Recipe[]
): number {
  const recipesToUse = allRecipesDataLocal;
  if (!recipesToUse || recipesToUse.length === 0) {
    return 0;
  }
  const recipe = recipesToUse.find(r => r.id === recipeId);
  if (!recipe) return 0;

  let totalCostOfIngredients = 0;
  const ingredients: RecipeIngredientItem[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

  for (const ingredient of ingredients) {
    const subRecipe = recipesToUse.find(r => r.name.toLowerCase() === ingredient.name.toLowerCase() && r.isIntermediate);
    let ingredientCost = 0;
    if (subRecipe && subRecipe.id) {
      const costOfEntireSubRecipeTanda = calculateDynamicRecipeCost(subRecipe.id, priceStrategy, recipesToUse);
      const yieldOfSubRecipeTanda = subRecipe.expectedYield && subRecipe.expectedYield > 0 ? subRecipe.expectedYield : 1;
      const costPerOutputUnitOfSubRecipe = yieldOfSubRecipeTanda > 0 ? costOfEntireSubRecipeTanda / yieldOfSubRecipeTanda : costOfEntireSubRecipeTanda;
      const { quantity: requiredIngredientInSubRecipeBaseUnit, unit: requiredIngredientUnitBase } = convertMaterialToBaseUnit(ingredient.quantity, ingredient.unit, ingredient.name);
      const subRecipeOutputBaseUnit = normalizeUnit(subRecipe.outputUnit || (subRecipe.name.toLowerCase().includes("melado") || subRecipe.name.toLowerCase().includes("jarabe") ? "l" : "kg"));
      if (normalizeUnit(requiredIngredientUnitBase) === subRecipeOutputBaseUnit) {
        ingredientCost = costPerOutputUnitOfSubRecipe * requiredIngredientInSubRecipeBaseUnit;
      } else { ingredientCost = 0; }
    } else {
      const priceDetails = priceStrategy === 'lowest' ? getLowestPriceInfo(ingredient.name) : getHighestPriceInfo(ingredient.name);
      if (priceDetails) {
        const { quantity: ingredientQuantityInBase, unit: ingredientUnitInBase } = convertMaterialToBaseUnit(ingredient.quantity, ingredient.unit, ingredient.name);
        if (normalizeUnit(ingredientUnitInBase) === normalizeUnit(priceDetails.baseUnit)) {
          ingredientCost = ingredientQuantityInBase * priceDetails.pricePerBaseUnit;
        } else { ingredientCost = 0; }
      } else { ingredientCost = 0; }
    }
    totalCostOfIngredients += ingredientCost;
  }

  // This now returns the TOTAL cost of the batch, not per unit.
  // Per-unit calculation will be done where needed.
  return totalCostOfIngredients;
}


export interface AggregatedRawMaterial { name: string; quantity: number; unit: string; }

export function getRawMaterialsForProductQuantity(
  productName: string,
  quantityToProduce: number,
  allRecipes: Recipe[]
): AggregatedRawMaterial[] {
  const currentBranchId = getActiveBranchId();
  if (!currentBranchId) {
    console.error("getRawMaterialsForProductQuantity: No active branch ID.");
    return [];
  }
  const recipesForBranch = allRecipes.length > 0 ? allRecipes : loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, currentBranchId);
  const productRecipe = recipesForBranch.find(r => r.name.toLowerCase() === productName.toLowerCase());

  if (!productRecipe) { console.warn(`Receta no encontrada para: ${productName}`); return []; }

  const recipeMultiplier = quantityToProduce / (productRecipe.expectedYield || 1);
  if (isNaN(recipeMultiplier) || recipeMultiplier <= 0) { console.warn(`Multiplicador de receta inválido para ${productName}`); return []; }

  const aggregatedMaterialsMap = new Map<string, AggregatedRawMaterial>();

  function processIngredients(currentRecipeId: string, currentMultiplier: number) {
    const recipe = recipesForBranch.find(r => r.id === currentRecipeId);
    if (!recipe || !Array.isArray(recipe.ingredients)) return;
    const recipeIngredients = recipe.ingredients;

    for (const ingredient of recipeIngredients) {
      const subRecipe = recipesForBranch.find(r => r.name.toLowerCase() === ingredient.name.toLowerCase() && r.isIntermediate);
      const requiredIngredientQuantityTotal = ingredient.quantity * currentMultiplier;

      if (subRecipe && subRecipe.id) {
        const subRecipeYield = subRecipe.expectedYield || 1;
        const subRecipeBatchesNeeded = requiredIngredientQuantityTotal / subRecipeYield;
        processIngredients(subRecipe.id, subRecipeBatchesNeeded);
      } else {
        const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(
          requiredIngredientQuantityTotal, ingredient.unit, ingredient.name
        );
        if (VALID_BASE_UNITS.includes(baseUnit as any)) {
          const key = `${ingredient.name.toLowerCase().trim()}-${baseUnit}`;
          const existing = aggregatedMaterialsMap.get(key);
          if (existing) {
            existing.quantity += baseQuantity;
          } else {
            aggregatedMaterialsMap.set(key, { name: ingredient.name, quantity: baseQuantity, unit: baseUnit });
          }
        } else { console.warn(`Unidad base no válida '${baseUnit}' para ingrediente '${ingredient.name}'.`); }
      }
    }
  }
  processIngredients(productRecipe.id, recipeMultiplier);
  return Array.from(aggregatedMaterialsMap.values()).map(item => ({
    ...item, quantity: parseFloat(item.quantity.toFixed(4))
  })).filter(item => item.quantity > 0.0001);
}

export function getDirectIngredientsForRecipe(
  productName: string,
  batchMultiplier: number,
  allRecipes: Recipe[]
): DirectIngredient[] {
  const currentBranchId = getActiveBranchId();
  if (!currentBranchId) {
    console.error("getDirectIngredientsForRecipe: No active branch ID.");
    return [];
  }
  const recipesForBranch = allRecipes.length > 0 ? allRecipes : loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, currentBranchId);
  const recipe = recipesForBranch.find(r => r.name.toLowerCase() === productName.toLowerCase());

  if (!recipe) { console.warn(`getDirectIngredientsForRecipe: Receta no encontrada para: ${productName}`); return []; }
  const recipeIngredientsArray: RecipeIngredientItem[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  if (recipeIngredientsArray.length === 0) return [];

  const directIngredients: DirectIngredient[] = [];
  for (const ingredient of recipeIngredientsArray) {
    const subRecipe = recipesForBranch.find(r => r.name.toLowerCase() === ingredient.name.toLowerCase() && r.isIntermediate);
    const scaledIngredientQuantity = ingredient.quantity * batchMultiplier;
    if (subRecipe) {
      const outputUnit = normalizeUnit(subRecipe.outputUnit || (subRecipe.name.toLowerCase().includes("melado") || subRecipe.name.toLowerCase().includes("jarabe") ? "l" : "kg"));
      directIngredients.push({
        name: subRecipe.name, quantity: scaledIngredientQuantity, unit: outputUnit,
        isIntermediate: true, originalRecipeUnit: ingredient.unit
      });
    } else {
      const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(scaledIngredientQuantity, ingredient.unit, ingredient.name);
      directIngredients.push({
        name: ingredient.name, quantity: baseQuantity, unit: baseUnit,
        isIntermediate: false, originalRecipeUnit: ingredient.unit
      });
    }
  }
  return directIngredients;
}

export interface GoalIngredientsAndCost {
  ingredientsList: AggregatedRawMaterial[];
  totalCostMinUSD: number;
  totalCostMaxUSD: number;
  missingPriceInfoForMaterials: string[];
}

export function calculateTotalIngredientsAndCostForGoal(
  goal: ProductionGoal,
  allRecipesDataLocal: Recipe[]
): GoalIngredientsAndCost {
  const ingredientsList = getRawMaterialsForProductQuantity(
    goal.product, goal.target, allRecipesDataLocal
  );
  let totalCostMinUSD = 0; let totalCostMaxUSD = 0; const missingPriceInfoForMaterials: string[] = [];
  for (const material of ingredientsList) {
    const lowestPrice = getLowestPriceInfo(material.name); const highestPrice = getHighestPriceInfo(material.name); // Proveedores globales
    let minItemCost = 0; let maxItemCost = 0; let priceFound = false;
    if (lowestPrice && normalizeUnit(lowestPrice.baseUnit) === normalizeUnit(material.unit)) {
      minItemCost = material.quantity * lowestPrice.pricePerBaseUnit; priceFound = true;
    }
    if (highestPrice && normalizeUnit(highestPrice.baseUnit) === normalizeUnit(material.unit)) {
      maxItemCost = material.quantity * highestPrice.pricePerBaseUnit; priceFound = true;
    }
    if (priceFound) {
      totalCostMinUSD += (minItemCost > 0 ? minItemCost : (maxItemCost > 0 ? maxItemCost : 0));
      totalCostMaxUSD += (maxItemCost > 0 ? maxItemCost : (minItemCost > 0 ? minItemCost : 0));
    } else if (material.quantity > 0) { missingPriceInfoForMaterials.push(material.name); }
  }
  return { ingredientsList, totalCostMinUSD, totalCostMaxUSD, missingPriceInfoForMaterials };
}

// --- Save Functions for Each Data Type ---
// Branch-specific saves
export function saveProductsData(data: Product[]): void {
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) return;
  productsData = data;
  saveToLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, activeBranchId, data);
}
export function saveProductionLogData(data: ProductionLogEntry[]): void {
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) return;
  productionLogData = data;
  saveToLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranchId, data);
}
export function saveRecipesData(data: Recipe[]): void {
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) return;
  const dataToSave = data.map(r => ({ ...r })).sort((a, b) => a.name.localeCompare(b.name));
  saveToLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchId, dataToSave);
  recipesData = dataToSave;
  dispatchDataUpdateEvent(KEYS.RECIPES);
}


export function savePurchaseOrdersData(branchId: string, data: PurchaseOrder[]): void {
  if (!branchId) {
    console.error("savePurchaseOrdersData: No branchId provided.");
    return;
  }
  saveToLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, branchId, data);
  if (branchId === getActiveBranchId()) {
    purchaseOrdersData = data;
  }
}
export function saveWeeklyGoalsData(data: ProductionGoal[]): void {
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) return;
  weeklyGoalsData = data;
  saveToLocalStorageForBranch<ProductionGoal[]>(KEYS.WEEKLY_GOALS, activeBranchId, data);
}
export function saveMonthlyGoalsData(data: ProductionGoal[]): void {
  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) return;
  monthlyGoalsData = data;
  saveToLocalStorageForBranch<ProductionGoal[]>(KEYS.MONTHLY_GOALS, activeBranchId, data);
}

export function saveAccountTransactionsData(branchIdToSave: string, data: AccountTransaction[]): void {
  if (!branchIdToSave) {
    console.error("saveAccountTransactionsData: No branchId provided.");
    return;
  }
  const sortedData = [...data].sort((a, b) => {
    const dateA = a.date && isValid(parseISO(a.date)) ? parseISO(a.date) : new Date(0);
    const dateB = b.date && isValid(parseISO(b.date)) ? parseISO(b.date) : new Date(0);
    const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
    const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
    if (dayB !== dayA) return dayB - dayA;
    const timestampAValue = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : 0;
    const timestampBValue = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : 0;
    if (timestampBValue !== timestampAValue) return timestampBValue - timestampAValue;
    return (b.id || '').localeCompare(a.id || '');
  });
  saveToLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, branchIdToSave, sortedData);
}

// Global saves (Proveedores, Opciones de MP)
export function saveSuppliersData(data: Supplier[]): void {
  // Ensure priceListUSDCash is initialized if missing for any supplier during save
  const suppliersWithInitializedUSDCashList = data.map(supplier => ({
    ...supplier,
    priceList: Array.isArray(supplier.priceList) ? supplier.priceList : [],
    priceListUSDCash: Array.isArray(supplier.priceListUSDCash) ? supplier.priceListUSDCash : [],
  }));
  suppliersData = suppliersWithInitializedUSDCashList;
  saveToLocalStorage<Supplier[]>(KEYS.SUPPLIERS, suppliersData);
}


// Branch-specific saves for Employees and Expenses
export function saveEmployeesData(branchIdToSave: string, data: Employee[]): void {
  if (!branchIdToSave) {
    console.error("saveEmployeesData: No branchId provided.");
    return;
  }
  if (branchIdToSave === getActiveBranchId()) {
    employeesData = data;
  }
  saveToLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, branchIdToSave, data);
}

export function saveExpensesData(branchIdToSave: string, data: Expense[]): void {
  if (!branchIdToSave) {
    console.error("saveExpensesData: No branchId provided.");
    return;
  }
  if (branchIdToSave === getActiveBranchId()) {
    expensesData = data;
  }
  saveToLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, branchIdToSave, data);
}


export function saveSalesData(data: Sale[]): void {
  const validatedSales = data.map(sale => ({
    ...sale,
    amountPaidUSD: typeof sale.amountPaidUSD === 'number' ? sale.amountPaidUSD : 0,
    itemsPerBranch: Array.isArray(sale.itemsPerBranch) ? sale.itemsPerBranch.map(branchDetail => ({
      ...branchDetail,
      amountPaidUSD: typeof branchDetail.amountPaidUSD === 'number' ? branchDetail.amountPaidUSD : 0,
      totalAmount: typeof branchDetail.totalAmount === 'number' ? branchDetail.totalAmount : 0,
      items: Array.isArray(branchDetail.items) ? branchDetail.items : []
    })) : [],
  }));
  salesData = validatedSales;
  saveToLocalStorage<Sale[]>(KEYS.SALES, salesData);
}
export function saveCustomersData(data: Customer[]): void {
  const uniqueCustomersMap = new Map<string, Customer>();
  for (const customer of data) {
    if (customer && customer.id) {
      const customerToSave = { ...customer };
      uniqueCustomersMap.set(customer.id, customerToSave as Customer);
    }
  }
  customersData = Array.from(uniqueCustomersMap.values());
  saveToLocalStorage<Customer[]>(KEYS.CUSTOMERS, customersData);
}
export function savePaymentsData(data: Payment[]): void {
  paymentsData = data;
  saveToLocalStorage<Payment[]>(KEYS.PAYMENTS, data);
}
export function saveInventoryTransfersData(data: InventoryTransfer[]): void { inventoryTransfersData = data; saveToLocalStorage<InventoryTransfer[]>(KEYS.INVENTORY_TRANSFERS, data); }
export function savePendingFundTransfersData(data: PendingFundTransfer[]): void { pendingFundTransfersData = data; saveToLocalStorage<PendingFundTransfer[]>(KEYS.PENDING_FUND_TRANSFERS, data); }
export function saveWeeklyLossReportsData(data: WeeklyLossReport[]): void { weeklyLossReportsData = data; saveToLocalStorage<WeeklyLossReport[]>(KEYS.WEEKLY_LOSS_REPORTS, data); }
export function saveWeeklyProfitReportsData(data: WeeklyProfitReport[]): void { weeklyProfitReportsData = data; saveToLocalStorage<WeeklyProfitReport[]>(KEYS.WEEKLY_PROFIT_REPORTS, data); }
export function saveComparisonRecipesData(data: SimulatedRecipe[]): void { saveToLocalStorage<SimulatedRecipe[]>(KEYS.COMPARISON_RECIPES, data); }


// --- Constants ---
export const commonUnitOptions: string[] = [
  "kg", "g", "L", "ml", "galon", "unidad", "docena", "paquete", "caja", "saco", "bandeja"
].sort((a, b) => a.localeCompare(b));

// --- Goal Status Calculation ---
export function calculateGoalStatus(target: number, achieved: number): string {
  if (target <= 0) return 'No Definido';
  if (achieved <= 0 && target > 0) return 'Sin Empezar';
  const progress = (achieved / target) * 100;
  if (progress >= 100) return 'Completado';
  if (progress >= 90) return 'Casi Logrado';
  if (progress >= 50) return 'En Progreso';
  return 'Atrasado';
}

// --- Customer Balance Calculation (Global) ---
export function calculateCustomerBalance(customerId: string, allSales?: Sale[], allPayments?: Payment[]): number {
  const salesToUse = allSales || loadFromLocalStorage<Sale[]>(KEYS.SALES);
  const paymentsToUse = allPayments || loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);

  const customerDebts = salesToUse
    .filter(s => s.customerId === customerId && s.totalAmount >= 0)
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const customerRealPayments = paymentsToUse
    .filter(p => p.customerId === customerId && p.status === 'verificado' && p.paymentMethod !== 'Crédito a Favor')
    .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);

  return parseFloat((customerDebts - customerRealPayments).toFixed(4));
}

export function calculateCustomerOverdueBalance(customerId: string, allSales: Sale[], allPayments: Payment[]): number {
  const customerSales = allSales.filter(s => s.customerId === customerId);
  let overdueBalance = 0;

  customerSales.forEach(sale => {
    const status = getInvoiceStatus(sale, allPayments);
    if (status === 'Vencida') {
      const invoiceBalance = calculateInvoiceBalance(sale.id, allPayments, allSales);
      if (invoiceBalance > 0) {
        overdueBalance += invoiceBalance;
      }
    }
  });

  return overdueBalance;
}


// --- Data Initialization Function ---
if (typeof window !== 'undefined') {
  userProfileData = loadUserProfileFromLocalStorage();
  loadExchangeRate();
  inventoryTransfersData = loadFromLocalStorage<InventoryTransfer[]>(KEYS.INVENTORY_TRANSFERS);
  pendingFundTransfersData = loadFromLocalStorage<PendingFundTransfer[]>(KEYS.PENDING_FUND_TRANSFERS);
  customersData = loadFromLocalStorage<Customer[]>(KEYS.CUSTOMERS);
  salesData = loadFromLocalStorage<Sale[]>(KEYS.SALES).map(s => ({ ...s, amountPaidUSD: s.amountPaidUSD || 0, itemsPerBranch: Array.isArray(s.itemsPerBranch) ? s.itemsPerBranch : [] }));
  paymentsData = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
  suppliersData = loadFromLocalStorage<Supplier[]>(KEYS.SUPPLIERS).map(s => ({ ...s, priceList: s.priceList || [], priceListUSDCash: s.priceListUSDCash || [] }));
  rawMaterialOptions = initializeRawMaterialOptions();
  customConversionRulesData = loadCustomConversionRules();
  weeklyLossReportsData = loadFromLocalStorage<WeeklyLossReport[]>(KEYS.WEEKLY_LOSS_REPORTS);
  weeklyProfitReportsData = loadFromLocalStorage<WeeklyProfitReport[]>(KEYS.WEEKLY_PROFIT_REPORTS);

  const activeBranchIdLoaded = getActiveBranchId();
  if (activeBranchIdLoaded) {
    productsData = loadProductsForBranch(activeBranchIdLoaded);
    productionLogData = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranchIdLoaded);
    recipesData = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchIdLoaded);
    purchaseOrdersData = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchIdLoaded);
    rawMaterialInventoryData = loadRawMaterialInventoryData(activeBranchIdLoaded);
    weeklyGoalsData = loadFromLocalStorageForBranch<ProductionGoal[]>(KEYS.WEEKLY_GOALS, activeBranchIdLoaded);
    monthlyGoalsData = loadFromLocalStorageForBranch<ProductionGoal[]>(KEYS.MONTHLY_GOALS, activeBranchIdLoaded);
    employeesData = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchIdLoaded);
    expensesData = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchIdLoaded);
    loadExpenseFixedCategories(activeBranchIdLoaded);
    loadExpenseVariableCategories(activeBranchIdLoaded);
  } else {
    productsData = []; productionLogData = []; recipesData = [];
    purchaseOrdersData = []; rawMaterialInventoryData = []; weeklyGoalsData = [];
    monthlyGoalsData = []; employeesData = []; expensesData = [];
  }
}

export function updateGlobalSaleDataAndFinances(
  payment: Payment,
  operation: 'add' | 'subtract'
): void {

  let currentSales = loadFromLocalStorage<Sale[]>(KEYS.SALES);
  let currentPendingTransfers = loadFromLocalStorage<PendingFundTransfer[]>(KEYS.PENDING_FUND_TRANSFERS);

  const saleIndex = payment.appliedToInvoiceId ? currentSales.findIndex(s => s.id === payment.appliedToInvoiceId) : -1;

  if (operation === 'add') {
    if (saleIndex !== -1) {
      const sale = currentSales[saleIndex];
      sale.amountPaidUSD = (sale.amountPaidUSD || 0) + payment.amountAppliedToDebtUSD;

      if (payment.paymentMethod !== 'Nota de Crédito' && payment.paymentMethod !== 'Crédito a Favor' && sale.itemsPerBranch.length > 1 && payment.paidToBranchId) { // Pagos normales
        const rateForTransfer = payment.exchangeRateAtPayment || loadExchangeRate(parseISO(payment.paymentDate));
        const amountPaidInUSD = payment.amountAppliedToDebtUSD;

        sale.itemsPerBranch.forEach(branchDetail => {
          if (branchDetail.branchId !== payment.paidToBranchId) {
            const proportionOfTotal = sale.totalAmount > 0 ? branchDetail.totalAmount / sale.totalAmount : 0;
            const amountToTransferUSD = amountPaidInUSD * proportionOfTotal;

            if (amountToTransferUSD > 0.001) {
              const transferObject: PendingFundTransfer = {
                id: `TRNFR-${sale.id.slice(-4)}-${payment.id.slice(-4)}-${branchDetail.branchId.slice(-4)}`,
                saleId: sale.id,
                fromBranchId: payment.paidToBranchId!,
                fromBranchName: availableBranches.find(b => b.id === payment.paidToBranchId)?.name || 'Desconocida',
                toBranchId: branchDetail.branchId,
                toBranchName: branchDetail.branchName,
                amountUSD: 0,
                amountVES: 0,
                originalPaymentAccountId: payment.paidToAccountId,
                originalPaymentCurrency: payment.currencyPaidInput,
                exchangeRateAtPayment: rateForTransfer,
                creationTimestamp: payment.verificationDate || new Date().toISOString(),
                status: 'pendiente',
                parentPaymentId: payment.parentPaymentId,
                isFromCreditNote: payment.paymentMethod === 'Nota de Crédito'
              };

              if (payment.currencyPaidInput === 'VES') {
                transferObject.amountVES = parseFloat((amountToTransferUSD * rateForTransfer).toFixed(2));
                transferObject.amountUSD = parseFloat(amountToTransferUSD.toFixed(2)); // Guardamos ambos
              } else {
                transferObject.amountUSD = parseFloat(amountToTransferUSD.toFixed(2));
              }

              currentPendingTransfers.push(transferObject);
            }
          }
        });
      }
    }

    if (payment.paidToBranchId && payment.paidToAccountId && payment.paymentMethod !== 'Crédito a Favor' && payment.paymentMethod !== 'Nota de Crédito') {
      let companyAccounts = loadCompanyAccountsData(payment.paidToBranchId);
      const account = companyAccounts[payment.paidToAccountId];
      if (account) {
        const rate = payment.exchangeRateAtPayment || loadExchangeRate(parseISO(payment.paymentDate));
        const amountInAccountCurrency = account.currency === 'USD'
          ? payment.amountAppliedToDebtUSD
          : (rate > 0 ? payment.amountAppliedToDebtUSD * rate : 0);

        account.balance += amountInAccountCurrency;
        account.lastTransactionDate = new Date().toISOString();

        const newTransaction: AccountTransaction = {
          id: `TRN-PAYMENT-${payment.id}`,
          date: payment.paymentDate,
          description: `Ingreso por pago de ${payment.customerName}`,
          type: 'ingreso',
          amount: parseFloat(amountInAccountCurrency.toFixed(2)),
          currency: account.currency,
          accountId: payment.paidToAccountId,
          sourceModule: 'Ventas (Pago Cliente)',
          sourceId: payment.id,
          timestamp: payment.verificationDate || new Date().toISOString(),
          balanceAfterTransaction: account.balance
        };
        let transactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, payment.paidToBranchId);
        transactions.unshift(newTransaction);
        saveToLocalStorageForBranch(KEYS.ACCOUNT_TRANSACTIONS, payment.paidToBranchId, transactions);
        saveCompanyAccountsData(payment.paidToBranchId, companyAccounts);
      }
    }
  } else { // operation === 'subtract'
    // 1. Revert Sale's amountPaidUSD
    if (saleIndex !== -1) {
      currentSales[saleIndex].amountPaidUSD = Math.max(0, (currentSales[saleIndex].amountPaidUSD || 0) - payment.amountAppliedToDebtUSD);
    }

    // 2. Revert Company Account Balance
    if (payment.paidToBranchId && payment.paidToAccountId && payment.paymentMethod !== 'Crédito a Favor' && payment.paymentMethod !== 'Nota de Crédito') {
      let companyAccounts = loadCompanyAccountsData(payment.paidToBranchId);
      const account = companyAccounts[payment.paidToAccountId];
      if (account) {
        const rate = payment.exchangeRateAtPayment || loadExchangeRate(parseISO(payment.paymentDate));
        const amountInAccountCurrency = account.currency === 'USD'
          ? payment.amountAppliedToDebtUSD
          : (rate > 0 ? payment.amountAppliedToDebtUSD * rate : 0);
        account.balance -= amountInAccountCurrency;
      }
      saveCompanyAccountsData(payment.paidToBranchId, companyAccounts);
    }

    // 3. Remove Account Transaction
    if (payment.paidToBranchId && payment.paymentMethod !== 'Crédito a Favor' && payment.paymentMethod !== 'Nota de Crédito') {
      let transactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, payment.paidToBranchId);
      transactions = transactions.filter(t => t.sourceId !== payment.id);
      saveToLocalStorageForBranch(KEYS.ACCOUNT_TRANSACTIONS, payment.paidToBranchId, transactions);
    }

    // 4. Remove Pending Fund Transfers (if any)
    const initialTransferCount = currentPendingTransfers.length;
    currentPendingTransfers = currentPendingTransfers.filter(t => !t.id.includes(payment.id.slice(0, 15)));
    if (currentPendingTransfers.length < initialTransferCount) {
      savePendingFundTransfersData(currentPendingTransfers);
    }
  }

  // Save updated global states at the end
  saveSalesData(currentSales);
  savePendingFundTransfersData(currentPendingTransfers);
}


export function getInvoiceStatus(sale: Sale, allPayments: Payment[]): SaleStatus {
  if (!sale || typeof sale.totalAmount !== 'number') return 'Pendiente de Pago';

  const balance = calculateInvoiceBalance(sale.id, allPayments, [sale]);

  if (balance <= 0.01) {
    return 'Completada';
  }

  if (sale.dueDate && isValid(parseISO(sale.dueDate))) {
    if (differenceInDays(new Date(), parseISO(sale.dueDate)) > 0) {
      return 'Vencida';
    }
  }

  const paymentsForThisInvoice = allPayments.filter(p => p.appliedToInvoiceId === sale.id && p.status === 'verificado').reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);
  if (paymentsForThisInvoice > 0.01) {
    return 'Pagada Parcialmente';
  }

  return 'Pendiente de Pago';
}

export function calculateInvoiceBalance(invoiceId: string, allPayments: Payment[], allSales: Sale[]): number {
  const sale = allSales.find(s => s.id === invoiceId);
  if (!sale) return 0;

  const paymentsForThisInvoice = allPayments
    .filter(p => p.appliedToInvoiceId === invoiceId && p.status === 'verificado')
    .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);

  return (sale.totalAmount || 0) - paymentsForThisInvoice;
}















