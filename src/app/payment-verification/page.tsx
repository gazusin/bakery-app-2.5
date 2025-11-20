

"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2, History, Hourglass, Edit, Trash2, Filter, Search, Eye } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  paymentsData as initialPaymentsDataGlobal,
  savePaymentsData,
  type Payment,
  customersData as initialCustomersDataGlobal,
  saveCustomersData,
  type Customer,
  type AccountTransaction,
  saveCompanyAccountsData, 
  type CompanyAccountsData,
  type AccountType,
  accountTypeNames,
  loadExchangeRate,
  userProfileData,
  salesData as initialSalesDataGlobal,
  saveSalesData,
  type Sale,
  KEYS,
  loadFromLocalStorageForBranch, 
  saveToLocalStorageForBranch, 
  calculateCustomerBalance,
  pendingFundTransfersData as initialPendingFundTransfersDataGlobal,
  savePendingFundTransfersData,
  type PendingFundTransfer,
  availableBranches,
  getInvoiceStatus,
  loadCompanyAccountsData,
  updateGlobalSaleDataAndFinances
} from '@/lib/data-storage';
import { format, parseISO, isValid, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { paymentMethodList, type PaymentMethodType } from '@/lib/data-storage';

const DEBT_ADJUSTMENT_ID = "DEBT_ADJUSTMENT_PAYMENT";
const ALL_CUSTOMERS_FILTER_VALUE = "__ALL_CUSTOMERS__";


export default function PaymentVerificationPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [processedPayments, setProcessedPayments] = useState<Payment[]>([]);
  const [filteredProcessedPayments, setFilteredProcessedPayments] = useState<Payment[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [globalExchangeRate, setGlobalExchangeRate] = useState<number>(0);

  // Estados para filtros del historial
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [filterCustomerId, setFilterCustomerId] = useState<string>(ALL_CUSTOMERS_FILTER_VALUE);
  const [filterReference, setFilterReference] = useState<string>('');

  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false);
  const [notesToView, setNotesToView] = useState<string>('');


  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES'>('USD');
  const [paymentExchangeRate, setPaymentExchangeRate] = useState('');
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethodType>(paymentMethodList[0]);
  const [paymentReferenceNumber, setPaymentReferenceNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paidToBranchIdDialog, setPaidToBranchIdDialog] = useState<string>('');
  const [paidToAccountIdDialog, setPaidToAccountIdDialog] = useState<AccountType>('vesElectronic');
  const [isPaymentDatePickerOpen, setIsPaymentDatePickerOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [pendingInvoicesForCustomer, setPendingInvoicesForCustomer] = useState<Sale[]>([]);
  const [balanceFromAdjustment, setBalanceFromAdjustment] = useState<number>(0);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);


  const loadPayments = useCallback(() => {
    setIsLoading(true);
    const currentPayments = [...initialPaymentsDataGlobal].sort((a, b) => {
      const dateA = a.paymentDate && isValid(parseISO(a.paymentDate)) ? parseISO(a.paymentDate).getTime() : 0;
      const dateB = b.paymentDate && isValid(parseISO(b.paymentDate)) ? parseISO(b.paymentDate).getTime() : 0;
      return dateB - dateA; 
    });
    setAllPayments(currentPayments);
    setPendingPayments(currentPayments.filter(p => p.status === 'pendiente de verificación'));
    const processed = currentPayments.filter(p => p.status === 'verificado' || p.status === 'rechazado');
    setProcessedPayments(processed);
    setFilteredProcessedPayments(processed);
    setGlobalExchangeRate(loadExchangeRate());
    setIsLoading(false);
  }, []);

  const applyFilters = useCallback(() => {
    let paymentsToFilter = [...processedPayments];

    if (filterDateRange?.from) {
        const toDate = filterDateRange.to ? endOfDay(filterDateRange.to) : endOfDay(filterDateRange.from);
        paymentsToFilter = paymentsToFilter.filter(payment => {
            if (!payment.paymentDate || !isValid(parseISO(payment.paymentDate))) return false;
            return isWithinInterval(parseISO(payment.paymentDate), { start: startOfDay(filterDateRange.from!), end: toDate });
        });
    }

    if (filterCustomerId !== ALL_CUSTOMERS_FILTER_VALUE) {
        paymentsToFilter = paymentsToFilter.filter(payment => payment.customerId === filterCustomerId);
    }

    if (filterReference.trim() !== '') {
        paymentsToFilter = paymentsToFilter.filter(payment => 
            payment.referenceNumber?.toLowerCase().includes(filterReference.trim().toLowerCase())
        );
    }
    
    setFilteredProcessedPayments(paymentsToFilter);
  }, [processedPayments, filterDateRange, filterCustomerId, filterReference]);

  useEffect(() => {
    applyFilters();
  }, [processedPayments, filterDateRange, filterCustomerId, filterReference, applyFilters]);
  
  const handleApplyFilters = () => applyFilters();
  const handleClearFilters = () => {
    setFilterDateRange(undefined);
    setFilterCustomerId(ALL_CUSTOMERS_FILTER_VALUE);
    setFilterReference('');
  };


  useEffect(() => {
    loadPayments();
    const handleDataUpdate = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.key === KEYS.PAYMENTS || 
            customEvent.detail?.key === KEYS.SALES ||
            customEvent.detail?.key === KEYS.CUSTOMERS ||
            customEvent.detail?.key === KEYS.COMPANY_ACCOUNTS ||
            customEvent.detail?.key === KEYS.ACCOUNT_TRANSACTIONS ||
            customEvent.detail?.key === KEYS.PENDING_FUND_TRANSFERS
           ) {
            loadPayments();
        }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
        window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadPayments]);

  const handleVerifyPayment = (paymentId: string) => {
    setIsProcessing(paymentId);
    let currentGlobalPayments = [...initialPaymentsDataGlobal];
    const paymentIndex = currentGlobalPayments.findIndex(p => p.id === paymentId);

    if (paymentIndex === -1) {
      toast({ title: "Error", description: "Pago no encontrado.", variant: "destructive" });
      setIsProcessing(null);
      return;
    }
    const paymentToVerify = { ...currentGlobalPayments[paymentIndex] };
    
    paymentToVerify.status = 'verificado';
    paymentToVerify.verifiedBy = userProfileData.fullName;
    paymentToVerify.verificationDate = new Date().toISOString();
    
    currentGlobalPayments[paymentIndex] = paymentToVerify;
    savePaymentsData(currentGlobalPayments);

    // This single call handles all financial updates now.
    updateGlobalSaleDataAndFinances(paymentToVerify, 'add');
    
    toast({ title: "Pago Verificado", description: `El pago de ${paymentToVerify.customerName} ha sido verificado y aplicado.` });
    loadPayments();
    setIsProcessing(null);
  };

  const handleRejectPayment = (paymentId: string) => {
    setIsProcessing(paymentId);
    let allPaymentsToSave = [...initialPaymentsDataGlobal];
    const paymentIndex = allPaymentsToSave.findIndex(p => p.id === paymentId);

     if (paymentIndex === -1) {
      toast({ title: "Error", description: "Pago no encontrado.", variant: "destructive" });
      setIsProcessing(null);
      return;
    }
    const payment = { ...allPaymentsToSave[paymentIndex] };
    payment.status = 'rechazado';
    payment.verifiedBy = userProfileData.fullName;
    payment.verificationDate = new Date().toISOString();
    allPaymentsToSave[paymentIndex] = payment;

    savePaymentsData(allPaymentsToSave);
    toast({ title: "Pago Rechazado", description: `El pago de ${payment.customerName} ha sido marcado como rechazado.` });
    loadPayments();
    setIsProcessing(null);
  };
  
  const handleSaveEditedPayment = () => {
     if (!editingPayment || !paymentDate || !paymentAmountInput) {
        toast({ title: "Error", description: "Faltan datos para editar el pago.", variant: "destructive" });
        return;
    }
    const amountNum = parseFloat(paymentAmountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Error", description: "Monto inválido.", variant: "destructive" });
      return;
    }
    
    let currentGlobalPayments = [...initialPaymentsDataGlobal];
    const paymentIndex = currentGlobalPayments.findIndex(p => p.id === editingPayment.id);
    if(paymentIndex === -1) {
        toast({ title: "Error", description: "Pago no encontrado para actualizar.", variant: "destructive" });
        return;
    }
    
    const updatedPayment = { ...currentGlobalPayments[paymentIndex] };
    
    updatedPayment.paymentDate = format(paymentDate, "yyyy-MM-dd");
    updatedPayment.amountPaidInput = amountNum;
    updatedPayment.currencyPaidInput = paymentCurrency;
    updatedPayment.paymentMethod = currentPaymentMethod;
    updatedPayment.referenceNumber = paymentReferenceNumber;
    updatedPayment.notes = paymentNotes;
    updatedPayment.paidToBranchId = paidToBranchIdDialog;
    updatedPayment.paidToAccountId = paidToAccountIdDialog;

    let paymentExchangeRateValue = parseFloat(paymentExchangeRate);
    if (paymentCurrency === 'VES' && (isNaN(paymentExchangeRateValue) || paymentExchangeRateValue <= 0)) {
        toast({ title: "Error", description: "La tasa de cambio para el pago en VES debe ser un número positivo.", variant: "destructive" });
        return;
    }
    updatedPayment.exchangeRateAtPayment = paymentCurrency === 'VES' ? paymentExchangeRateValue : undefined;
    updatedPayment.amountAppliedToDebtUSD = paymentCurrency === 'VES' ? amountNum / paymentExchangeRateValue : amountNum;
    
    updatedPayment.appliedToInvoiceId = selectedInvoiceId === DEBT_ADJUSTMENT_ID ? undefined : selectedInvoiceId;
    updatedPayment.paymentSource = selectedInvoiceId === DEBT_ADJUSTMENT_ID ? 'balance_adjustment' : 'invoice';

    currentGlobalPayments[paymentIndex] = updatedPayment;
    savePaymentsData(currentGlobalPayments);

    toast({ title: "Éxito", description: "El pago pendiente ha sido actualizado." });
    setIsEditPaymentDialogOpen(false);
    setEditingPayment(null);
  };
  
 const handleDeletePayment = () => {
    if (!paymentToDelete) return;
    setIsProcessing(paymentToDelete.id);

    // Revertir efectos financieros si el pago estaba verificado
    if (paymentToDelete.status === 'verificado') {
        updateGlobalSaleDataAndFinances(paymentToDelete, 'subtract');
    }

    // Filtrar pago
    let currentPayments = [...initialPaymentsDataGlobal];
    const initialPaymentCount = currentPayments.length;
    currentPayments = currentPayments.filter(p => p.id !== paymentToDelete.id);
    
    if (currentPayments.length < initialPaymentCount) {
        savePaymentsData(currentPayments);
    }
    
    // Filtrar transferencias de fondos si el pago eliminado estaba verificado
    if (paymentToDelete.status === 'verificado' && paymentToDelete.parentPaymentId) {
        let currentTransfers = [...initialPendingFundTransfersDataGlobal];
        const initialTransferCount = currentTransfers.length;
        currentTransfers = currentTransfers.filter(t => !t.id.includes(paymentToDelete.id.slice(0, 15))); // Heurística para encontrar transferencias relacionadas
        if (currentTransfers.length < initialTransferCount) {
            savePendingFundTransfersData(currentTransfers);
        }
    }


    toast({title: "Pago Eliminado", description: "El pago y sus efectos financieros asociados (si aplica) han sido eliminados."});
    setIsProcessing(null);
    setPaymentToDelete(null);
    setIsDeleteConfirmOpen(false);
    loadPayments();
}


  const handleOpenEditDialog = (payment: Payment) => {
    setEditingPayment(payment);
    const customer = initialCustomersDataGlobal.find(c => c.id === payment.customerId);

    setPaymentDate(parseISO(payment.paymentDate));
    setPaymentAmountInput(payment.amountPaidInput.toString());
    setPaymentCurrency(payment.currencyPaidInput);
    setPaymentExchangeRate(payment.exchangeRateAtPayment?.toString() || (payment.currencyPaidInput === 'VES' ? globalExchangeRate.toString() : ''));
    setCurrentPaymentMethod(payment.paymentMethod);
    setPaymentReferenceNumber(payment.referenceNumber || '');
    setPaymentNotes(payment.notes || '');
    setPaidToBranchIdDialog(payment.paidToBranchId || '');
    setPaidToAccountIdDialog(payment.paidToAccountId || 'vesElectronic');
    
    if (payment.paymentSource === 'invoice' && payment.appliedToInvoiceId) {
        setSelectedInvoiceId(payment.appliedToInvoiceId);
    } else {
        setSelectedInvoiceId(DEBT_ADJUSTMENT_ID);
    }
    
    if (customer) {
        const invoices = initialSalesDataGlobal.filter(
            s => s.customerId === customer.id && getInvoiceStatus(s, initialPaymentsDataGlobal) !== 'Completada'
        ).sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
        setPendingInvoicesForCustomer(invoices);

        const customerBalance = calculateCustomerBalance(customer.id, initialSalesDataGlobal, initialPaymentsDataGlobal);
        setBalanceFromAdjustment(customerBalance < -0.01 ? Math.abs(customerBalance) : 0);
    }

    setIsEditPaymentDialogOpen(true);
  }


  const renderPaymentsTable = (paymentsToList: Payment[], isPendingTable: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha Pago</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Monto Pagado</TableHead>
          <TableHead>Monto Aplicado (USD)</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Referencia</TableHead>
          <TableHead>Fuente</TableHead>
          <TableHead>Sede Ingreso</TableHead>
          {!isPendingTable && <TableHead>Estado</TableHead>}
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paymentsToList.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.paymentDate && isValid(parseISO(payment.paymentDate)) ? format(parseISO(payment.paymentDate), "dd/MM/yyyy", { locale: es }) : '-'}</TableCell>
            <TableCell>{payment.customerName}</TableCell>
            <TableCell><FormattedNumber value={payment.amountPaidInput} prefix={payment.currencyPaidInput === 'VES' ? 'Bs. ' : '$'} /></TableCell>
            <TableCell><FormattedNumber value={payment.amountAppliedToDebtUSD} prefix="$" /></TableCell>
            <TableCell>{payment.paymentMethod}</TableCell>
            <TableCell>{payment.referenceNumber || '-'}</TableCell>
            <TableCell>{payment.paymentSource === 'invoice' ? `Factura: ${payment.appliedToInvoiceId}` : 'Abono Saldo'}</TableCell>
            <TableCell>{payment.paidToBranchId ? availableBranches.find(b=>b.id === payment.paidToBranchId)?.name : 'N/A'}</TableCell>
            {!isPendingTable && (
              <TableCell>
                <Badge
                  variant={payment.status === 'verificado' ? 'default' : payment.status === 'rechazado' ? 'destructive' : 'secondary'}
                  className={cn( "whitespace-nowrap", payment.status === 'verificado' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : payment.status === 'rechazado' ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50' : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50' )}>
                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                </Badge>
              </TableCell>
            )}
            <TableCell className="text-right space-x-1">
              <Button size="sm" variant="ghost" onClick={() => { setNotesToView(payment.notes || 'No hay notas para este pago.'); setIsNotesDialogOpen(true); }} disabled={isProcessing === payment.id}>
                <Eye className="h-4 w-4" />
              </Button>
              {isPendingTable && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleOpenEditDialog(payment)} disabled={isProcessing === payment.id}><Edit className="mr-1 h-3 w-3" /> Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => handleVerifyPayment(payment.id)} disabled={isProcessing === payment.id} className="bg-green-500/20 hover:bg-green-500/30 text-green-700 border-green-500/50 dark:text-green-400 dark:border-green-500/70 dark:hover:bg-green-500/40">
                      {isProcessing === payment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleRejectPayment(payment.id)} disabled={isProcessing === payment.id}>
                      {isProcessing === payment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    </Button>
                  </>
              )}
              
               <Button size="sm" variant="ghost" onClick={() => { setPaymentToDelete(payment); setIsDeleteConfirmOpen(true); }} disabled={isProcessing === payment.id} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
               </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando pagos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificación de Pagos (Global)"
        description="Verifica o rechaza los pagos (Pago Móvil, Transferencias) registrados globalmente. El ingreso se registra en la sede seleccionada al registrar el pago y se generan transferencias de fondos pendientes si la factura es multi-sede."
        icon={Hourglass} 
      />

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
          <TabsTrigger value="pending"><Hourglass className="mr-2 h-4 w-4" /> Pendientes ({pendingPayments.length})</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> Historial Procesados ({processedPayments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card className="shadow-lg"><CardHeader><CardTitle>Pagos Pendientes de Verificación</CardTitle><CardDescription>Pagos que necesitan ser verificados. La verificación aplicará el pago a la factura/saldo, registrará el ingreso en la sede y creará transferencias de fondos pendientes si aplica.</CardDescription></CardHeader><CardContent>{pendingPayments.length > 0 ? (renderPaymentsTable(pendingPayments, true)) : (!isLoading && <p className="text-center text-muted-foreground py-8">No hay pagos pendientes de verificación.</p>)}</CardContent></Card>
        </TabsContent>
        <TabsContent value="history">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Historial de Pagos Procesados</CardTitle>
                            <CardDescription>Pagos globales ya verificados o rechazados.</CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="date-filter-payments" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !filterDateRange && "text-muted-foreground")} disabled={isLoading}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filterDateRange?.from ? (filterDateRange.to ? (<>{format(filterDateRange.from, "LLL dd, y", { locale: es })} - {format(filterDateRange.to, "LLL dd, y", { locale: es })}</>) : (format(filterDateRange.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar por Fecha</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar initialFocus mode="range" defaultMonth={filterDateRange?.from} selected={filterDateRange} onSelect={setFilterDateRange} numberOfMonths={2} locale={es} disabled={isLoading} />
                                </PopoverContent>
                            </Popover>
                            <Select value={filterCustomerId} onValueChange={setFilterCustomerId} disabled={isLoading}>
                                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar Cliente" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL_CUSTOMERS_FILTER_VALUE}>Todos los Clientes</SelectItem>
                                    {initialCustomersDataGlobal.sort((a,b) => a.name.localeCompare(b.name)).map(customer => (<SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                             <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input type="search" placeholder="Buscar por Ref..." className="pl-8 sm:w-[150px]" value={filterReference} onChange={(e) => setFilterReference(e.target.value)} disabled={isLoading} />
                            </div>
                            <Button onClick={handleApplyFilters} className="w-full sm:w-auto" disabled={isLoading}><Filter className="mr-2 h-4 w-4" /> Aplicar</Button>
                            <Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto" disabled={isLoading}>Limpiar</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredProcessedPayments.length > 0 ? (renderPaymentsTable(filteredProcessedPayments, false)) : (!isLoading && <p className="text-center text-muted-foreground py-8">No hay pagos procesados que coincidan con los filtros.</p>)}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Estás seguro? Se eliminará el pago. Si fue verificado, se revertirá el abono a la deuda, el ingreso en cuentas, y las transferencias de fondos asociadas. Esta acción no se puede deshacer.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline" disabled={isProcessing}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleDeletePayment} disabled={isProcessing}>{isProcessing?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:"Eliminar Pago y Revertir"}</Button></DialogFooter></DialogContent>
      </Dialog>
      
      <Dialog open={isEditPaymentDialogOpen} onOpenChange={(isOpen) => {if(!isProcessing) setIsEditPaymentDialogOpen(isOpen)}}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar Pago Pendiente</DialogTitle><DialogDescription>Ajusta los detalles del pago antes de verificarlo.</DialogDescription></DialogHeader>
        <ScrollArea className="max-h-[70vh] p-1 pr-3"><div className="grid gap-4 py-4">
            <div className="space-y-1"><Label htmlFor="apply_to_invoice_edit">Aplicar Pago a*</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId} disabled={isProcessing}><SelectTrigger id="apply_to_invoice_edit"><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                  <SelectContent>{balanceFromAdjustment > 0 && (<SelectItem value={DEBT_ADJUSTMENT_ID}>Abono a Saldo Inicial (${balanceFromAdjustment.toFixed(2)})</SelectItem>)}{pendingInvoicesForCustomer.map(invoice => { let dueDateInfo = ""; if (invoice.dueDate && isValid(parseISO(invoice.dueDate))) { const daysDiff = differenceInDays(new Date(), parseISO(invoice.dueDate)); if (daysDiff > 0) dueDateInfo = ` (Vencida hace ${daysDiff} días)`; else if (daysDiff === 0) dueDateInfo = " (Vence Hoy)"; } const invoiceGlobalBalance = invoice.totalAmount - (initialPaymentsDataGlobal.filter(p=>p.appliedToInvoiceId === invoice.id && p.status === 'verificado').reduce((sum,p) => sum + p.amountAppliedToDebtUSD, 0)); return (<SelectItem key={invoice.id} value={invoice.id}>Factura ID: {invoice.id} ({format(parseISO(invoice.date), "dd/MM/yy")}) - Saldo: ${invoiceGlobalBalance.toFixed(2)}{dueDateInfo}</SelectItem>);})}</SelectContent>
                </Select></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="payment_date_edit">Fecha</Label><Popover open={isPaymentDatePickerOpen} onOpenChange={setIsPaymentDatePickerOpen}><PopoverTrigger asChild><Button id="payment_date_edit" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")} disabled={isProcessing}><CalendarIcon className="mr-2 h-4 w-4" />{paymentDate ? format(paymentDate, "PPP", { locale: es }) : <span>Elige</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={(date) => { setPaymentDate(date); setIsPaymentDatePickerOpen(false); }} initialFocus locale={es} disabled={isProcessing}/></PopoverContent></Popover></div><div className="space-y-1"><Label htmlFor="payment_method_edit">Método</Label><Select value={currentPaymentMethod} onValueChange={(value) => setCurrentPaymentMethod(value as PaymentMethodType)} disabled={isProcessing}><SelectTrigger id="payment_method_edit"><SelectValue/></SelectTrigger><SelectContent>{paymentMethodList.map(method => (<SelectItem key={method} value={method}>{method}</SelectItem>))}</SelectContent></Select></div></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="payment_currency_edit">Moneda</Label><Select value={paymentCurrency} onValueChange={(value) => setPaymentCurrency(value as 'USD' | 'VES')} disabled={isProcessing}><SelectTrigger id="payment_currency_edit"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="VES">VES</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label htmlFor="payment_amount_edit">Monto ({paymentCurrency})</Label><Input id="payment_amount_edit" type="number" value={paymentAmountInput} onChange={(e) => setPaymentAmountInput(e.target.value)} disabled={isProcessing}/></div></div>
            {(paymentCurrency === 'VES') && (<div className="space-y-1"><Label htmlFor="payment_exchange_rate_edit">Tasa Cambio</Label><Input id="payment_exchange_rate_edit" type="number" value={paymentExchangeRate} onChange={(e) => setPaymentExchangeRate(e.target.value)} disabled={isProcessing}/></div>)}
            <div className="space-y-1"><Label htmlFor="payment_ref_edit">Referencia</Label><Input id="payment_ref_edit" value={paymentReferenceNumber} onChange={(e) => setPaymentReferenceNumber(e.target.value)} disabled={isProcessing}/></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="paid_to_branch_edit">Sede Ingreso</Label><Select value={paidToBranchIdDialog} onValueChange={setPaidToBranchIdDialog} disabled={isProcessing}><SelectTrigger id="paid_to_branch_edit"><SelectValue/></SelectTrigger><SelectContent>{availableBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label htmlFor="paid_to_account_edit">Cuenta Ingreso</Label><Select value={paidToAccountIdDialog} onValueChange={(value) => setPaidToAccountIdDialog(value as AccountType)} disabled={isProcessing}><SelectTrigger id="paid_to_account_edit"><SelectValue/></SelectTrigger><SelectContent>{(Object.keys(accountTypeNames) as AccountType[]).map(accType => (<SelectItem key={accType} value={accType}>{accountTypeNames[accType]}</SelectItem>))}</SelectContent></Select></div></div>
        </div></ScrollArea><DialogFooter><DialogClose asChild><Button variant="outline" disabled={isProcessing}>Cancelar</Button></DialogClose><Button onClick={handleSaveEditedPayment} disabled={isProcessing}>Guardar Cambios</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Notas del Pago</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notesToView}</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNotesDialogOpen(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
