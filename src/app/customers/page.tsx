

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, PlusCircle, MoreHorizontal, Edit, Trash2, BarChartHorizontal, AlertTriangle, FileText as InvoiceHistoryIcon, Eye, Calendar as CalendarIcon, ArrowDown, ArrowUp, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  customersData as initialCustomersDataGlobal,
  saveCustomersData,
  loadFromLocalStorage,
  type Customer,
  salesData as initialSalesDataGlobal,
  type Sale,
  type SaleItem,
  paymentsData as initialPaymentsDataGlobal,
  type Payment,
  getInvoiceStatus,
  type SaleStatus,
  loadExchangeRate,
  KEYS,
  calculateCustomerBalance,
  calculateInvoiceBalance,
  calculateCustomerOverdueBalance,
} from '@/lib/data-storage';
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, getWeek } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Bar
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Separator } from '@/components/ui/separator';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

interface ProductStat {
  name: string;
  quantity: number;
}

interface CombinedProductStat {
  name: string;
  sold: number;
  changedNormal: number;
  changedNonDispatchable: number;
  totalChanged: number;
  changeRate: number;
}

interface WeeklySummary {
  weekKey: string;
  startDate: Date;
  endDate: Date;
  purchases: Sale[]; // Guardar ventas completas
  creditNotes: Sale[]; // Guardar NCs
  returns: { saleId: string; saleDate: string; items: SaleItem[] }[]; // Guardar devoluciones
  totalPurchased: number;
  totalReturned: number;
  netTotal: number;
}


