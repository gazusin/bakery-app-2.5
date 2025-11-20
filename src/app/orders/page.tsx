

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { Receipt, PlusCircle, MoreHorizontal, Edit, Trash2, Calendar as CalendarIcon, Loader2, Trash, FileText as InvoiceIcon, Filter, Gift, AlertTriangle, Eye, DollarSign, SaveIcon, PackageCheck, Settings, Settings2, ListPlus, XCircle, Search } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, addDays, differenceInDays, isWithinInterval, startOfDay, endOfDay, isValid, compareDesc } from "date-fns";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
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
  paymentsData as initialPaymentsData,
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
  suppliersData as initialSuppliersData,
  getBestPriceInfo,
  getCurrentPriceFromHistory,
  loadCompanyAccountsData,
  type PurchaseOrderStatus,
  savePurchaseOrdersData,
  updateRawMaterialInventoryFromOrder,
  addRawMaterialOption,
  removeRawMaterialOption,
  saveSuppliersData,
  type PriceHistoryEntry,
  type PurchaseOrder,
  type PurchaseOrderItem,
  purchaseOrderStatusList,
  updateSupplierPriceList,
  updateCompanyAccountAndExpensesForPO,
  commonUnitOptions,
  getCurrentRawMaterialOptions,
  loadPurchaseOrdersFromStorage,
  convertMaterialToBaseUnit,
  normalizeUnit,
  type PricePointInfo,
  type Supplier,
  type Recipe
} from '@/lib/data-storage';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ManageConversionsDialog } from '@/components/orders/manage-conversions-dialog';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { processInvoice, type ProcessInvoiceInput, type ProcessInvoiceOutput } from '@/ai/flows/process-invoice-flow';
import type jsPDF from 'jspdf';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

interface PurchaseOrderItemExtended extends PurchaseOrderItem {
  bestPriceHint?: string;
  manualPriceEdit?: boolean;
  unitPriceDisplayUSD: string;
  unitPriceDisplayVES: string;
  priceInputCurrency: 'USD' | 'VES';
}

const ALL_SUPPLIERS_FILTER_VALUE = "__ALL_SUPPLIERS__";


