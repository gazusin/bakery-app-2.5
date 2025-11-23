

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageTransition } from '@/components/page-transition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, PlusCircle, MoreHorizontal, Edit, Trash2, Calendar as CalendarIcon, Loader2, Trash, FileText as InvoiceIcon, Filter, Gift, AlertTriangle, Eye, DollarSign, Info, ShieldCheck, Bot, MessageCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAudit } from "@/hooks/useAudit";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, addDays, differenceInDays, isWithinInterval, startOfDay, endOfDay, isValid, compareDesc } from "date-fns";
import type { DateRange } from "react-day-picker";
import { es } from 'date-fns/locale';
import { SendInvoiceButton } from '@/components/whatsapp-button';
import { cn } from "@/lib/utils";
import {
  type Product,
  salesData as initialSalesDataGlobal,
  saveSalesData,
  type Sale,
  type SaleItem,
  type SaleBranchDetail,
  customersData as initialCustomersDataGlobal,
  saveCustomersData,
  type Customer,
  salePaymentMethods,
  loadExchangeRate,
  type AccountTransaction,
  type CompanyAccountsData,
  type AccountType,
  accountTypeNames,
  getInvoiceStatus,
  type SaleStatus,
  paymentsData as initialPaymentsDataGlobal,
  savePaymentsData,
  type Payment,
  KEYS,
  loadAllProductsFromAllBranches,
  loadProductsForBranch,
  saveProductsDataForBranch,
  type PendingFundTransfer,
  savePendingFundTransfersData,
  pendingFundTransfersData as initialPendingFundTransfersData,
  availableBranches,
  getActiveBranchId,
  loadFromLocalStorageForBranch,
  saveToLocalStorageForBranch,
  calculateCustomerBalance,
  type PaymentSplit,
  type PaymentMethodType,
  paymentMethodList,
  userProfileData,
  updateGlobalSaleDataAndFinances,
  loadFromLocalStorage,
  type Recipe,
  checkDuplicateReference,
  validateReferenceFormat,
  getCustomerCreditStatus
} from '@/lib/data-storage';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { SaleDialog } from '@/components/sales/sale-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { processDispatch, type ProcessDispatchInput, type ProcessDispatchOutput } from '@/ai/flows/process-dispatch-flow';
import { registerLossesFromSale } from '@/lib/loss-tracking-service';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

const ALL_CUSTOMERS_FILTER_VALUE = "__ALL_CUSTOMERS__";
const ALL_STATUSES_FILTER_VALUE = "__ALL_STATUSES__";
const saleStatusOptions: SaleStatus[] = ['Completada', 'Pendiente de Pago', 'Vencida', 'Pagada Parcialmente'];


