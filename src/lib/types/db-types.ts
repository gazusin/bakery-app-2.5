import { AuditLog } from './user';

export type AccountType = 'vesElectronic' | 'usdCash' | 'vesCash';

export interface UserPermissions { [moduleId: string]: boolean; }

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
    costPerUnit: number;
    expectedYield?: number;
    lastUpdated: string;
    isIntermediate?: boolean;
    isResoldProduct?: boolean;
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
    priceListUSDCash?: SupplierPriceListItem[];
}

export interface PurchaseOrderItem { id: string; rawMaterialName: string; quantity: number; unit: string; unitPrice: number; subtotal: number; }

export type PurchaseOrderStatus = 'Pagado' | 'Pendiente' | 'Cancelado' | 'Recibido';

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

export type SaleStatus = 'Completada' | 'Pendiente de Pago' | 'Vencida' | 'Pagada Parcialmente';

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
    paymentSplits?: PaymentSplit[];
    amountPaidUSD: number;
    status?: SaleStatus;
    timestamp?: string;
    notes?: string;
    creditNoteTargetInvoiceId?: string;
}

export interface Customer {
    id: string;
    name: string;
    contact: string;
    phone?: string;
    email?: string;
    address?: string;
    workZone?: string;
    lastOrder?: string;
    totalDebt?: number; // Added for compatibility with DB schema if needed, or remove if not used
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
    parentPaymentId?: string;
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

export interface CompanyAccountsData {
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
    amount: number;
    paidTo: string;
    sourceModule?: 'Compra de Materia Prima' | 'Gastos Operativos';
    sourceId?: string;
    paymentAccountId?: AccountType;
    timestamp?: string;
    branchId?: string; // Added for DB compatibility if needed
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
    amountVES?: number;
    originalPaymentAccountId?: AccountType;
    originalPaymentCurrency?: 'USD' | 'VES';
    exchangeRateAtPayment?: number;
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
    id: string;
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

// --- Product Loss Tracking Types ---
export type LossCategory =
    | 'devolucion_no_despachable'  // Producto defectuoso devuelto por cliente
    | 'consumo_interno'            // Desayuno/merienda empleados  
    | 'beneficio_semanal'          // Pan regalado a trabajadores
    | 'merma_operativa';           // Quemado, caído, vencido

export interface ProductLoss {
    id: string;
    productId: string;
    productName: string;
    category: LossCategory;
    quantity: number;
    unitCost: number;      // Costo unitario del producto
    totalCost: number;     // quantity * unitCost
    reason: string;        // Descripción específica
    date: string;
    branchId: string;
    registeredBy: string;
    createdAt: string;
}

export type { AuditLog };