export default function OrdersPage() {
  const { toast } = useToast();
  const [allPurchaseOrders, setAllPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPurchaseOrders, setFilteredPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [currentRawMaterialOptions, setCurrentRawMaterialOptions] = useState<string[]>([]);
  const [currentSuppliers, setCurrentSuppliers] = useState<Supplier[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isPODialogOpen, setIsPODialogOpen] = useState(false);
  const [isEditingPO, setIsEditingPO] = useState(false);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);
  const [currentEditablePOId, setCurrentEditablePOId] = useState<string>('');
  const [originalPOForEdit, setOriginalPOForEdit] = useState<PurchaseOrder | null>(null);

  const [newOrderId, setNewOrderId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [expectedDelivery, setExpectedDelivery] = useState<Date | undefined>(new Date());
  const [currentOrderStatus, setCurrentOrderStatus] = useState<PurchaseOrderStatus>('Pagado');
  const [newPONotes, setNewPONotes] = useState('');
  const [editPONotes, setEditPONotes] = useState('');
  const [editOrderDate, setEditOrderDate] = useState<Date | undefined>(undefined);
  const [editExpectedDelivery, setEditExpectedDelivery] = useState<Date | undefined>(undefined);

  const [isOrderDatePickerOpen, setIsOrderDatePickerOpen] = useState(false);
  const [isDeliveryDatePickerOpen, setIsDeliveryDatePickerOpen] = useState(false);


  const generateUniqueItemId = useCallback((prefix: string, existingIdsInList: string[]): string => {
    let newId;
    let attempt = 0;
    const MAX_ATTEMPTS = 100;
    const generateRandomSuffix = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').substring(0, 22);
      }
      return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36,2,15)).substring(0, 22);
    };

    do {
      const randomSuffix = generateRandomSuffix();
      newId = `${prefix}-${randomSuffix}${attempt > 0 ? `-v${attempt}` : ''}`;
      attempt++;
      if (attempt > MAX_ATTEMPTS) {
        console.warn(`generateUniqueItemId: Max attempts for ${prefix}. Using: ${newId}`);
        break;
      }
    } while (existingIdsInList.includes(newId));
    return newId;
  }, []);


  const [globalOrderItems, setGlobalOrderItems] = useState<PurchaseOrderItemExtended[]>([{ id: generateUniqueItemId('global-item-initial-state', []), rawMaterialName: '', quantity: 0, unit: commonUnitOptions[0] || '', unitPrice: 0, subtotal: 0, bestPriceHint: '', manualPriceEdit: false, unitPriceDisplayUSD: "0", unitPriceDisplayVES: "0.00", priceInputCurrency: 'VES' }]);


  const activeBranchForDefaultSplit = getActiveBranchId();
  const initialBranchIdForDefaultNewSplit = activeBranchForDefaultSplit || (availableBranches.length > 0 ? availableBranches[0].id : '');

  const [newPaymentSplits, setNewPaymentSplits] = useState<PaymentSplit[]>([{
    id: generateUniqueItemId('split-initial-state', []),
    amount: 0,
    currency: 'VES',
    paymentMethod: 'Transferencia (VES)',
    paidToBranchId: initialBranchIdForDefaultNewSplit,
    paidToAccountId: 'vesElectronic',
    items: []
  }]);
  const [editPaymentSplits, setEditPaymentSplits] = useState<PaymentSplit[]>([]);


  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [poToDeleteId, setPoToDeleteId] = useState<string | null>(null);

  const [isManageMaterialsDialogOpen, setIsManageMaterialsDialogOpen] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [isDeleteMaterialConfirmOpen, setIsDeleteMaterialConfirmOpen] = useState(false);

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [filterSupplierId, setFilterSupplierId] = useState<string>(ALL_SUPPLIERS_FILTER_VALUE);
  const [filterOrderId, setFilterOrderId] = useState<string>('');


  const [isViewPODialogOpen, setIsViewPODialogOpen] = useState(false);
  const [poToViewDetails, setPoToViewDetails] = useState<PurchaseOrder | null>(null);

  const [isManageConversionsDialogOpen, setIsManageConversionsDialogOpen] = useState(false);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const handleConversionsUpdated = useCallback(() => {}, []);


  const loadInitialData = useCallback(() => {
    setIsLoading(true);
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Configuración", description: "No se ha seleccionado una sede activa. Por favor, selecciona una sede.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const orders = [...loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchId)].sort((a,b) => {
        const dateA = a.orderDate && isValid(parseISO(a.orderDate)) ? parseISO(a.orderDate).getTime() : 0;
        const dateB = b.orderDate && isValid(parseISO(b.orderDate)) ? parseISO(b.orderDate).getTime() : 0;
        if (dateA === 0 && dateB === 0) return 0;
        if (dateA === 0) return 1;
        if (dateB === 0) return -1;
        return dateB - dateA;
    });
    setAllPurchaseOrders(orders);
    setFilteredPurchaseOrders(orders);

    const materialOptions = getCurrentRawMaterialOptions();
    setCurrentRawMaterialOptions(materialOptions);

    const loadedSuppliers = [...initialSuppliersData];
    setCurrentSuppliers(loadedSuppliers);

    if (loadedSuppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(loadedSuppliers[0].id);
    }

    const rate = loadExchangeRate();
    setExchangeRate(rate);

    const initialBranchIdForPayment = activeBranchId || (availableBranches.length > 0 ? availableBranches[0].id : '');
    setNewPaymentSplits([{
        id: generateUniqueItemId('split-load-init', []),
        amount: 0, currency: 'VES', paymentMethod: 'Transferencia (VES)',
        paidToBranchId: initialBranchIdForPayment, paidToAccountId: 'vesElectronic',
        referenceNumber: '', items: []
    }]);
    
    setGlobalOrderItems([{ 
        id: generateUniqueItemId('global-item-load', []), 
        rawMaterialName: '', quantity: 0, unit: commonUnitOptions[0] || '', 
        unitPrice: 0, subtotal: 0, bestPriceHint: '', manualPriceEdit: false, 
        unitPriceDisplayUSD: "0", unitPriceDisplayVES: "0.00", 
        priceInputCurrency: 'VES' 
    }]);
    
    setIsLoading(false);
  }, [selectedSupplierId, toast, generateUniqueItemId]);


  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);


  const updateItemsForNewSupplier = useCallback((
    currentItems: PurchaseOrderItemExtended[],
    supplierId: string,
    currentGlobalExchangeRate: number
  ): PurchaseOrderItemExtended[] => {
      const supplier = currentSuppliers.find(s => s.id === supplierId);
      if (!supplier) return currentItems;

      const formatVes = (price: number) => (currentGlobalExchangeRate > 0 ? (price * currentGlobalExchangeRate).toFixed(2) : "0.00");

      return currentItems.map(item => {
          if (item.manualPriceEdit || !item.rawMaterialName) return item;

          let newItemData = { ...item };
          const listToUse = item.priceInputCurrency === 'USD' ? supplier.priceListUSDCash : supplier.priceList;
          let newUnitPrice = item.unitPrice;
          let priceFound = false;

          const priceListItem = listToUse?.find(pli => pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit);
          if (priceListItem) {
              const currentPrice = getCurrentPriceFromHistory(priceListItem.priceHistory);
              if (currentPrice) {
                  newUnitPrice = currentPrice.price;
                  priceFound = true;
              }
          }

          if (!priceFound) {
              const otherList = item.priceInputCurrency === 'USD' ? supplier.priceList : supplier.priceListUSDCash;
              const otherPriceItem = otherList?.find(pli => pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit);
              if (otherPriceItem) {
                  const currentPrice = getCurrentPriceFromHistory(otherPriceItem.priceHistory);
                  if (currentPrice) {
                      newUnitPrice = currentPrice.price;
                  }
              }
          }

          newItemData.unitPrice = newUnitPrice;
          newItemData.subtotal = parseFloat(((item.quantity || 0) * newUnitPrice).toFixed(4));
          newItemData.unitPriceDisplayUSD = newUnitPrice.toFixed(4);
          newItemData.unitPriceDisplayVES = formatVes(newUnitPrice);

          return newItemData;
      });
  }, [currentSuppliers]);


  useEffect(() => {
    if (isAnalyzing) return;
    
    const handler = () => {
      if (isEditingPO) {
        const updatedItems = updateItemsForNewSupplier(globalOrderItems, selectedSupplierId, exchangeRate);
        setGlobalOrderItems(updatedItems);
        const updatedSplits = editPaymentSplits.map(split => ({
            ...split,
            items: updateItemsForNewSupplier(split.items || [], selectedSupplierId, exchangeRate)
        }));
        setEditPaymentSplits(updatedSplits);
      } else {
        const updatedItems = updateItemsForNewSupplier(globalOrderItems, selectedSupplierId, exchangeRate);
        setGlobalOrderItems(updatedItems);
        const updatedSplits = newPaymentSplits.map(split => ({
            ...split,
            items: updateItemsForNewSupplier(split.items || [], selectedSupplierId, exchangeRate)
        }));
        setNewPaymentSplits(updatedSplits);
      }
    };

    handler();

  }, [selectedSupplierId, exchangeRate, isAnalyzing]); // Removed dependencies to avoid re-triggering, now it only runs on supplier/rate change.


  useEffect(() => {
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const key = customEvent.detail?.key;
  
      if (key === KEYS.SUPPLIERS) {
        setCurrentSuppliers([...initialSuppliersData]);
      } else if (key === KEYS.RAW_MATERIAL_OPTIONS) {
        setCurrentRawMaterialOptions(getCurrentRawMaterialOptions());
      } else if (key === KEYS.EXCHANGE_RATE || key === KEYS.EXCHANGE_RATE_HISTORY) {
        const dateToUse = isPODialogOpen ? (isEditingPO ? editOrderDate : orderDate) : new Date();
        setExchangeRate(loadExchangeRate(dateToUse));
      } else if (key === KEYS.ACTIVE_BRANCH_ID) {
        loadInitialData();
      } else if (
        !isPODialogOpen &&
        (key === KEYS.PURCHASE_ORDERS ||
         key === KEYS.RAW_MATERIAL_INVENTORY ||
         key === KEYS.COMPANY_ACCOUNTS ||
         key === KEYS.CUSTOM_CONVERSION_RULES)
      ) {
        loadInitialData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [isPODialogOpen, loadInitialData, isEditingPO, orderDate, editOrderDate]);


  useEffect(() => {
    if (isAnalyzing) return;

    const dateToUse = isEditingPO ? editOrderDate : orderDate;
    const currentRate = dateToUse ? loadExchangeRate(dateToUse) : 0;
    if (Math.abs(currentRate - exchangeRate) > 0.0001) {
      setExchangeRate(currentRate);
    }
  }, [
    isAnalyzing,
    isPODialogOpen,
    currentOrderStatus,
    isEditingPO,
    orderDate,
    editOrderDate,
    exchangeRate
  ]);


  const applyFilters = useCallback(() => {
    let filtered = [...allPurchaseOrders];
    
    if (dateRangeFilter?.from) {
      const toDate = dateRangeFilter.to ? endOfDay(dateRangeFilter.to) : endOfDay(dateRangeFilter.from);
      filtered = filtered.filter(po =>
        po.orderDate && isValid(parseISO(po.orderDate)) && isWithinInterval(parseISO(po.orderDate), { start: startOfDay(dateRangeFilter.from!), end: toDate })
      );
    }

    if (filterSupplierId !== ALL_SUPPLIERS_FILTER_VALUE) {
        filtered = filtered.filter(po => po.supplierId === filterSupplierId);
    }
    
    if (filterOrderId.trim() !== '') {
        filtered = filtered.filter(po => po.id.toLowerCase().includes(filterOrderId.trim().toLowerCase()));
    }

    setFilteredPurchaseOrders(filtered);
  }, [allPurchaseOrders, dateRangeFilter, filterSupplierId, filterOrderId]);

  useEffect(() => {
    applyFilters();
  }, [allPurchaseOrders, dateRangeFilter, filterSupplierId, filterOrderId, applyFilters]);


  const calculateItemsTotalCost = useCallback((itemsList: PurchaseOrderItemExtended[]): number => {
    return itemsList.reduce((total, item) => {
        const subtotal = Number(item.subtotal) || 0;
        return total + subtotal;
    }, 0);
  }, []);

  const displayedTotalCost = useMemo(() => {
    if (currentOrderStatus === 'Pagado') {
      const splitsToConsider = isEditingPO ? editPaymentSplits : newPaymentSplits;
      return (splitsToConsider || []).reduce((total, split) => {
        const itemsTotalUSDForSplit = (split.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
        return total + itemsTotalUSDForSplit;
      }, 0);
    }
    return calculateItemsTotalCost(globalOrderItems);
  }, [currentOrderStatus, newPaymentSplits, editPaymentSplits, globalOrderItems, calculateItemsTotalCost, isEditingPO]);


  const resetAddForm = useCallback(() => {
    setNewOrderId('');
    setCurrentEditablePOId('');
    const currentSuppliersList = [...initialSuppliersData];
    const firstSupplierId = currentSuppliersList.length > 0 ? currentSuppliersList[0].id : '';
    setSelectedSupplierId(firstSupplierId);

    const today = new Date();
    setOrderDate(today);
    setExpectedDelivery(today);
    setCurrentOrderStatus('Pagado');
    setNewPONotes('');

    const initialMaterial = currentRawMaterialOptions.length > 0 ? currentRawMaterialOptions[0] : '';
    let initialPriceUSD = 0;
    let initialUnitForNewItem = commonUnitOptions[0] || '';
    const supplierForNew = currentSuppliersList.find(s => s.id === firstSupplierId);

    if (initialMaterial && supplierForNew) {
      const listToUseForNewItem = supplierForNew.priceList;
      const priceListItemForNew = listToUseForNewItem?.find(pli => pli.rawMaterialName === initialMaterial);
      if (priceListItemForNew) {
        const currentPriceEntry = getCurrentPriceFromHistory(priceListItemForNew.priceHistory);
        initialPriceUSD = currentPriceEntry ? currentPriceEntry.price : 0;
        initialUnitForNewItem = priceListItemForNew.unit;
      }
    }
    const currentGlobalItemsIds = (Array.isArray(globalOrderItems) ? globalOrderItems : []).map(it => it.id);
    const rateForReset = loadExchangeRate(today);
    
    setGlobalOrderItems([{
      id: generateUniqueItemId('global-item-reset', currentGlobalItemsIds),
      rawMaterialName: initialMaterial,
      quantity: 0,
      unit: initialUnitForNewItem,
      unitPrice: initialPriceUSD,
      subtotal: 0,
      bestPriceHint: '',
      manualPriceEdit: false,
      unitPriceDisplayUSD: initialPriceUSD.toFixed(4),
      unitPriceDisplayVES: rateForReset > 0 ? (initialPriceUSD * rateForReset).toFixed(2) : "0.00",
      priceInputCurrency: 'VES' 
    }]);

    const activeBranch = getActiveBranchId();
    const initialBranchIdForPayment = activeBranch || (availableBranches.length > 0 ? availableBranches[0].id : '');
    const existingSplitIds = (Array.isArray(newPaymentSplits) ? newPaymentSplits : []).map(s => s.id);
    
    const initialSplitCurrency: 'VES' | 'USD' = 'VES';
    const initialSplitPaymentMethod: PaymentMethodType = 'Transferencia (VES)';
    const initialSplitAccountId: AccountType = 'vesElectronic';

    setNewPaymentSplits([{
      id: generateUniqueItemId('split-reset', existingSplitIds),
      amount: 0,
      currency: initialSplitCurrency,
      paymentMethod: initialSplitPaymentMethod,
      paidToBranchId: initialBranchIdForPayment,
      paidToAccountId: initialSplitAccountId,
      referenceNumber: '',
      items: []
    }]);

    setIsEditingPO(false);
    setEditingPOId(null);
    setOriginalPOForEdit(null);
    setEditPONotes('');
  }, [currentRawMaterialOptions, generateUniqueItemId, globalOrderItems, newPaymentSplits]);


  useEffect(() => {
    if (!isEditingPO && orderDate) {
      setExpectedDelivery(orderDate);
    }
  }, [orderDate, isEditingPO]);

  const handleItemChange = (
    itemIndex: number,
    field: keyof Omit<PurchaseOrderItemExtended, 'id' | 'subtotal' | 'bestPriceHint' | 'manualPriceEdit' | 'unitPrice'> | 'unitPriceDisplayUSD' | 'unitPriceDisplayVES' | 'priceInputCurrency',
    value: string | number,
    splitIndex?: number
  ) => {
    const updateItemsState = (prevItems: PurchaseOrderItemExtended[]) => {
      const newItems = [...prevItems];
      const updatedItem = { ...newItems[itemIndex] };
      const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
      
      let splitCurrencyForListLookup: 'USD' | 'VES' = updatedItem.priceInputCurrency;
      if (splitIndex !== undefined) {
          const currentSplits = isEditingPO ? editPaymentSplits : newPaymentSplits;
          if (currentSplits[splitIndex]) {
              splitCurrencyForListLookup = currentSplits[splitIndex].currency;
          }
      }
      
      const formatVesPriceWithCurrentRate = (usdPrice: number) => {
        if (exchangeRate > 0 && typeof usdPrice === 'number' && !isNaN(usdPrice)) {
          return (usdPrice * exchangeRate).toFixed(2);
        }
        return "0.00";
      };

      if (field === 'quantity') {
        updatedItem.quantity = Number(value) >= 0 ? Number(value) : 0;
      } else if (field === 'rawMaterialName') {
        updatedItem.rawMaterialName = value as string;
        updatedItem.manualPriceEdit = false;
        let price = 0;
        let itemUnit = commonUnitOptions[0] || '';
        let hint = '';

        if (supplier) {
          const listToUse = splitIndex !== undefined ? (splitCurrencyForListLookup === 'USD' ? supplier.priceListUSDCash : supplier.priceList) : (updatedItem.priceInputCurrency === 'USD' ? supplier.priceListUSDCash : supplier.priceList);
          
          const priceListItem = listToUse?.find(pli => pli.rawMaterialName === updatedItem.rawMaterialName);
          const currentPriceEntry = priceListItem ? getCurrentPriceFromHistory(priceListItem.priceHistory) : null;

          if (priceListItem && currentPriceEntry) {
            price = currentPriceEntry.price;
            itemUnit = priceListItem.unit;
            const bestPriceInfo = getBestPriceInfo(updatedItem.rawMaterialName);
            if (bestPriceInfo && bestPriceInfo.supplierId === supplier.id && bestPriceInfo.originalUnitPrice === currentPriceEntry.price && bestPriceInfo.originalUnit === priceListItem.unit) {
              hint = 'Este proveedor tiene el mejor precio.';
            } else if (bestPriceInfo) {
              hint = `💡 Mejor opción: ${bestPriceInfo.supplierName} a $${bestPriceInfo.originalUnitPrice.toFixed(4)} por ${bestPriceInfo.originalUnit}.`;
            } else {
              hint = 'Precio cargado de lista. No hay otros proveedores para comparar.';
            }
          } else {
            hint = 'No encontrado en la lista de este proveedor. Ingresa el precio manualmente.';
            const bestPriceInfo = getBestPriceInfo(updatedItem.rawMaterialName);
            if (bestPriceInfo) {
                hint += ` Mejor opción: ${bestPriceInfo.supplierName} a $${bestPriceInfo.originalUnitPrice.toFixed(4)} por ${bestPriceInfo.originalUnit}.`;
            }
          }
        }
        updatedItem.unitPrice = price;
        updatedItem.unit = itemUnit;
        updatedItem.bestPriceHint = hint;
        updatedItem.priceInputCurrency = splitIndex !== undefined ? splitCurrencyForListLookup : updatedItem.priceInputCurrency;
        updatedItem.unitPriceDisplayUSD = price.toFixed(4);
        updatedItem.unitPriceDisplayVES = formatVesPriceWithCurrentRate(price);

      } else if (field === 'unit') {
        updatedItem.unit = value as string;
        updatedItem.manualPriceEdit = false;
        let newPriceUSD = 0;
        if (supplier && updatedItem.rawMaterialName) {
          const listToUse = splitIndex !== undefined ? (splitCurrencyForListLookup === 'USD' ? supplier.priceListUSDCash : supplier.priceList) : (updatedItem.priceInputCurrency === 'USD' ? supplier.priceListUSDCash : supplier.priceList);

          const priceListItem = listToUse?.find(pli => pli.rawMaterialName === updatedItem.rawMaterialName && pli.unit === updatedItem.unit);
          if (priceListItem) {
            newPriceUSD = getCurrentPriceFromHistory(priceListItem.priceHistory)?.price || 0;
          } else {
             const anyPriceListItem = listToUse?.find(pli => pli.rawMaterialName === updatedItem.rawMaterialName);
             if(anyPriceListItem) newPriceUSD = getCurrentPriceFromHistory(anyPriceListItem.priceHistory)?.price || 0;
          }
        }
        updatedItem.unitPrice = newPriceUSD;
        updatedItem.priceInputCurrency = splitIndex !== undefined ? splitCurrencyForListLookup : updatedItem.priceInputCurrency;
        updatedItem.unitPriceDisplayUSD = newPriceUSD.toFixed(4);
        updatedItem.unitPriceDisplayVES = formatVesPriceWithCurrentRate(newPriceUSD);

      } else if (field === 'priceInputCurrency') { 
        updatedItem.priceInputCurrency = value as 'USD' | 'VES';
        let newPriceFromList = 0;
        if(supplier && updatedItem.rawMaterialName && updatedItem.unit) {
            const listToUseForNewCurrency = updatedItem.priceInputCurrency === 'USD' ? supplier.priceListUSDCash : supplier.priceList;
            const priceListItem = listToUseForNewCurrency?.find(pli => pli.rawMaterialName === updatedItem.rawMaterialName && pli.unit === updatedItem.unit);
            if(priceListItem) {
                newPriceFromList = getCurrentPriceFromHistory(priceListItem.priceHistory)?.price || 0;
            }
        }
        updatedItem.unitPrice = newPriceFromList;
        updatedItem.manualPriceEdit = false;
        updatedItem.unitPriceDisplayUSD = updatedItem.unitPrice.toFixed(4);
        updatedItem.unitPriceDisplayVES = formatVesPriceWithCurrentRate(updatedItem.unitPrice);


      } else if (field === 'unitPriceDisplayUSD') {
        updatedItem.unitPriceDisplayUSD = String(value);
        if (updatedItem.priceInputCurrency === 'USD') {
          updatedItem.manualPriceEdit = true;
          const newPriceUSD = parseFloat(String(value).replace(/,/g, '.')) || 0;
          updatedItem.unitPrice = newPriceUSD < 0 ? 0 : newPriceUSD;
          updatedItem.unitPriceDisplayVES = formatVesPriceWithCurrentRate(updatedItem.unitPrice);
        }
      } else if (field === 'unitPriceDisplayVES') {
        updatedItem.unitPriceDisplayVES = String(value);
        if (updatedItem.priceInputCurrency === 'VES') {
          updatedItem.manualPriceEdit = true;
          const newPriceVES = parseFloat(String(value).replace(/,/g, '.')) || 0;
          updatedItem.unitPrice = exchangeRate > 0 ? (newPriceVES < 0 ? 0 : newPriceVES / exchangeRate) : 0;
          updatedItem.unitPriceDisplayUSD = updatedItem.unitPrice.toFixed(4);
        }
      }
      
      updatedItem.subtotal = parseFloat(((Number(updatedItem.quantity) || 0) * (Number(updatedItem.unitPrice) || 0)).toFixed(4));
      newItems[itemIndex] = updatedItem;
      return newItems;
    };

    if (splitIndex !== undefined) {
      const setSplitsFunction = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
      setSplitsFunction(prevSplits => {
        const newSplits = [...prevSplits];
        if (newSplits[splitIndex]) {
          newSplits[splitIndex].items = updateItemsState(newSplits[splitIndex].items || []);
          const totalItemsUSDForSplit = (newSplits[splitIndex].items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
          if (newSplits[splitIndex].currency === 'VES') {
              newSplits[splitIndex].amount = parseFloat((totalItemsUSDForSplit * (newSplits[splitIndex].exchangeRateAtPayment || exchangeRate || 1)).toFixed(2));
          } else { 
              newSplits[splitIndex].amount = parseFloat(totalItemsUSDForSplit.toFixed(2));
          }
        }
        return newSplits;
      });
    } else {
      setGlobalOrderItems(updateItemsState);
    }
  };

  const handleUpdateSupplierPriceListItemManually = useCallback((
    supplierId: string,
    rawMaterialName: string,
    unitPrice: number,
    unit: string,
    listType: 'default' | 'usdCash'
  ) => {
    if (!supplierId || !rawMaterialName || unitPrice < 0 || !unit) {
      toast({
        title: "Datos incompletos",
        description: "No se puede guardar el precio sin proveedor, material, precio y unidad.",
        variant: "destructive"
      });
      return;
    }

    const suppliersToUpdate = [...currentSuppliers];
    const supplierIndex = suppliersToUpdate.findIndex(s => s.id === supplierId);
    if (supplierIndex === -1) {
      toast({ title: "Error", description: "Proveedor no encontrado.", variant: "destructive" });
      return;
    }

    const supplier = { ...suppliersToUpdate[supplierIndex] };
    const priceListName = listType === 'usdCash' ? 'priceListUSDCash' : 'priceList';
    
    if (!Array.isArray(supplier[priceListName])) {
      supplier[priceListName] = [];
    }

    let targetPriceList = [...(supplier[priceListName]!)];
    const itemIndex = targetPriceList.findIndex(item => item.rawMaterialName === rawMaterialName && item.unit === unit);
    const today = format(new Date(), "yyyy-MM-dd");

    if (itemIndex !== -1) {
      const itemToUpdate = { ...targetPriceList[itemIndex] };
      itemToUpdate.priceHistory = itemToUpdate.priceHistory ? [...itemToUpdate.priceHistory] : [];
      const historyIndex = itemToUpdate.priceHistory.findIndex(entry => entry.date === today);

      if (historyIndex !== -1) {
        itemToUpdate.priceHistory[historyIndex].price = unitPrice;
      } else {
        itemToUpdate.priceHistory.push({ date: today, price: unitPrice });
      }
      itemToUpdate.priceHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
      targetPriceList[itemIndex] = itemToUpdate;
    } else {
      targetPriceList.push({
        id: `pli-manual-${Date.now()}`,
        rawMaterialName,
        unit,
        priceHistory: [{ date: today, price: unitPrice }],
      });
    }

    supplier[priceListName] = targetPriceList;
    suppliersToUpdate[supplierIndex] = supplier;
    
    saveSuppliersData(suppliersToUpdate);
    setCurrentSuppliers(suppliersToUpdate);
    
    toast({
      title: "Precio Guardado",
      description: `El precio para ${rawMaterialName} se ha guardado en la lista de ${supplier.name}.`,
    });
  }, [currentSuppliers, toast]);

  useEffect(() => {
    if (isAnalyzing) return;
    if (isPODialogOpen && isEditingPO && originalPOForEdit) {
        if (currentOrderStatus === 'Pagado' && originalPOForEdit.status !== 'Pagado') {
            const currentSplits = Array.isArray(editPaymentSplits) ? editPaymentSplits : [];
            const currentGlobalItemsForAutoSplit = Array.isArray(globalOrderItems) ? globalOrderItems : [];

            if ((!currentSplits || currentSplits.length === 0 || currentSplits.every(ps => !ps.items || ps.items.length === 0)) && currentGlobalItemsForAutoSplit.length > 0 && currentGlobalItemsForAutoSplit.some(it => it.rawMaterialName && it.quantity > 0)) {
                const totalGlobalItemsCostUSD = calculateItemsTotalCost(currentGlobalItemsForAutoSplit);
                const activeBranchForPayment = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
                
                const existingSplitIds = currentSplits.map(s => s.id);
                
                let defaultSplitCurrency: 'VES' | 'USD' = 'VES';
                let defaultSplitPaymentMethod: PaymentMethodType = 'Transferencia (VES)';
                let defaultSplitAccountId: AccountType = 'vesElectronic';
                
                const supplierDetails = currentSuppliers.find(s => s.id === selectedSupplierId);
                if (supplierDetails?.priceListUSDCash && supplierDetails.priceListUSDCash.length > 0 && exchangeRate > 0) {
                     let usdMatchCount = 0;
                    currentGlobalItemsForAutoSplit.forEach(item => {
                        const usdPriceItem = supplierDetails.priceListUSDCash?.find(pli => pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit);
                        if (usdPriceItem && getCurrentPriceFromHistory(usdPriceItem.priceHistory)?.price === item.unitPrice) {
                            usdMatchCount++;
                        }
                    });
                    if (usdMatchCount > currentGlobalItemsForAutoSplit.length / 2) {
                        defaultSplitCurrency = 'USD';
                        defaultSplitPaymentMethod = 'Efectivo USD';
                        defaultSplitAccountId = 'usdCash';
                    }
                }

                const newSplitAmount = defaultSplitCurrency === 'VES' ? totalGlobalItemsCostUSD * (exchangeRate || 1) : totalGlobalItemsCostUSD;

                setEditPaymentSplits([{
                    id: generateUniqueItemId(`split-auto-edit`, existingSplitIds),
                    amount: parseFloat(newSplitAmount.toFixed(2)),
                    currency: defaultSplitCurrency,
                    paymentMethod: defaultSplitPaymentMethod,
                    paidToBranchId: activeBranchForPayment,
                    paidToAccountId: defaultSplitAccountId,
                    referenceNumber: '',
                    items: JSON.parse(JSON.stringify(currentGlobalItemsForAutoSplit.filter(it => it.rawMaterialName && it.quantity > 0).map(item => ({
                        id: item.id, rawMaterialName: item.rawMaterialName, quantity: item.quantity, unit: item.unit, unitPrice: Number(item.unitPrice), subtotal: item.subtotal
                    }))))
                }]);
            }
        }
    }
  }, [isAnalyzing, currentOrderStatus, isPODialogOpen, isEditingPO, originalPOForEdit, globalOrderItems, calculateItemsTotalCost, generateUniqueItemId, editPaymentSplits, exchangeRate, currentSuppliers, selectedSupplierId]);

  const isAddingSplitItemRef = useRef(false);
  const handleAddItemToSplit = (splitIndex: number) => {
    if (isAddingSplitItemRef.current) {
      return;
    }
    isAddingSplitItemRef.current = true;
    
    const setSplits = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
    const currentSplitsForNewItem = isEditingPO ? editPaymentSplits : newPaymentSplits;
    const targetSplitForNewItem = currentSplitsForNewItem[splitIndex];


    setSplits(prevSplits => {
      const newSplits = [...(Array.isArray(prevSplits) ? prevSplits : [])];
      if (newSplits[splitIndex]) {
        const targetSplit = { ...newSplits[splitIndex] };
        const existingItems = targetSplit.items ? [...targetSplit.items] : [];

        const initialMaterial = currentRawMaterialOptions.length > 0 ? currentRawMaterialOptions[0] : '';
        let initialPriceUSD = 0;
        let initialUnit = commonUnitOptions[0] || '';
        const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
        if (initialMaterial && supplier) {
            const listToUse = targetSplitForNewItem.currency === 'USD' ? supplier.priceListUSDCash : supplier.priceList;
            const pli = listToUse?.find(p => p.rawMaterialName === initialMaterial);
            if (pli) {
                initialPriceUSD = getCurrentPriceFromHistory(pli.priceHistory)?.price || 0;
                initialUnit = pli.unit;
            }
        }
        
        const currentItemsInThisSplitForIdGen = existingItems.map(it => it.id);
        const newItemId = generateUniqueItemId(`split-item-${splitIndex}-idx${existingItems.length}`, currentItemsInThisSplitForIdGen);

        const newItem: PurchaseOrderItemExtended = {
          id: newItemId,
          rawMaterialName: initialMaterial,
          quantity: 0,
          unit: initialUnit,
          unitPrice: initialPriceUSD,
          subtotal: 0,
          bestPriceHint: '',
          manualPriceEdit: false,
          unitPriceDisplayUSD: initialPriceUSD.toFixed(4),
          unitPriceDisplayVES: exchangeRate > 0 ? (initialPriceUSD * exchangeRate).toFixed(2) : "0.00",
          priceInputCurrency: targetSplitForNewItem.currency
        };

        targetSplit.items = [...existingItems, newItem];
      
        newSplits[splitIndex] = targetSplit;
      }
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isAddingSplitItemRef.current = false;
        });
      });
      return newSplits;
    });
  };


  const handleRemoveItemFromSplit = (splitIndex: number, itemIndex: number) => {
    const setSplits = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
    const currentSplitsForRemove = isEditingPO ? editPaymentSplits : newPaymentSplits;
    const targetSplitForRemove = currentSplitsForRemove[splitIndex];

    setSplits(prev => {
      const newSplits = [...(Array.isArray(prev) ? prev : [])];
      if (newSplits[splitIndex] && newSplits[splitIndex].items) {
        newSplits[splitIndex].items = newSplits[splitIndex].items!.filter((_, i) => i !== itemIndex);
        if (newSplits[splitIndex].items!.length === 0) {
            const initialMaterial = currentRawMaterialOptions.length > 0 ? currentRawMaterialOptions[0] : '';
            let initialPriceUSD = 0; let initialUnit = commonUnitOptions[0] || '';
            const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
            if (initialMaterial && supplier) {
                const listToUse = targetSplitForRemove.currency === 'USD' ? supplier.priceListUSDCash : supplier.priceList;
                const pli = listToUse?.find(p => p.rawMaterialName === initialMaterial);
                if (pli) { initialPriceUSD = getCurrentPriceFromHistory(pli.priceHistory)?.price || 0; initialUnit = pli.unit; }
            }
            const placeholderItemId = generateUniqueItemId(`split-item-${splitIndex}-placeholder`, (newSplits[splitIndex].items || []).map(it => it.id));
            newSplits[splitIndex].items = [{
                id: placeholderItemId,
                rawMaterialName: initialMaterial,
                quantity: 0, unit: initialUnit, unitPrice: initialPriceUSD, subtotal: 0,
                bestPriceHint: '', manualPriceEdit: false,
                unitPriceDisplayUSD: initialPriceUSD.toFixed(4),
                unitPriceDisplayVES: exchangeRate > 0 ? (initialPriceUSD * exchangeRate).toFixed(2) : "0.00",
                priceInputCurrency: targetSplitForRemove.currency
            }];
        }
        const totalItemsUSDForSplit = (newSplits[splitIndex].items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
        if (newSplits[splitIndex].currency === 'VES') {
            newSplits[splitIndex].amount = parseFloat((totalItemsUSDForSplit * (newSplits[splitIndex].exchangeRateAtPayment || exchangeRate || 1)).toFixed(2));
        } else {
            newSplits[splitIndex].amount = parseFloat(totalItemsUSDForSplit.toFixed(2));
        }
      }
      return newSplits;
    });
  };

  const handleAddGlobalItem = () => {
    const initialMaterial = currentRawMaterialOptions.length > 0 ? currentRawMaterialOptions[0] : '';
    let initialPriceUSD = 0; let initialUnit = commonUnitOptions[0] || '';
    const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
    if (initialMaterial && supplier?.priceList) {
        const pli = supplier.priceList.find(p => p.rawMaterialName === initialMaterial);
        if (pli) { initialPriceUSD = getCurrentPriceFromHistory(pli.priceHistory)?.price || 0; initialUnit = pli.unit; }
    }
    const currentGlobalItemsIds = globalOrderItems.map(it => it.id);
    const newId = generateUniqueItemId(`global-item-idx${globalOrderItems.length}`, currentGlobalItemsIds);

    setGlobalOrderItems(prev => [...(Array.isArray(prev) ? prev : []), {
      id: newId,
      rawMaterialName: initialMaterial, quantity: 0, unit: initialUnit,
      unitPrice: initialPriceUSD, subtotal: 0, bestPriceHint: '', manualPriceEdit: false,
      unitPriceDisplayUSD: initialPriceUSD.toFixed(4),
      unitPriceDisplayVES: exchangeRate > 0 ? (initialPriceUSD * exchangeRate).toFixed(2) : "0.00",
      priceInputCurrency: 'VES'
    }]);
  };

  const handleRemoveGlobalItem = (index: number) => {
    setGlobalOrderItems(prev => {
      const newList = (Array.isArray(prev) ? prev : []).filter((_, i) => i !== index);
      if (newList.length === 0) {
        const initialMaterial = currentRawMaterialOptions.length > 0 ? currentRawMaterialOptions[0] : '';
        let initialPriceUSD = 0; let initialUnit = commonUnitOptions[0] || '';
        const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
        if (initialMaterial && supplier?.priceList) {
            const pli = supplier.priceList.find(p => p.rawMaterialName === initialMaterial);
            if (pli) { initialPriceUSD = getCurrentPriceFromHistory(pli.priceHistory)?.price || 0; initialUnit = pli.unit; }
        }
        const placeholderId = generateUniqueItemId(`global-item-placeholder`, newList.map(it => it.id));
        return [{
            id: placeholderId,
            rawMaterialName: initialMaterial,
            quantity: 0, unit: initialUnit, unitPrice: initialPriceUSD, subtotal: 0,
            bestPriceHint: '', manualPriceEdit: false,
            unitPriceDisplayUSD: initialPriceUSD.toFixed(4),
            unitPriceDisplayVES: exchangeRate > 0 ? (initialPriceUSD * exchangeRate).toFixed(2) : "0.00",
            priceInputCurrency: 'VES'
        }];
      }
      return newList;
    });
  };


  const handleAddPaymentSplit = (formType: 'new' | 'edit') => {
    const setSplits = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
    const currentSplits = isEditingPO ? editPaymentSplits : newPaymentSplits;

    const activeBranchForPayment = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
    
    const currentSplitsIds = (Array.isArray(currentSplits) ? currentSplits : []).map(sp => sp.id);
    const newSplitId = generateUniqueItemId(`split-idx${(Array.isArray(currentSplits) ? currentSplits : []).length}`, currentSplitsIds);
    
    const initialSplitCurrency: 'VES' | 'USD' = 'VES';
    const initialSplitPaymentMethod: PaymentMethodType = 'Transferencia (VES)';
    const initialSplitAccountId: AccountType = 'vesElectronic';

    setSplits(prev => [...(Array.isArray(prev) ? prev : []), {
        id: newSplitId,
        amount: 0,
        currency: initialSplitCurrency,
        paymentMethod: initialSplitPaymentMethod,
        paidToBranchId: activeBranchForPayment,
        paidToAccountId: initialSplitAccountId,
        referenceNumber: '',
        items: []
    }]);
  };
  const handleRemovePaymentSplit = (id: string, formType: 'new' | 'edit') => {
    const setSplits = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
    setSplits(prev => (Array.isArray(prev) ? prev : []).filter(split => split.id !== id));
  };

  const getPaymentMethodsForPOPaymentSplitCurrency = useCallback((currency: 'USD' | 'VES'): PaymentMethodType[] => {
    if (currency === 'USD') return ['Efectivo USD'];
    if (currency === 'VES' && exchangeRate > 0) return ['Pago Móvil (VES)', 'Transferencia (VES)', 'Efectivo VES'];
    if (currency === 'VES' && exchangeRate <= 0) return [];
    return ['Otro'];
  }, [exchangeRate]);

  const getAccountsForPOPaymentSplitMethod = useCallback((currency: 'USD' | 'VES', method: PaymentMethodType): AccountType[] => {
      if (currency === 'USD' && method === 'Efectivo USD') return ['usdCash'];
      if (currency === 'VES' && exchangeRate > 0) {
          if (method === 'Pago Móvil (VES)' || method === 'Transferencia (VES)') return ['vesElectronic'];
          if (method === 'Efectivo VES') return ['vesCash'];
      }
      if ((currency === 'VES' && exchangeRate <= 0) || method === 'Otro') return [];
      return Object.values(accountTypeNames).map((_, idx) => Object.keys(accountTypeNames)[idx] as AccountType);
  }, [exchangeRate]);

  const handlePaymentSplitChange = (id: string, field: keyof Omit<PaymentSplit, 'id' | 'items' | 'amount'>, value: string | number | undefined, formType: 'new' | 'edit') => {
    const setSplits = formType === 'new' ? setNewPaymentSplits : setEditPaymentSplits;
    setSplits(prevSplits => (Array.isArray(prevSplits) ? prevSplits : []).map(split => {
      if (split.id === id) {
        let updatedSplit = { ...split, [field]: value };

        if (field === 'currency') {
          const newCurrency = value as 'USD' | 'VES';
          if (newCurrency === 'USD') {
            updatedSplit.paymentMethod = 'Efectivo USD';
            updatedSplit.paidToAccountId = 'usdCash';
          } else {
            if (updatedSplit.paymentMethod === 'Efectivo USD' || updatedSplit.paymentMethod === 'Otro') { 
                updatedSplit.paymentMethod = 'Transferencia (VES)';
                updatedSplit.paidToAccountId = 'vesElectronic';
            } else if (updatedSplit.paymentMethod === 'Efectivo VES') {
                updatedSplit.paidToAccountId = 'vesCash';
            } else { 
                updatedSplit.paidToAccountId = 'vesElectronic';
            }
          }
          
          const supplier = currentSuppliers.find(s => s.id === selectedSupplierId);
          if (supplier && updatedSplit.items) {
              const listToUseForNewSplitCurrency = newCurrency === 'USD' ? supplier.priceListUSDCash : supplier.priceList;
              const updatedItemsForSplit = updatedSplit.items.map(item => {
                  let newUnitPriceUSD = item.unitPrice;
                  if (!item.manualPriceEdit) {
                      const priceListItem = listToUseForNewSplitCurrency?.find(pli =>
                          pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit
                      );
                      if (priceListItem) {
                          newUnitPriceUSD = getCurrentPriceFromHistory(priceListItem.priceHistory)?.price || 0;
                      } else {
                          const fallbackList = newCurrency === 'USD' ? supplier.priceList : supplier.priceListUSDCash;
                          const fallbackPriceItem = fallbackList?.find(pli =>
                              pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit
                          );
                          if (fallbackPriceItem) {
                              newUnitPriceUSD = getCurrentPriceFromHistory(fallbackPriceItem.priceHistory)?.price || 0;
                          }
                      }
                  }
                  return {
                      ...item,
                      priceInputCurrency: newCurrency, 
                      unitPrice: newUnitPriceUSD,
                      unitPriceDisplayUSD: newUnitPriceUSD.toFixed(4),
                      unitPriceDisplayVES: exchangeRate > 0 ? (newUnitPriceUSD * exchangeRate).toFixed(2) : "0.00",
                      subtotal: (item.quantity || 0) * newUnitPriceUSD,
                  };
              });
              updatedSplit.items = updatedItemsForSplit;
              const totalItemsUSD = (updatedSplit.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
              if (updatedSplit.currency === 'VES') {
                  updatedSplit.amount = parseFloat((totalItemsUSD * (updatedSplit.exchangeRateAtPayment || exchangeRate || 1)).toFixed(2));
              } else {
                  updatedSplit.amount = parseFloat(totalItemsUSD.toFixed(2));
              }
          }

        } else if (field === 'paymentMethod') {
          const newMethod = value as PaymentMethodType;
          const availableAccounts = getAccountsForPOPaymentSplitMethod(updatedSplit.currency, newMethod);
          updatedSplit.paidToAccountId = availableAccounts[0] || (updatedSplit.currency === 'USD' ? 'usdCash' : 'vesElectronic');
        }
        if (field === 'paidToBranchId') {
            if (updatedSplit.currency === 'USD') {
                 updatedSplit.paymentMethod = 'Efectivo USD';
                 updatedSplit.paidToAccountId = 'usdCash';
            } else if (updatedSplit.currency === 'VES') {
                if (updatedSplit.paymentMethod === 'Efectivo VES') {
                    updatedSplit.paidToAccountId = 'vesCash';
                } else { 
                    updatedSplit.paymentMethod = 'Transferencia (VES)';
                    updatedSplit.paidToAccountId = 'vesElectronic';
                }
            }
        }
        return updatedSplit;
      }
      return split;
    }));
  };


  const _revertPOFinancialEffects = useCallback((poToRevert: PurchaseOrder, rate: number) => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      console.warn("_revertPOFinancialEffects: No active branch. Skipping.");
      return;
    }
    if (poToRevert.status === 'Pagado') {
      const activeBranchRecipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchId);
      updateRawMaterialInventoryFromOrder(poToRevert, 'subtract', activeBranchRecipes);
      updateCompanyAccountAndExpensesForPO(poToRevert, 'subtract', rate, poToRevert);
    }
  }, []);

  const _applyPOFinancialEffects = useCallback((poToApply: PurchaseOrder, rate: number) => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      console.warn("_applyPOFinancialEffects: No active branch. Skipping.");
      return;
    }
    if (poToApply.status === 'Pagado') {
      if (!poToApply.timestamp) poToApply.timestamp = new Date().toISOString();
      const activeBranchRecipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchId);
      updateRawMaterialInventoryFromOrder(poToApply, 'add', activeBranchRecipes);
      updateCompanyAccountAndExpensesForPO(poToApply, 'add', rate);
      updateSupplierPriceList(poToApply);
    }
  }, []);

  const handleSubmitPO = () => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
        toast({ title: "Error de Configuración", description: "No se ha seleccionado una sede activa para la orden de compra.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const supplierDetails = currentSuppliers.find(s => s.id === selectedSupplierId);
    const finalPOId = (isEditingPO ? currentEditablePOId : newOrderId).trim();
    if (!finalPOId) { toast({ title: "Error", description: "ID de OC obligatorio.", variant: "destructive" }); setIsSubmitting(false); return; }

    const currentPOsForBranch = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchId);
    if (isEditingPO && originalPOForEdit) {
        if (finalPOId.toLowerCase() !== originalPOForEdit.id.toLowerCase() && currentPOsForBranch.some(po => po.id.toLowerCase() === finalPOId.toLowerCase())) {
            toast({ title: "Error", description: "El nuevo ID de OC ya existe para otra orden en esta sede.", variant: "destructive" });
            setIsSubmitting(false); return;
        }
    } else {
        if (currentPOsForBranch.some(po => po.id.toLowerCase() === finalPOId.toLowerCase())) {
            toast({ title: "Error", description: "ID de OC ya existe en esta sede.", variant: "destructive" });
            setIsSubmitting(false); return;
        }
    }
    const orderDateToUse = isEditingPO ? editOrderDate : orderDate;
    const expectedDeliveryToUse = isEditingPO ? editExpectedDelivery : expectedDelivery;
    
    if (!supplierDetails || !orderDateToUse || !expectedDeliveryToUse) { toast({ title: "Error", description: "Proveedor y fechas obligatorios.", variant: "destructive" }); setIsSubmitting(false); return; }

    let itemsToProcessForPOStorage: PurchaseOrderItem[] = [];
    let calculatedTotalCostUSD = 0;
    let finalPaymentSplits: PaymentSplit[] | undefined = undefined;
    const splitsToProcess = isEditingPO ? editPaymentSplits : newPaymentSplits;


    if (currentOrderStatus === 'Pagado') {
      const validSplits = (Array.isArray(splitsToProcess) ? splitsToProcess : []).filter(split => split.items && split.items.some(item => item.rawMaterialName && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && item.unit));
      if (validSplits.length === 0 || validSplits.some(s => !s.items || s.items.length === 0 || !s.items.some(i => i.rawMaterialName && i.quantity > 0))) {
        toast({ title: "Error", description: "Para estado 'Pagado', al menos una forma de pago debe tener ítems válidos con cantidad positiva.", variant: "destructive" });
        setIsSubmitting(false); return;
      }

      finalPaymentSplits = validSplits.map(split => {
          const totalItemsUSDForThisSplit = (split.items || []).reduce((sum, item) => sum + (item.subtotal || 0),0);
          let splitAmountInSplitCurrency;
          if (split.currency === 'VES') {
              splitAmountInSplitCurrency = totalItemsUSDForThisSplit * (split.exchangeRateAtPayment || exchangeRate || 1);
          } else { 
              splitAmountInSplitCurrency = totalItemsUSDForThisSplit;
          }
          return {
            ...split,
            amount: parseFloat(splitAmountInSplitCurrency.toFixed(2)),
            items: (split.items || []).filter(item => item.rawMaterialName && item.quantity > 0).map(item => ({
              id: item.id, rawMaterialName: item.rawMaterialName, quantity: item.quantity, unit: item.unit, unitPrice: Number(item.unitPrice), subtotal: item.subtotal
            }))
        }
      });

      itemsToProcessForPOStorage = finalPaymentSplits.flatMap(split => split.items || []);
      calculatedTotalCostUSD = itemsToProcessForPOStorage.reduce((sum, item) => sum + (item.subtotal || 0), 0);


      if (finalPaymentSplits.some(s => {
          const ref = s.referenceNumber?.trim();
          return (s.paymentMethod === 'Pago Móvil (VES)' || s.paymentMethod === 'Transferencia (VES)') && ref && !/^\d{6}$/.test(ref);
        })) {
        toast({ title: "Error de Referencia", description: "Si se ingresa una referencia para Pago Móvil/Transferencia, debe ser de 6 dígitos.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
    } else {
      const validGlobalItems = (Array.isArray(globalOrderItems) ? globalOrderItems : []).filter(item => item.rawMaterialName && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && item.unit);
      if (validGlobalItems.length === 0) {
        toast({ title: "Error", description: "Añada artículos válidos a la orden.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
      itemsToProcessForPOStorage = validGlobalItems.map(item => ({ id: item.id, rawMaterialName: item.rawMaterialName, quantity: item.quantity, unit: item.unit, unitPrice: Number(item.unitPrice), subtotal: item.subtotal }));
      calculatedTotalCostUSD = calculateItemsTotalCost(validGlobalItems);
    }
     if (itemsToProcessForPOStorage.length === 0) {
        toast({ title: "Error", description: "La orden debe tener al menos un artículo válido.", variant: "destructive" });
        setIsSubmitting(false); return;
    }


    let updatedPOs;
    const currentGlobalRate = loadExchangeRate(orderDateToUse);
    const currentTimestamp = new Date().toISOString();
    const finalNotes = isEditingPO ? editPONotes : newPONotes;

    if (isEditingPO && editingPOId && originalPOForEdit) {
      _revertPOFinancialEffects(originalPOForEdit, currentGlobalRate);
      
      const updatedPOData: PurchaseOrder = {
        ...originalPOForEdit,
        id: finalPOId, supplierId: selectedSupplierId, supplierName: supplierDetails.name,
        orderDate: format(orderDateToUse, "yyyy-MM-dd"),
        expectedDelivery: format(expectedDeliveryToUse || new Date(), "yyyy-MM-dd"),
        items: currentOrderStatus !== 'Pagado' ? itemsToProcessForPOStorage : [],
        totalCost: calculatedTotalCostUSD, status: currentOrderStatus,
        paymentSplits: finalPaymentSplits?.map(split => ({ 
            ...split,
            exchangeRateAtPayment: split.currency === 'VES' ? (split.exchangeRateAtPayment || currentGlobalRate || undefined) : undefined,
        })),
        timestamp: currentOrderStatus === 'Pagado' ? (originalPOForEdit.timestamp && originalPOForEdit.status === 'Pagado' ? originalPOForEdit.timestamp : currentTimestamp) : undefined,
        exchangeRateOnOrderDate: currentGlobalRate,
        notes: finalNotes.trim() || undefined,
      };

      _applyPOFinancialEffects(updatedPOData, currentGlobalRate);
      
      const filteredPOs = currentPOsForBranch.filter(p => p.id !== originalPOForEdit.id);
      updatedPOs = [updatedPOData, ...filteredPOs];
      toast({ title: "Éxito", description: "OC actualizada." });
    } else {
      const newPO: PurchaseOrder = {
        id: finalPOId, supplierId: selectedSupplierId, supplierName: supplierDetails.name,
        orderDate: format(orderDateToUse, "yyyy-MM-dd"),
        expectedDelivery: format(expectedDeliveryToUse || new Date(), "yyyy-MM-dd"),
        items: currentOrderStatus !== 'Pagado' ? itemsToProcessForPOStorage : [],
        totalCost: calculatedTotalCostUSD, status: currentOrderStatus,
        paymentSplits: finalPaymentSplits?.map(split => ({ 
            ...split,
            exchangeRateAtPayment: split.currency === 'VES' ? (split.exchangeRateAtPayment || currentGlobalRate || undefined) : undefined,
        })),
        timestamp: currentOrderStatus === 'Pagado' ? currentTimestamp : undefined,
        exchangeRateOnOrderDate: currentGlobalRate,
        notes: finalNotes.trim() || undefined,
      };
      _applyPOFinancialEffects(newPO, currentGlobalRate);
      updatedPOs = [newPO, ...currentPOsForBranch];
      toast({ title: "Éxito", description: `OC ${newPO.status} creada.` });
    }
    const sortedPOs = updatedPOs.sort((a,b) => {
        const dateA = a.orderDate && isValid(parseISO(a.orderDate)) ? parseISO(a.orderDate).getTime() : 0;
        const dateB = b.orderDate && isValid(parseISO(b.orderDate)) ? parseISO(b.orderDate).getTime() : 0;
        if (dateA === 0 && dateB === 0) return 0;
        if (dateA === 0) return 1;
        if (dateB === 0) return -1;
        return dateB - dateA;
    });
    savePurchaseOrdersData(activeBranchId, sortedPOs);
    setAllPurchaseOrders(sortedPOs);
    setIsPODialogOpen(false); resetAddForm(); setIsSubmitting(false);
  };


  const handleMarkAsPaid = (poId: string) => {
    const poToEdit = allPurchaseOrders.find(p => p.id === poId);
    if (poToEdit) {
        if (poToEdit.status === 'Pagado') { toast({title: "Info", description: "Ya pagada.", variant: "default"}); return; }
        handleOpenEditDialog(poToEdit);
        setTimeout(() => {
            setCurrentOrderStatus('Pagado');
            const itemsForSplit = Array.isArray(editPaymentSplits) ? editPaymentSplits : [];
            const itemsFromNonPaidOrder = poToEdit.items || [];


            if (poToEdit.status !== 'Pagado' && itemsFromNonPaidOrder.length > 0 && itemsFromNonPaidOrder.some(it => it.rawMaterialName && it.quantity > 0)) {
                const totalOrderItemsCostUSD = itemsFromNonPaidOrder.reduce((sum, item) => sum + item.subtotal, 0);
                const activeBranchForPayment = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
                
                const currentSplitsIds = itemsForSplit.map(sp => sp.id);
                
                let defaultSplitCurrency: 'VES' | 'USD' = 'VES';
                let defaultSplitPaymentMethod: PaymentMethodType = 'Transferencia (VES)';
                let defaultSplitAccountId: AccountType = 'vesElectronic';
                
                const supplierDetails = currentSuppliers.find(s => s.id === poToEdit.supplierId);
                if (supplierDetails?.priceListUSDCash && supplierDetails.priceListUSDCash.length > 0 && exchangeRate > 0) {
                     let usdMatchCount = 0;
                    itemsFromNonPaidOrder.forEach(item => {
                        const usdPriceItem = supplierDetails.priceListUSDCash?.find(pli => pli.rawMaterialName === item.rawMaterialName && pli.unit === item.unit);
                        if (usdPriceItem && getCurrentPriceFromHistory(usdPriceItem.priceHistory)?.price === item.unitPrice) {
                            usdMatchCount++;
                        }
                    });
                    if (usdMatchCount > itemsFromNonPaidOrder.length / 2) {
                        defaultSplitCurrency = 'USD';
                        defaultSplitPaymentMethod = 'Efectivo USD';
                        defaultSplitAccountId = 'usdCash';
                    }
                }

                const newSplitAmount = defaultSplitCurrency === 'VES' ? totalOrderItemsCostUSD * (exchangeRate || 1) : totalOrderItemsCostUSD;

                setEditPaymentSplits([{
                    id: generateUniqueItemId(`split-markpaid-auto`, currentSplitsIds),
                    amount: parseFloat(newSplitAmount.toFixed(2)),
                    currency: defaultSplitCurrency,
                    paymentMethod: defaultSplitPaymentMethod,
                    paidToBranchId: activeBranchForPayment,
                    paidToAccountId: defaultSplitAccountId,
                    referenceNumber: '',
                    items: JSON.parse(JSON.stringify(itemsFromNonPaidOrder.filter(it => it.rawMaterialName && it.quantity > 0).map(item => ({
                        id: item.id, rawMaterialName: item.rawMaterialName, quantity: item.quantity, unit: item.unit, unitPrice: Number(item.unitPrice), subtotal: item.subtotal
                    }))))
                }]);
            } else if (!itemsForSplit || itemsForSplit.length === 0 || itemsForSplit.every(ps => !ps.items || ps.items.length === 0)) {
                const activeBranchForPayment = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
                const currentSplitsIds = itemsForSplit.map(sp => sp.id);
                 setEditPaymentSplits([{
                    id: generateUniqueItemId(`split-markpaid-empty`, currentSplitsIds),
                    amount: 0, currency: 'VES' as 'USD' | 'VES', paymentMethod: 'Transferencia (VES)' as PaymentMethodType,
                    paidToBranchId: activeBranchForPayment, paidToAccountId: 'vesElectronic' as AccountType,
                    referenceNumber: '', items: []
                }]);
            }
            toast({title: "Acción", description: "Estado cambiado a 'Pagado'. Verifica/Ajusta las formas de pago e ítems asociados y guarda."});
        }, 150);
    } else { toast({title: "Error", description: "OC no encontrada.", variant: "destructive"});}
  };

  const handleOpenEditDialog = (po: PurchaseOrder) => {
    setIsEditingPO(true); setEditingPOId(po.id); setCurrentEditablePOId(po.id);
    const originalPoDeepClone = JSON.parse(JSON.stringify(po));
    setOriginalPOForEdit(originalPoDeepClone);

    setSelectedSupplierId(po.supplierId || '');
    setEditOrderDate(po.orderDate && isValid(parseISO(po.orderDate)) ? parseISO(po.orderDate) : new Date());
    setEditExpectedDelivery(po.expectedDelivery && isValid(parseISO(po.expectedDelivery)) ? parseISO(po.expectedDelivery) : new Date());
    setCurrentOrderStatus(po.status);
    setEditPONotes(po.notes || '');

    if (po.status === 'Pagado' && po.paymentSplits && po.paymentSplits.length > 0) {
        const processedSplitsData = JSON.parse(JSON.stringify(po.paymentSplits.map((split, splitIndex) => {
            const itemsInThisSplitFromPO = split.items || [];
            const processedItemsForThisSplit: PurchaseOrderItemExtended[] = [];
            const idsUsedInThisSplitMapping = new Set<string>();

            itemsInThisSplitFromPO.forEach((item: PurchaseOrderItem, itemIndex: number) => {
                let itemId = item.id;
                const currentIdsInProcessedItems = processedItemsForThisSplit.map(pi => pi.id);
                if (!itemId || idsUsedInThisSplitMapping.has(itemId) || currentIdsInProcessedItems.includes(itemId)) {
                    itemId = generateUniqueItemId(`edit-split${splitIndex}-item${itemIndex}`, [...currentIdsInProcessedItems, ...Array.from(idsUsedInThisSplitMapping)]);
                }
                idsUsedInThisSplitMapping.add(itemId);
                processedItemsForThisSplit.push({
                    id: itemId,
                    rawMaterialName: item.rawMaterialName,
                    quantity: item.quantity,
                    unit: item.unit,
                    unitPrice: Number(item.unitPrice),
                    subtotal: item.subtotal,
                    unitPriceDisplayUSD: (Number(item.unitPrice) || 0).toFixed(4),
                    unitPriceDisplayVES: exchangeRate > 0 ? ((Number(item.unitPrice) || 0) * exchangeRate).toFixed(2) : "0.00",
                    priceInputCurrency: split.currency,
                    manualPriceEdit: false,
                    bestPriceHint: ''
                });
            });
            const existingSplitIdsForIdGen = po.paymentSplits?.map(s => s.id).filter(Boolean) as string[] || [];
            return {
                id: split.id || generateUniqueItemId(`edit-split${splitIndex}`, existingSplitIdsForIdGen),
                amount: parseFloat(split.amount.toFixed(2)),
                currency: split.currency,
                paymentMethod: split.paymentMethod,
                exchangeRateAtPayment: split.exchangeRateAtPayment,
                paidToBranchId: split.paidToBranchId,
                paidToAccountId: split.paidToAccountId,
                referenceNumber: split.referenceNumber,
                items: processedItemsForThisSplit
            };
        })));
        setEditPaymentSplits(processedSplitsData);
        const currentGlobalItemsIds = (Array.isArray(globalOrderItems) ? globalOrderItems : []).map(it => it.id);
        setGlobalOrderItems([{ id: generateUniqueItemId('global-item-placeholder-edit', currentGlobalItemsIds), rawMaterialName: '', quantity: 0, unit: commonUnitOptions[0] || '', unitPrice: 0, subtotal: 0, bestPriceHint: '', manualPriceEdit: false, unitPriceDisplayUSD: "0", unitPriceDisplayVES: "0.00", priceInputCurrency: 'VES' }]);
    } else {
        const itemsFromPO = (po.items || []).map((itemOriginal, idx) => {
            const item = JSON.parse(JSON.stringify(itemOriginal));
            let itemId = item.id;
            const existingItemIdsInPo = (po.items || []).map(i => i.id).filter(Boolean);
            const itemsFromPOMap = new Map();
            (po.items || []).forEach(i => itemsFromPOMap.set(i.id, (itemsFromPOMap.get(i.id) || 0) + 1));
            if (!itemId || itemsFromPOMap.get(itemId) > 1) {
                itemId = generateUniqueItemId(`edit-gitem-${idx}-${Date.now().toString().slice(-5)}`, []);
            }
            const poUnitPrice = Number(item.unitPrice);
            const poQuantity = Number(item.quantity);
            const validUnitPrice = !isNaN(poUnitPrice) && isFinite(poUnitPrice) ? poUnitPrice : 0;
            const validQuantity = !isNaN(poQuantity) && isFinite(poQuantity) ? poQuantity : 0;
            const poSubtotal = Number(item.subtotal);
            const calculatedSubtotal = !isNaN(poSubtotal) && isFinite(poSubtotal) ? poSubtotal : (validUnitPrice * validQuantity);

            return {
                id: itemId,
                rawMaterialName: item.rawMaterialName || '',
                quantity: validQuantity,
                unit: item.unit || (commonUnitOptions[0] || ''),
                unitPrice: validUnitPrice,
                subtotal: parseFloat(calculatedSubtotal.toFixed(4)),
                unitPriceDisplayUSD: validUnitPrice.toFixed(4),
                unitPriceDisplayVES: exchangeRate > 0 ? (validUnitPrice * exchangeRate).toFixed(2) : "0.00",
                priceInputCurrency: 'USD' as 'USD' | 'VES',
                manualPriceEdit: true,
                bestPriceHint: ''
            };
        });

        if (itemsFromPO.length > 0) {
            setGlobalOrderItems(itemsFromPO);
        } else {
            const currentGlobalItemsIds = (Array.isArray(globalOrderItems) ? globalOrderItems : []).map(it => it.id);
            setGlobalOrderItems([{
                id: generateUniqueItemId('global-item-placeholder-edit-noitems', currentGlobalItemsIds),
                rawMaterialName: '',
                quantity: 0,
                unit: commonUnitOptions[0] || '',
                unitPrice: 0,
                subtotal: 0,
                unitPriceDisplayUSD: "0.0000",
                unitPriceDisplayVES: "0.00",
                priceInputCurrency: 'USD' as 'USD' | 'VES',
                manualPriceEdit: false,
                bestPriceHint: ''
            }]);
        }
        
        const activeBranchForPayment = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
        const initialSplitsForEdit = (po.paymentSplits && po.paymentSplits.length > 0)
            ? JSON.parse(JSON.stringify(po.paymentSplits.map((ps, splitIndex) => { /* ... (mapeo complejo de paymentSplits) ... */ }))) // Mantener la lógica actual si existe
            : [{
                id: generateUniqueItemId(`split-default-edit-nonpaid-${Date.now().toString().slice(-4)}`, []),
                amount: 0, currency: 'VES' as 'USD' | 'VES', paymentMethod: 'Transferencia (VES)' as PaymentMethodType,
                paidToBranchId: activeBranchForPayment, paidToAccountId: 'vesElectronic' as AccountType,
                referenceNumber: '', items: []
            }];
        setEditPaymentSplits(initialSplitsForEdit);
    }
    setIsPODialogOpen(true);
  };

  const handleOpenViewDialog = (po: PurchaseOrder) => { setPoToViewDetails(po); setIsViewPODialogOpen(true); };
  const handleOpenDeleteDialog = (poId: string) => { setPoToDeleteId(poId); setIsDeleteConfirmDialogOpen(true); };
  const handleConfirmDelete = () => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) { toast({ title: "Error", description: "No hay sede activa.", variant: "destructive" }); return; }
    setIsSubmitting(true);
    if (poToDeleteId) {
      const currentPOsForBranch = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchId);
      const poToDeleteDetails = currentPOsForBranch.find(p => p.id === poToDeleteId);
      if (poToDeleteDetails) {
        _revertPOFinancialEffects(poToDeleteDetails, exchangeRate);
      }
      const updatedPOs = currentPOsForBranch.filter(p => p.id !== poToDeleteId).sort((a,b) => {
        const dateA = a.orderDate && isValid(parseISO(a.orderDate)) ? parseISO(a.orderDate).getTime() : 0;
        const dateB = b.orderDate && isValid(parseISO(b.orderDate)) ? parseISO(b.orderDate).getTime() : 0;
        if (dateA === 0 && dateB === 0) return 0; if (dateA === 0) return 1; if (dateB === 0) return -1; return dateB - dateA;
    });
      savePurchaseOrdersData(activeBranchId, updatedPOs); setAllPurchaseOrders(updatedPOs);
      toast({ title: "Éxito", description: "OC eliminada." });
      setIsDeleteConfirmDialogOpen(false); setPoToDeleteId(null);
    }
    setIsSubmitting(false);
  };

  const formatItemsForDisplay = (itemsList?: PurchaseOrderItem[]) => {
    if (!Array.isArray(itemsList) || itemsList.length === 0) return '-';
    return itemsList.map(item => `${item.rawMaterialName} (${item.quantity} ${item.unit})`).join('; ');
  };

  const formatPaymentSplitsForDisplay = (splits?: PaymentSplit[]) => {
    if (!Array.isArray(splits) || splits.length === 0) return '-';
    return splits.map(split => {
      const itemsDesc = split.items && split.items.length > 0 ? `(${split.items.length} art.)` : '(Sin art.)';
      const rate = split.currency === 'VES' ? (split.exchangeRateAtPayment || exchangeRate || 0) : 0;
      const amountOfSplitInUSD = split.items && split.items.length > 0
                                 ? split.items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
                                 : (split.currency === 'USD' ? split.amount : (rate > 0 ? split.amount / rate : 0));

      return `${split.paymentMethod} ${split.currency} ${split.amount.toFixed(2)} ($${amountOfSplitInUSD.toFixed(2)} USD) ${itemsDesc}`;
    }).join('; ');
  };


  const handleAddNewRawMaterial = () => {
    if (!newMaterialName.trim()) { toast({ title: "Error", description: "Nombre vacío.", variant: "destructive"}); return; }
    if (addRawMaterialOption(newMaterialName.trim())) {
      setCurrentRawMaterialOptions(getCurrentRawMaterialOptions());
      toast({ title: "Éxito", description: `Materia "${newMaterialName.trim()}" añadida.`}); setNewMaterialName('');
    } else { toast({ title: "Info", description: `Materia "${newMaterialName.trim()}" ya existe.`, variant: "default"}); }
  };

  const openDeleteMaterialConfirm = (option: string) => { setMaterialToDelete(option); setIsDeleteMaterialConfirmOpen(true); };
  const handleConfirmDeleteMaterial = () => {
    if (materialToDelete) {
      removeRawMaterialOption(materialToDelete);
      setCurrentRawMaterialOptions(getCurrentRawMaterialOptions());
      toast({ title: "Éxito", description: `Materia "${materialToDelete}" eliminada.`});
      setMaterialToDelete(null); setIsDeleteMaterialConfirmOpen(false);
    }
  };

  const handleFilterApply = () => { applyFilters(); };
  const handleClearFilters = () => { 
    setDateRangeFilter(undefined); 
    setFilterSupplierId(ALL_SUPPLIERS_FILTER_VALUE);
    setFilterOrderId('');
  };

  const getReportFilename = (baseName: string): string => {
    const today = format(new Date(), "yyyy-MM-dd");
    let branchSuffix = '';
    const currentBranchId = getActiveBranchId();
    if (baseName.includes("gastos") || baseName.includes("stock") || baseName.includes("materia_prima") || baseName.includes("ordenes_compra") || baseName.includes("merma") || baseName.includes("perdidas")) {
        if (currentBranchId) branchSuffix = `_${currentBranchId}`;
    }

    if (dateRangeFilter?.from) {
      const fromDate = format(dateRangeFilter.from, "yyyy-MM-dd");
      if (dateRangeFilter.to) {
        const toDate = format(dateRangeFilter.to, "yyyy-MM-dd");
        return `${baseName}${branchSuffix}_${fromDate}_a_${toDate}.pdf`;
      }
      return `${baseName}${branchSuffix}_${fromDate}.pdf`;
    }
    return `${baseName}${branchSuffix}_general_${today}.pdf`;
  };

  const generatePurchaseOrderPDF = async (po: PurchaseOrder) => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const supplier = currentSuppliers.find(s => s.id === po.supplierId);
    const doc = new jsPDF() as jsPDFWithAutoTable;

    const rateToUseForPdf = (po.exchangeRateOnOrderDate && po.exchangeRateOnOrderDate > 0)
        ? po.exchangeRateOnOrderDate
        : exchangeRate; 

    const formatVesForPdf = (usdPrice: number) => {
        if (rateToUseForPdf > 0 && typeof usdPrice === 'number' && !isNaN(usdPrice)) {
            return `Bs. ${(usdPrice * rateToUseForPdf).toFixed(2)}`;
        }
        return "Bs. --";
    };
    
    doc.setFontSize(18); doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12); doc.text("Orden de Compra", 14, 30);
    doc.setFontSize(11); doc.text(`OC #: ${po.id}`, 14, 38);
    doc.text(`Fecha de Orden: ${po.orderDate && isValid(parseISO(po.orderDate)) ? format(parseISO(po.orderDate), "dd/MM/yyyy", { locale: es }) : 'N/A'}`, 14, 44);
    doc.text(`Entrega Estimada: ${po.expectedDelivery && isValid(parseISO(po.expectedDelivery)) ? format(parseISO(po.expectedDelivery), "dd/MM/yyyy", { locale: es }) : 'N/A'}`, 14, 50);
    const currentBranchName = availableBranches.find(b => b.id === getActiveBranchId())?.name || 'Sede Desconocida';
    doc.text(`Sede de Compra: ${currentBranchName}`, 14, 56);
    doc.text(`Tasa de Cambio Aplicada (USD/VES): ${rateToUseForPdf > 0 ? rateToUseForPdf.toFixed(2) : 'No disponible'}`, 14, 62);


    let startYContent = 72;
    if (supplier) {
      doc.text(`Proveedor: ${supplier.name}`, 14, startYContent); startYContent += 6;
      if (supplier.contactPerson) {doc.text(`Atn: ${supplier.contactPerson}`, 14, startYContent); startYContent += 6;}
      if (supplier.phone) {doc.text(`Tel: ${supplier.phone}`, 14, startYContent); startYContent += 6;}
      if (supplier.email) {doc.text(`Email: ${supplier.email}`, 14, startYContent); startYContent += 6;}
    } else { doc.text(`Proveedor: ${po.supplierName || 'Desconocido'}`, 14, startYContent); startYContent += 6;}
    
    if (po.notes) {
      startYContent += 2;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Observaciones:", 14, startYContent);
      startYContent += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(po.notes, 180);
      doc.text(splitNotes, 14, startYContent);
      startYContent += (splitNotes.length * 5) + 4;
    } else {
        startYContent += 2;
    }


    if (po.status === 'Pagado' && po.paymentSplits && po.paymentSplits.length > 0) {
        doc.setFontSize(10);
        doc.text("Formas de Pago y Artículos:", 14, startYContent); startYContent += 7;

        po.paymentSplits.forEach((split, splitIndex) => {
            doc.setFont("helvetica", "bold");
            doc.text(`Forma de Pago ${splitIndex + 1}: ${split.paymentMethod} (${split.currency})`, 14, startYContent);
            doc.setFont("helvetica", "normal");
            startYContent += 5;

            const splitItemsTotalUSD = (split.items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
            const declaredPaymentAmountDisplay = split.currency === 'USD' ? `$${split.amount.toFixed(2)}` : `Bs.${split.amount.toFixed(2)}`;
            
            const rateForThisSplitDisplay = split.currency === 'VES' ? (split.exchangeRateAtPayment || rateToUseForPdf) : rateToUseForPdf;
            const declaredPaymentAmountInUSD = split.currency === 'USD' 
                ? split.amount 
                : (rateForThisSplitDisplay > 0 ? split.amount / rateForThisSplitDisplay : 0);


            doc.text(`  Monto Pago Declarado: ${declaredPaymentAmountDisplay} (Equiv. ~$${declaredPaymentAmountInUSD.toFixed(2)} USD @ ${rateForThisSplitDisplay > 0 ? rateForThisSplitDisplay.toFixed(2) : 'N/A'})`, 16, startYContent);
            startYContent += 5;
            doc.text(`  Suma de Ítems en este Pago (USD): $${splitItemsTotalUSD.toFixed(2)}`, 16, startYContent);
            startYContent += 5;

            doc.text(`  Cuenta: ${accountTypeNames[split.paidToAccountId]} (Sede: ${availableBranches.find(b=>b.id===split.paidToBranchId)?.name || 'N/A'})`, 16, startYContent);
            if (split.referenceNumber) { startYContent += 5; doc.text(`  Referencia: ${split.referenceNumber}`, 16, startYContent); }
            startYContent += 7;

            const headItems = [["Material", "Cantidad", "Unidad", "P.Unit(USD)", "Subtotal(USD)"]];
            const bodyItems = (split.items || []).map(item => ([ item.rawMaterialName, item.quantity, item.unit, `$${item.unitPrice.toFixed(4)}`, `$${item.subtotal.toFixed(4)}` ]));
            if (bodyItems.length > 0) {
                doc.autoTable({
                    startY: startYContent, head: headItems, body: bodyItems, theme: 'grid', headStyles: { fillColor: [200, 200, 220], fontSize: 9 }, bodyStyles: { fontSize: 8 },
                    didDrawPage: (data: any) => { startYContent = data.cursor?.y ? data.cursor.y + 5 : 20; }
                });
                startYContent = (doc as any).lastAutoTable.finalY + 10;
            } else {
                doc.text("  (Sin artículos asignados a esta forma de pago)", 16, startYContent); startYContent += 7;
            }
        });
    } else {
        const head = [["Material", "Cantidad", "Unidad", "P.Unit(USD)", "Subtotal(USD)"]];
        const body = po.items.map(item => ([ item.rawMaterialName, item.quantity, item.unit, `$${item.unitPrice.toFixed(4)}`, `$${item.subtotal.toFixed(4)}` ]));
        doc.autoTable({ startY: startYContent, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95] }, didDrawPage: function (data: any) { const pageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any).getNumberOfPages(); doc.setFontSize(10); doc.text(`Página ${doc.getCurrentPageInfo ? doc.getCurrentPageInfo().pageNumber : (doc.internal as any).getCurrentPageInfo().pageNumber} de ${pageCount}`, (data.settings.margin as any).left || 14, (doc.internal as any).pageSize.height - 10); startYContent = data.cursor?.y ? data.cursor.y + 5 : 20; } });
        startYContent = (doc as any).lastAutoTable.finalY || startYContent + 20;
    }

    const finalY = startYContent;
    doc.setFontSize(12); doc.text(`Estado: ${po.status}`, 14, finalY + 10);

    let totalVesPaid = 0;
    let totalUsdPaid = 0;
    if (po.status === 'Pagado' && po.paymentSplits && po.paymentSplits.length > 0) {
        po.paymentSplits.forEach(split => {
            if (split.currency === 'VES') totalVesPaid += split.amount;
            else if (split.currency === 'USD') totalUsdPaid += split.amount;
        });
    }
    let summaryStartY = finalY + 18;
    if (totalVesPaid > 0) { doc.setFontSize(10); doc.text(`Total Pagado (VES): Bs. ${totalVesPaid.toFixed(2)}`, 14, summaryStartY); summaryStartY +=6; }
    if (totalUsdPaid > 0) { doc.setFontSize(10); doc.text(`Total Pagado (USD): $${totalUsdPaid.toFixed(2)}`, 14, summaryStartY); summaryStartY +=6; }


    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(`Neto Factura (USD): $${po.totalCost.toFixed(4)}`, 14, summaryStartY);
    if (rateToUseForPdf > 0) { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`Equivalente Neto Factura (VES): ${formatVesForPdf(po.totalCost)}`, 14, summaryStartY + 6); }
    doc.save(getReportFilename(`oc_${getActiveBranchId() || 'general'}_${po.id}`));
    toast({ title: "OC Generada", description: `OC ${po.id}.pdf descargada.` });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setInvoiceFile(event.target.files[0]);
    } else {
      setInvoiceFile(null);
    }
  };

  const handleAnalyzeInvoice = async () => {
    if (!invoiceFile) {
        toast({ title: "Sin archivo", description: "Por favor, selecciona un archivo de imagen.", variant: "destructive" });
        return;
    }
    setIsAnalyzing(true);
    setIsSubmitting(true);
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(invoiceFile);
        reader.onload = async () => {
            try {
                const invoiceImageUri = reader.result as string;

                const analysisInput: ProcessInvoiceInput = {
                  invoiceImageUri,
                  availableSuppliers: currentSuppliers.map(s => s.name),
                  availableRawMaterials: currentRawMaterialOptions,
                };
                
                const response = await processInvoice(analysisInput);
                
                const supplierFromAI = response.supplierName ? currentSuppliers.find(s => s.name === response.supplierName) : null;
                const dateFromAI = response.orderDate && isValid(parseISO(response.orderDate)) ? parseISO(response.orderDate) : undefined;
                if(dateFromAI) dateFromAI.setMinutes(dateFromAI.getMinutes() + dateFromAI.getTimezoneOffset());
                
                const finalItems: PurchaseOrderItemExtended[] = [];
                if (Array.isArray(response.items)) {
                    response.items.forEach((aiItem, index) => {
                      const priceFromInvoiceVES = aiItem.unitPrice || 0;
                      const invoiceUnit = aiItem.unit || 'unidad';
                      let finalUnitPriceUSD = 0;
                      let finalUnit = invoiceUnit;
                      let priceFound = false;
                      let bestPriceHint = '';

                      if (supplierFromAI) {
                        const priceListItem = supplierFromAI.priceList?.find(pli => pli.rawMaterialName === aiItem.description);
                        if (priceListItem) {
                          const latestPrice = getCurrentPriceFromHistory(priceListItem.priceHistory);
                          if (latestPrice) {
                            finalUnit = priceListItem.unit;
                            finalUnitPriceUSD = latestPrice.price;
                            priceFound = true;
                          }
                        }
                      }
                      
                      if (!priceFound) {
                        const rateForCalc = loadExchangeRate(dateFromAI || new Date());
                        if (rateForCalc > 0 && priceFromInvoiceVES > 0) {
                          finalUnitPriceUSD = priceFromInvoiceVES / rateForCalc;
                          bestPriceHint = `No se encontró en lista de precios. Precio calculado desde factura. Unidad "${finalUnit}" extraída de factura. VERIFICAR.`;
                        } else {
                          bestPriceHint = `No se encontró precio de lista para este proveedor. Por favor, ingrésalo manualmente.`;
                        }
                      } else {
                        const bestPriceInfoForAIItem = getBestPriceInfo(aiItem.description);
                        if (bestPriceInfoForAIItem && supplierFromAI && bestPriceInfoForAIItem.supplierId === supplierFromAI.id) {
                            bestPriceHint = `Este proveedor tiene el mejor precio.`;
                        } else if (bestPriceInfoForAIItem) {
                            bestPriceHint = `💡 Mejor opción: ${bestPriceInfoForAIItem.supplierName} a $${bestPriceInfoForAIItem.originalUnitPrice.toFixed(4)} por ${bestPriceInfoForAIItem.originalUnit}.`;
                        } else {
                            bestPriceHint = `Precio y unidad cargados desde la lista de precios de ${supplierFromAI?.name || 'proveedor actual'}.`;
                        }
                      }
                      
                      const itemQuantity = aiItem.quantity || 0;
                      const newItem: PurchaseOrderItemExtended = {
                          id: `ai-item-${Date.now()}-${index}`,
                          rawMaterialName: aiItem.description,
                          quantity: itemQuantity,
                          unit: finalUnit,
                          unitPrice: finalUnitPriceUSD,
                          subtotal: itemQuantity * finalUnitPriceUSD,
                          bestPriceHint: bestPriceHint,
                          manualPriceEdit: !priceFound,
                          unitPriceDisplayUSD: finalUnitPriceUSD.toFixed(4),
                          unitPriceDisplayVES: exchangeRate > 0 ? (finalUnitPriceUSD * exchangeRate).toFixed(2) : "0.00",
                          priceInputCurrency: 'VES'
                      };
                      finalItems.push(newItem);
                    });
                }
                
                const splitsSetter = isEditingPO ? setEditPaymentSplits : setNewPaymentSplits;
                
                if (finalItems.length > 0) {
                    if (currentOrderStatus === 'Pagado') {
                        const totalCostFromAI = response.totalCost || 0;
                        const activeBranch = getActiveBranchId() || (availableBranches.length > 0 ? availableBranches[0].id : '');
                        splitsSetter([{
                            id: `ai-split-${Date.now()}`,
                            amount: totalCostFromAI, currency: 'VES', paymentMethod: 'Transferencia (VES)',
                            paidToBranchId: activeBranch, paidToAccountId: 'vesElectronic',
                            referenceNumber: '', items: finalItems,
                        }]);
                    } else {
                        setGlobalOrderItems(finalItems);
                    }
                }
                
                if (supplierFromAI) setSelectedSupplierId(supplierFromAI.id);
                if (isEditingPO) {
                    if (response.invoiceId) setCurrentEditablePOId(response.invoiceId);
                    if (dateFromAI) setEditOrderDate(dateFromAI);
                } else {
                    if (response.invoiceId) setNewOrderId(response.invoiceId);
                    if (dateFromAI) setOrderDate(dateFromAI);
                }
                
                toast({
                    title: 'Análisis Completado',
                    description: `${response.analysisNotes || 'Revisa los datos para confirmar.'}`,
                    duration: 9000,
                });

            } catch (aiError) {
                 console.error("Error analyzing invoice (AI):", aiError);
                 toast({ title: 'Error de Análisis', description: 'La IA no pudo procesar la factura. Inténtalo de nuevo con una imagen más clara o revisa la consola para más detalles.', variant: 'destructive' });
            } finally {
                setIsAnalyzing(false);
                setIsSubmitting(false);
                setInvoiceFile(null); 
                const fileInput = document.getElementById('invoice_upload') as HTMLInputElement;
                if(fileInput) fileInput.value = '';
            }
        };
        reader.onerror = (error) => {
            console.error("Error reading file:", error);
            toast({ title: 'Error de Lectura', description: 'No se pudo leer el archivo de imagen.', variant: 'destructive' });
            setIsAnalyzing(false);
            setIsSubmitting(false);
        };
    } catch (error) {
        console.error("Error handling file:", error);
        toast({ title: 'Error Inesperado', description: 'Ocurrió un error al manejar el archivo.', variant: 'destructive' });
        setIsAnalyzing(false);
        setIsSubmitting(false);
    }
  };


  const renderGlobalItemsSection = (currentItems: PurchaseOrderItemExtended[]) => (
    <div className="space-y-2 border p-3 rounded-md">
        <Label className="font-medium">Artículos de la Orden (Global)</Label>
        {currentItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-1 items-start border-b pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 space-y-0.5">
                  {index === 0 && <Label htmlFor={`global_item_name_${item.id}_oc`} className="text-xs">Materia Prima</Label>}
                  <Select value={item.rawMaterialName} onValueChange={(value) => handleItemChange(index, 'rawMaterialName', value)} disabled={isSubmitting}>
                    <SelectTrigger id={`global_item_name_${item.id}_oc`} className="h-9"><SelectValue placeholder="Material" className="truncate" /></SelectTrigger>
                    <SelectContent>{currentRawMaterialOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  {item.bestPriceHint && (
                    <p className={cn("text-xs pt-1",
                        item.bestPriceHint.startsWith("Este proveedor") ? "text-green-600 dark:text-green-500" :
                        item.bestPriceHint.startsWith("💡") ? "text-amber-600 dark:text-amber-500" :
                        "text-muted-foreground"
                    )}>{item.bestPriceHint}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">{index === 0 && <Label htmlFor={`global_item_quantity_${item.id}_oc`} className="text-xs">Cant.</Label>}<Input id={`global_item_quantity_${item.id}_oc`} type="number" placeholder="Cant." value={item.quantity ?? 0} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0" className="h-9" disabled={isSubmitting} /></div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">{index === 0 && <Label htmlFor={`global_item_unit_${item.id}_oc`} className="text-xs">Unidad</Label>}<Select value={item.unit} onValueChange={(value) => handleItemChange(index, 'unit', value)} disabled={isSubmitting}><SelectTrigger id={`global_item_unit_${item.id}_oc`} className="h-9"><SelectValue placeholder="Unidad" /></SelectTrigger><SelectContent>{commonUnitOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">
                    {index === 0 && <Label htmlFor={`global_item_price_currency_${item.id}_oc`} className="text-xs">Moneda P.U.</Label>}
                    <Select value={item.priceInputCurrency} onValueChange={(value) => handleItemChange(index, 'priceInputCurrency', value)} disabled={isSubmitting}>
                        <SelectTrigger id={`global_item_price_currency_${item.id}_oc`} className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="VES" disabled={exchangeRate <= 0}>VES {exchangeRate <=0 ? '(Tasa no disp.)':''}</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="col-span-6 sm:col-span-3 lg:col-span-2 space-y-0.5">
                    {index === 0 && <Label htmlFor={`global_item_unit_price_ves_${item.id}_oc`} className="text-xs">P. Unit (VES)</Label>}
                    <Input id={`global_item_unit_price_ves_${item.id}_oc`} type="text" placeholder="Precio VES" value={item.unitPriceDisplayVES || ''} onChange={(e) => handleItemChange(index, 'unitPriceDisplayVES', e.target.value)} className="h-9" disabled={isSubmitting || item.priceInputCurrency !== 'VES' || exchangeRate <= 0}/>
                </div>
                 <div className="col-span-6 sm:col-span-3 lg:col-span-2 space-y-0.5">
                    {index === 0 && <Label htmlFor={`global_item_unit_price_usd_${item.id}_oc`} className="text-xs">P. Unit (USD)</Label>}
                    <Input id={`global_item_unit_price_usd_${item.id}_oc`} type="text" placeholder="Precio USD" value={item.unitPriceDisplayUSD || ''} onChange={(e) => handleItemChange(index, 'unitPriceDisplayUSD', e.target.value)} className="h-9" disabled={isSubmitting || item.priceInputCurrency !== 'USD'}/>
                </div>
                <div className="col-span-8 sm:col-span-2 lg:col-span-1 space-y-1 text-left sm:text-right">
                    {index === 0 && <Label className="text-xs md:hidden">Subtotal (USD)</Label>} {index === 0 && <Label className="text-xs hidden md:block">Subtotal (USD)</Label>} {index > 0 && <div className="md:hidden h-5"></div>} {index > 0 && <div className="hidden md:block h-5"></div>}
                    <div className="h-9 flex flex-col items-start sm:items-end justify-center">
                        <p className="text-sm font-medium">
                            <FormattedNumber value={item.subtotal} prefix="$" decimalPlaces={4} />
                        </p>
                        {item.subtotal > 0 && exchangeRate > 0 && (
                            <p className="text-xs text-muted-foreground">
                                <FormattedNumber value={item.subtotal * exchangeRate} prefix="Bs. " />
                            </p>
                        )}
                    </div>
                </div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-2 flex items-center justify-end space-x-1">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-primary hover:bg-primary/10 shrink-0"
                      onClick={() => handleUpdateSupplierPriceListItemManually(selectedSupplierId, item.rawMaterialName, Number(item.unitPrice), item.unit, item.priceInputCurrency === 'USD' ? 'usdCash' : 'default')}
                      disabled={isSubmitting || !selectedSupplierId || !item.rawMaterialName || item.unitPrice < 0 || !item.unit}
                      title={`Guardar precio en lista ${item.priceInputCurrency === 'USD' ? 'USD Efectivo' : 'Estándar'} del proveedor`}>
                      <SaveIcon className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveGlobalItem(index)} className="h-9 w-9 text-destructive hover:bg-destructive/10" disabled={isSubmitting}><Trash className="h-4 w-4" /></Button>
                </div>
            </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={handleAddGlobalItem} className="mt-2" disabled={isSubmitting || currentRawMaterialOptions.length === 0}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Artículo</Button>
    </div>
  );

  const renderPaymentSplitsSection = () => {
    const paymentSplitsToRender = isEditingPO ? editPaymentSplits : newPaymentSplits;
    const formTypeForSplits = isEditingPO ? 'edit' : 'new';

    const getPaymentMethodsForCurrency = (currency: 'USD' | 'VES'): PaymentMethodType[] => {
        if (currency === 'USD') return ['Efectivo USD'];
        if (currency === 'VES' && exchangeRate > 0) return ['Pago Móvil (VES)', 'Transferencia (VES)', 'Efectivo VES'];
        if (currency === 'VES' && exchangeRate <= 0) return [];
        return ['Otro'];
    };
    
    const getAccountsForPaymentMethod = (currency: 'USD' | 'VES', method: PaymentMethodType): AccountType[] => {
        if (currency === 'USD' && method === 'Efectivo USD') return ['usdCash'];
        if (currency === 'VES' && exchangeRate > 0) {
            if (method === 'Pago Móvil (VES)' || method === 'Transferencia (VES)') return ['vesElectronic'];
            if (method === 'Efectivo VES') return ['vesCash'];
        }
        if ((currency === 'VES' && exchangeRate <= 0) || method === 'Otro') return [];
        return Object.values(accountTypeNames).map((_, idx) => Object.keys(accountTypeNames)[idx] as AccountType);
    };

    return (
      <div className="space-y-3 border p-3 rounded-md">
        <Label className="font-medium">Formas de Pago Múltiples</Label>
        {paymentSplitsToRender.map((split, index) => {
          const availablePaymentMethods = getPaymentMethodsForCurrency(split.currency);
          const availableAccounts = getAccountsForPaymentMethod(split.currency, split.paymentMethod);
          
          const splitItemsTotalUSD = (split.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
          let splitAmountToDisplay = 0;
          if (split.currency === 'VES') {
            splitAmountToDisplay = splitItemsTotalUSD * (split.exchangeRateAtPayment || exchangeRate || 1);
          } else {
            splitAmountToDisplay = splitItemsTotalUSD;
          }

          return (
          <div key={split.id} className="border-b pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0 bg-background p-2 rounded-md shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end mb-2">
              <div className="space-y-1 lg:col-span-1">
                  <Label htmlFor={`split_amount_display_${split.id}`} className="text-xs">Monto Pago ({split.currency})</Label>
                  <div className="h-9 rounded-md bg-muted/50 px-3 flex items-center justify-end">
                    <FormattedNumber value={splitAmountToDisplay} prefix={split.currency === 'USD' ? '$' : 'Bs. '} />
                  </div>
              </div>
              <div className="space-y-1 lg:col-span-1">
                  <Label htmlFor={`split_currency_${split.id}`} className="text-xs">Moneda Pago</Label>
                  <Select value={split.currency} onValueChange={val => handleSplitChange(split.id, 'currency', val, formTypeForSplits)} disabled={isSubmitting }>
                      <SelectTrigger id={`split_currency_${split.id}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="VES" disabled={exchangeRate <= 0}>VES {exchangeRate <= 0 ? '(Tasa no disp.)' : ''}</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1 lg:col-span-1">
                  <Label htmlFor={`split_method_${split.id}`} className="text-xs">Método</Label>
                  <Select value={split.paymentMethod} onValueChange={val => handleSplitChange(split.id, 'paymentMethod', val, formTypeForSplits)} disabled={isSubmitting || availablePaymentMethods.length === 0}>
                      <SelectTrigger id={`split_method_${split.id}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          {availablePaymentMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          {availablePaymentMethods.length === 0 && <SelectItem value="no-methods-available" disabled>N/A para moneda</SelectItem>}
                      </SelectContent>
                  </Select>
              </div>
                       {split.currency === 'VES' && (
                         <div className="space-y-1 lg:col-span-1">
                            <Label htmlFor={`split_exchange_rate_${split.id}`} className="text-xs">Tasa (Opc)</Label>
                            <Input id={`split_exchange_rate_${split.id}`} type="number" value={split.exchangeRateAtPayment || ''} onChange={e => handleSplitChange(split.id, 'exchangeRateAtPayment', parseFloat(e.target.value) || undefined, formTypeForSplits)} placeholder={`Global: ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'N/A'}`} disabled={isSubmitting || exchangeRate <=0} className="h-9"/>
                        </div>
                       )}
                        {(split.paymentMethod === 'Pago Móvil (VES)' || split.paymentMethod === 'Transferencia (VES)') && (
                            <div className="space-y-1 lg:col-span-1">
                                {index === 0 && <Label htmlFor={`split_ref_${split.id}`} className="text-xs">Ref. (6 dig)</Label>}
                                <Input id={`split_ref_${split.id}`} value={split.referenceNumber || ''} onChange={e => handleSplitChange(split.id, 'referenceNumber', e.target.value, formTypeForSplits)} placeholder="123456" disabled={isSubmitting} className="h-9" maxLength={6}/>
                            </div>
                        )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor={`split_branch_${split.id}`} className="text-xs">Sede Egreso</Label>
                  <Select value={split.paidToBranchId} onValueChange={val => handleSplitChange(split.id, 'paidToBranchId', val, formTypeForSplits)} disabled={isSubmitting}>
                      <SelectTrigger id={`split_branch_${split.id}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
              </div>
              <div className="space-y-1 lg:col-span-2">
                  <Label htmlFor={`split_account_${split.id}`} className="text-xs">Cuenta Egreso</Label>
                    <Select value={split.paidToAccountId} onValueChange={val => handleSplitChange(split.id, 'paidToAccountId', val as AccountType, formTypeForSplits)} disabled={isSubmitting || availableAccounts.length === 0}>
                      <SelectTrigger id={`split_account_${split.id}`} className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                          {availableAccounts.map(accId => {
                              const accountDetails = loadFromLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, split.paidToBranchId || '', true)[accId as AccountType];
                              return (<SelectItem key={accId} value={accId}>{accountTypeNames[accId]} ({accountDetails?.currency})</SelectItem>);
                          })}
                          {availableAccounts.length === 0 && <SelectItem value="no-accounts-available" disabled>N/A para moneda/método</SelectItem>}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex items-end justify-end lg:col-span-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePaymentSplit(split.id, formTypeForSplits)} disabled={isSubmitting || paymentSplitsToRender.length <=1} className="h-9 w-9 text-destructive hover:bg-destructive/10"><Trash className="h-4 w-4" /></Button>
              </div>
            </div>
            {renderItemsForSplitSection(index, split.items || [])}
          </div>
        )})}
        <Button type="button" variant="outline" size="sm" onClick={() => handleAddPaymentSplit(formTypeForSplits)} disabled={isSubmitting} className="mt-2">
            <DollarSign className="mr-2 h-4 w-4" /> Añadir Forma de Pago
        </Button>
      </div>
    );
  };

  const renderItemsForSplitSection = (splitIndex: number, currentItems: PurchaseOrderItemExtended[]) => {
    const currentSplit = (isEditingPO ? editPaymentSplits : newPaymentSplits)[splitIndex];
    if (!currentSplit) return null;
    const currentSplitCurrency = currentSplit.currency;
    return (
    <div className="space-y-2 border p-3 rounded-md mt-2 bg-muted/30">
        <Label className="font-medium text-xs">Artículos para esta Forma de Pago</Label>
        {currentItems.map((item, itemIndex) => {
            return (
            <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-1 items-start border-b pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
                <div className="col-span-12 sm:col-span-6 lg:col-span-2 space-y-0.5">
                  {itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_name_${item.id}_oc`} className="text-xs">Materia Prima</Label>}
                  <Select value={item.rawMaterialName} onValueChange={(value) => handleItemChange(itemIndex, 'rawMaterialName', value, splitIndex)} disabled={isSubmitting}>
                    <SelectTrigger id={`split${splitIndex}_item_name_${item.id}_oc`} className="h-8 text-xs"><SelectValue placeholder="Material" className="truncate" /></SelectTrigger>
                    <SelectContent>{currentRawMaterialOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  {item.bestPriceHint && (
                    <p className={cn("text-xs pt-1",
                        item.bestPriceHint.startsWith("Este proveedor") ? "text-green-600 dark:text-green-500" :
                        item.bestPriceHint.startsWith("💡") ? "text-amber-600 dark:text-amber-500" :
                        "text-muted-foreground"
                    )}>{item.bestPriceHint}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">{itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_quantity_${item.id}_oc`} className="text-xs">Cant.</Label>}<Input id={`split${splitIndex}_item_quantity_${item.id}_oc`} type="number" placeholder="Cant." value={item.quantity ?? 0} onChange={(e) => handleItemChange(itemIndex, 'quantity', e.target.value, splitIndex)} min="0" className="h-8 text-xs" disabled={isSubmitting} /></div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">{itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_unit_${item.id}_oc`} className="text-xs">Unidad</Label>}<Select value={item.unit} onValueChange={(value) => handleItemChange(itemIndex, 'unit', value, splitIndex)} disabled={isSubmitting}><SelectTrigger id={`split${splitIndex}_item_unit_${item.id}_oc`} className="h-8 text-xs"><SelectValue placeholder="Unidad" /></SelectTrigger><SelectContent>{commonUnitOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-1 space-y-0.5">
                    {itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_price_currency_${item.id}_oc`} className="text-xs">Moneda P.U.</Label>}
                    <Select value={currentSplitCurrency} disabled={true}>
                        <SelectTrigger id={`split${splitIndex}_item_price_currency_${item.id}_oc`} className="h-8 text-xs bg-muted/50"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="VES">VES</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="col-span-6 sm:col-span-3 lg:col-span-2 space-y-0.5">
                    {itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_unit_price_ves_${item.id}_oc`} className="text-xs">P. Unit (VES)</Label>}
                    <Input id={`split${splitIndex}_item_unit_price_ves_${item.id}_oc`} type="text" placeholder="Precio VES" value={item.unitPriceDisplayVES || ''} onChange={(e) => handleItemChange(itemIndex, 'unitPriceDisplayVES', e.target.value, splitIndex)} className="h-8 text-xs" disabled={isSubmitting || currentSplitCurrency !== 'VES' || exchangeRate <= 0}/>
                </div>
                 <div className="col-span-6 sm:col-span-3 lg:col-span-2 space-y-0.5">
                    {itemIndex === 0 && <Label htmlFor={`split${splitIndex}_item_unit_price_usd_${item.id}_oc`} className="text-xs">P. Unit (USD)</Label>}
                    <Input id={`split${splitIndex}_item_unit_price_usd_${item.id}_oc`} type="text" placeholder="Precio USD" value={item.unitPriceDisplayUSD || ''} onChange={(e) => handleItemChange(itemIndex, 'unitPriceDisplayUSD', e.target.value, splitIndex)} className="h-8 text-xs" disabled={isSubmitting || currentSplitCurrency !== 'USD'}/>
                </div>
                <div className="col-span-8 sm:col-span-2 lg:col-span-1 space-y-1 text-left sm:text-right">
                    {itemIndex === 0 && <Label className="text-xs md:hidden">Subtotal (USD)</Label>} {itemIndex === 0 && <Label className="text-xs hidden md:block">Subtotal (USD)</Label>} {itemIndex > 0 && <div className="md:hidden h-5"></div>} {itemIndex > 0 && <div className="hidden md:block h-5"></div>}
                    <div className="h-8 flex flex-col items-start sm:items-end justify-center">
                        <p className="text-sm font-medium">
                            <FormattedNumber value={item.subtotal} prefix="$" decimalPlaces={4} />
                        </p>
                        {item.subtotal > 0 && exchangeRate > 0 && (
                            <p className="text-xs text-muted-foreground">
                                <FormattedNumber value={item.subtotal * exchangeRate} prefix="Bs. " />
                            </p>
                        )}
                    </div>
                </div>
                <div className="col-span-4 sm:col-span-2 lg:col-span-2 flex items-center justify-end space-x-1">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0"
                      onClick={() => handleUpdateSupplierPriceListItemManually(selectedSupplierId, item.rawMaterialName, Number(item.unitPrice), item.unit, currentSplitCurrency === 'USD' ? 'usdCash' : 'default')}
                      disabled={isSubmitting || !selectedSupplierId || !item.rawMaterialName || item.unitPrice < 0 || !item.unit}
                      title={`Guardar precio en lista ${currentSplitCurrency === 'USD' ? 'USD Efectivo' : 'Estándar'} del proveedor`}>
                      <SaveIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItemFromSplit(splitIndex, itemIndex)} className="h-8 w-8 text-destructive hover:bg-destructive/10" disabled={isSubmitting}><Trash className="h-3.5 w-3.5" /></Button>
                </div>
            </div>
        )})}
        <Button type="button" variant="outline" size="xs" className="mt-1" onClick={() => handleAddItemToSplit(splitIndex)} disabled={isSubmitting || currentRawMaterialOptions.length === 0}>
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Añadir Artículo a este Pago
        </Button>
    </div>
  )};

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión de Órdenes de Compra" description={`Optimiza tu proceso de compra. Aquí puedes comprar tanto Materia Prima como Productos de Reventa (ej. Catalinas). Los productos de reventa deben ser agregados primero en "Gestionar Materias Primas" y su receta debe tener marcada la opción "Es Producto de Reventa". Sede actual: ${availableBranches.find(b=>b.id === getActiveBranchId())?.name || 'No Seleccionada'}.`} icon={Receipt}
        actions={ <div className="flex space-x-2"> <Button onClick={() => setIsManageMaterialsDialogOpen(true)} variant="outline" disabled={isSubmitting}><Settings className="mr-2 h-4 w-4" />Gestionar Materias Primas</Button> <Button onClick={() => setIsManageConversionsDialogOpen(true)} variant="outline" disabled={isSubmitting}><Settings2 className="mr-2 h-4 w-4" />Gestionar Conversiones (Global)</Button> <Button onClick={() => { resetAddForm(); setIsPODialogOpen(true); }} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Crear Nueva OC</Button> </div> }
      />
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Historial de Órdenes de Compra</CardTitle>
              <CardDescription>Registro de todas tus OCs para la sede actual.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date-filter-orders" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal",!dateRangeFilter && "text-muted-foreground")} disabled={isSubmitting}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRangeFilter?.from ? (dateRangeFilter.to ? (<>{format(dateRangeFilter.from, "LLL dd, y", { locale: es })} - {format(dateRangeFilter.to, "LLL dd, y", { locale: es })}</>) : (format(dateRangeFilter.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar por Fecha</span>)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={dateRangeFilter?.from} selected={dateRangeFilter} onSelect={setDateRangeFilter} numberOfMonths={2} locale={es} disabled={isSubmitting} />
                  </PopoverContent>
                </Popover>
                <Select value={filterSupplierId} onValueChange={setFilterSupplierId} disabled={isSubmitting || isLoading}>
                    <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar Proveedor" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_SUPPLIERS_FILTER_VALUE}>Todos los Proveedores</SelectItem>
                        {currentSuppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                    </SelectContent>
                </Select>
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar por ID de OC..."
                        className="pl-8 sm:w-[200px]"
                        value={filterOrderId}
                        onChange={(e) => setFilterOrderId(e.target.value)}
                        disabled={isSubmitting || isLoading}
                    />
                </div>
                <Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto" disabled={isSubmitting || isLoading}>Limpiar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Proveedor</TableHead><TableHead>Fecha Pedido</TableHead><TableHead>Entrega</TableHead><TableHead>Artículos/Pagos</TableHead><TableHead className="text-right">Total (USD)</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>{filteredPurchaseOrders.map((po) => {
              const itemsToDisplay = po.status === 'Pagado' && po.paymentSplits ? formatPaymentSplitsForDisplay(po.paymentSplits) : formatItemsForDisplay(po.items);
              return (
                <TableRow key={po.id}>
                  <TableCell>{po.id}</TableCell>
                  <TableCell className="font-medium">{po.supplierName}</TableCell>
                  <TableCell>{po.orderDate && isValid(parseISO(po.orderDate)) ? format(parseISO(po.orderDate), "dd/MM/yy", { locale: es }) : '-'}</TableCell>
                  <TableCell>{po.expectedDelivery && isValid(parseISO(po.expectedDelivery)) ? format(parseISO(po.expectedDelivery), "dd/MM/yy", { locale: es }) : '-'}</TableCell>
                  <TableCell className="max-w-xs truncate" title={itemsToDisplay}>{itemsToDisplay}</TableCell>
                  <TableCell className="text-right"><FormattedNumber value={po.totalCost} prefix="$" decimalPlaces={4} /></TableCell>
                  <TableCell>
                    <Badge variant={po.status === 'Pagado' ? 'default' : po.status === 'Cancelado' ? 'destructive' : 'outline'} className={cn("whitespace-nowrap", po.status === 'Pagado' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : '')}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenViewDialog(po)} title="Ver Detalles de OC" disabled={isSubmitting}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting} title="Más Acciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                            {po.status !== 'Pagado' ? (
                                <DropdownMenuItem onClick={() => handleMarkAsPaid(po.id)} disabled={isSubmitting}>
                                <PackageCheck className="mr-2 h-4 w-4 text-green-600"/>Marcar Pagada
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => generatePurchaseOrderPDF(po)} disabled={isSubmitting}><InvoiceIcon className="mr-2 h-4 w-4" />Generar PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(po)} disabled={isSubmitting}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenDeleteDialog(po.id)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
          {filteredPurchaseOrders.length === 0 && !isLoading && (<p className="text-center text-muted-foreground py-8">{dateRangeFilter?.from || filterSupplierId !== ALL_SUPPLIERS_FILTER_VALUE || filterOrderId ? "No hay OCs para filtros." : "No hay OCs."}</p>)}
        </CardContent>
      </Card>
      <Dialog open={isPODialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) {setIsPODialogOpen(isOpen); if (!isOpen) resetAddForm();} }}><DialogContent className="sm:max-w-7xl max-h-[90vh]"><DialogHeader><DialogTitle>{isEditingPO ? "Editar OC" : "Crear Nueva OC"}</DialogTitle><DialogDescription>{isEditingPO ? "Actualiza detalles." : "Completa detalles."}</DialogDescription></DialogHeader>
        <div className="p-4 border rounded-lg bg-muted/50">
          <Label className="font-semibold text-base">Autocompletar con Factura (Beta)</Label>
          <p className="text-sm text-muted-foreground mb-3">Sube una foto de la factura y la IA intentará rellenar los datos.</p>
          <div className="flex gap-2 items-center">
              <Input
                  id="invoice_upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="flex-grow"
              />
              <Button onClick={handleAnalyzeInvoice} disabled={isSubmitting || !invoiceFile}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  {isSubmitting ? 'Analizando...' : 'Analizar'}
              </Button>
          </div>
        </div>
      <ScrollArea className="max-h-[calc(80vh-320px)] p-1 pr-3"><div className="grid gap-4 py-4 "><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="po_id_input">ID OC (Factura)</Label><Input id="po_id_input" value={isEditingPO ? currentEditablePOId : newOrderId} onChange={(e) => { if (isEditingPO) { setCurrentEditablePOId(e.target.value); } else { setNewOrderId(e.target.value); }}} placeholder="FAC-00123" disabled={isSubmitting} /></div><div className="space-y-1"><Label htmlFor="supplier_select">Proveedor</Label><Select value={selectedSupplierId} onValueChange={setSelectedSupplierId} disabled={isSubmitting}><SelectTrigger id="supplier_select"><SelectValue placeholder="Selecciona" /></SelectTrigger><SelectContent>{currentSuppliers.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent></Select></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1"><Label htmlFor="po_status_select">Estado</Label><Select value={currentOrderStatus} onValueChange={(value) => setCurrentOrderStatus(value as PurchaseOrderStatus)} disabled={isSubmitting}><SelectTrigger id="po_status_select"><SelectValue /></SelectTrigger><SelectContent>{purchaseOrderStatusList.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="order_date">Fecha Pedido</Label><Popover open={isOrderDatePickerOpen} onOpenChange={setIsOrderDatePickerOpen}><PopoverTrigger asChild><Button id="order_date" variant={"outline"} className={cn("w-full justify-start", !(isEditingPO ? editOrderDate : orderDate) && "text-muted-foreground")} disabled={isSubmitting}><CalendarIcon className="mr-2 h-4 w-4" />{(isEditingPO ? editOrderDate : orderDate) ? format((isEditingPO ? editOrderDate! : orderDate!), "PPP", { locale: es }) : <span>Elige</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={isEditingPO ? editOrderDate : orderDate} onSelect={(date) => { if (isEditingPO) { setEditOrderDate(date); } else { setOrderDate(date); } setIsOrderDatePickerOpen(false); }} initialFocus locale={es} disabled={isSubmitting} /></PopoverContent></Popover></div><div className="space-y-1"><Label htmlFor="expected_delivery">Entrega Estimada</Label><Popover open={isDeliveryDatePickerOpen} onOpenChange={setIsDeliveryDatePickerOpen}><PopoverTrigger asChild><Button id="expected_delivery" variant={"outline"} className={cn("w-full justify-start", !(isEditingPO ? editExpectedDelivery : expectedDelivery) && "text-muted-foreground")} disabled={isSubmitting}><CalendarIcon className="mr-2 h-4 w-4" />{(isEditingPO ? editExpectedDelivery : expectedDelivery) ? format((isEditingPO ? editExpectedDelivery! : expectedDelivery!), "PPP", { locale: es }) : <span>Elige</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={isEditingPO ? editExpectedDelivery : expectedDelivery} onSelect={(date) => { if (isEditingPO) { setEditExpectedDelivery(date); } else { setExpectedDelivery(date); } setIsDeliveryDatePickerOpen(false); }} initialFocus locale={es} disabled={isSubmitting} /></PopoverContent></Popover></div></div>
        {currentOrderStatus === 'Pagado' ? renderPaymentSplitsSection() : renderGlobalItemsSection(globalOrderItems)}
        <div className="space-y-1 mt-4">
            <Label htmlFor="po_notes">Observaciones (Opcional)</Label>
            <Textarea
                id="po_notes"
                value={isEditingPO ? editPONotes : newPONotes}
                onChange={(e) => {
                    if (isEditingPO) setEditPONotes(e.target.value);
                    else setNewPONotes(e.target.value);
                }}
                placeholder="Anotaciones internas sobre la orden, condiciones de pago especiales, etc."
                disabled={isSubmitting}
                className="min-h-[60px]"
            />
        </div>
        <div className="space-y-1 mt-4 text-right">
            {currentOrderStatus === 'Pagado' ? (
              (() => {
                const splits = isEditingPO ? editPaymentSplits : newPaymentSplits;
                const totalAmountVES_footer = (splits || [])
                  .filter(split => split.currency === 'VES')
                  .reduce((sum, split) => sum + (split.amount || 0), 0);
                const totalAmountUSD_footer = (splits || [])
                  .filter(split => split.currency === 'USD')
                  .reduce((sum, split) => sum + (split.amount || 0), 0);
                return (
                  <>
                    {totalAmountVES_footer > 0 && <Label className="text-sm font-semibold block">Total Pagado (VES): <FormattedNumber value={totalAmountVES_footer} prefix="Bs. " /></Label>}
                    {totalAmountUSD_footer > 0 && <Label className="text-sm font-semibold block">Total Pagado (USD): <FormattedNumber value={totalAmountUSD_footer} prefix="$" /></Label>}
                    {(totalAmountVES_footer > 0 || totalAmountUSD_footer > 0) && <Separator className="my-1" />}
                    <Label className="text-lg font-semibold block">
                      Neto Factura (USD): <FormattedNumber value={displayedTotalCost} prefix="$" decimalPlaces={4} />
                    </Label>
                    {displayedTotalCost > 0 && exchangeRate > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Equivalente Neto Factura (VES): <FormattedNumber value={displayedTotalCost * exchangeRate} prefix="Bs. " />
                      </p>
                    )}
                  </>
                );
              })()
            ) : (
              <>
                <Label className="text-lg font-semibold">Costo Total (USD): <FormattedNumber value={displayedTotalCost} prefix="$" decimalPlaces={4} /></Label>
                {displayedTotalCost > 0 && exchangeRate > 0 && (
                  <p className="text-sm text-muted-foreground"><FormattedNumber value={displayedTotalCost * exchangeRate} prefix="Bs. " /></p>
                )}
              </>
            )}
        </div>
      </div></ScrollArea><DialogFooter className="pt-2 border-t"><DialogClose asChild><Button variant="outline" onClick={() => { if(!isSubmitting) {setIsPODialogOpen(false); resetAddForm();}}} disabled={isSubmitting}>Cancelar</Button></DialogClose><Button type="button" onClick={handleSubmitPO} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditingPO ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}{isSubmitting ? 'Guardando...' : (isEditingPO ? "Guardar Cambios" : "Guardar OC")}</Button></DialogFooter></DialogContent></Dialog>
      
      <Dialog open={isViewPODialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsViewPODialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalles OC: {poToViewDetails?.id}</DialogTitle>
            <DialogDescription>Info completa.</DialogDescription>
          </DialogHeader>
          {poToViewDetails && (
            <>
            <ScrollArea className="max-h-[calc(70vh-100px)] p-1 pr-3">
              <div className="space-y-3 py-4 text-sm">
                  <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Proveedor:</Label>
                    <span>{poToViewDetails.supplierName}</span>
                  </div>
                  <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Fecha Orden:</Label>
                    <span>{poToViewDetails.orderDate && isValid(parseISO(poToViewDetails.orderDate)) ? format(parseISO(poToViewDetails.orderDate), "dd/MM/yyyy", { locale: es }) : '-'}</span>
                  </div>
                  <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Entrega Estimada:</Label>
                    <span>{poToViewDetails.expectedDelivery && isValid(parseISO(poToViewDetails.expectedDelivery)) ? format(parseISO(poToViewDetails.expectedDelivery), "dd/MM/yyyy", { locale: es }) : '-'}</span>
                  </div>
                   <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Sede Compra:</Label>
                    <span>{availableBranches.find(b => b.id === getActiveBranchId())?.name || 'Desconocida'}</span>
                  </div>
                  <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Estado:</Label>
                    <Badge variant={poToViewDetails.status === 'Pagado' ? 'default' : poToViewDetails.status === 'Cancelado' ? 'destructive' : 'outline'} className={cn("whitespace-nowrap justify-self-start", poToViewDetails.status === 'Pagado' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : '')}>
                      {poToViewDetails.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline">
                    <Label className="font-semibold">Tasa Aplicada (PDF):</Label>
                    <span>{poToViewDetails.exchangeRateOnOrderDate && poToViewDetails.exchangeRateOnOrderDate > 0 ? poToViewDetails.exchangeRateOnOrderDate.toFixed(2) : (exchangeRate > 0 ? `${exchangeRate.toFixed(2)} (Actual)` : 'No disponible')}</span>
                  </div>

                  {poToViewDetails.notes && (
                    <div className="pt-2">
                        <Label className="font-semibold">Observaciones:</Label>
                        <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md border mt-1">{poToViewDetails.notes}</p>
                    </div>
                  )}

                  <Separator className="my-3" />
                  <h4 className="font-semibold text-md mb-1">Artículos y Pagos:</h4>
                  <div>
                    {poToViewDetails.status === 'Pagado' && poToViewDetails.paymentSplits && poToViewDetails.paymentSplits.length > 0 ? (
                      poToViewDetails.paymentSplits.map((split, index) => (
                        <div key={split.id} className="mb-3 border rounded-md p-3 bg-muted/5">
                          <p className="text-xs font-semibold mb-1">Forma de Pago {index + 1}: {split.paymentMethod} ({split.currency})</p>
                          <p className="text-xs text-muted-foreground">Monto Pago Declarado: <FormattedNumber value={split.amount} prefix={split.currency === 'USD' ? '$' : 'Bs. '} /></p>
                          <p className="text-xs text-muted-foreground">Suma Ítems en Pago (USD): <FormattedNumber value={(split.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0)} prefix="$" decimalPlaces={4} /></p>
                          <p className="text-xs text-muted-foreground">Cuenta: {accountTypeNames[split.paidToAccountId]} (Sede: {availableBranches.find(b=>b.id===split.paidToBranchId)?.name || 'N/A'})</p>
                          {split.referenceNumber && <p className="text-xs text-muted-foreground">Referencia: {split.referenceNumber}</p>}
                          
                          <Table className="text-xs mt-1.5"><TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">P.Unit(USD)</TableHead><TableHead className="text-right">Subtotal(USD)</TableHead></TableRow></TableHeader>
                            <TableBody>{(split.items || []).map(item => (<TableRow key={item.id}><TableCell>{item.rawMaterialName}</TableCell><TableCell className="text-right"><FormattedNumber value={item.quantity} decimalPlaces={3}/></TableCell><TableCell>{item.unit}</TableCell><TableCell className="text-right"><FormattedNumber value={item.unitPrice} prefix="$" decimalPlaces={4}/></TableCell><TableCell className="text-right"><FormattedNumber value={item.subtotal} prefix="$" decimalPlaces={4}/></TableCell></TableRow>))}</TableBody>
                          </Table>
                        </div>
                      ))
                    ) : (
                      <Table><TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead>Unidad</TableHead><TableHead className="text-right">P.Unit(USD)</TableHead><TableHead className="text-right">Subtotal(USD)</TableHead></TableRow></TableHeader>
                        <TableBody>{poToViewDetails.items.map(item => (<TableRow key={item.id}><TableCell>{item.rawMaterialName}</TableCell><TableCell className="text-right"><FormattedNumber value={item.quantity} decimalPlaces={3}/></TableCell><TableCell>{item.unit}</TableCell><TableCell className="text-right"><FormattedNumber value={item.unitPrice} prefix="$" decimalPlaces={4}/></TableCell><TableCell className="text-right"><FormattedNumber value={item.subtotal} prefix="$" decimalPlaces={4}/></TableCell></TableRow>))}</TableBody>
                      </Table>
                    )}
                  </div>
                  <Separator className="my-3" />
                   <div className="mt-3 text-right">
                    {poToViewDetails.status === 'Pagado' && poToViewDetails.paymentSplits && poToViewDetails.paymentSplits.length > 0 ? (
                      (() => {
                        const totalAmountVES_footer_view = poToViewDetails.paymentSplits
                          .filter(split => split.currency === 'VES')
                          .reduce((sum, split) => sum + (split.amount || 0), 0);
                        const totalAmountUSD_footer_view = poToViewDetails.paymentSplits
                          .filter(split => split.currency === 'USD')
                          .reduce((sum, split) => sum + (split.amount || 0), 0);
                        return (
                          <>
                            {totalAmountVES_footer_view > 0 && <p className="text-sm font-semibold">Total Pagado (VES): <FormattedNumber value={totalAmountVES_footer_view} prefix="Bs. " /></p>}
                            {totalAmountUSD_footer_view > 0 && <p className="text-sm font-semibold">Total Pagado (USD): <FormattedNumber value={totalAmountUSD_footer_view} prefix="$" /></p>}
                            {(totalAmountVES_footer_view > 0 || totalAmountUSD_footer_view > 0) && <Separator className="my-1" />}
                            <p className="font-semibold text-base">Neto Factura (USD): <FormattedNumber value={poToViewDetails.totalCost} prefix="$" decimalPlaces={4} /></p>
                            {poToViewDetails.totalCost > 0 && (poToViewDetails.exchangeRateOnOrderDate || exchangeRate) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Equivalente Neto Factura (VES): <FormattedNumber value={poToViewDetails.totalCost * (poToViewDetails.exchangeRateOnOrderDate || exchangeRate)} prefix="Bs. " />
                              </p>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <p className="font-semibold text-base">Costo Total (USD): <FormattedNumber value={poToViewDetails.totalCost} prefix="$" decimalPlaces={4} /></p>
                        {poToViewDetails.totalCost > 0 && (poToViewDetails.exchangeRateOnOrderDate || exchangeRate) > 0 && (
                            <p className="text-xs text-muted-foreground"><FormattedNumber value={poToViewDetails.totalCost * (poToViewDetails.exchangeRateOnOrderDate || exchangeRate)} prefix="Bs. " /></p>
                        )}
                      </>
                    )}
                  </div>
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
                <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
                <Button onClick={() => generatePurchaseOrderPDF(poToViewDetails)} disabled={isSubmitting}><InvoiceIcon className="mr-2 h-4 w-4" />Generar PDF</Button>
            </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen)}}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Eliminar OC? Ajustará stock/cuentas si estaba pagada.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-end"><DialogClose asChild><Button variant="outline" onClick={() => {if(!isSubmitting) {setIsDeleteConfirmDialogOpen(false); setPoToDeleteId(null)}}} disabled={isSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{isSubmitting ? 'Eliminando...' : 'Eliminar OC'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isManageMaterialsDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsManageMaterialsDialogOpen(isOpen); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Gestionar Materias Primas y Productos de Reventa</DialogTitle><DialogDescription>Añade/elimina opciones de la lista global. Los productos de reventa también deben añadirse aquí para poder incluirlos en Órdenes de Compra.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="flex items-center space-x-2"><Input id="new_material_name" value={newMaterialName} onChange={(e) => setNewMaterialName(e.target.value)} placeholder="Nueva materia o producto de reventa" disabled={isSubmitting} /><Button type="button" onClick={handleAddNewRawMaterial} disabled={isSubmitting}><ListPlus className="mr-2 h-4 w-4"/> Añadir</Button></div><Separator className="my-4" /><Label>Artículos Comprables Existentes:</Label>{currentRawMaterialOptions.length > 0 ? (<ScrollArea className="h-48 rounded-md border p-2">{currentRawMaterialOptions.map(option => (<div key={option} className="flex items-center justify-between py-1.5 hover:bg-muted/50 px-2 rounded-md"><span>{option}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => openDeleteMaterialConfirm(option)} disabled={isSubmitting}><XCircle className="h-4 w-4" /></Button></div>))}</ScrollArea>) : (<p className="text-sm text-muted-foreground">No hay materias primas.</p>)}</div><DialogFooter><DialogClose asChild><Button variant="outline" onClick={() => {if(!isSubmitting) setIsManageMaterialsDialogOpen(false);}} disabled={isSubmitting}>Cerrar</Button></DialogClose></DialogFooter></DialogContent></Dialog>
      <Dialog open={isDeleteMaterialConfirmOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsDeleteMaterialConfirmOpen(isOpen); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Eliminar materia prima "{materialToDelete}"?</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline" onClick={() => {if(!isSubmitting) setIsDeleteMaterialConfirmOpen(false);}} disabled={isSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDeleteMaterial} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{isSubmitting ? 'Eliminando...' : 'Eliminar'}</Button></DialogFooter></DialogContent></Dialog>

      <ManageConversionsDialog
        isOpen={isManageConversionsDialogOpen}
        onOpenChange={setIsManageConversionsDialogOpen}
        onConversionsUpdated={handleConversionsUpdated}
      />
    </div>
  );
}