export default function SalesPage() {
  const { toast } = useToast();
  const { logCreate, logUpdate, logDelete } = useAudit();
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<Customer[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [isAddSaleDialogOpen, setIsAddSaleDialogOpen] = useState(false);


  const [customerBalance, setCustomerBalance] = useState(0);
  const [applyCustomerCredit, setApplyCustomerCredit] = useState(false);


  const [isEditSaleDialogOpen, setIsEditSaleDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [originalSaleForEdit, setOriginalSaleForEdit] = useState<Sale | null>(null);
  const [editSaleDate, setEditSaleDate] = useState<Date | undefined>(undefined);


  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [saleToDeleteId, setSaleToDeleteId] = useState<string | null>(null);

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [filterCustomerId, setFilterCustomerId] = useState<string>(ALL_CUSTOMERS_FILTER_VALUE);
  const [filterSaleStatus, setFilterSaleStatus] = useState<string>(ALL_STATUSES_FILTER_VALUE);

  const [isViewSaleDialogOpen, setIsViewSaleDialogOpen] = useState(false);
  const [saleToViewDetails, setSaleToViewDetails] = useState<Sale | null>(null);



  // Estados para el diálogo de despacho con IA
  const [isAiDispatchDialogOpen, setIsAiDispatchDialogOpen] = useState(false);
  const [dispatchText, setDispatchText] = useState('');
  const [isAnalyzingDispatch, setIsAnalyzingDispatch] = useState(false);

  const [isCreditNotesDialogOpen, setIsCreditNotesDialogOpen] = useState(false);
  const [creditNotesDateRange, setCreditNotesDateRange] = useState<DateRange | undefined>(undefined);
  const [analyzedDispatchData, setAnalyzedDispatchData] = useState<ProcessDispatchOutput | null>(null);
  const [creditNotesQueue, setCreditNotesQueue] = useState<any[]>([]); // Para manejar múltiples NC


  const vendibleProducts = useMemo(() => {
    return availableProducts.filter(p =>
      p.category?.toLowerCase() !== 'no despachable' &&
      !p.name.toLowerCase().startsWith('no despachable')
    );
  }, [availableProducts]);

  const loadPageData = useCallback(() => {
    setIsLoading(true);
    setAvailableProducts(loadAllProductsFromAllBranches());

    const allRecipesData: Recipe[] = [];
    availableBranches.forEach(branch => {
      allRecipesData.push(...loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branch.id));
    });
    setAllRecipes(allRecipesData);

    const currentSales = [...initialSalesDataGlobal].sort((a, b) => {
      const dateA = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    setAllSales(currentSales);
    setFilteredSales(currentSales);
    setAvailableCustomers([...initialCustomersDataGlobal].sort((a, b) => a.name.localeCompare(b.name)));
    setExchangeRate(loadExchangeRate());

    setIsLoading(false);
  }, []);

  const resetAddForm = useCallback(() => {
    // Form reset handled by SaleDialog
  }, []);

  useEffect(() => {
    loadPageData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.SALES ||
        customEvent.detail?.key === KEYS.PRODUCTS ||
        customEvent.detail?.key === KEYS.CUSTOMERS ||
        customEvent.detail?.key === KEYS.PAYMENTS ||
        customEvent.detail?.key === KEYS.ACCOUNT_TRANSACTIONS ||
        customEvent.detail?.key === KEYS.COMPANY_ACCOUNTS ||
        customEvent.detail?.key === KEYS.PENDING_FUND_TRANSFERS ||
        customEvent.detail?.key === KEYS.EXCHANGE_RATE_HISTORY ||
        customEvent.detail?.key === KEYS.RECIPES
      ) {
        loadPageData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadPageData]);







  const applyFilters = useCallback(() => {
    let salesToFilter = [...allSales];
    if (dateRangeFilter?.from) {
      const toDate = dateRangeFilter.to ? endOfDay(dateRangeFilter.to) : endOfDay(dateRangeFilter.from);
      salesToFilter = salesToFilter.filter(sale =>
        isValid(parseISO(sale.date)) && isWithinInterval(parseISO(sale.date), { start: startOfDay(dateRangeFilter.from!), end: toDate })
      );
    }
    if (filterCustomerId && filterCustomerId !== ALL_CUSTOMERS_FILTER_VALUE) {
      salesToFilter = salesToFilter.filter(sale => sale.customerId === filterCustomerId);
    }
    if (filterSaleStatus && filterSaleStatus !== ALL_STATUSES_FILTER_VALUE) {
      salesToFilter = salesToFilter.filter(sale => getInvoiceStatus(sale, initialPaymentsDataGlobal) === filterSaleStatus);
    }
    setFilteredSales(salesToFilter);
  }, [allSales, dateRangeFilter, filterCustomerId, filterSaleStatus]);


  useEffect(() => {
    applyFilters();
  }, [allSales, dateRangeFilter, filterCustomerId, filterSaleStatus, applyFilters]);

  const handleApplyFilters = () => { applyFilters(); };
  const handleClearFilters = () => {
    setDateRangeFilter(undefined);
    setFilterCustomerId(ALL_CUSTOMERS_FILTER_VALUE);
    setFilterSaleStatus(ALL_STATUSES_FILTER_VALUE);
  };

  const calculateItemsSubtotal = (items: SaleItem[]): number => {
    return items.reduce((total, item) => total + (item.subtotal || 0), 0);
  };

  const calculateTotalAmount = (items: SaleItem[], changes: SaleItem[]): number => {
    const itemsSubtotal = calculateItemsSubtotal(items);
    const changesSubtotal = calculateItemsSubtotal(changes);
    return parseFloat((itemsSubtotal - changesSubtotal).toFixed(4));
  };



  const validateAndUpdateStock = (
    itemsSold: SaleItem[],
    itemsReturned: SaleItem[],
    itemsSampled: SaleItem[],
    isEdit: boolean,
    originalSale?: Sale | null
  ): { success: boolean; itemsPerBranch: SaleBranchDetail[] } => {
    const stockChanges = new Map<string, number>(); // Key: `${branchId}-${productId}`

    const updateStockChange = (productId: string, branchId: string, quantity: number) => {
      if (!productId || !branchId) return;
      const key = `${branchId}-${productId}`;
      stockChanges.set(key, (stockChanges.get(key) || 0) + quantity);
    };

    if (isEdit && originalSale) {
      originalSale.itemsPerBranch.forEach(branchDetail => {
        branchDetail.items.forEach(item => updateStockChange(item.productId, branchDetail.branchId, item.quantity));
      });
      (originalSale.samples || []).forEach(item => updateStockChange(item.productId, item.sourceBranchId, item.quantity));
      (originalSale.changes || []).forEach(item => updateStockChange(item.productId, item.sourceBranchId, -item.quantity));
    }

    itemsSold.forEach(item => updateStockChange(item.productId, item.sourceBranchId, -item.quantity));
    itemsSampled.forEach(item => updateStockChange(item.productId, item.sourceBranchId, -item.quantity));
    itemsReturned.forEach(item => updateStockChange(item.productId, item.sourceBranchId, item.quantity));

    for (const [key, netChange] of stockChanges.entries()) {
      if (netChange !== 0) {
        const [branchId, productId] = key.split('-');
        let branchProducts = loadProductsForBranch(branchId);
        const productIndex = branchProducts.findIndex(p => p.id === productId);

        if (productIndex === -1 && netChange < 0) {
          const productName = itemsSold.find(i => i.productId === productId)?.productName || 'Producto desconocido';
          const branchName = availableBranches.find(b => b.id === branchId)?.name || 'Sede desconocida';
          toast({ title: "Error de Producto", description: `Producto ${productName} no encontrado en sede ${branchName}.`, variant: "destructive" });
          return { success: false, itemsPerBranch: [] };
        }

        const currentStock = productIndex !== -1 ? branchProducts[productIndex].stock : 0;
        if (currentStock + netChange < 0) {
          const productName = branchProducts[productIndex].name;
          const branchName = branchProducts[productIndex].sourceBranchName;
          toast({ title: "Error de Stock", description: `Stock insuficiente para ${productName} en sede ${branchName}. Disp: ${currentStock}, Cambio Neto Req: ${netChange}.`, variant: "destructive", duration: 7000 });
          return { success: false, itemsPerBranch: [] };
        }
      }
    }

    for (const [key, netChange] of stockChanges.entries()) {
      if (netChange === 0) continue;
      const [branchId, productId] = key.split('-');
      let branchProducts = loadProductsForBranch(branchId);
      const productIndex = branchProducts.findIndex(p => p.id === productId);

      if (productIndex !== -1) {
        branchProducts[productIndex].stock += netChange;
        branchProducts[productIndex].lastUpdated = format(new Date(), "yyyy-MM-dd");
      } else if (netChange > 0) {
        const allItems = [...itemsSold, ...itemsReturned, ...itemsSampled];
        const itemInfo = allItems.find(i => i.productId === productId);
        if (itemInfo) {
          const originalProductInfo = availableProducts.find(p => p.id === productId);
          branchProducts.push({
            id: productId, name: itemInfo.productName, category: originalProductInfo?.category || 'General',
            stock: netChange, unitPrice: itemInfo.unitPrice, lastUpdated: format(new Date(), "yyyy-MM-dd"),
            image: originalProductInfo?.image || 'https://placehold.co/40x40.png', aiHint: originalProductInfo?.aiHint || 'producto panaderia',
            sourceBranchId: branchId, sourceBranchName: availableBranches.find(b => b.id === branchId)?.name || 'Desconocida'
          });
        }
      }
      saveProductsDataForBranch(branchId, branchProducts);
    }

    setAvailableProducts(loadAllProductsFromAllBranches());

    const saleItemsPerBranch: SaleBranchDetail[] = [];
    const itemsGroupedByBranch: { [branchId: string]: SaleItem[] } = {};

    itemsSold.filter(i => i.productId && i.sourceBranchId).forEach(item => {
      const branchId = item.sourceBranchId;
      if (!itemsGroupedByBranch[branchId]) itemsGroupedByBranch[branchId] = [];
      itemsGroupedByBranch[branchId].push(item);
    });

    const changesSubtotalByBranch: { [branchId: string]: number } = {};
    itemsReturned.filter(i => i.productId && i.sourceBranchId).forEach(item => {
      const branchId = item.sourceBranchId;
      changesSubtotalByBranch[branchId] = (changesSubtotalByBranch[branchId] || 0) + item.subtotal;
    });

    const allInvolvedBranches = new Set([...Object.keys(itemsGroupedByBranch), ...Object.keys(changesSubtotalByBranch)]);

    allInvolvedBranches.forEach(branchId => {
      const branchName = availableBranches.find(b => b.id === branchId)?.name || 'Sede Desconocida';
      const soldItemsForBranch = itemsGroupedByBranch[branchId] || [];
      const soldSubtotal = soldItemsForBranch.reduce((sum, item) => sum + item.subtotal, 0);
      const returnedSubtotal = changesSubtotalByBranch[branchId] || 0;

      saleItemsPerBranch.push({
        branchId,
        branchName,
        items: soldItemsForBranch,
        totalAmount: soldSubtotal - returnedSubtotal,
        amountPaidUSD: 0
      });
    });

    return { success: true, itemsPerBranch: saleItemsPerBranch };
  };

  const handleAddSale = async (saleData: any) => {
    setIsSubmitting(true);

    const {
      date: newSaleDate,
      customerId: newSelectedCustomerId,
      items: newSaleItems,
      changes: newSaleChanges,
      samples: newSampleItems,
      paymentMethod: newPaymentMethod,
      paymentSplits: newPaymentSplits,
      notes: newSaleNotes,
      creditNoteTargetInvoiceId,
      applyCustomerCredit
    } = saleData;

    const validSaleItems = newSaleItems.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.unitPrice >= 0 && item.sourceBranchId);
    const validChangeItems = newSaleChanges.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.unitPrice >= 0 && item.sourceBranchId);
    const validSampleItems = newSampleItems.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.sourceBranchId);

    if (!newSaleDate || !newSelectedCustomerId || (validSaleItems.length === 0 && validChangeItems.length === 0 && validSampleItems.length === 0)) {
      toast({ title: "Error de Validación", description: "Fecha, cliente y al menos un ítem, cambio o muestra son obligatorios.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    // Validar semáforo de crédito si es venta a crédito
    if (newPaymentMethod === 'Crédito') {
      const creditStatus = getCustomerCreditStatus(newSelectedCustomerId, userProfileData.role);

      if (creditStatus.isBlocked) {
        if (!creditStatus.canOverride) {
          // Usuario no puede anular el bloqueo
          toast({
            title: "Cliente Bloqueado",
            description: `El cliente tiene una deuda vencida de $${creditStatus.overdueAmount.toFixed(2)} con ${creditStatus.daysPastDue} días de atraso. No se  pueden hacer más ventas a crédito.`,
            variant: "destructive",
            duration: 8000
          });
          setIsSubmitting(false);
          return;
        } else {
          // Admin/Manager puede anular, pero requiere confirmación
          const confirmed = window.confirm(
            `⚠️ CLIENTE CON CRÉDITO VENCIDO\n\n` +
            `Cliente: ${availableCustomers.find(c => c.id === newSelectedCustomerId)?.name}\n` +
            `Deuda vencida: $${creditStatus.overdueAmount.toFixed(2)}\n` +
            `Días de atraso: ${creditStatus.daysPastDue}\n\n` +
            `Como ${userProfileData.role === 'admin' ? 'Administrador' : 'Manager'}, puedes autorizar esta venta.\n\n` +
            `¿Deseas continuar con la venta a crédito?`
          );

          if (!confirmed) {
            setIsSubmitting(false);
            return;
          }

          // Registrar la excepción en auditoría
          logCreate(
            'ventas',
            'credit_override',
            `${saleId}-override`,
            { customerId: newSelectedCustomerId, overdueAmount: creditStatus.overdueAmount, daysPastDue: creditStatus.daysPastDue },
            `Venta a crédito autorizada por ${userProfileData.fullName} para cliente con deuda vencida`,
            ''
          );
        }
      }
    }

    const totalInvoiceAmount = calculateTotalAmount(validSaleItems, validChangeItems);
    if (totalInvoiceAmount < 0 && !creditNoteTargetInvoiceId) {
      toast({ title: "Acción Requerida", description: "Para ventas con total negativo (notas de crédito), debe seleccionar una factura pendiente a la cual aplicar el crédito.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    const saleId = `SALE${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`;
    const saleTimestamp = new Date().toISOString();

    const stockValidationResult = validateAndUpdateStock(validSaleItems, validChangeItems, validSampleItems, false);
    if (!stockValidationResult.success) {
      setIsSubmitting(false); return;
    }

    const newSaleEntry: Sale = {
      id: saleId,
      date: format(newSaleDate, "yyyy-MM-dd"),
      itemsPerBranch: stockValidationResult.itemsPerBranch,
      changes: validChangeItems.length > 0 ? validChangeItems : undefined,
      samples: validSampleItems.length > 0 ? validSampleItems.map((s: any) => ({ ...s, unitPrice: 0, subtotal: 0 })) : undefined,
      customerId: newSelectedCustomerId,
      customerName: availableCustomers.find(c => c.id === newSelectedCustomerId)?.name || 'Desconocido',
      totalAmount: totalInvoiceAmount,
      paymentMethod: totalInvoiceAmount <= 0 ? 'Pagado' : newPaymentMethod,
      dueDate: (newPaymentMethod === 'Crédito' && totalInvoiceAmount > 0) ? format(addDays(newSaleDate, 7), "yyyy-MM-dd") : undefined,
      amountPaidUSD: 0,
      timestamp: saleTimestamp,
      notes: newSaleNotes ? newSaleNotes.trim() : undefined,
      creditNoteTargetInvoiceId: totalInvoiceAmount < 0 ? creditNoteTargetInvoiceId : undefined,
    };

    let currentSales = loadFromLocalStorage<Sale[]>(KEYS.SALES);
    currentSales.push(newSaleEntry);
    saveSalesData(currentSales.sort((a, b) => compareDesc(parseISO(a.timestamp || a.date), parseISO(b.timestamp || b.date))));

    // Automatically register losses from this sale
    registerLossesFromSale(newSaleEntry);

    const customer = initialCustomersDataGlobal.find(c => c.id === newSelectedCustomerId);
    if (customer) {
      const updatedCustomers = initialCustomersDataGlobal.map(c =>
        c.id === newSelectedCustomerId ? { ...c, lastOrder: newSaleEntry.date } : c
      );
      saveCustomersData(updatedCustomers);
    }

    const paymentsToCreate: Payment[] = [];
    const parentId = `PAY-P-${saleId.slice(-6)}`;

    if (applyCustomerCredit && customerBalance < -0.01 && totalInvoiceAmount > 0) {
      const creditToApply = Math.min(totalInvoiceAmount, Math.abs(customerBalance));
      if (creditToApply > 0) {
        const creditPayment: Payment = {
          id: `PAY-CREDIT-${saleId}`, parentPaymentId: parentId, customerId: newSelectedCustomerId,
          customerName: newSaleEntry.customerName || 'Desconocido', paymentDate: newSaleEntry.date,
          amountPaidInput: creditToApply, currencyPaidInput: 'USD',
          amountAppliedToDebtUSD: creditToApply, paymentMethod: 'Crédito a Favor',
          status: 'verificado', appliedToInvoiceId: saleId, paymentSource: 'invoice',
          verifiedBy: 'Sistema', verificationDate: saleTimestamp, creationTimestamp: saleTimestamp,
          paidToBranchId: newSaleEntry.itemsPerBranch[0]?.branchId || availableBranches[0]?.id || '',
          paidToAccountId: 'usdCash',
        };
        paymentsToCreate.push(creditPayment);
        updateGlobalSaleDataAndFinances(creditPayment, 'add');
      }
    }

    // Validar referencias de pagos antes de crear
    if (newPaymentMethod === 'Pagado' && totalInvoiceAmount > 0) {
      for (const split of newPaymentSplits) {
        if (split.amount > 0 && (split.paymentMethod === 'Pago Móvil' || split.paymentMethod === 'Transferencia')) {
          // Validar que tenga referencia
          if (!split.referenceNumber) {
            toast({
              title: "Referencia Requerida",
              description: `El método ${split.paymentMethod} requiere número de referencia`,
              variant: "destructive"
            });
            setIsSubmitting(false);
            return;
          }

          // Validar formato de 6 dígitos
          if (!validateReferenceFormat(split.referenceNumber)) {
            toast({
              title: "Formato Inválido",
              description: "La referencia debe tener exactamente 6 dígitos numéricos",
              variant: "destructive"
            });
            setIsSubmitting(false);
            return;
          }

          // Validar que no esté duplicada
          const duplicateCheck = checkDuplicateReference(split.referenceNumber);
          if (duplicateCheck.exists) {
            toast({
              title: "Referencia Duplicada",
              description: `Esta referencia ya fue usada el ${duplicateCheck.existingPayment?.paymentDate} por ${duplicateCheck.existingPayment?.customerName}`,
              variant: "destructive",
              duration: 6000
            });
            setIsSubmitting(false);
            return;
          }
        }
      }
    }

    if (newPaymentMethod === 'Pagado' && totalInvoiceAmount > 0) {
      newPaymentSplits.forEach((split: PaymentSplit, index: number) => {
        if (split.amount > 0) {
          const rate = split.currency === 'VES' ? (split.exchangeRateAtPayment || exchangeRate || 1) : 1;
          const amountInUSD = split.currency === 'USD' ? split.amount : (rate > 0 ? split.amount / rate : 0);
          const isVerified = split.paymentMethod === 'Efectivo USD' || split.paymentMethod === 'Efectivo VES';
          const payment = {
            id: `PAY-SALE-${saleId}-${index}`, parentPaymentId: parentId, customerId: newSelectedCustomerId,
            customerName: newSaleEntry.customerName || 'Desconocido', paymentDate: newSaleEntry.date,
            amountPaidInput: split.amount, currencyPaidInput: split.currency,
            exchangeRateAtPayment: split.exchangeRateAtPayment, amountAppliedToDebtUSD: amountInUSD,
            paymentMethod: split.paymentMethod, status: isVerified ? 'verificado' : 'pendiente de verificación' as Payment['status'],
            appliedToInvoiceId: saleId, paymentSource: 'invoice' as Payment['paymentSource'],
            verifiedBy: isVerified ? userProfileData.fullName : undefined,
            verificationDate: isVerified ? saleTimestamp : undefined,
            creationTimestamp: saleTimestamp, paidToBranchId: split.paidToBranchId,
            paidToAccountId: split.paidToAccountId, referenceNumber: split.referenceNumber,
          };
          paymentsToCreate.push(payment);
          if (payment.status === 'verificado') {
            updateGlobalSaleDataAndFinances(payment, 'add');
          }
        }
      });
    }

    if (totalInvoiceAmount < 0) {
      const creditNotePayment: Payment = {
        id: `PAY-CN-${saleId}`, parentPaymentId: parentId, customerId: newSelectedCustomerId,
        customerName: newSaleEntry.customerName || 'Desconocido', paymentDate: newSaleEntry.date,
        amountPaidInput: Math.abs(totalInvoiceAmount), currencyPaidInput: 'USD',
        amountAppliedToDebtUSD: Math.abs(totalInvoiceAmount), paymentMethod: 'Nota de Crédito',
        status: 'verificado', appliedToInvoiceId: creditNoteTargetInvoiceId, paymentSource: 'invoice',
        verifiedBy: 'Sistema', verificationDate: saleTimestamp, creationTimestamp: saleTimestamp,
        paidToBranchId: newSaleEntry.itemsPerBranch[0]?.branchId || availableBranches[0]?.id || '', // Heurística
        paidToAccountId: 'usdCash', notes: `Aplicado desde NC: ${saleId}`
      };
      paymentsToCreate.push(creditNotePayment);
      updateGlobalSaleDataAndFinances(creditNotePayment, 'add');
    }

    if (paymentsToCreate.length > 0) {
      let allPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
      allPayments.push(...paymentsToCreate);
      savePaymentsData(allPayments);
    }

    toast({ title: totalInvoiceAmount < 0 ? "Nota de Crédito Creada" : "Venta Registrada", description: `La operación se ha registrado exitosamente.` });

    // Registrar auditoría
    logCreate(
      'ventas',
      'sale',
      saleId,
      { sale: newSaleEntry },
      `Venta registrada para ${newSaleEntry.customerName}: $${totalInvoiceAmount.toFixed(2)}`,
      newSaleEntry.itemsPerBranch[0]?.branchId
    );

    setIsAddSaleDialogOpen(false); setIsSubmitting(false);
  };


  const handleOpenEditDialog = (sale: Sale) => {
    setEditingSale(sale);
    setOriginalSaleForEdit(JSON.parse(JSON.stringify(sale)));
    setIsEditSaleDialogOpen(true);
  };

  const handleUpdateSale = async (saleData: any) => {
    if (!editingSale || !originalSaleForEdit) return;
    setIsSubmitting(true);

    const {
      date: editSaleDate,
      customerId: editSelectedCustomerId,
      items: editSaleItems,
      changes: editSaleChanges,
      samples: editSampleItems,
      paymentMethod: editPaymentMethod,
      paymentSplits: editPaymentSplits,
      notes: editSaleNotes
    } = saleData;

    const validSaleItems = editSaleItems.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.unitPrice >= 0 && item.sourceBranchId);
    const validChangeItems = editSaleChanges.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.unitPrice >= 0 && item.sourceBranchId);
    const validSampleItems = editSampleItems.filter((item: SaleItem) => item.productId && item.quantity > 0 && item.sourceBranchId);

    if (!editSaleDate || !editSelectedCustomerId) {
      toast({ title: "Error de Validación", description: "Fecha y cliente son obligatorios.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    // Primero, revertir los efectos de la venta original
    const stockRevertResult = validateAndUpdateStock([], [], [], true, originalSaleForEdit);
    if (!stockRevertResult.success) {
      toast({ title: "Error Crítico", description: "No se pudo revertir el stock de la venta original. La edición ha sido cancelada para prevenir inconsistencias.", variant: "destructive", duration: 8000 });
      setIsSubmitting(false); return;
    }

    // Borrar pagos y transferencias asociadas a la venta original
    let currentPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
    const paymentsForOriginalSale = currentPayments.filter(p => p.appliedToInvoiceId === originalSaleForEdit.id);
    paymentsForOriginalSale.forEach(p => {
      if (p.status === 'verificado') {
        updateGlobalSaleDataAndFinances(p, 'subtract');
      }
    });
    currentPayments = currentPayments.filter(p => p.appliedToInvoiceId !== originalSaleForEdit.id);
    savePaymentsData(currentPayments);

    // Ahora aplicar los nuevos cambios
    const stockValidationResult = validateAndUpdateStock(validSaleItems, validChangeItems, validSampleItems, false);
    if (!stockValidationResult.success) {
      // Re-aplicar el stock de la venta original si la nueva validación falla
      validateAndUpdateStock(
        originalSaleForEdit.itemsPerBranch.flatMap(bd => bd.items),
        originalSaleForEdit.changes || [],
        originalSaleForEdit.samples || [],
        false
      );
      toast({ title: "Error de Stock", description: "No se pudo actualizar el stock con los nuevos datos de la venta. Cambios revertidos.", variant: "destructive" });
      setIsSubmitting(false); return;
    }

    const totalInvoiceAmount = calculateTotalAmount(validSaleItems, validChangeItems);

    const updatedSaleEntry: Sale = {
      ...originalSaleForEdit,
      date: format(editSaleDate, "yyyy-MM-dd"),
      itemsPerBranch: stockValidationResult.itemsPerBranch,
      changes: validChangeItems.length > 0 ? validChangeItems : undefined,
      samples: validSampleItems.length > 0 ? validSampleItems.map((s: any) => ({ ...s, unitPrice: 0, subtotal: 0 })) : undefined,
      customerId: editSelectedCustomerId,
      customerName: availableCustomers.find(c => c.id === editSelectedCustomerId)?.name || 'Desconocido',
      totalAmount: totalInvoiceAmount,
      paymentMethod: editPaymentMethod,
      dueDate: (editPaymentMethod === 'Crédito' && totalInvoiceAmount > 0) ? format(addDays(editSaleDate, 7), "yyyy-MM-dd") : undefined,
      amountPaidUSD: 0, // Se recalculará con los nuevos pagos
      notes: editSaleNotes ? editSaleNotes.trim() : undefined,
      timestamp: new Date().toISOString(), // Actualizar el timestamp
    };

    // Guardar la venta actualizada
    let currentSales = loadFromLocalStorage<Sale[]>(KEYS.SALES);
    currentSales = currentSales.filter(s => s.id !== originalSaleForEdit.id);
    currentSales.push(updatedSaleEntry);
    saveSalesData(currentSales.sort((a, b) => compareDesc(parseISO(a.timestamp || a.date), parseISO(b.timestamp || b.date))));

    // Procesar nuevos pagos si existen
    // Procesar nuevos pagos si existen
    // Validar referencias de pagos antes de crear (Similar a handleAddSale)
    if (editPaymentMethod === 'Pagado' && totalInvoiceAmount > 0) {
      for (const split of editPaymentSplits) {
        if (split.amount > 0 && (split.paymentMethod === 'Pago Móvil' || split.paymentMethod === 'Transferencia')) {
          if (!split.referenceNumber) {
            toast({
              title: "Referencia Requerida",
              description: `El método ${split.paymentMethod} requiere número de referencia`,
              variant: "destructive"
            });
            setIsSubmitting(false);
            return;
          }

          if (!validateReferenceFormat(split.referenceNumber)) {
            toast({
              title: "Formato Inválido",
              description: "La referencia debe tener exactamente 6 dígitos numéricos",
              variant: "destructive"
            });
            setIsSubmitting(false);
            return;
          }

          const duplicateCheck = checkDuplicateReference(split.referenceNumber, `PAY-SALE-EDIT-${updatedSaleEntry.id}-*`);
          if (duplicateCheck.exists) {
            toast({
              title: "Referencia Duplicada",
              description: `Esta referencia ya fue usada el ${duplicateCheck.existingPayment?.paymentDate}`,
              variant: "destructive",
              duration: 6000
            });
            setIsSubmitting(false);
            return;
          }
        }
      }
    }

    // Procesar nuevos pagos si existen
    if (editPaymentMethod === 'Pagado' && totalInvoiceAmount > 0) {
      const paymentsToCreate: Payment[] = [];
      const parentId = `PAY-P-EDIT-${updatedSaleEntry.id.slice(-6)}`;
      editPaymentSplits.forEach((split: PaymentSplit, index: number) => {
        if (split.amount > 0) {
          const rate = split.currency === 'VES' ? (split.exchangeRateAtPayment || exchangeRate || 1) : 1;
          const amountInUSD = split.currency === 'USD' ? split.amount : (rate > 0 ? split.amount / rate : 0);
          const isVerified = split.paymentMethod === 'Efectivo USD' || split.paymentMethod === 'Efectivo VES';
          const payment = {
            id: `PAY-SALE-EDIT-${updatedSaleEntry.id}-${index}`, parentPaymentId: parentId, customerId: editSelectedCustomerId,
            customerName: updatedSaleEntry.customerName || 'Desconocido', paymentDate: updatedSaleEntry.date,
            amountPaidInput: split.amount, currencyPaidInput: split.currency,
            exchangeRateAtPayment: split.exchangeRateAtPayment, amountAppliedToDebtUSD: amountInUSD,
            paymentMethod: split.paymentMethod, status: isVerified ? 'verificado' : 'pendiente de verificación' as Payment['status'],
            appliedToInvoiceId: updatedSaleEntry.id, paymentSource: 'invoice' as Payment['paymentSource'],
            verifiedBy: isVerified ? userProfileData.fullName : undefined,
            verificationDate: isVerified ? updatedSaleEntry.timestamp : undefined,
            creationTimestamp: updatedSaleEntry.timestamp, paidToBranchId: split.paidToBranchId,
            paidToAccountId: split.paidToAccountId, referenceNumber: split.referenceNumber,
          };
          paymentsToCreate.push(payment);
          if (payment.status === 'verificado') {
            updateGlobalSaleDataAndFinances(payment, 'add');
          }
        }
      });
      if (paymentsToCreate.length > 0) {
        let allPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
        allPayments.push(...paymentsToCreate);
        savePaymentsData(allPayments);
      }
    } else if (totalInvoiceAmount < 0) {
      // Manejo de Nota de Crédito en Edición
      const parentId = `PAY-P-EDIT-${updatedSaleEntry.id.slice(-6)}`;
      const creditNotePayment: Payment = {
        id: `PAY-CN-EDIT-${updatedSaleEntry.id}`, parentPaymentId: parentId, customerId: editSelectedCustomerId,
        customerName: updatedSaleEntry.customerName || 'Desconocido', paymentDate: updatedSaleEntry.date,
        amountPaidInput: Math.abs(totalInvoiceAmount), currencyPaidInput: 'USD',
        amountAppliedToDebtUSD: Math.abs(totalInvoiceAmount), paymentMethod: 'Nota de Crédito',
        status: 'verificado', appliedToInvoiceId: saleData.creditNoteTargetInvoiceId, paymentSource: 'invoice',
        verifiedBy: 'Sistema', verificationDate: updatedSaleEntry.timestamp, creationTimestamp: updatedSaleEntry.timestamp,
        paidToBranchId: updatedSaleEntry.itemsPerBranch[0]?.branchId || availableBranches[0]?.id || '',
        paidToAccountId: 'usdCash', notes: `Aplicado desde NC (Edición): ${updatedSaleEntry.id}`
      };

      let allPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
      allPayments.push(creditNotePayment);
      savePaymentsData(allPayments);

      updateGlobalSaleDataAndFinances(creditNotePayment, 'add');
    }

    toast({ title: "Venta Actualizada", description: "La venta ha sido modificada y los datos actualizados." });

    // Registrar auditoría
    logUpdate(
      'ventas',
      'sale',
      updatedSaleEntry.id,
      { before: originalSaleForEdit, after: updatedSaleEntry },
      `Venta actualizada para ${updatedSaleEntry.customerName}`,
      updatedSaleEntry.itemsPerBranch[0]?.branchId
    );

    setIsEditSaleDialogOpen(false);
    setEditingSale(null);
    setOriginalSaleForEdit(null);
    setIsSubmitting(false);
  };


  const handleOpenDeleteDialog = (saleId: string) => { setSaleToDeleteId(saleId); setIsDeleteConfirmDialogOpen(true); };

  const handleConfirmDelete = () => {
    if (!saleToDeleteId) return;
    setIsSubmitting(true);

    const saleToDelete = allSales.find(s => s.id === saleToDeleteId);
    if (!saleToDelete) {
      toast({ title: "Error", description: "No se pudo encontrar la venta para eliminar.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    // Special handling for credit notes
    if (saleToDelete.totalAmount < 0) {
      const correspondingPayment = initialPaymentsDataGlobal.find(p => p.paymentMethod === 'Nota de Crédito' && p.notes?.includes(saleToDelete.id));
      if (correspondingPayment) {
        updateGlobalSaleDataAndFinances(correspondingPayment, 'subtract'); // Revert the credit application
        let currentPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
        currentPayments = currentPayments.filter(p => p.id !== correspondingPayment.id);
        savePaymentsData(currentPayments);
      }
    } else {
      // Revertir el stock para ventas normales
      const stockRevertResult = validateAndUpdateStock([], [], [], true, saleToDelete);
      if (!stockRevertResult.success) {
        toast({ title: "Error Crítico de Stock", description: "No se pudo revertir el stock. La eliminación ha sido cancelada.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      // Revertir los pagos y sus efectos financieros
      let currentPayments = loadFromLocalStorage<Payment[]>(KEYS.PAYMENTS);
      const paymentsForSale = currentPayments.filter(p => p.appliedToInvoiceId === saleToDelete.id);

      paymentsForSale.forEach(p => {
        if (p.status === 'verificado') {
          updateGlobalSaleDataAndFinances(p, 'subtract');
        }
      });

      const paymentIdsToDelete = new Set(paymentsForSale.map(p => p.id));
      const updatedPayments = currentPayments.filter(p => !paymentIdsToDelete.has(p.id));
      savePaymentsData(updatedPayments);
    }

    // 3. Eliminar la venta (sea normal o nota de crédito)
    const updatedSales = allSales.filter(s => s.id !== saleToDeleteId);
    saveSalesData(updatedSales);

    toast({ title: "Operación Eliminada", description: "La venta o nota de crédito y sus transacciones asociadas han sido eliminadas." });

    // Registrar auditoría
    logDelete(
      'ventas',
      'sale',
      saleToDeleteId,
      `Venta eliminada para ${saleToDelete.customerName}: $${saleToDelete.totalAmount.toFixed(2)}`,
      saleToDelete.itemsPerBranch[0]?.branchId
    );

    setSaleToDeleteId(null);
    setIsDeleteConfirmDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleOpenViewDialog = (sale: Sale) => {
    setSaleToViewDetails(sale);
    setIsViewSaleDialogOpen(true);
  };

  const renderItemsTable = (items: SaleItem[] | undefined, type: 'items' | 'changes' | 'samples' | 'branchDetail') => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className="font-semibold mb-2 capitalize">{type === 'branchDetail' ? 'Detalle por Sede' : type}</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.productName}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right"><FormattedNumber value={item.unitPrice} prefix="$" /></TableCell>
                <TableCell className="text-right"><FormattedNumber value={item.subtotal || 0} prefix="$" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const generateInvoicePDF = (sale: Sale) => {
    const doc = new jsPDF();
    doc.text(`Factura #${sale.id}`, 10, 10);
    doc.text(`Cliente: ${sale.customerName}`, 10, 20);
    doc.text(`Fecha: ${sale.date}`, 10, 30);

    const items = sale.itemsPerBranch.flatMap(bd => bd.items).map(item => [
      item.productName,
      item.quantity.toString(),
      `$${item.unitPrice.toFixed(2)}`,
      `$${(item.subtotal || 0).toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [['Producto', 'Cant.', 'Precio', 'Subtotal']],
      body: items,
      startY: 40,
    });

    doc.text(`Total: $${sale.totalAmount.toFixed(2)}`, 10, (doc as any).lastAutoTable.finalY + 10);
    doc.save(`factura-${sale.id}.pdf`);
  };

  const handleAnalyzeDispatch = async () => {
    if (!dispatchText.trim()) {
      toast({ title: 'Entrada Vacía', description: 'Por favor, pega el texto del despacho.', variant: 'destructive' });
      return;
    }
    setIsAnalyzingDispatch(true);
    setAnalyzedDispatchData(null);
    try {
      const allProductNames = loadAllProductsFromAllBranches().map(p => p.name);
      const allCustomerNames = loadFromLocalStorage<Customer[]>(KEYS.CUSTOMERS).map(c => c.name);

      const input: ProcessDispatchInput = {
        dispatchText,
        availableCustomers: allCustomerNames,
        availableProducts: allProductNames
      };

      const result = await processDispatch(input);
      setAnalyzedDispatchData(result);
      toast({ title: 'Análisis Completado', description: result.analysisNotes || 'Revisa los resultados.' });

    } catch (error) {
      console.error("Error analyzing dispatch:", error);
      toast({ title: 'Error de Análisis', description: 'No se pudo procesar el despacho. Revisa el texto o inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setIsAnalyzingDispatch(false);
    }
  };

  const handleSaveAllAnalyzedSales = async () => {
    if (!analyzedDispatchData || !analyzedDispatchData.sales || analyzedDispatchData.sales.length === 0) {
      toast({ title: 'Sin Datos', description: 'No hay ventas analizadas para registrar.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    const salesToProcess = [...analyzedDispatchData.sales];
    const normalSales = salesToProcess.filter(s => s.items && s.items.length > 0);
    const creditNoteSales = salesToProcess.filter(s => (!s.items || s.items.length === 0) && s.changes && s.changes.length > 0);

    let salesCreatedCount = 0;
    let errorCount = 0;

    for (const analyzedSale of normalSales) {
      const stockValidationItems = (analyzedSale.items || []).map((item: any) => {
        const product = availableProducts.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
        const recipe = allRecipes.find(r => r.name.toLowerCase() === item.productName.toLowerCase());
        return {
          productId: product?.id || recipe?.id || '',
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: recipe?.costPerUnit || product?.unitPrice || 0,
          subtotal: parseFloat(((recipe?.costPerUnit || product?.unitPrice || 0) * item.quantity).toFixed(4)),
          sourceBranchId: product?.sourceBranchId || '',
          sourceBranchName: product?.sourceBranchName || ''
        };
      });

      const stockValidationChanges = (analyzedSale.changes || []).map((item: any) => {
        const product = availableProducts.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
        const recipe = allRecipes.find(r => r.name.toLowerCase() === item.productName.toLowerCase());
        return {
          productId: product?.id || recipe?.id || '',
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: recipe?.costPerUnit || product?.unitPrice || 0,
          subtotal: parseFloat(((recipe?.costPerUnit || product?.unitPrice || 0) * item.quantity).toFixed(4)),
          sourceBranchId: product?.sourceBranchId || '',
          sourceBranchName: product?.sourceBranchName || ''
        };
      });

      const { success, itemsPerBranch } = validateAndUpdateStock(stockValidationItems, stockValidationChanges, [], false);
      if (!success) { errorCount++; continue; }
      const customer = availableCustomers.find(c => c.name === analyzedSale.customerName);
      if (!customer) { errorCount++; continue; }

      const newSale: Sale = {
        id: `SALE-AI-${Date.now().toString().slice(-4)}-${salesCreatedCount}`,
        date: analyzedDispatchData.dispatchDate || format(new Date(), 'yyyy-MM-dd'),
        itemsPerBranch: itemsPerBranch,
        changes: stockValidationChanges.length > 0 ? stockValidationChanges : undefined,
        customerId: customer.id,
        customerName: customer.name,
        totalAmount: calculateTotalAmount(stockValidationItems, stockValidationChanges),
        paymentMethod: 'Crédito',
        dueDate: format(addDays(parseISO(analyzedDispatchData.dispatchDate || format(new Date(), 'yyyy-MM-dd')), 7), "yyyy-MM-dd"),
        amountPaidUSD: 0,
        timestamp: new Date().toISOString(),
        notes: `Venta generada por IA desde despacho. ${analyzedSale.notes || ''}`.trim(),
      };

      let currentSales = loadFromLocalStorage<Sale[]>(KEYS.SALES);
      currentSales.push(newSale);
      saveSalesData(currentSales.sort((a, b) => compareDesc(parseISO(a.timestamp || a.date), parseISO(b.timestamp || b.date))));
      salesCreatedCount++;
    }

    if (creditNoteSales.length > 0) {
      const creditNotesToQueue = creditNoteSales.map(cn => {
        const customerForCreditNote = availableCustomers.find(c => c.name === cn.customerName);
        const changeItemsForCreditNote: SaleItem[] = (cn.changes || []).map((item: any) => {
          const product = availableProducts.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
          const recipe = allRecipes.find(r => r.name.toLowerCase() === item.productName.toLowerCase());
          return {
            productId: product?.id || recipe?.id || '',
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: recipe?.costPerUnit || product?.unitPrice || 0,
            subtotal: parseFloat(((recipe?.costPerUnit || product?.unitPrice || 0) * item.quantity).toFixed(4)),
            sourceBranchId: product?.sourceBranchId || '',
            sourceBranchName: product?.sourceBranchName || ''
          };
        });
        return {
          customerId: customerForCreditNote?.id || '',
          changes: changeItemsForCreditNote,
        };
      }).filter(cn => cn.customerId);

      if (creditNotesToQueue.length > 0) {
        setCreditNotesQueue(creditNotesToQueue);
      }
    }

    let finalMessage = '';
    if (salesCreatedCount > 0) finalMessage += `${salesCreatedCount} ventas registradas como 'Crédito'. `;
    if (creditNoteSales.length > 0 && finalMessage) finalMessage += " ";
    if (creditNoteSales.length > 0) finalMessage += `Ahora, por favor, gestiona la primera de ${creditNoteSales.length} nota(s) de crédito detectada(s).`;
    if (errorCount > 0) {
      toast({ title: 'Algunas Ventas Fallaron', description: `${errorCount} ventas no pudieron ser procesadas. Revísalas y regístralas manualmente.`, variant: 'destructive', duration: 9000 });
    }
    if (finalMessage) {
      toast({ title: 'Proceso de Despacho', description: finalMessage, duration: 9000 });
    }

    setIsAiDispatchDialogOpen(false);
    setDispatchText('');
    setAnalyzedDispatchData(null);
    setIsSubmitting(false);
  };

  if (isLoading && availableProducts.length === 0) {
    return (<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Cargando...</p></div>);
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader title="Gestión de Ventas (Global)" description="Registra y gestiona ventas. Puedes incluir productos de múltiples sedes. Si una venta pagada es multi-sede, el ingreso se registra en la sede seleccionada y se generan transferencias de fondos pendientes." icon={ShoppingCart}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsCreditNotesDialogOpen(true)} className="mr-2">
              <InvoiceIcon className="mr-2 h-4 w-4" />
              Ver Notas de Crédito
            </Button>
            <Button onClick={() => { resetAddForm(); setIsAddSaleDialogOpen(true); }} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Nueva Venta</Button>
          </>
        } />
      <Card className="shadow-lg">
        <CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><CardTitle>Historial de Ventas (Global)</CardTitle><CardDescription>Resumen de ventas globales.</CardDescription></div><div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto"><Popover><PopoverTrigger asChild><Button id="date-filter-sales" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !dateRangeFilter && "text-muted-foreground")} disabled={isSubmitting || isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{dateRangeFilter?.from ? (dateRangeFilter.to ? (<>{format(dateRangeFilter.from, "LLL dd, y", { locale: es })} - {format(dateRangeFilter.to, "LLL dd, y", { locale: es })}</>) : (format(dateRangeFilter.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar Fecha</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={dateRangeFilter?.from} selected={dateRangeFilter} onSelect={setDateRangeFilter} numberOfMonths={2} locale={es} /></PopoverContent></Popover><Select value={filterCustomerId} onValueChange={setFilterCustomerId} disabled={isSubmitting || isLoading}><SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar Cliente" /></SelectTrigger><SelectContent><SelectItem value={ALL_CUSTOMERS_FILTER_VALUE}>Todos Clientes</SelectItem>{availableCustomers.sort((a, b) => a.name.localeCompare(b.name)).map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>))}</SelectContent></Select><Select value={filterSaleStatus} onValueChange={setFilterSaleStatus} disabled={isSubmitting || isLoading}><SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar Estado" /></SelectTrigger><SelectContent><SelectItem value={ALL_STATUSES_FILTER_VALUE}>Todos Estados</SelectItem>{saleStatusOptions.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select><Button onClick={handleApplyFilters} className="w-full sm:w-auto" disabled={isSubmitting || isLoading}><Filter className="mr-2 h-4 w-4" /> Aplicar</Button><Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto" disabled={isSubmitting || isLoading}>Limpiar</Button></div></div></CardHeader>
        <CardContent>
          <div className="h-[600px]">
            <VirtualizedList
              data={filteredSales}
              itemHeight={70}
              header={
                <div className="grid grid-cols-[100px_minmax(150px,1fr)_100px_100px_120px_120px_100px_112px] gap-4 p-4 text-sm font-medium text-muted-foreground">
                  <div>Fecha/Hora</div>
                  <div>Cliente</div>
                  <div className="text-right">Total (USD)</div>
                  <div className="text-right">Total (VES)</div>
                  <div>Método Pago</div>
                  <div>Estado</div>
                  <div>Vence</div>
                  <div className="text-right">Acciones</div>
                </div>
              }
              renderRow={(sale: Sale, style: React.CSSProperties) => {
                const status = getInvoiceStatus(sale, initialPaymentsDataGlobal);
                return (
                  <div style={style} className={cn("flex items-center border-b transition-colors", status === 'Vencida' ? 'bg-destructive/10 hover:bg-destructive/15' : 'hover:bg-muted/20')}>
                    <div className="grid grid-cols-[100px_minmax(150px,1fr)_100px_100px_120px_120px_100px_112px] gap-4 p-2 w-full items-center">
                      <div className="text-sm">
                        {sale.date ? format(parseISO(sale.date), "dd/MM/yy", { locale: es }) : '-'}
                        {sale.timestamp && isValid(parseISO(sale.timestamp)) && (
                          <span className="block text-xs text-muted-foreground">{format(parseISO(sale.timestamp), "hh:mm a", { locale: es })}</span>
                        )}
                      </div>
                      <div className="truncate font-medium" title={sale.customerName}>{sale.customerName}</div>
                      <div className="text-right font-mono"><FormattedNumber value={sale.totalAmount} prefix="$" /></div>
                      <div className="text-right font-mono text-muted-foreground"><FormattedNumber value={exchangeRate > 0 ? sale.totalAmount * exchangeRate : undefined} prefix="Bs. " /></div>
                      <div className="truncate text-sm" title={sale.paymentMethod}>{sale.paymentMethod}</div>
                      <div>
                        <Badge variant={status === 'Completada' ? 'default' : status === 'Vencida' ? 'destructive' : 'secondary'} className={cn("whitespace-nowrap text-xs", status === 'Vencida' ? 'bg-red-500/80 text-white dark:bg-red-700/80 dark:text-red-100 border-red-700/50' : status === 'Pendiente de Pago' ? 'bg-yellow-500/80 text-black dark:bg-yellow-600/80 dark:text-yellow-100 border-yellow-600/50' : status === 'Pagada Parcialmente' ? 'bg-orange-500/80 text-white dark:bg-orange-600/80 dark:text-orange-100 border-orange-600/50' : status === 'Completada' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : '')}>{status}</Badge>
                      </div>
                      <div className="text-sm">{sale.dueDate ? format(parseISO(sale.dueDate), "dd/MM/yy", { locale: es }) : '-'}</div>
                      <div className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenViewDialog(sale)} title="Ver Factura" disabled={isSubmitting} className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <SendInvoiceButton
                            phoneNumber={availableCustomers.find(c => c.id === sale.customerId)?.contact || ''}
                            invoiceData={{
                              invoiceNumber: sale.id,
                              customerName: sale.customerName || 'Desconocido',
                              date: sale.date,
                              totalAmount: sale.totalAmount,
                              items: sale.itemsPerBranch.flatMap(bd => bd.items).map(item => ({
                                productName: item.productName,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                subtotal: item.subtotal
                              }))
                            }}
                            variant="ghost"
                            size="icon"
                            className={cn("h-8 w-8", availableCustomers.find(c => c.id === sale.customerId)?.contact ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-muted-foreground opacity-50")}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting} title="Más Acciones" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEditDialog(sale)} disabled={isSubmitting}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSaleToDeleteId(sale.id); setIsDeleteConfirmDialogOpen(true); }} className="text-destructive focus:text-destructive-foreground focus:bg-destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Dialog */}
      <Dialog open={isCreditNotesDialogOpen} onOpenChange={setIsCreditNotesDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mr-8">
              <div>
                <DialogTitle>Historial de Notas de Crédito</DialogTitle>
                <DialogDescription>
                  Consulta las notas de crédito generadas y aplicadas.
                </DialogDescription>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal", !creditNotesDateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {creditNotesDateRange?.from ? (
                      creditNotesDateRange.to ? (
                        <>{format(creditNotesDateRange.from, "dd/MM/yy", { locale: es })} - {format(creditNotesDateRange.to, "dd/MM/yy", { locale: es })}</>
                      ) : (
                        format(creditNotesDateRange.from, "dd/MM/yy", { locale: es })
                      )
                    ) : (
                      <span>Filtrar por Fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={creditNotesDateRange?.from}
                    selected={creditNotesDateRange}
                    onSelect={setCreditNotesDateRange}
                    numberOfMonths={2}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </DialogHeader>

          <Tabs defaultValue="generated" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="generated">Notas Generadas (Devoluciones)</TabsTrigger>
              <TabsTrigger value="applied">Notas Aplicadas (Pagos)</TabsTrigger>
            </TabsList>

            <TabsContent value="generated" className="flex-1 overflow-auto p-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>ID Nota</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Factura Origen</TableHead>
                    <TableHead className="text-right">Monto (USD)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSales
                    .filter(s => {
                      if (s.totalAmount >= 0) return false;
                      if (!creditNotesDateRange?.from) return true;
                      const date = parseISO(s.date);
                      if (creditNotesDateRange.to) {
                        return isWithinInterval(date, { start: startOfDay(creditNotesDateRange.from), end: endOfDay(creditNotesDateRange.to) });
                      }
                      return isWithinInterval(date, { start: startOfDay(creditNotesDateRange.from), end: endOfDay(creditNotesDateRange.from) });
                    })
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(nc => (
                      <TableRow key={nc.id}>
                        <TableCell>{format(parseISO(nc.date), "dd/MM/yy", { locale: es })}</TableCell>
                        <TableCell className="font-mono text-xs">{nc.id}</TableCell>
                        <TableCell>{nc.customerName}</TableCell>
                        <TableCell className="font-mono text-xs">{nc.creditNoteTargetInvoiceId || '-'}</TableCell>
                        <TableCell className="text-right text-destructive font-bold">
                          <FormattedNumber value={nc.totalAmount} prefix="$" />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{nc.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenViewDialog(nc)} title="Ver Detalles">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {allSales.filter(s => s.totalAmount < 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay notas de crédito generadas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="applied" className="flex-1 overflow-auto p-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha Aplicación</TableHead>
                    <TableHead>ID Pago</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Factura Destino</TableHead>
                    <TableHead>Referencia (NC ID)</TableHead>
                    <TableHead className="text-right">Monto Aplicado (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialPaymentsDataGlobal
                    .filter(p => {
                      if (p.paymentMethod !== 'Nota de Crédito') return false;
                      if (!creditNotesDateRange?.from) return true;
                      const date = parseISO(p.paymentDate);
                      if (creditNotesDateRange.to) {
                        return isWithinInterval(date, { start: startOfDay(creditNotesDateRange.from), end: endOfDay(creditNotesDateRange.to) });
                      }
                      return isWithinInterval(date, { start: startOfDay(creditNotesDateRange.from), end: endOfDay(creditNotesDateRange.from) });
                    })
                    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                    .map(payment => {
                      const customer = availableCustomers.find(c => c.id === payment.customerId);
                      const ncId = payment.notes?.split(': ')[1] || '-';
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{format(parseISO(payment.paymentDate), "dd/MM/yy", { locale: es })}</TableCell>
                          <TableCell className="font-mono text-xs">{payment.id.slice(0, 8)}...</TableCell>
                          <TableCell>{customer?.name || 'Desconocido'}</TableCell>
                          <TableCell className="font-mono text-xs">{payment.appliedToInvoiceId || 'Saldo a Favor'}</TableCell>
                          <TableCell className="font-mono text-xs">{ncId}</TableCell>
                          <TableCell className="text-right text-green-600 font-bold">
                            <FormattedNumber value={payment.amountAppliedToDebtUSD} prefix="$" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {initialPaymentsDataGlobal.filter(p => p.paymentMethod === 'Nota de Crédito').length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No hay notas de crédito aplicadas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setIsCreditNotesDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAiDispatchDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsAiDispatchDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-4xl lg:max-w-7xl">
          <DialogHeader>
            <DialogTitle className="flex items-center"><Bot className="mr-2 h-6 w-6" /> Cargar Despacho Diario con IA</DialogTitle>
            <DialogDescription>Pega el texto completo de tu despacho del día. La IA lo analizará y preparará las ventas para que las registres.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <Label htmlFor="dispatch-text-area">Texto del Despacho</Label>
              <Textarea id="dispatch-text-area" value={dispatchText} onChange={(e) => setDispatchText(e.target.value)} rows={20} placeholder="Pega aquí el texto del despacho..." disabled={isAnalyzingDispatch || isSubmitting} />
              <Button onClick={handleAnalyzeDispatch} disabled={isAnalyzingDispatch || isSubmitting || !dispatchText.trim()} className="w-full">
                {isAnalyzingDispatch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                {isAnalyzingDispatch ? 'Analizando...' : 'Analizar Despacho'}
              </Button>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Resultados del Análisis</h3>
              {analyzedDispatchData ? (
                <div className="border p-4 rounded-md h-full">
                  <p className="text-sm text-muted-foreground mb-2">Día del despacho detectado: {analyzedDispatchData.dispatchDate ? format(parseISO(analyzedDispatchData.dispatchDate), 'dd/MM/yyyy', { locale: es }) : 'No detectada'}</p>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead><TableHead>Items Vendidos</TableHead><TableHead>Cambios/Devoluciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyzedDispatchData.sales.map((sale: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium align-top">{sale.customerName}</TableCell>
                            <TableCell className="text-xs align-top">
                              <ul className="list-disc list-inside">{sale.items?.map((item: any, i: number) => <li key={i}>{item.quantity} x {item.productName}</li>)}</ul>
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              {sale.changes && sale.changes.length > 0 ? (
                                <ul className="list-disc list-inside text-destructive">{sale.changes?.map((item: any, i: number) => <li key={i}>{item.quantity} x {item.productName}</li>)}</ul>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">{analyzedDispatchData.analysisNotes}</p>
                </div>
              ) : (
                <div className="border border-dashed rounded-md h-full flex items-center justify-center bg-muted/50">
                  <p className="text-muted-foreground">Los resultados aparecerán aquí.</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button onClick={handleSaveAllAnalyzedSales} disabled={!analyzedDispatchData || isSubmitting || isAnalyzingDispatch}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Registrar Todas las Ventas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isViewSaleDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsViewSaleDialogOpen(isOpen); if (!isOpen) setSaleToViewDetails(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalles de Venta: {saleToViewDetails?.id}</DialogTitle>
            <DialogDescription>Info completa.</DialogDescription>
          </DialogHeader>
          {saleToViewDetails && (
            <>
              <ScrollArea className="max-h-[calc(70vh-100px)] p-1 pr-3">
                <div className="space-y-3 py-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-semibold">Cliente:</span> {saleToViewDetails.customerName}</div>
                    <div><span className="font-semibold">Fecha:</span> {saleToViewDetails.date ? format(parseISO(saleToViewDetails.date), "dd/MM/yyyy", { locale: es }) : '-'} {saleToViewDetails.timestamp && isValid(parseISO(saleToViewDetails.timestamp)) ? format(parseISO(saleToViewDetails.timestamp), "hh:mm a", { locale: es }) : ''}</div>
                    <div><span className="font-semibold">Método Pago Global:</span> {saleToViewDetails.paymentMethod}</div>
                    <div><span className="font-semibold">Estado:</span> <Badge variant={getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Completada' ? 'default' : getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Vencida' ? 'destructive' : 'secondary'} className={cn("whitespace-nowrap", getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Vencida' ? 'bg-red-500/80 text-white dark:bg-red-700/80 dark:text-red-100 border-red-700/50' : getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Pendiente de Pago' ? 'bg-yellow-500/80 text-black dark:bg-yellow-600/80 dark:text-yellow-100 border-yellow-600/50' : getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Pagada Parcialmente' ? 'bg-orange-500/80 text-white dark:bg-orange-600/80 dark:text-orange-100 border-orange-600/50' : getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal) === 'Completada' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : '')}>{getInvoiceStatus(saleToViewDetails, initialPaymentsDataGlobal)}</Badge></div>
                    {saleToViewDetails.dueDate && <div><span className="font-semibold">Vence:</span> {format(parseISO(saleToViewDetails.dueDate), "dd/MM/yyyy", { locale: es })}</div>}
                  </div>
                  {saleToViewDetails.notes && (
                    <div className="pt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Observaciones:</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md border">{saleToViewDetails.notes}</p>
                    </div>
                  )}
                  {saleToViewDetails.paymentMethod === 'Pagado' && saleToViewDetails.paymentSplits && saleToViewDetails.paymentSplits.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Desglose de Pagos:</p>
                      {saleToViewDetails.paymentSplits.map(split => (
                        <div key={split.id} className="text-xs text-muted-foreground/90 pl-2">
                          - {split.paymentMethod}: <FormattedNumber value={split.amount} prefix={split.currency === 'USD' ? '$' : 'Bs. '} />
                          {split.currency === 'VES' && split.exchangeRateAtPayment && ` (Tasa: ${split.exchangeRateAtPayment.toFixed(2)})`}
                          , Sede: {availableBranches.find(b => b.id === split.paidToBranchId)?.name || 'N/A'}
                          , Cta: {accountTypeNames[split.paidToAccountId]}
                          {split.referenceNumber && `, Ref: ${split.referenceNumber}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {saleToViewDetails.itemsPerBranch.map(branchDetail => (
                    <div key={`view-branchDetail-${branchDetail.branchId}-${saleToViewDetails.id}`}>{renderItemsTable(branchDetail.items, 'branchDetail')}</div>
                  ))}
                  {renderItemsTable(saleToViewDetails.changes, 'changes')}
                  {renderItemsTable(saleToViewDetails.samples, 'samples')}

                  <Card className="mt-3"><CardContent className="p-3 space-y-1 text-sm"><div className="flex justify-between"><span>Total Bruto (USD):</span><span><FormattedNumber value={calculateItemsSubtotal(saleToViewDetails.itemsPerBranch.flatMap(bd => bd.items))} prefix="$" /></span></div>{saleToViewDetails.changes && saleToViewDetails.changes.some(c => c.productId) && (<div className="flex justify-between text-destructive"><span>(-) Total Cambios (USD):</span><span><FormattedNumber value={calculateItemsSubtotal(saleToViewDetails.changes)} prefix="-$" /></span></div>)}<div className="flex justify-between text-base font-semibold border-t pt-1 mt-1"><span>Total Neto (USD):</span><span><FormattedNumber value={saleToViewDetails.totalAmount} prefix="$" /></span></div></CardContent></Card>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
                <SendInvoiceButton
                  phoneNumber={availableCustomers.find(c => c.id === saleToViewDetails.customerId)?.contact || ''}
                  invoiceData={{
                    invoiceNumber: saleToViewDetails.id,
                    customerName: saleToViewDetails.customerName || 'Desconocido',
                    date: saleToViewDetails.date,
                    totalAmount: saleToViewDetails.totalAmount,
                    items: saleToViewDetails.itemsPerBranch.flatMap(bd => bd.items).map(item => ({
                      productName: item.productName,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      subtotal: item.subtotal
                    }))
                  }}
                  variant="outline"
                  className={cn("border-green-200", availableCustomers.find(c => c.id === saleToViewDetails.customerId)?.contact ? "text-green-700 hover:bg-green-50 hover:text-green-800" : "text-muted-foreground opacity-50")}
                />
                <Button onClick={() => generateInvoicePDF(saleToViewDetails)} disabled={isSubmitting}><InvoiceIcon className="mr-2 h-4 w-4" />Generar PDF</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Sale Dialog */}
      <SaleDialog
        open={isAddSaleDialogOpen}
        onOpenChange={setIsAddSaleDialogOpen}
        mode="new"
        availableProducts={availableProducts}
        availableCustomers={availableCustomers}
        allRecipes={allRecipes}
        exchangeRate={exchangeRate}
        userProfileData={userProfileData}
        availableBranches={availableBranches}
        onSave={handleAddSale}
        initialPaymentsDataGlobal={initialPaymentsDataGlobal}
        allSales={allSales}
      />

      {/* Edit Sale Dialog */}
      <SaleDialog
        open={isEditSaleDialogOpen}
        onOpenChange={setIsEditSaleDialogOpen}
        mode="edit"
        initialData={editingSale}
        availableProducts={availableProducts}
        availableCustomers={availableCustomers}
        allRecipes={allRecipes}
        exchangeRate={exchangeRate}
        userProfileData={userProfileData}
        availableBranches={availableBranches}
        onSave={handleUpdateSale}
        initialPaymentsDataGlobal={initialPaymentsDataGlobal}
        allSales={allSales}
      />
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Eliminar venta? Ajustará stock y datos del cliente. Revertirá pagos/transacciones asociadas.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-end"><DialogClose asChild><Button variant="outline" disabled={isSubmitting} onClick={() => { setSaleToDeleteId(null); setIsDeleteConfirmDialogOpen(false); }}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Eliminar Venta</Button></DialogFooter></DialogContent></Dialog>
    </PageTransition>
  );
}