const salesChartConfig = {
  quantity: {
    label: "Cantidad Vendida",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const changesChartConfig = {
  quantity: {
    label: "Cantidad Cambiada/Devuelta",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const HIGH_CHANGE_RATE_THRESHOLD = 20; // Percentage

export default function CustomersPage() {
  const { toast } = useToast();
  const [currentCustomers, setCurrentCustomers] = useState<Customer[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerContact, setNewCustomerContact] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerWorkZone, setNewCustomerWorkZone] = useState('');


  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerContact, setEditCustomerContact] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editCustomerWorkZone, setEditCustomerWorkZone] = useState('');


  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [customerToDeleteId, setCustomerToDeleteId] = useState<string | null>(null);

  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [selectedCustomerForStats, setSelectedCustomerForStats] = useState<Customer | null>(null);
  const [productSalesStats, setProductSalesStats] = useState<ProductStat[]>([]);
  const [productChangesStats, setProductChangesStats] = useState<ProductStat[]>([]);
  const [combinedProductStats, setCombinedProductStats] = useState<CombinedProductStat[]>([]);
  const [productsWithHighChangeRate, setProductsWithHighChangeRate] = useState<string[]>([]);
  const [statsDateRangeFilter, setStatsDateRangeFilter] = useState<DateRange | undefined>(undefined);


  const [isInvoiceHistoryDialogOpen, setIsInvoiceHistoryDialogOpen] = useState(false);
  const [selectedCustomerForInvoices, setSelectedCustomerForInvoices] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Sale[]>([]);
  const [invoiceHistoryDateRangeFilter, setInvoiceHistoryDateRangeFilter] = useState<DateRange | undefined>(undefined);

  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);


  const loadPageData = useCallback(() => {
    // Reload data fresh from localStorage instead of using stale global variables
    const allCustomers = loadFromLocalStorage<Customer[]>(KEYS.CUSTOMERS, false) || [];
    const allSales = [...initialSalesDataGlobal];
    const allPayments = [...initialPaymentsDataGlobal];
    const calculatedCustomers = allCustomers.map(c => ({
      ...c,
      balance: calculateCustomerBalance(c.id, allSales, allPayments),
      overdueBalance: calculateCustomerOverdueBalance(c.id, allSales, allPayments)
    }));
    setCurrentCustomers(calculatedCustomers);
    setExchangeRate(loadExchangeRate());
  }, []);

  useEffect(() => {
    loadPageData();

    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.CUSTOMERS ||
        customEvent.detail?.key === KEYS.SALES ||
        customEvent.detail?.key === KEYS.PAYMENTS ||
        customEvent.detail?.key === KEYS.EXCHANGE_RATE) {
        loadPageData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadPageData]);

  const resetAddForm = () => {
    setNewCustomerName('');
    setNewCustomerContact('');
    setNewCustomerEmail('');
    setNewCustomerAddress('');
    setNewCustomerWorkZone('');
  };

  const handleAddCustomer = () => {
    if (!newCustomerName || !newCustomerContact) {
      toast({ title: "Error", description: "Nombre y contacto son obligatorios.", variant: "destructive" });
      return;
    }
    const newCustomer: Customer = {
      id: `CUST${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`,
      name: newCustomerName,
      contact: newCustomerContact,
      email: newCustomerEmail,
      address: newCustomerAddress,
      workZone: newCustomerWorkZone,
      lastOrder: undefined,
    };
    const updatedCustomers = [newCustomer, ...initialCustomersDataGlobal];
    saveCustomersData(updatedCustomers);
    toast({ title: "Éxito", description: "Cliente añadido correctamente." });
    setIsAddCustomerDialogOpen(false);
    resetAddForm();
  };

  const handleOpenEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.name);
    setEditCustomerContact(customer.contact);
    setEditCustomerEmail(customer.email || '');
    setEditCustomerAddress(customer.address || '');
    setEditCustomerWorkZone(customer.workZone || '');
    setIsEditCustomerDialogOpen(true);
  };

  const handleUpdateCustomer = () => {
    if (!editingCustomer || !editCustomerName || !editCustomerContact) {
      toast({ title: "Error", description: "Nombre y contacto son obligatorios.", variant: "destructive" });
      return;
    }
    const updatedCustomers = initialCustomersDataGlobal.map(c =>
      c.id === editingCustomer.id
        ? {
          ...c,
          name: editCustomerName,
          contact: editCustomerContact,
          email: editCustomerEmail,
          address: editCustomerAddress,
          workZone: editCustomerWorkZone,
        }
        : c
    );
    saveCustomersData(updatedCustomers);
    toast({ title: "Éxito", description: "Cliente actualizado correctamente." });
    setIsEditCustomerDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleOpenDeleteDialog = (customerId: string) => {
    setCustomerToDeleteId(customerId);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (customerToDeleteId) {
      const updatedCustomers = initialCustomersDataGlobal.filter(c => c.id !== customerToDeleteId);
      saveCustomersData(updatedCustomers);
      toast({ title: "Éxito", description: "Cliente eliminado correctamente." });
      setIsDeleteConfirmDialogOpen(false);
      setCustomerToDeleteId(null);
    }
  };

  const calculateCustomerStats = useCallback((customer: Customer | null, dateRange: DateRange | undefined) => {
    if (!customer) {
      setProductSalesStats([]);
      setProductChangesStats([]);
      setCombinedProductStats([]);
      setProductsWithHighChangeRate([]);
      return;
    }

    let customerSales = initialSalesDataGlobal.filter(sale => sale.customerId === customer.id);

    if (dateRange?.from) {
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      customerSales = customerSales.filter(sale => {
        if (!sale.date || !isValid(parseISO(sale.date))) return false;
        return isWithinInterval(parseISO(sale.date), { start: startOfDay(dateRange.from!), end: toDate });
      });
    }

    const canonicalNames = new Map<string, string>();
    const salesAggregated: Record<string, number> = {};
    const changesNormalAggregated: Record<string, number> = {};
    const changesNonDispatchableAggregated: Record<string, number> = {};

    customerSales.forEach(sale => {
      if (sale.itemsPerBranch && Array.isArray(sale.itemsPerBranch)) {
        sale.itemsPerBranch.forEach(branchDetail => {
          if (branchDetail.items && Array.isArray(branchDetail.items)) {
            branchDetail.items.forEach(item => {
              if (item.productName && !item.productName.toLowerCase().startsWith('no despachable')) {
                const normalizedName = item.productName.toLowerCase().trim();
                if (!canonicalNames.has(normalizedName)) {
                  canonicalNames.set(normalizedName, item.productName.trim());
                }
                salesAggregated[normalizedName] = (salesAggregated[normalizedName] || 0) + item.quantity;
              }
            });
          }
        });
      }
    });

    customerSales.forEach(sale => {
      if (sale.changes) {
        sale.changes.forEach(item => {
          if (item.productName) {
            const trimmedProductName = item.productName.trim();
            const match = trimmedProductName.match(/^no\s*despachable\s+(.*)/i);

            if (match && match[1]) {
              const baseProductName = match[1].trim();
              const normalizedBaseName = baseProductName.toLowerCase().trim();

              if (!canonicalNames.has(normalizedBaseName)) {
                canonicalNames.set(normalizedBaseName, baseProductName);
              }
              changesNonDispatchableAggregated[normalizedBaseName] = (changesNonDispatchableAggregated[normalizedBaseName] || 0) + item.quantity;
            } else {
              const normalizedName = trimmedProductName.toLowerCase().trim();
              if (!canonicalNames.has(normalizedName)) {
                canonicalNames.set(normalizedName, trimmedProductName);
              }
              changesNormalAggregated[normalizedName] = (changesNormalAggregated[normalizedName] || 0) + item.quantity;
            }
          }
        });
      }
    });

    const allProductKeys = new Set([
      ...Object.keys(salesAggregated),
      ...Object.keys(changesNormalAggregated),
      ...Object.keys(changesNonDispatchableAggregated)
    ]);

    const combinedStatsList: CombinedProductStat[] = [];
    allProductKeys.forEach(normalizedName => {
      const sold = salesAggregated[normalizedName] || 0;
      const changedNormal = changesNormalAggregated[normalizedName] || 0;
      const changedNonDispatchable = changesNonDispatchableAggregated[normalizedName] || 0;

      if (sold > 0 || changedNormal > 0 || changedNonDispatchable > 0) {
        const totalChanged = changedNormal + changedNonDispatchable;
        const changeRate = sold > 0 ? (totalChanged / sold) * 100 : (totalChanged > 0 ? Infinity : 0);
        combinedStatsList.push({
          name: canonicalNames.get(normalizedName) || normalizedName,
          sold,
          changedNormal,
          changedNonDispatchable,
          totalChanged,
          changeRate: parseFloat(changeRate.toFixed(2))
        });
      }
    });

    combinedStatsList.sort((a, b) => b.sold - a.sold);

    const salesStats: ProductStat[] = combinedStatsList
      .filter(s => s.sold > 0)
      .map(s => ({ name: s.name, quantity: s.sold }))
      .sort((a, b) => b.quantity - a.quantity);

    const changesStats: ProductStat[] = combinedStatsList
      .filter(s => s.totalChanged > 0)
      .map(s => ({ name: s.name, quantity: s.totalChanged }))
      .sort((a, b) => b.quantity - a.quantity);

    setProductSalesStats(salesStats);
    setProductChangesStats(changesStats);
    setCombinedProductStats(combinedStatsList);
    setProductsWithHighChangeRate(
      combinedStatsList
        .filter(stat => stat.changeRate > HIGH_CHANGE_RATE_THRESHOLD)
        .map(stat => stat.name)
    );
  }, []);

  const handleOpenStatsDialog = (customer: Customer) => {
    setSelectedCustomerForStats(customer);
    setStatsDateRangeFilter(undefined);
    calculateCustomerStats(customer, undefined);
    setIsStatsDialogOpen(true);
  };

  useEffect(() => {
    if (isStatsDialogOpen && selectedCustomerForStats) {
      calculateCustomerStats(selectedCustomerForStats, statsDateRangeFilter);
    }
  }, [selectedCustomerForStats, statsDateRangeFilter, isStatsDialogOpen, calculateCustomerStats]);


  const handleOpenInvoiceHistoryDialog = (customer: Customer) => {
    setSelectedCustomerForInvoices(customer);
    setInvoiceHistoryDateRangeFilter(undefined);
    const invoices = initialSalesDataGlobal
      .filter(sale => sale.customerId === customer.id)
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    setCustomerInvoices(invoices);
    setIsInvoiceHistoryDialogOpen(true);
  };

  useEffect(() => {
    if (selectedCustomerForInvoices) {
      let invoices = initialSalesDataGlobal.filter(sale => sale.customerId === selectedCustomerForInvoices.id);

      if (invoiceHistoryDateRangeFilter?.from) {
        const toDate = invoiceHistoryDateRangeFilter.to ? endOfDay(invoiceHistoryDateRangeFilter.to) : endOfDay(invoiceHistoryDateRangeFilter.from);
        invoices = invoices.filter(invoice => {
          if (!invoice.date || !isValid(parseISO(invoice.date))) return false;
          return isWithinInterval(parseISO(invoice.date), { start: startOfDay(invoiceHistoryDateRangeFilter.from!), end: toDate });
        });
      }
      invoices.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
      setCustomerInvoices(invoices);

      const weeklySummariesMap = new Map<string, WeeklySummary>();

      invoices.forEach(sale => {
        if (!sale.date || !isValid(parseISO(sale.date))) return;
        const saleDate = parseISO(sale.date);
        const weekKey = `${getWeek(saleDate, { weekStartsOn: 1, locale: es })}-${saleDate.getFullYear()}`;

        if (!weeklySummariesMap.has(weekKey)) {
          weeklySummariesMap.set(weekKey, {
            weekKey,
            startDate: startOfWeek(saleDate, { weekStartsOn: 1, locale: es }),
            endDate: endOfWeek(saleDate, { weekStartsOn: 1, locale: es }),
            purchases: [],
            creditNotes: [],
            returns: [],
            totalPurchased: 0,
            totalReturned: 0,
            netTotal: 0,
          });
        }

        const summary = weeklySummariesMap.get(weekKey)!;

        if (sale.totalAmount >= 0) {
          summary.purchases.push(sale);
          const itemsSubtotal = sale.itemsPerBranch.reduce((branchSum, branchDetail) =>
            branchSum + branchDetail.items.reduce((itemSum, item) => itemSum + item.subtotal, 0),
            0);
          summary.totalPurchased += itemsSubtotal;

          if (sale.changes && sale.changes.length > 0) {
            summary.returns.push({
              saleId: sale.id,
              saleDate: sale.date,
              items: sale.changes,
            });
            const changesSubtotal = sale.changes.reduce((sum, item) => sum + item.subtotal, 0);
            summary.totalReturned += changesSubtotal;
          }
        } else { // It's a credit note
          summary.creditNotes.push(sale);
          summary.totalReturned += Math.abs(sale.totalAmount);
        }
      });

      for (const summary of weeklySummariesMap.values()) {
        summary.netTotal = summary.totalPurchased - summary.totalReturned;
      }

      setWeeklySummaries(Array.from(weeklySummariesMap.values()).sort((a, b) => b.startDate.getTime() - a.startDate.getTime()));
    }
  }, [selectedCustomerForInvoices, invoiceHistoryDateRangeFilter]);

  const handleGenerateWeeklyStatementPDF = (weekData: WeeklySummary) => {
    if (!selectedCustomerForInvoices) return;
    const doc = new jsPDF() as jsPDFWithAutoTable;

    const formatInvoiceTotalCell = (sale: Sale): string => {
      const appliedCreditNotes = initialPaymentsDataGlobal.filter(p => p.appliedToInvoiceId === sale.id && p.paymentMethod === 'Nota de Crédito');
      const totalCreditApplied = appliedCreditNotes.reduce((sum, cn) => sum + cn.amountAppliedToDebtUSD, 0);

      if (totalCreditApplied === 0) {
        return `$${sale.totalAmount.toFixed(2)}`;
      }

      const netTotal = sale.totalAmount - totalCreditApplied;
      let cellText = `$${sale.totalAmount.toFixed(2)}\n`;
      appliedCreditNotes.forEach(cn => {
        const ncId = cn.notes?.split(': ')[1] || cn.id;
        cellText += `- $${cn.amountAppliedToDebtUSD.toFixed(2)} (NC: ${ncId.slice(0, 10)}..)\n`;
      });
      cellText += `-------------------\n$${netTotal.toFixed(2)}`;

      return cellText;
    };


    doc.setFontSize(14);
    doc.text("Estado de Cuenta Semanal", 14, 22);
    doc.setFontSize(9);
    doc.text(`Cliente: ${selectedCustomerForInvoices.name}`, 14, 32);
    doc.text(`Semana del ${format(weekData.startDate, "dd/MM/yyyy", { locale: es })} al ${format(weekData.endDate, "dd/MM/yyyy", { locale: es })}`, 14, 38);

    let currentY = 48;

    if (weekData.purchases.length > 0) {
      doc.setFontSize(11);
      doc.text("Facturas de la Semana:", 14, currentY);
      currentY += 6;
      const purchaseHead = [['Fecha', 'ID Factura', 'Productos Comprados', 'Monto Total (USD)']];
      const purchaseBody = weekData.purchases.map(sale => {
        const itemsString = sale.itemsPerBranch.flatMap(b => b.items).map(i => `${i.productName} (x${i.quantity})`).join(', ');
        const appliedCreditNotes = initialPaymentsDataGlobal.filter(p => p.appliedToInvoiceId === sale.id && p.paymentMethod === 'Nota de Crédito');
        let creditNoteDetails = '';
        if (appliedCreditNotes.length > 0) {
          creditNoteDetails = '\nNotas de Crédito Aplicadas:\n' + appliedCreditNotes.map(cn => `  - NC ${cn.notes?.split(': ')[1] || cn.id}: -$${cn.amountAppliedToDebtUSD.toFixed(2)} (${format(parseISO(cn.paymentDate), "dd/MM/yy", { locale: es })})`).join('\n');
        }
        return [
          format(parseISO(sale.date), "dd/MM/yy", { locale: es }),
          sale.id,
          itemsString + creditNoteDetails,
          formatInvoiceTotalCell(sale)
        ];
      });
      doc.autoTable({
        startY: currentY,
        head: purchaseHead,
        body: purchaseBody,
        theme: 'grid',
        headStyles: { fillColor: [52, 152, 219], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5, minCellHeight: 10 },
        columnStyles: { 2: { cellWidth: 'auto' }, 3: { halign: 'right' } }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (weekData.creditNotes.length > 0) {
      doc.setFontSize(11);
      doc.text("Notas de Crédito en la Semana:", 14, currentY);
      currentY += 6;
      const creditNoteHead = [['Fecha NC', 'NC ID', 'Factura Afectada', 'Detalle Devolución', 'Monto Crédito (USD)']];
      const creditNoteBody = weekData.creditNotes.map(creditNote => {
        const creditNoteItemsString = creditNote.changes?.map(c => `${c.productName} (x${c.quantity})`).join(', ') || 'N/A';
        return [
          format(parseISO(creditNote.date), "dd/MM/yy", { locale: es }),
          creditNote.id,
          creditNote.creditNoteTargetInvoiceId || 'N/A',
          creditNoteItemsString,
          `-${Math.abs(creditNote.totalAmount).toFixed(2)}`
        ];
      });
      doc.autoTable({
        startY: currentY,
        head: creditNoteHead,
        body: creditNoteBody,
        theme: 'grid',
        headStyles: { fillColor: [243, 156, 18], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: { 3: { cellWidth: 'auto' } }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else if (weekData.returns.length > 0) {
      doc.setFontSize(11);
      doc.text("Devoluciones/Cambios de la Semana:", 14, currentY);
      currentY += 6;
      const returnHead = [['Fecha', 'Factura Afectada', 'Producto Devuelto', 'Cant.', 'P. Unitario (USD)', 'Subtotal (USD)']];
      const returnBody = weekData.returns.flatMap(ret =>
        ret.items.map(item => [
          format(parseISO(ret.saleDate), "dd/MM/yy", { locale: es }),
          ret.saleId,
          item.productName,
          item.quantity,
          item.unitPrice.toFixed(2),
          `-${item.subtotal.toFixed(2)}`
        ])
      );
      doc.autoTable({
        startY: currentY,
        head: returnHead,
        body: returnBody,
        theme: 'grid',
        headStyles: { fillColor: [231, 76, 60], fontSize: 8 },
        bodyStyles: { fontSize: 7, cellPadding: 1.5 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    doc.setFontSize(11);
    doc.text(`Total Comprado: $${weekData.totalPurchased.toFixed(2)}`, 14, currentY);
    currentY += 6;
    doc.text(`Total Devuelto (por cambios/NC): -$${weekData.totalReturned.toFixed(2)}`, 14, currentY);
    currentY += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Neto a Pagar por la Semana: $${weekData.netTotal.toFixed(2)}`, 14, currentY);

    doc.save(`estado_cuenta_${selectedCustomerForInvoices.name.replace(/\s/g, '_')}_${weekData.weekKey}.pdf`);
    toast({ title: "Estado de cuenta semanal generado.", description: `Se ha descargado el PDF.` });
  };

  const totalOverdueBalance = useMemo(() => {
    return currentCustomers.reduce((total, customer) => total + ((customer as any).overdueBalance || 0), 0);
  }, [currentCustomers]);

  const handleGenerateOverdueDebtPDF = () => {
    const customersWithOverdueDebt = currentCustomers.filter(
      (c) => (c as any).overdueBalance > 0
    );

    if (customersWithOverdueDebt.length === 0) {
      toast({
        title: "Sin Deudas Vencidas",
        description: "¡Excelente! Ningún cliente tiene deudas vencidas actualmente.",
        variant: "default",
      });
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;

    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text("Reporte de Deudas Vencidas", 14, 30);
    doc.setFontSize(10);
    doc.text(`Fecha del Reporte: ${format(new Date(), "dd/MM/yyyy")}`, 14, 38);

    const head = [["Cliente", "Deuda Vencida (USD)"]];
    const body = customersWithOverdueDebt.map((c) => [
      c.name,
      `$${(c as any).overdueBalance.toFixed(2)}`,
    ]);

    const total = customersWithOverdueDebt.reduce((sum, c) => sum + (c as any).overdueBalance, 0);

    doc.autoTable({
      startY: 46,
      head: head,
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [220, 53, 69] }, // Rojo destructivo
      foot: [
        [{ content: 'Total Deuda Vencida', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `$${total.toFixed(2)}`, styles: { fontStyle: 'bold' } }],
      ],
      footStyles: { fontStyle: 'bold', fillColor: [248, 249, 250], halign: 'right' },
      didDrawPage: function (data) {
        if (data.pageNumber === 1 && data.cursor) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`Total Deuda Vencida: $${total.toFixed(2)}`, 14, data.cursor.y + 10);
        }
      }
    });

    doc.save(`reporte_deuda_vencida_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({
      title: "Reporte Generado",
      description: "Se ha descargado el PDF con las deudas vencidas.",
    });
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Clientes"
        description="Gestiona la información y relaciones con tus clientes. Analiza sus patrones de compra y devoluciones (global)."
        icon={Users}
        actions={
          <>
            <Button onClick={handleGenerateOverdueDebtPDF}>
              <Download className="mr-2 h-4 w-4" />
              Descargar Deuda Vencida
            </Button>
            <Button onClick={() => { resetAddForm(); setIsAddCustomerDialogOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Nuevo Cliente
            </Button>
          </>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Todos los Clientes (Global)</CardTitle>
          <CardDescription>Una lista de todos tus valiosos clientes, sus saldos y acceso a estadísticas de compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Último Pedido</TableHead>
                <TableHead className="text-right">Saldo Total (USD)</TableHead>
                <TableHead className="text-right">
                  Deuda Vencida (USD)
                  {totalOverdueBalance > 0 && (
                    <span className="block text-destructive font-bold text-xs">
                      Total: <FormattedNumber value={totalOverdueBalance} prefix="$" />
                    </span>
                  )}
                </TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentCustomers.map((customer) => {
                const balance = (customer as any).balance;
                const overdueBalance = (customer as any).overdueBalance;
                const isDebt = balance > 0;
                const balanceValue = Math.abs(balance);
                const balanceColor = balance < 0 ? 'text-green-600 dark:text-green-500' : balance > 0 ? 'text-destructive' : '';
                const balancePrefix = balance < 0 ? 'Saldo a Favor: $' : '$';

                return (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.contact}</TableCell>
                    <TableCell>{customer.lastOrder && isValid(parseISO(customer.lastOrder)) ? format(parseISO(customer.lastOrder), "dd/MM/yyyy", { locale: es }) : '-'}</TableCell>
                    <TableCell className={cn("text-right font-semibold", balanceColor)}>
                      <FormattedNumber value={balanceValue} prefix={balancePrefix} />
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold", overdueBalance > 0 && "text-destructive")}>
                      {overdueBalance > 0 ? <FormattedNumber value={overdueBalance} prefix="$" /> : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center space-x-1">
                        <Button variant="ghost" size="icon" title="Ver Estadísticas de Compras" onClick={() => handleOpenStatsDialog(customer)}>
                          <BarChartHorizontal className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Ver Estado de Cuenta" onClick={() => handleOpenInvoiceHistoryDialog(customer)}>
                          <InvoiceHistoryIcon className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="Más Acciones">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEditDialog(customer)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar Cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenDeleteDialog(customer.id)}
                              className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar Cliente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {currentCustomers.length === 0 && <p className="text-center text-muted-foreground py-8">No hay clientes registrados.</p>}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerDialogOpen} onOpenChange={setIsAddCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del nuevo cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="new_customer_name">Nombre Completo</Label>
              <Input id="new_customer_name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="ej., Juan Pérez" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_contact_phone">Número de Teléfono</Label>
              <Input id="new_contact_phone" type="tel" value={newCustomerContact} onChange={(e) => setNewCustomerContact(e.target.value)} placeholder="ej., 555-123-4567" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_email_address">Correo Electrónico (Opcional)</Label>
              <Input id="new_email_address" type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="ej., juan.perez@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_address">Dirección (Opcional)</Label>
              <Input id="new_address" value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} placeholder="ej., Calle Principal 123, Ciudad" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new_work_zone">Zona donde trabaja (Opcional)</Label>
              <Input id="new_work_zone" value={newCustomerWorkZone} onChange={(e) => setNewCustomerWorkZone(e.target.value)} placeholder="ej., Oficina Central, Ruta Norte" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setIsAddCustomerDialogOpen(false)}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleAddCustomer}>Guardar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditCustomerDialogOpen} onOpenChange={setIsEditCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Actualiza los detalles del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="edit_customer_name">Nombre Completo</Label>
              <Input id="edit_customer_name" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_contact_phone">Número de Teléfono</Label>
              <Input id="edit_contact_phone" type="tel" value={editCustomerContact} onChange={(e) => setEditCustomerContact(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_email_address">Correo Electrónico (Opcional)</Label>
              <Input id="edit_email_address" type="email" value={editCustomerEmail} onChange={(e) => setEditCustomerEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_address">Dirección (Opcional)</Label>
              <Input id="edit_address" value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_work_zone">Zona donde trabaja (Opcional)</Label>
              <Input id="edit_work_zone" value={editCustomerWorkZone} onChange={(e) => setEditCustomerWorkZone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => { setIsEditCustomerDialogOpen(false); setEditingCustomer(null); }}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdateCustomer}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar a este cliente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => { setIsDeleteConfirmDialogOpen(false); setCustomerToDeleteId(null) }}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete}>Eliminar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Statistics Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Estadísticas de Cliente: {selectedCustomerForStats?.name}</DialogTitle>
            <DialogDescription>Patrones de compra y devoluciones del cliente (filtrado por fecha si se aplica).</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row items-center gap-2 py-2 border-b mb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-filter-stats-customers"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-auto min-w-[200px] justify-start text-left font-normal",
                    !statsDateRangeFilter && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {statsDateRangeFilter?.from ? (
                    statsDateRangeFilter.to ? (
                      <>
                        {format(statsDateRangeFilter.from, "LLL dd, y", { locale: es })} -{" "}
                        {format(statsDateRangeFilter.to, "LLL dd, y", { locale: es })}
                      </>
                    ) : (
                      format(statsDateRangeFilter.from, "LLL dd, y", { locale: es })
                    )
                  ) : (
                    <span>Filtrar por Fecha de Ventas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={statsDateRangeFilter?.from}
                  selected={statsDateRangeFilter}
                  onSelect={setStatsDateRangeFilter}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => setStatsDateRangeFilter(undefined)} variant="outline" className="w-full sm:w-auto" disabled={!statsDateRangeFilter?.from}>Limpiar Filtro Fecha</Button>
          </div>
          <ScrollArea className="max-h-[60vh] p-1 pr-4">
            {productsWithHighChangeRate.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>¡Atención!</AlertTitle>
                <AlertDescription>
                  Se ha detectado una alta tasa de cambio/devolución (&gt;{HIGH_CHANGE_RATE_THRESHOLD}%) para los siguientes productos:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    {productsWithHighChangeRate.map(productName => (
                      <li key={productName}>{productName}</li>
                    ))}
                  </ul>
                  Considera revisar estos casos.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-6 py-4">
              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Comprados (Top 10)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                  {productSalesStats.length > 0 ? (
                    <ChartContainer config={salesChartConfig} className="h-full w-full">
                      <BarChart data={productSalesStats.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={150} interval={0} />
                        <RechartsTooltip content={<ChartTooltipContent />} />
                        <RechartsLegend content={<ChartLegendContent />} />
                        <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} nameKey="name" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-center text-muted-foreground">No hay datos de ventas para este cliente {statsDateRangeFilter?.from ? "en el rango seleccionado" : ""}.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Cambiados/Devueltos (Top 10)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                  {productChangesStats.length > 0 ? (
                    <ChartContainer config={changesChartConfig} className="h-full w-full">
                      <BarChart data={productChangesStats.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={150} interval={0} />
                        <RechartsTooltip content={<ChartTooltipContent />} />
                        <RechartsLegend content={<ChartLegendContent />} />
                        <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} nameKey="name" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-center text-muted-foreground">No hay datos de cambios/devoluciones para este cliente {statsDateRangeFilter?.from ? "en el rango seleccionado" : ""}.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Ventas vs. Cambios por Producto</CardTitle>
                </CardHeader>
                <CardContent>
                  {combinedProductStats.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cant. Vendida</TableHead>
                          <TableHead className="text-right">Devoluciones (Total)</TableHead>
                          <TableHead className="text-right">Tasa de Cambio (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {combinedProductStats.map(stat => (
                          <TableRow key={stat.name}>
                            <TableCell>{stat.name}</TableCell>
                            <TableCell className="text-right">{stat.sold}</TableCell>
                            <TableCell className="text-right">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(stat.totalChanged > 0 && "underline decoration-dashed cursor-help")}>
                                      {stat.totalChanged}
                                    </span>
                                  </TooltipTrigger>
                                  {stat.totalChanged > 0 && (
                                    <TooltipContent>
                                      <p>En buen estado: {stat.changedNormal}</p>
                                      <p>No despachable: {stat.changedNonDispatchable}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className={cn("text-right", stat.changeRate > HIGH_CHANGE_RATE_THRESHOLD ? "text-destructive font-semibold" : stat.changeRate > 5 ? "text-yellow-600" : "")}>
                              {stat.changeRate.toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground">No hay datos combinados para mostrar {statsDateRangeFilter?.from ? "en el rango seleccionado" : ""}.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => { setIsStatsDialogOpen(false); setSelectedCustomerForStats(null); setStatsDateRangeFilter(undefined); setProductsWithHighChangeRate([]); }}>Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInvoiceHistoryDialogOpen} onOpenChange={setIsInvoiceHistoryDialogOpen}>
        <DialogContent className="sm:max-w-4xl lg:max-w-7xl">
          <DialogHeader>
            <DialogTitle>Estado de Cuenta: {selectedCustomerForInvoices?.name}</DialogTitle>
            <DialogDescription>Resumen de facturas pendientes y desglose de actividad semanal.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row items-center gap-2 py-2 border-b mb-2">
            <Popover><PopoverTrigger asChild><Button id="date-filter-invoice-history" variant={"outline"} className={cn("w-full sm:w-auto min-w-[200px] justify-start text-left font-normal", !invoiceHistoryDateRangeFilter && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{invoiceHistoryDateRangeFilter?.from ? (invoiceHistoryDateRangeFilter.to ? (<>{format(invoiceHistoryDateRangeFilter.from, "LLL dd, y", { locale: es })} - {format(invoiceHistoryDateRangeFilter.to, "LLL dd, y", { locale: es })}</>) : (format(invoiceHistoryDateRangeFilter.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar por Fecha</span>)}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={invoiceHistoryDateRangeFilter?.from} selected={invoiceHistoryDateRangeFilter} onSelect={setInvoiceHistoryDateRangeFilter} numberOfMonths={2} locale={es} /></PopoverContent>
            </Popover>
            <Button onClick={() => setInvoiceHistoryDateRangeFilter(undefined)} variant="outline" className="w-full sm:w-auto" disabled={!invoiceHistoryDateRangeFilter?.from}>Limpiar Filtro</Button>
          </div>

          <ScrollArea className="max-h-[60vh] p-1 pr-4">
            <Card className="mb-4">
              <CardHeader><CardTitle>Facturas con Saldo Pendiente</CardTitle></CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full space-y-2">
                  {customerInvoices
                    .filter(inv => calculateInvoiceBalance(inv.id, initialPaymentsDataGlobal, customerInvoices) > 0.01)
                    .map((invoice) => {
                      const status = getInvoiceStatus(invoice, initialPaymentsDataGlobal);
                      const balance = calculateInvoiceBalance(invoice.id, initialPaymentsDataGlobal, customerInvoices);
                      const appliedPayments = initialPaymentsDataGlobal.filter(p => p.appliedToInvoiceId === invoice.id);

                      return (
                        <AccordionItem value={invoice.id} key={invoice.id} className="border rounded-md shadow-sm">
                          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-md text-left">
                            <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center gap-2">
                              <div className="flex-1"><p className="font-semibold text-sm">Factura ID: <span className="font-mono">{invoice.id}</span></p><p className="text-xs text-muted-foreground">Fecha: {invoice.date ? format(parseISO(invoice.date), "dd/MM/yyyy") : 'N/A'}</p></div>
                              <div className="flex-1 text-right sm:text-left"><p className="text-xs">Monto Original: <FormattedNumber value={invoice.totalAmount} prefix="$" /></p><p className="text-xs font-semibold">Saldo Pendiente: <span className="text-destructive"><FormattedNumber value={balance} prefix="$" /></span></p></div>
                              <div className="flex-1 text-right"><Badge variant={status === 'Vencida' ? 'destructive' : 'secondary'} className="whitespace-nowrap">{status}</Badge></div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-3 border-t">
                            {appliedPayments.length > 0 ? (
                              <div>
                                <h4 className="text-xs font-semibold mb-1.5">Pagos y Créditos Aplicados:</h4>
                                <ul className="space-y-1">
                                  {appliedPayments.map(p => {
                                    const creditNote = p.paymentMethod === 'Nota de Crédito' ? initialSalesDataGlobal.find(s => s.id === p.notes?.split(': ')[1]) : null;
                                    return (
                                      <li key={p.id} className="text-xs p-2 border rounded-md bg-muted/30">
                                        <p>
                                          {format(parseISO(p.paymentDate), 'dd/MM/yy')}: <strong>{p.paymentMethod}</strong> por <strong className="text-green-600"><FormattedNumber value={p.amountAppliedToDebtUSD} prefix="$" /></strong>.
                                        </p>
                                        {creditNote && creditNote.changes && (
                                          <div className="pl-4 mt-1">
                                            <p className="font-medium">Detalle Devolución (NC):</p>
                                            <ul className="list-disc list-inside text-muted-foreground">
                                              {creditNote.changes.map((item, idx) => (
                                                <li key={idx}>{item.productName} (x{item.quantity})</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-2">No hay pagos ni notas de crédito aplicados a esta factura.</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  {customerInvoices.filter(inv => calculateInvoiceBalance(inv.id, initialPaymentsDataGlobal, customerInvoices) > 0.01).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">Este cliente no tiene facturas pendientes.</p>
                  )}
                </Accordion>
              </CardContent>
            </Card>
            <Separator className="my-4" />
            {weeklySummaries.map(week => {
              const hasCreditNotes = week.creditNotes.length > 0;
              const hasReturns = week.returns.length > 0;

              return (
                <Card key={week.weekKey} className="mb-4">
                  <CardHeader className="flex flex-row justify-between items-center bg-muted/50 p-3 rounded-t-md">
                    <div>
                      <CardTitle className="text-base">Resumen Semanal</CardTitle>
                      <CardDescription className="text-sm">{format(week.startDate, "dd/MM/yyyy")} - {format(week.endDate, "dd/MM/yyyy")}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleGenerateWeeklyStatementPDF(week)}><Download className="mr-2 h-4 w-4" />Generar PDF</Button>
                  </CardHeader>
                  <CardContent className="space-y-4 p-3">
                    {week.purchases.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 p-2 bg-blue-500/10 text-blue-800 dark:text-blue-200 rounded-md text-sm">Facturas de la Semana</h4>
                        <Table>
                          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>ID Factura</TableHead><TableHead>Productos Comprados</TableHead><TableHead className="text-right">Monto (USD)</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {week.purchases.map((sale, i) => {
                              const appliedCreditNotes = initialPaymentsDataGlobal.filter(p => p.appliedToInvoiceId === sale.id && p.paymentMethod === 'Nota de Crédito');
                              const totalCreditApplied = appliedCreditNotes.reduce((sum, cn) => sum + cn.amountAppliedToDebtUSD, 0);
                              const netTotal = sale.totalAmount - totalCreditApplied;

                              return (
                                <TableRow key={`buy-${i}`}>
                                  <TableCell className="text-xs">{format(parseISO(sale.date), "dd/MM/yy", { locale: es })}</TableCell>
                                  <TableCell className="text-xs">{sale.id}</TableCell>
                                  <TableCell className="text-xs">{sale.itemsPerBranch.flatMap(b => b.items).map(item => `${item.productName} (x${item.quantity})`).join(', ')}</TableCell>
                                  <TableCell className="text-right text-xs">
                                    {totalCreditApplied > 0 ? (
                                      <div className="flex flex-col items-end">
                                        <span><FormattedNumber value={sale.totalAmount} prefix="$" /></span>
                                        <span className="text-destructive">- <FormattedNumber value={totalCreditApplied} prefix="$" /> (NC)</span>
                                        <hr className="w-16 my-0.5 border-foreground/50" />
                                        <span className="font-bold"><FormattedNumber value={netTotal} prefix="$" /></span>
                                      </div>
                                    ) : (
                                      <FormattedNumber value={sale.totalAmount} prefix="$" />
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {hasCreditNotes ? (
                      <div>
                        <h4 className="font-semibold mb-2 p-2 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-md text-sm">Notas de Crédito</h4>
                        <Table>
                          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>ID Nota Crédito</TableHead><TableHead>Factura Afectada</TableHead><TableHead>Productos Devueltos</TableHead><TableHead className="text-right">Monto (USD)</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {week.creditNotes.map(cn => (
                              <TableRow key={cn.id}>
                                <TableCell className="text-xs">{format(parseISO(cn.date), "dd/MM/yy")}</TableCell>
                                <TableCell className="text-xs">{cn.id}</TableCell>
                                <TableCell className="text-xs">{cn.creditNoteTargetInvoiceId || 'N/A'}</TableCell>
                                <TableCell className="text-xs">{cn.changes?.map(c => `${c.productName} (x${c.quantity})`).join(', ') || 'N/A'}</TableCell>
                                <TableCell className="text-right text-destructive text-xs"><FormattedNumber value={Math.abs(cn.totalAmount)} prefix="-$" /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : hasReturns ? (
                      <div>
                        <h4 className="font-semibold mb-2 p-2 bg-red-500/10 text-red-800 dark:text-red-200 rounded-md text-sm">Devoluciones/Cambios</h4>
                        <Table>
                          <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Factura Afectada</TableHead><TableHead>Producto Devuelto</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead className="text-right">Subtotal (USD)</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {week.returns.flatMap(ret => ret.items.map((item, idx) => (
                              <TableRow key={`return-${ret.saleId}-${idx}`}>
                                <TableCell className="text-xs">{format(parseISO(ret.saleDate), "dd/MM/yy")}</TableCell>
                                <TableCell className="text-xs">{ret.saleId}</TableCell>
                                <TableCell className="text-xs">{item.productName}</TableCell>
                                <TableCell className="text-right text-xs">{item.quantity}</TableCell>
                                <TableCell className="text-right text-destructive text-xs"><FormattedNumber value={item.subtotal} prefix="-$" /></TableCell>
                              </TableRow>
                            )))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="flex justify-end font-bold text-lg bg-muted/50 p-3 rounded-b-md">
                    <p>Total Semana: <FormattedNumber value={week.netTotal} prefix="$" /></p>
                  </CardFooter>
                </Card>
              )
            })}
            {weeklySummaries.length === 0 && <p className="text-center text-muted-foreground py-8">No hay actividad de ventas para este cliente en el período seleccionado.</p>}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" onClick={() => { setIsInvoiceHistoryDialogOpen(false); setSelectedCustomerForInvoices(null); setCustomerInvoices([]); }}>Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}












