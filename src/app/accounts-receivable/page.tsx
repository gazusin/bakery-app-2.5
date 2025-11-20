

"use client";

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, isValid, differenceInDays, isWithinInterval, startOfDay, endOfDay, parse } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CreditCard, DollarSign, Calendar as CalendarIcon, Loader2, FileText as InvoiceHistoryIcon, Building, Filter, Eye, XCircle, PlusCircle, ShieldCheck } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  customersData as initialCustomersDataGlobal,
  saveCustomersData,
  type Customer,
  paymentsData as initialPaymentsDataGlobal,
  savePaymentsData,
  type Payment,
  type PaymentMethodType,
  paymentMethodList,
  type AccountTransaction,
  loadCompanyAccountsData,
  saveCompanyAccountsData,
  type CompanyAccountsData,
  type AccountType,
  accountTypeNames,
  loadExchangeRate,
  userProfileData,
  salesData as initialSalesDataGlobal,
  saveSalesData,
  type Sale,
  getInvoiceStatus,
  KEYS,
  loadFromLocalStorageForBranch,
  saveToLocalStorageForBranch,
  type PendingFundTransfer,
  savePendingFundTransfersData,
  pendingFundTransfersData as initialPendingFundTransfersData,
  availableBranches,
  type PaymentBranchApplication,
  calculateCustomerBalance,
  calculateInvoiceBalance,
  updateGlobalSaleDataAndFinances
} from '@/lib/data-storage';
import { processPayment, type ProcessPaymentInput, type ProcessPaymentOutput } from '@/ai/flows/process-payment-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from '@/components/ui/checkbox';


interface EnrichedPaymentOutput extends ProcessPaymentOutput {
  fileName?: string;
  exchangeRate?: number;
  amountUSD?: number;
}

interface ManualPaymentEntry {
  id: string;
  date: Date;
  amount: string;
  currency: 'USD' | 'VES';
  method: PaymentMethodType;
  exchangeRate: string;
  referenceNumber?: string;
  notes?: string;
  equivalentUSD?: string;
}

export default function AccountsReceivablePage() {
  const { toast } = useToast();
  const [customersWithBalance, setCustomersWithBalance] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [isRegisterPaymentDialogOpen, setIsRegisterPaymentDialogOpen] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);

  const [paymentAmountUSD, setPaymentAmountUSD] = useState<number>(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [paidToBranchIdDialog, setPaidToBranchIdDialog] = useState<string>('');

  const [isInvoiceHistoryDialogOpenAR, setIsInvoiceHistoryDialogOpenAR] = useState(false);
  const [selectedCustomerForInvoicesAR, setSelectedCustomerForInvoicesAR] = useState<Customer | null>(null);
  const [customerInvoicesAR, setCustomerInvoicesAR] = useState<Sale[]>([]);
  const [invoiceHistoryDateRangeFilterAR, setInvoiceHistoryDateRangeFilterAR] = useState<DateRange | undefined>(undefined);

  const [paymentImageFiles, setPaymentImageFiles] = useState<File[]>([]);
  const [batchPayments, setBatchPayments] = useState<EnrichedPaymentOutput[]>([]);
  const [manualPayments, setManualPayments] = useState<ManualPaymentEntry[]>([]);
  const [isAnalyzingPayment, setIsAnalyzingPayment] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Popover control
  const [openDatePickers, setOpenDatePickers] = useState<Record<string, boolean>>({});
  const [openAnalyzedDatePickers, setOpenAnalyzedDatePickers] = useState<Record<number, boolean>>({});


  // Saldo a favor
  const [customerBalance, setCustomerBalance] = useState(0);
  const [applyCustomerCredit, setApplyCustomerCredit] = useState(false);

  // Factura seleccionada para aplicar el pago
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');


  const formatVesPrice = (usdPrice: number): React.ReactNode => {
    if (exchangeRate > 0 && typeof usdPrice === 'number') {
      return <FormattedNumber value={usdPrice * exchangeRate} prefix="Bs. " />;
    }
    return "Bs. --";
  };

  const loadData = useCallback(() => {
    setIsLoading(true);
    const allCustomers = [...initialCustomersDataGlobal];
    const allSales = [...initialSalesDataGlobal];
    const allPayments = [...initialPaymentsDataGlobal];
    const filteredCustomers = allCustomers
      .map(c => ({ ...c, balance: calculateCustomerBalance(c.id, allSales, allPayments) }))
      .filter(c => c.balance !== 0)
      .sort((a, b) => b.balance - a.balance);
    setCustomersWithBalance(filteredCustomers);

    const rate = loadExchangeRate();
    setExchangeRate(rate);

    if (availableBranches.length > 0 && !paidToBranchIdDialog) {
      setPaidToBranchIdDialog(availableBranches[0].id);
    }
    setIsLoading(false);
  }, [paidToBranchIdDialog]);

  useEffect(() => {
    loadData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (
        customEvent.detail?.key === KEYS.CUSTOMERS ||
        customEvent.detail?.key === KEYS.SALES ||
        customEvent.detail?.key === KEYS.PAYMENTS ||
        customEvent.detail?.key === KEYS.COMPANY_ACCOUNTS ||
        customEvent.detail?.key === KEYS.ACCOUNT_TRANSACTIONS ||
        customEvent.detail?.key === KEYS.PENDING_FUND_TRANSFERS ||
        customEvent.detail?.key === KEYS.EXCHANGE_RATE_HISTORY
      ) {
        loadData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadData]);


  useEffect(() => {
    if (payingCustomer) {
      const balance = calculateCustomerBalance(payingCustomer.id, initialSalesDataGlobal, initialPaymentsDataGlobal);
      setCustomerBalance(balance);
    } else {
      setCustomerBalance(0);
    }
    setApplyCustomerCredit(false);
  }, [payingCustomer]);


  const handleOpenRegisterPaymentDialog = (customer: Customer) => {
    setPayingCustomer(customer);
    setPaymentNotes('');
    setPaymentImageFiles([]);
    setBatchPayments([]);
    setSelectedInvoiceId(''); // Reset invoice selection

    const initialRate = loadExchangeRate();
    const newManualPaymentEntry: ManualPaymentEntry = {
      id: `manual-${Date.now()}`, date: new Date(), amount: '', currency: 'VES',
      method: 'Pago Móvil (VES)', exchangeRate: initialRate > 0 ? initialRate.toString() : '',
      equivalentUSD: '0'
    };
    setManualPayments([newManualPaymentEntry]);

    const initialBranchId = availableBranches.length > 0 ? availableBranches[0].id : '';
    setPaidToBranchIdDialog(initialBranchId);

    setIsRegisterPaymentDialogOpen(true);
  };

  const handlePaymentImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setPaymentImageFiles(Array.from(event.target.files));
    } else {
      setPaymentImageFiles([]);
    }
  };

  const handleAnalyzeBatchPayments = async () => {
    if (!paymentImageFiles || paymentImageFiles.length === 0) {
      toast({ title: "Sin imágenes", description: "Por favor, selecciona una o más imágenes de confirmación de pago.", variant: "destructive" });
      return;
    }
    setIsAnalyzingPayment(true);

    const analysisPromises = paymentImageFiles.map(file => {
      return new Promise<EnrichedPaymentOutput>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const paymentImageUri = reader.result as string;
            const analysisInput: ProcessPaymentInput = { paymentImageUri };
            const response = await processPayment(analysisInput);

            let amountUSD: number | undefined;
            let exchangeRateForPayment: number | undefined;

            if (response.date && response.amount) {
              const paymentDateObj = parse(response.date, 'yyyy-MM-dd', new Date());
              if (isValid(paymentDateObj)) {
                exchangeRateForPayment = loadExchangeRate(paymentDateObj);
                if (exchangeRateForPayment > 0) {
                  amountUSD = response.amount / exchangeRateForPayment;
                }
              }
            }

            const enrichedResponse: EnrichedPaymentOutput = {
              ...response,
              fileName: file.name,
              exchangeRate: exchangeRateForPayment,
              amountUSD: amountUSD,
            };

            resolve(enrichedResponse);
          } catch (aiError) {
            console.error(`Error analyzing ${file.name}:`, aiError);
            resolve({
              analysisNotes: `Error al analizar ${file.name}.`,
              fileName: file.name
            });
          }
        };
        reader.onerror = (error) => {
          reject(error);
        };
      });
    });

    try {
      const results = await Promise.all(analysisPromises);
      setBatchPayments(prev => [...prev, ...results]);
      toast({
        title: 'Análisis Completado',
        description: `${results.filter(r => r.amount).length} de ${paymentImageFiles.length} imágenes analizadas. Revisa los resultados.`,
        duration: 7000,
      });

    } catch (error) {
      console.error("Error processing batch payment analysis:", error);
      toast({ title: 'Error Inesperado', description: 'Ocurrió un error al procesar las imágenes.', variant: 'destructive' });
    } finally {
      setIsAnalyzingPayment(false);
      setPaymentImageFiles([]);
    }
  };

  const handleRemoveBatchItem = (indexToRemove: number) => {
    setBatchPayments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAddManualPayment = () => {
    const rate = loadExchangeRate();
    const newEntry: ManualPaymentEntry = {
      id: `manual-${Date.now()}`,
      date: new Date(),
      amount: '',
      currency: 'VES',
      method: 'Pago Móvil (VES)',
      exchangeRate: rate > 0 ? rate.toString() : '',
      equivalentUSD: '0'
    };
    setManualPayments(prev => [...prev, newEntry]);
  };

  const handleRemoveManualPayment = (id: string) => {
    setManualPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleManualPaymentChange = (id: string, field: keyof ManualPaymentEntry | 'equivalentUSD', value: any) => {
    setManualPayments(prev => prev.map(p => {
      if (p.id === id) {
        let updatedPayment = { ...p, [field]: value };
        const rate = parseFloat(updatedPayment.exchangeRate) || 0;

        if (field === 'date') {
          const newRate = loadExchangeRate(value);
          updatedPayment.exchangeRate = newRate > 0 ? newRate.toString() : '';
          const amountNum = parseFloat(updatedPayment.amount) || 0;
          if (updatedPayment.currency === 'VES' && newRate > 0) {
            updatedPayment.equivalentUSD = (amountNum / newRate).toFixed(2);
          }
        } else if (field === 'currency') {
          if (value === 'USD') {
            updatedPayment.method = 'Efectivo USD';
            updatedPayment.equivalentUSD = updatedPayment.amount;
          } else { // VES
            updatedPayment.method = 'Pago Móvil (VES)';
            const amountNum = parseFloat(updatedPayment.amount) || 0;
            updatedPayment.equivalentUSD = rate > 0 ? (amountNum / rate).toFixed(2) : '0';
          }
        } else if (field === 'method') {
          if (value === 'Efectivo USD') updatedPayment.currency = 'USD';
          else updatedPayment.currency = 'VES';
        } else if (field === 'amount') {
          const amountNum = parseFloat(value) || 0;
          if (updatedPayment.currency === 'USD') {
            updatedPayment.equivalentUSD = amountNum.toFixed(2);
          } else { // VES
            updatedPayment.equivalentUSD = rate > 0 ? (amountNum / rate).toFixed(2) : '0';
          }
        } else if (field === 'equivalentUSD') {
          const equivUsdNum = parseFloat(value) || 0;
          if (updatedPayment.currency === 'VES' && rate > 0) {
            updatedPayment.amount = (equivUsdNum * rate).toFixed(2);
          }
        }

        return updatedPayment;
      }
      return p;
    }));
  };

  const handleBatchPaymentDateChange = (index: number, newDate: Date | undefined) => {
    if (!newDate) return;

    setBatchPayments(prev => prev.map((p, i) => {
      if (i === index && p.amount) {
        const newDateStr = format(newDate, "yyyy-MM-dd");
        const newExchangeRate = loadExchangeRate(newDate);
        const newAmountUSD = newExchangeRate > 0 ? p.amount / newExchangeRate : undefined;
        return {
          ...p,
          date: newDateStr,
          exchangeRate: newExchangeRate,
          amountUSD: newAmountUSD,
        };
      }
      return p;
    }));
  };

  const handleBatchPaymentAmountChange = (index: number, newAmountVes: number) => {
    setBatchPayments(prev => prev.map((p, i) => {
      if (i === index) {
        const rate = p.exchangeRate || 0;
        const newAmountUSD = rate > 0 ? newAmountVes / rate : undefined;
        return {
          ...p,
          amount: newAmountVes,
          amountUSD: newAmountUSD
        }
      }
      return p;
    }));
  }

  useEffect(() => {
    const totalFromBatch = batchPayments.reduce((sum, p) => sum + (p.amountUSD || 0), 0);
    const totalFromManual = manualPayments.reduce((sum, p) => {
      const amount = parseFloat(p.amount);
      if (isNaN(amount) || amount <= 0) return sum;
      if (p.currency === 'USD') return sum + amount;
      const rate = parseFloat(p.exchangeRate);
      if (isNaN(rate) || rate <= 0) return sum;
      return sum + (amount / rate);
    }, 0);

    setPaymentAmountUSD(totalFromBatch + totalFromManual);

  }, [batchPayments, manualPayments]);



  const handleSavePayment = () => {
    if (!payingCustomer) {
      toast({ title: "Error", description: "Se requiere un cliente.", variant: "destructive" });
      return;
    }

    const totalFromPayments = paymentAmountUSD;
    const creditToApply = applyCustomerCredit && customerBalance < -0.01 ? Math.abs(customerBalance) : 0;
    const totalAmountToApply = totalFromPayments + creditToApply;

    if (totalAmountToApply <= 0) {
      toast({ title: "Error", description: "El monto total a aplicar a la deuda debe ser positivo.", variant: "destructive" });
      return;
    }

    // Validation for manual payments
    for (const p of manualPayments) {
      const amount = parseFloat(p.amount);
      if (isNaN(amount) || amount <= 0) continue; // Skip empty/invalid manual payments
      if ((p.method === 'Pago Móvil (VES)' || p.method === 'Transferencia (VES)') && (!p.referenceNumber || !/^\d{6}$/.test(p.referenceNumber))) {
        toast({ title: "Error de Referencia", description: `La referencia para el pago manual de ${p.amount} ${p.currency} debe ser de 6 dígitos.`, variant: "destructive" });
        return; // Stop the submission
      }
    }

    const allExistingPayments = initialPaymentsDataGlobal;
    const allNewReferenceNumbers = new Set<string>();

    for (const p of batchPayments) {
      if (p.referenceNumber) {
        const isDuplicate = allExistingPayments.some(existingP =>
          existingP.referenceNumber === p.referenceNumber &&
          (existingP.paymentMethod === 'Pago Móvil (VES)' || existingP.paymentMethod === 'Transferencia (VES)')
        );
        if (isDuplicate) {
          toast({ title: "Error: Pago Duplicado", description: `La referencia ${p.referenceNumber} del archivo ${p.fileName} ya existe.`, variant: "destructive", duration: 7000 });
          return;
        }
        if (allNewReferenceNumbers.has(p.referenceNumber)) {
          toast({ title: "Error: Referencia Duplicada", description: `La referencia ${p.referenceNumber} está duplicada en este lote de pagos.`, variant: "destructive", duration: 7000 });
          return;
        }
        allNewReferenceNumbers.add(p.referenceNumber);
      }
    }

    for (const m of manualPayments) {
      const amount = parseFloat(m.amount);
      if (isNaN(amount) || amount <= 0) continue;
      if ((m.method === 'Pago Móvil (VES)' || m.method === 'Transferencia (VES)') && m.referenceNumber) {
        const isDuplicate = allExistingPayments.some(existingP =>
          existingP.referenceNumber === m.referenceNumber &&
          (existingP.paymentMethod === 'Pago Móvil (VES)' || existingP.paymentMethod === 'Transferencia (VES)')
        );
        if (isDuplicate) {
          toast({ title: "Error: Pago Duplicado", description: `La referencia manual ${m.referenceNumber} ya existe.`, variant: "destructive", duration: 7000 });
          return;
        }
        if (allNewReferenceNumbers.has(m.referenceNumber)) {
          toast({ title: "Error: Referencia Duplicada", description: `La referencia ${m.referenceNumber} está duplicada en este lote de pagos.`, variant: "destructive", duration: 7000 });
          return;
        }
        allNewReferenceNumbers.add(m.referenceNumber);
      }
    }


    setIsSubmittingPayment(true);

    const paymentsToCreate: Partial<Payment>[] = [];
    const parentId = `PAY-P-${Date.now().toString().slice(-6)}`;
    const generalNotes = paymentNotes.trim();

    // Add Credit Payment First if applied
    if (creditToApply > 0) {
      paymentsToCreate.push({
        id: `PAY-CREDIT-${Date.now().toString().slice(-4)}`,
        parentPaymentId: parentId,
        customerId: payingCustomer.id,
        customerName: payingCustomer.name,
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        amountPaidInput: creditToApply,
        currencyPaidInput: 'USD',
        amountAppliedToDebtUSD: creditToApply,
        paymentMethod: 'Crédito a Favor',
        paidToBranchId: 'panaderia_principal',
        paidToAccountId: 'vesElectronic',
        status: 'verificado',
        notes: `Aplicación de saldo a favor existente.${generalNotes ? ` ${generalNotes}` : ''}`.trim(),
        verifiedBy: 'Sistema',
        verificationDate: new Date().toISOString(),
        creationTimestamp: new Date().toISOString(),
      });
    }

    batchPayments.forEach((p, index) => {
      if (p.amount && p.referenceNumber && p.amountUSD) {
        const paymentDateObj = p.date ? parse(p.date, 'yyyy-MM-dd', new Date()) : new Date();
        const paymentStatusForNewPayment: Payment['status'] = 'pendiente de verificación';
        const exchangeRateForPayment = p.exchangeRate || loadExchangeRate(paymentDateObj);

        let notesForThisPayment = `(Auto) Ref: ${p.referenceNumber} - Monto: ${p.amount.toFixed(2)} VES - Tasa: ${exchangeRateForPayment?.toFixed(2) || 'N/A'}. ${p.analysisNotes || ''}`.trim();
        if (generalNotes) notesForThisPayment += ` ${generalNotes}`;

        const newPayment: Partial<Payment> = {
          id: `PAY-AI-${Date.now().toString().slice(-6)}-${index}`,
          parentPaymentId: parentId,
          customerId: payingCustomer.id,
          customerName: payingCustomer.name,
          paymentDate: format(paymentDateObj, "yyyy-MM-dd"),
          amountPaidInput: p.amount,
          currencyPaidInput: 'VES',
          exchangeRateAtPayment: exchangeRateForPayment,
          amountAppliedToDebtUSD: p.amountUSD,
          paymentMethod: 'Pago Móvil (VES)',
          paidToBranchId: paidToBranchIdDialog,
          paidToAccountId: 'vesElectronic',
          status: paymentStatusForNewPayment,
          referenceNumber: p.referenceNumber,
          notes: notesForThisPayment.trim(),
          creationTimestamp: new Date().toISOString(),
        };
        paymentsToCreate.push(newPayment);
      }
    });

    manualPayments.forEach((m, index) => {
      const amount = parseFloat(m.amount);
      if (!isNaN(amount) && amount > 0) {
        const paymentStatusForNewPayment: Payment['status'] = (m.method === 'Efectivo USD' || m.method === 'Efectivo VES') ? 'verificado' : 'pendiente de verificación';
        const rate = parseFloat(m.exchangeRate);
        const amountUSD = m.currency === 'USD' ? amount : (rate > 0 ? amount / rate : 0);

        const getAccountIdForMethod = (): AccountType => {
          if (m.method === 'Efectivo USD') return 'usdCash';
          if (m.method === 'Efectivo VES') return 'vesCash';
          return 'vesElectronic';
        };

        let notesForThisPayment = m.notes || '';
        if (generalNotes) notesForThisPayment = `${notesForThisPayment} ${generalNotes}`.trim();

        const newPayment: Partial<Payment> = {
          id: `PAY-MANUAL-${Date.now().toString().slice(-6)}-${index}`,
          parentPaymentId: parentId,
          customerId: payingCustomer.id,
          customerName: payingCustomer.name,
          paymentDate: format(m.date, "yyyy-MM-dd"),
          amountPaidInput: amount,
          currencyPaidInput: m.currency,
          exchangeRateAtPayment: m.currency === 'VES' ? rate : undefined,
          amountAppliedToDebtUSD: amountUSD,
          paymentMethod: m.method,
          paidToBranchId: paidToBranchIdDialog,
          paidToAccountId: getAccountIdForMethod(),
          status: paymentStatusForNewPayment,
          notes: notesForThisPayment,
          referenceNumber: m.referenceNumber,
          verifiedBy: paymentStatusForNewPayment === 'verificado' ? userProfileData.fullName : undefined,
          verificationDate: paymentStatusForNewPayment === 'verificado' ? new Date().toISOString() : undefined,
          creationTimestamp: new Date().toISOString(),
        };
        paymentsToCreate.push(newPayment);
      }
    });

    if (paymentsToCreate.length === 0) {
      toast({ title: "Sin Pagos Válidos", description: "No se encontraron pagos válidos para registrar.", variant: "destructive" });
      setIsSubmittingPayment(false);
      return;
    }

    const remainingAmountToApplyUSD = paymentAmountUSD - creditToApply;
    const finalPayments: Payment[] = [];

    // Add credit payment to final list immediately
    const creditPaymentFromList = paymentsToCreate.find(p => p.paymentMethod === 'Crédito a Favor');
    if (creditPaymentFromList) {
      finalPayments.push(creditPaymentFromList as Payment);
    }

    // Filter out credit payment for invoice application logic
    const actualMoneyPayments = paymentsToCreate.filter(p => p.paymentMethod !== 'Crédito a Favor');

    // Filtrar facturas según si hay una seleccionada o no
    let invoicesToProcess: Sale[] = [];

    if (selectedInvoiceId && selectedInvoiceId !== 'DEBT_ADJUSTMENT_PAYMENT') {
      // Si hay una factura específica seleccionada, aplicar SOLO a esa factura
      const selectedInvoice = initialSalesDataGlobal.find(sale => sale.id === selectedInvoiceId);
      if (selectedInvoice && selectedInvoice.customerId === payingCustomer.id) {
        const totalPaidForThisInvoice = initialPaymentsDataGlobal
          .filter(p => p.appliedToInvoiceId === selectedInvoice.id && p.status === 'verificado')
          .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);
        const remainingBalance = selectedInvoice.totalAmount - totalPaidForThisInvoice;
        if (remainingBalance > 0.01) {
          invoicesToProcess = [selectedInvoice];
        }
      }
    } else if (!selectedInvoiceId || selectedInvoiceId === '') {
      // Si NO hay factura seleccionada, aplicar en cascada a TODAS las facturas pendientes
      // en orden cronológico (más vieja primero)
      invoicesToProcess = initialSalesDataGlobal.filter(sale => {
        if (sale.customerId !== payingCustomer.id) return false;
        const totalPaidForThisInvoice = initialPaymentsDataGlobal
          .filter(p => p.appliedToInvoiceId === sale.id && p.status === 'verificado')
          .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);
        const remainingBalance = sale.totalAmount - totalPaidForThisInvoice;
        return remainingBalance > 0.01;
      }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    }
    // Si selectedInvoiceId === 'DEBT_ADJUSTMENT_PAYMENT', invoicesToProcess queda vacío (abono directo)

    // First, apply the credit if any, to oldest invoices
    let creditToDistribute = creditToApply;
    for (const invoice of invoicesToProcess) {
      if (creditToDistribute <= 0.001) break;
      const alreadyPaid = initialPaymentsDataGlobal
        .filter(p => p.appliedToInvoiceId === invoice.id && p.status === 'verificado')
        .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0);
      let amountNeededForThisInvoice = (invoice.totalAmount || 0) - alreadyPaid;
      const amountToApplyFromCredit = Math.min(creditToDistribute, amountNeededForThisInvoice);

      if (amountToApplyFromCredit > 0.001 && creditPaymentFromList) {
        finalPayments.push({
          ...creditPaymentFromList,
          id: `${creditPaymentFromList.id}-inv-${invoice.id?.slice(-4) || 'ADJ'}`,
          amountAppliedToDebtUSD: parseFloat(amountToApplyFromCredit.toFixed(2)),
          appliedToInvoiceId: invoice.id,
          paymentSource: 'invoice',
        } as Payment);
        creditToDistribute -= amountToApplyFromCredit;
        amountNeededForThisInvoice -= amountToApplyFromCredit;
      }
    }


    let paymentIndex = 0;
    let amountToDistribute = remainingAmountToApplyUSD;

    for (const invoice of invoicesToProcess) {
      if (amountToDistribute <= 0.001) break;

      const alreadyPaid = initialPaymentsDataGlobal
        .filter(p => p.appliedToInvoiceId === invoice.id && p.status === 'verificado')
        .reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0) + (finalPayments.filter(p => p.appliedToInvoiceId === invoice.id).reduce((sum, p) => sum + p.amountAppliedToDebtUSD, 0));
      let amountNeededForThisInvoice = (invoice.totalAmount || 0) - alreadyPaid;

      while (amountToDistribute > 0.001 && paymentIndex < actualMoneyPayments.length) {
        const currentPayment = actualMoneyPayments[paymentIndex] as Payment;
        if ((currentPayment.amountAppliedToDebtUSD || 0) <= 0.001) {
          paymentIndex++;
          continue;
        }
        const amountToApplyFromThisPayment = Math.min(amountToDistribute, amountNeededForThisInvoice, currentPayment.amountAppliedToDebtUSD || 0);

        if (amountToApplyFromThisPayment > 0.001) {
          const appliedPayment: Payment = {
            ...currentPayment,
            id: `${currentPayment.id}-inv-${invoice.id?.slice(-4) || 'ADJ'}`,
            amountAppliedToDebtUSD: parseFloat(amountToApplyFromThisPayment.toFixed(2)),
            appliedToInvoiceId: invoice.id,
            paymentSource: 'invoice',
          };
          finalPayments.push(appliedPayment);

          currentPayment.amountAppliedToDebtUSD! -= amountToApplyFromThisPayment;
          amountToDistribute -= amountToApplyFromThisPayment;
          amountNeededForThisInvoice -= amountToApplyFromThisPayment;
        }
        if ((currentPayment.amountAppliedToDebtUSD || 0) <= 0.001) {
          paymentIndex++;
        }
        if (amountNeededForThisInvoice <= 0.001) break;
      }
    }

    // Correctly handle excess money payment after applying credit
    const remainingMoneyPaymentAfterInvoices = actualMoneyPayments.reduce((sum, p) => sum + (p.amountAppliedToDebtUSD || 0), 0);

    if (remainingMoneyPaymentAfterInvoices > 0.001) {
      let moneyLeftToMarkAsExcess = remainingMoneyPaymentAfterInvoices;
      paymentIndex = 0; // Reset index to iterate through payments again
      while (moneyLeftToMarkAsExcess > 0.001 && paymentIndex < actualMoneyPayments.length) {
        const currentPayment = actualMoneyPayments[paymentIndex];
        if ((currentPayment.amountAppliedToDebtUSD || 0) > 0.001) {
          const amountForExcess = currentPayment.amountAppliedToDebtUSD || 0;
          const excessPayment: Payment = {
            ...currentPayment,
            id: `${currentPayment.id}-EXCESS`,
            amountAppliedToDebtUSD: parseFloat(amountForExcess.toFixed(2)),
            notes: `${currentPayment.notes || ''} (Exceso de pago aplicado como saldo a favor)`.trim(),
            appliedToInvoiceId: undefined, paymentSource: 'balance_adjustment',
          };
          finalPayments.push(excessPayment);
          moneyLeftToMarkAsExcess -= amountForExcess;
        }
        paymentIndex++;
      }
    }

    try {
      const nonCreditPayments = finalPayments.filter(p => p.paymentMethod !== 'Crédito a Favor');
      let currentGlobalPayments = [...initialPaymentsDataGlobal, ...nonCreditPayments];

      // El pago de crédito (si existe) debe ser manejado por updateGlobalSaleDataAndFinances
      const creditPayment = finalPayments.find(p => p.paymentMethod === 'Crédito a Favor');
      if (creditPayment) {
        updateGlobalSaleDataAndFinances(creditPayment, 'add');
      }

      const verifiedMoneyPayments = nonCreditPayments.filter(p => p.status === 'verificado');
      verifiedMoneyPayments.forEach(p => {
        updateGlobalSaleDataAndFinances(p, 'add');
      });

      savePaymentsData(currentGlobalPayments);

      toast({
        title: `Pago de $${totalAmountToApply.toFixed(2)} Registrado`,
        description: "Pagos verificados aplicados, otros pendientes de verificación."
      });

    } catch (e) {
      const error = e as Error;
      toast({ title: "Error al Procesar Pago", description: error.message, variant: "destructive" });
    }

    setIsRegisterPaymentDialogOpen(false);
    setPayingCustomer(null);
    setIsSubmittingPayment(false);
    loadData();
  };

  const handleOpenInvoiceHistoryDialogAR = (customer: Customer) => {
    setSelectedCustomerForInvoicesAR(customer);
    setInvoiceHistoryDateRangeFilterAR(undefined);
    const invoices = initialSalesDataGlobal
      .filter(sale => sale.customerId === customer.id)
      .sort((a, b) => (a.date && b.date) ? (parseISO(b.date).getTime() - parseISO(a.date).getTime()) : 0);
    setCustomerInvoicesAR(invoices);
    setIsInvoiceHistoryDialogOpenAR(true);
  };

  useEffect(() => {
    if (selectedCustomerForInvoicesAR) {
      let invoices = initialSalesDataGlobal
        .filter(sale => sale.customerId === selectedCustomerForInvoicesAR.id);

      if (invoiceHistoryDateRangeFilterAR?.from) {
        const toDate = invoiceHistoryDateRangeFilterAR.to ? endOfDay(invoiceHistoryDateRangeFilterAR.to) : endOfDay(invoiceHistoryDateRangeFilterAR.from);
        invoices = invoices.filter(invoice => {
          if (!invoice.date || !isValid(parseISO(invoice.date))) return false;
          return isWithinInterval(parseISO(invoice.date), { start: startOfDay(invoiceHistoryDateRangeFilterAR.from!), end: toDate });
        });
      }
      invoices.sort((a, b) => (a.date && b.date) ? (parseISO(b.date).getTime() - parseISO(a.date).getTime()) : 0);
      setCustomerInvoicesAR(invoices);
    }
  }, [selectedCustomerForInvoicesAR, invoiceHistoryDateRangeFilterAR]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando cuentas por cobrar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas por Cobrar (Global)"
        description="Visualiza saldos pendientes globales y registra pagos. El ingreso se registra en la cuenta de la sede seleccionada y se generan transferencias de fondos pendientes si aplica."
        icon={CreditCard}
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Clientes con Saldo (Global)</CardTitle>
          <CardDescription>
            {customersWithBalance.length > 0
              ? "Lista de clientes con saldos pendientes (deuda) o a favor (crédito)."
              : "¡Excelente! Ningún cliente tiene saldo."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customersWithBalance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Cliente</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Correo Electrónico</TableHead>
                  <TableHead className="text-right">Saldo (USD)</TableHead>
                  <TableHead className="text-right">Saldo (VES)</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersWithBalance.map((customer) => {
                  const balance = (customer as any).balance;
                  const isDebt = balance > 0;
                  const balanceValue = Math.abs(balance);
                  const balanceColor = isDebt ? 'text-destructive' : 'text-green-600 dark:text-green-500';
                  const balancePrefix = isDebt ? '$' : 'Saldo a Favor: $';

                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.contact}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell className={cn("text-right font-semibold", balanceColor)}>
                        <FormattedNumber value={balanceValue} prefix={balancePrefix} />
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold", balanceColor)}>
                        {formatVesPrice(balanceValue)}
                      </TableCell>
                      <TableCell className="text-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenInvoiceHistoryDialogAR(customer)}
                          disabled={isSubmittingPayment}
                          title="Ver Historial de Facturas y Pagos"
                          className="px-2"
                        >
                          <InvoiceHistoryIcon className="mr-1 h-4 w-4" />
                          Historial
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRegisterPaymentDialog(customer)}
                          disabled={isSubmittingPayment}
                          title="Registrar Pago"
                          className="px-2"
                        >
                          <DollarSign className="mr-1 h-4 w-4" />
                          Pago
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            !isLoading && <p className="text-center text-muted-foreground py-8">No hay clientes con saldos pendientes o a favor.</p>
          )}
        </CardContent>
      </Card>

      {isRegisterPaymentDialogOpen && (
        <RegisterPaymentDialog
          isOpen={isRegisterPaymentDialogOpen}
          onOpenChange={(isOpen) => { if (!isSubmittingPayment && !isAnalyzingPayment) setIsRegisterPaymentDialogOpen(isOpen) }}
          payingCustomer={payingCustomer}
          setPayingCustomer={setPayingCustomer}
          paymentImageFiles={paymentImageFiles}
          handlePaymentImageFileChange={handlePaymentImageFileChange}
          handleAnalyzeBatchPayments={handleAnalyzeBatchPayments}
          isAnalyzingPayment={isAnalyzingPayment}
          batchPayments={batchPayments}
          handleBatchPaymentAmountChange={handleBatchPaymentAmountChange}
          handleBatchPaymentDateChange={handleBatchPaymentDateChange}
          openAnalyzedDatePickers={openAnalyzedDatePickers}
          setOpenAnalyzedDatePickers={setOpenAnalyzedDatePickers}
          handleRemoveBatchItem={handleRemoveBatchItem}
          manualPayments={manualPayments}
          handleManualPaymentChange={handleManualPaymentChange}
          openDatePickers={openDatePickers}
          setOpenDatePickers={setOpenDatePickers}
          handleRemoveManualPayment={handleRemoveManualPayment}
          handleAddManualPayment={handleAddManualPayment}
          customerBalance={customerBalance}
          applyCustomerCredit={applyCustomerCredit}
          setApplyCustomerCredit={setApplyCustomerCredit}
          paidToBranchIdDialog={paidToBranchIdDialog}
          setPaidToBranchIdDialog={setPaidToBranchIdDialog}
          paymentNotes={paymentNotes}
          setPaymentNotes={setPaymentNotes}
          paymentAmountUSD={paymentAmountUSD}
          handleSavePayment={handleSavePayment}
          isSubmittingPayment={isSubmittingPayment}
          selectedInvoiceId={selectedInvoiceId}
          setSelectedInvoiceId={setSelectedInvoiceId}
        />
      )}

      <Dialog open={isInvoiceHistoryDialogOpenAR} onOpenChange={setIsInvoiceHistoryDialogOpenAR}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de Facturas y Pagos: {selectedCustomerForInvoicesAR?.name}</DialogTitle>
            <DialogDescription>Consulta todas las facturas globales del cliente y los pagos aplicados a cada una.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row items-center gap-2 py-2 border-b mb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date-filter-invoice-history-ar" variant={"outline"} className={cn("w-full sm:w-auto min-w-[200px] justify-start text-left font-normal", !invoiceHistoryDateRangeFilterAR && "text-muted-foreground")} disabled={isSubmittingPayment}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {invoiceHistoryDateRangeFilterAR?.from ? (invoiceHistoryDateRangeFilterAR.to ? (<>{format(invoiceHistoryDateRangeFilterAR.from, "LLL dd, y", { locale: es })} - {format(invoiceHistoryDateRangeFilterAR.to, "LLL dd, y", { locale: es })}</>) : (format(invoiceHistoryDateRangeFilterAR.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar por Fecha de Factura</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={invoiceHistoryDateRangeFilterAR?.from} selected={invoiceHistoryDateRangeFilterAR} onSelect={setInvoiceHistoryDateRangeFilterAR} numberOfMonths={2} locale={es} disabled={isSubmittingPayment} />
              </PopoverContent>
            </Popover>
            <Button onClick={() => setInvoiceHistoryDateRangeFilterAR(undefined)} variant="outline" className="w-full sm:w-auto" disabled={isSubmittingPayment || !invoiceHistoryDateRangeFilterAR?.from}>Limpiar Filtro Fecha</Button>
          </div>
          <ScrollArea className="max-h-[60vh] p-1 pr-4">
            {customerInvoicesAR.length > 0 ? (
              <Accordion type="multiple" className="w-full space-y-2 py-4">
                {customerInvoicesAR.map((invoice) => {
                  const status = getInvoiceStatus(invoice, initialPaymentsDataGlobal);
                  const saldoPendienteGlobal = calculateInvoiceBalance(invoice.id, initialPaymentsDataGlobal, initialSalesDataGlobal);
                  const paymentsForThisInvoice = initialPaymentsDataGlobal.filter(p => p.appliedToInvoiceId === invoice.id);
                  return (
                    <AccordionItem value={invoice.id} key={invoice.id} className="border rounded-md shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-md text-left">
                        <div className="flex flex-col sm:flex-row justify-between w-full items-start sm:items-center gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">Factura ID: <span className="font-mono">{invoice.id}</span></p>
                            <p className="text-xs text-muted-foreground">Fecha: {invoice.date ? format(parseISO(invoice.date), "dd/MM/yyyy") : 'N/A'}</p>
                          </div>
                          <div className="flex-1 text-right sm:text-left">
                            <p className="text-xs">Total Global: <FormattedNumber value={invoice.totalAmount} prefix="$" /></p>
                            <p className="text-xs">Pagado Global (Verif.): <span className="text-green-600"><FormattedNumber value={invoice.totalAmount - saldoPendienteGlobal} prefix="$" /></span></p>
                            <p className="text-xs">Saldo Global: <span className={(saldoPendienteGlobal > 0.001 ? "text-destructive" : "")}><FormattedNumber value={(saldoPendienteGlobal)} prefix="$" /></span></p>
                          </div>
                          <div className="flex-1 text-right">
                            <Badge variant={status === 'Completada' ? 'default' : status === 'Vencida' ? 'destructive' : 'secondary'} className={cn("whitespace-nowrap text-xs", status === 'Completada' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : status === 'Vencida' ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50' : status === 'Pagada Parcialmente' ? 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/50' : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50')}>
                              {status}
                            </Badge>
                            {invoice.paymentMethod === 'Crédito' && invoice.dueDate && <p className="text-xs text-muted-foreground mt-1">Vence: {format(parseISO(invoice.dueDate), "dd/MM/yyyy")}</p>}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 py-3 border-t">
                        {invoice.itemsPerBranch && invoice.itemsPerBranch.length > 0 && (<div className="mb-3"><h4 className="font-medium text-xs mb-1.5">Desglose por Sede:</h4>{invoice.itemsPerBranch.map(branchData => (<div key={branchData.branchId} className="mb-1.5 p-2 border rounded-md text-xs bg-muted/30"><p className="font-semibold">{branchData.branchName}:</p><p>Monto Sede: <FormattedNumber value={branchData.totalAmount} prefix="$" /></p><p>Pagado Sede (Verif.): <span className="text-green-600"><FormattedNumber value={branchData.amountPaidUSD} prefix="$" /></span></p><p>Saldo Sede: <span className={(branchData.totalAmount - branchData.amountPaidUSD) > 0.001 ? "text-destructive" : ""}><FormattedNumber value={(branchData.totalAmount - branchData.amountPaidUSD)} prefix="$" /></span></p><ul className="list-disc list-inside pl-3 mt-1">{branchData.items.map((item, idx) => <li key={idx} className="text-muted-foreground">{item.productName} (x{item.quantity})</li>)}</ul></div>))}</div>)}
                        {paymentsForThisInvoice.length > 0 ? (<><h4 className="font-medium text-sm mb-2">Pagos Registrados para esta Factura:</h4><Table className="text-xs"><TableHeader><TableRow><TableHead>ID Pago</TableHead><TableHead>Fecha</TableHead><TableHead>Monto Aplicado (USD)</TableHead><TableHead>Monto Pagado (Moneda Orig.)</TableHead><TableHead>Método</TableHead><TableHead>Referencia</TableHead><TableHead>Estado Pago</TableHead></TableRow></TableHeader><TableBody>{paymentsForThisInvoice.map(payment => (<TableRow key={payment.id}><TableCell>{payment.id}</TableCell><TableCell>{payment.paymentDate ? format(parseISO(payment.paymentDate), "dd/MM/yy") : 'N/A'}</TableCell><TableCell><FormattedNumber value={payment.amountAppliedToDebtUSD} prefix="$" /></TableCell><TableCell>{payment.currencyPaidInput === 'VES' ? <FormattedNumber value={payment.amountPaidInput} prefix="Bs. " /> : (payment.currencyPaidInput === 'USD' ? <FormattedNumber value={payment.amountPaidInput} prefix="$" /> : 'N/A')}</TableCell><TableCell>{payment.paymentMethod}</TableCell><TableCell>{payment.referenceNumber || '-'}</TableCell><TableCell><Badge variant={payment.status === 'verificado' ? 'default' : payment.status === 'rechazado' ? 'destructive' : 'secondary'} className={cn("text-xs", payment.status === 'verificado' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : payment.status === 'rechazado' ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50' : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50')}>{payment.status}</Badge></TableCell></TableRow>))}</TableBody></Table></>) : (<p className="text-sm text-muted-foreground text-center py-2">No hay pagos registrados para esta factura.</p>)}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (<p className="text-center text-muted-foreground py-8">{invoiceHistoryDateRangeFilterAR?.from ? "Este cliente no tiene facturas en el rango de fechas seleccionado." : "Este cliente no tiene facturas registradas."}</p>)}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" onClick={() => { setIsInvoiceHistoryDialogOpenAR(false); setSelectedCustomerForInvoicesAR(null); setCustomerInvoicesAR([]); setInvoiceHistoryDateRangeFilterAR(undefined); }}>Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegisterPaymentDialog({
  isOpen, onOpenChange, payingCustomer, setPayingCustomer,
  paymentImageFiles, handlePaymentImageFileChange, handleAnalyzeBatchPayments, isAnalyzingPayment,
  batchPayments, handleBatchPaymentAmountChange, handleBatchPaymentDateChange, openAnalyzedDatePickers, setOpenAnalyzedDatePickers, handleRemoveBatchItem,
  manualPayments, handleManualPaymentChange, openDatePickers, setOpenDatePickers, handleRemoveManualPayment, handleAddManualPayment,
  customerBalance, applyCustomerCredit, setApplyCustomerCredit,
  paidToBranchIdDialog, setPaidToBranchIdDialog,
  paymentNotes, setPaymentNotes,
  paymentAmountUSD, handleSavePayment, isSubmittingPayment,
  selectedInvoiceId, setSelectedInvoiceId
}: {
  isOpen: boolean, onOpenChange: (isOpen: boolean) => void, payingCustomer: Customer | null, setPayingCustomer: (c: Customer | null) => void,
  paymentImageFiles: File[], handlePaymentImageFileChange: (e: ChangeEvent<HTMLInputElement>) => void, handleAnalyzeBatchPayments: () => void, isAnalyzingPayment: boolean,
  batchPayments: EnrichedPaymentOutput[], handleBatchPaymentAmountChange: (index: number, newAmountVes: number) => void, handleBatchPaymentDateChange: (index: number, date: Date | undefined) => void, openAnalyzedDatePickers: Record<number, boolean>, setOpenAnalyzedDatePickers: React.Dispatch<React.SetStateAction<Record<number, boolean>>>, handleRemoveBatchItem: (index: number) => void,
  manualPayments: ManualPaymentEntry[], handleManualPaymentChange: (id: string, field: keyof ManualPaymentEntry | 'equivalentUSD', value: any) => void, openDatePickers: Record<string, boolean>, setOpenDatePickers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, handleRemoveManualPayment: (id: string) => void, handleAddManualPayment: () => void,
  customerBalance: number, applyCustomerCredit: boolean, setApplyCustomerCredit: (val: boolean) => void,
  paidToBranchIdDialog: string, setPaidToBranchIdDialog: (val: string) => void,
  paymentNotes: string, setPaymentNotes: (val: string) => void,
  paymentAmountUSD: number, handleSavePayment: () => void, isSubmittingPayment: boolean,
  selectedInvoiceId: string, setSelectedInvoiceId: (val: string) => void
}) {
  const [pendingInvoices, setPendingInvoices] = useState<Sale[]>([]);

  useEffect(() => {
    if (payingCustomer) {
      const invoices = initialSalesDataGlobal.filter(
        sale => sale.customerId === payingCustomer.id && getInvoiceStatus(sale, initialPaymentsDataGlobal) !== 'Completada'
      ).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      setPendingInvoices(invoices);
    }
  }, [isOpen, payingCustomer]); // Recalcula si el diálogo se abre o cambia el cliente.

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isSubmittingPayment && !isAnalyzingPayment) onOpenChange(open) }}>
      <DialogContent className="sm:max-w-4xl lg:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Registrar Pago de: {payingCustomer?.name}</DialogTitle>
          <DialogDescription>
            Saldo pendiente total del cliente: <span className="font-semibold"><FormattedNumber value={(payingCustomer as any)?.balance || 0} prefix="$" /></span>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] p-1 pr-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">

            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <Label className="font-semibold text-base">Autocompletar con IA (Beta)</Label>
                <p className="text-sm text-muted-foreground">Sube una o varias imágenes de la confirmación de pago (ej. Pago Móvil) para rellenar los campos.</p>
                <div className="flex gap-2 items-center">
                  <Input
                    id="payment_image_upload"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePaymentImageFileChange}
                    disabled={isSubmittingPayment || isAnalyzingPayment}
                    className="flex-grow"
                  />
                  <Button onClick={handleAnalyzeBatchPayments} disabled={isSubmittingPayment || isAnalyzingPayment || paymentImageFiles.length === 0}>
                    {isAnalyzingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                    {isAnalyzingPayment ? 'Analizando...' : 'Analizar'}
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <Label className="font-semibold text-base">Añadir Pagos Manuales (Efectivo, etc.)</Label>
                <div className="space-y-2">
                  {manualPayments.map((p, index) => {
                    const amountNum = parseFloat(p.amount) || 0;
                    const rateNum = parseFloat(p.exchangeRate) || 0;
                    const equivalentUSDNum = parseFloat(p.equivalentUSD || '0') || 0;
                    const showRef = p.method === 'Pago Móvil (VES)' || p.method === 'Transferencia (VES)';
                    return (
                      <div key={p.id} className="grid grid-cols-12 gap-2 items-end border-b pb-2 last:border-b-0">
                        <div className="col-span-12 sm:col-span-6 md:col-span-2 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_date_${p.id}`} className="text-xs">Fecha</Label>}
                          <Popover open={openDatePickers[p.id]} onOpenChange={(open) => setOpenDatePickers(prev => ({ ...prev, [p.id]: open }))}><PopoverTrigger asChild><Button id={`manual_date_${p.id}`} variant="outline" size="sm" className="w-full text-xs h-8 justify-start font-normal"><CalendarIcon className="mr-1 h-3 w-3" />{format(p.date, "dd/MM/yy", { locale: es })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={p.date} onSelect={(date) => { if (date) { handleManualPaymentChange(p.id, 'date', date); setOpenDatePickers(prev => ({ ...prev, [p.id]: false })); } }} initialFocus locale={es} /></PopoverContent></Popover>
                        </div>
                        <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_amount_${p.id}`} className="text-xs">Monto</Label>}
                          <Input id={`manual_amount_${p.id}`} type="number" value={p.amount} onChange={(e) => handleManualPaymentChange(p.id, 'amount', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-6 sm:col-span-3 md:col-span-1 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_currency_${p.id}`} className="text-xs">Moneda</Label>}
                          <Select value={p.currency} onValueChange={(val) => handleManualPaymentChange(p.id, 'currency', val)}><SelectTrigger id={`manual_currency_${p.id}`} className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="VES">VES</SelectItem></SelectContent></Select>
                        </div>
                        <div className="col-span-12 sm:col-span-6 md:col-span-3 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_method_${p.id}`} className="text-xs">Método</Label>}
                          <Select value={p.method} onValueChange={(val) => handleManualPaymentChange(p.id, 'method', val)}><SelectTrigger id={`manual_method_${p.id}`} className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{paymentMethodList.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_rate_${p.id}`} className="text-xs">Tasa</Label>}
                          <Input id={`manual_rate_${p.id}`} type="number" value={p.exchangeRate} onChange={(e) => handleManualPaymentChange(p.id, 'exchangeRate', e.target.value)} disabled={p.currency !== 'VES'} className="h-8 text-xs" />
                        </div>
                        <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                          {index === 0 && <Label htmlFor={`manual_equiv_usd_${p.id}`} className="text-xs">Equiv. (USD)</Label>}
                          <Input
                            id={`manual_equiv_usd_${p.id}`}
                            type="number"
                            value={p.equivalentUSD}
                            onChange={(e) => handleManualPaymentChange(p.id, 'equivalentUSD', e.target.value)}
                            disabled={p.currency === 'USD'}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className={cn("col-span-6 md:col-span-2 space-y-1", !showRef && "hidden")}>
                          {index === 0 && <Label htmlFor={`manual_ref_${p.id}`} className="text-xs">Ref. (6 dig)*</Label>}
                          <Input id={`manual_ref_${p.id}`} type="text" value={p.referenceNumber || ''} onChange={(e) => handleManualPaymentChange(p.id, 'referenceNumber', e.target.value)} className="h-8 text-xs" maxLength={6} />
                        </div>
                        <div className="col-span-12 sm:col-span-1 flex justify-end items-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveManualPayment(p.id)}><XCircle className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={handleAddManualPayment}><PlusCircle className="mr-2 h-4 w-4" /> Añadir Pago Manual</Button>
              </div>

            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="apply_to_invoice_edit">Aplicar Pago a</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId} disabled={isSubmittingPayment}>
                  <SelectTrigger id="apply_to_invoice_edit">
                    <SelectValue placeholder="Selecciona una factura o abono..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBT_ADJUSTMENT_PAYMENT">Abono directo a la deuda (sin factura)</SelectItem>
                    {pendingInvoices.map(invoice => {
                      const daysDiff = invoice.dueDate ? differenceInDays(new Date(), parseISO(invoice.dueDate)) : 0;
                      let dueDateInfo = "";
                      if (daysDiff > 0) dueDateInfo = ` (Vencida hace ${daysDiff} días)`;
                      else if (daysDiff === 0) dueDateInfo = " (Vence Hoy)";
                      const invoiceGlobalBalance = calculateInvoiceBalance(invoice.id, initialPaymentsDataGlobal, initialSalesDataGlobal);
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          Factura ID: {invoice.id} ({format(parseISO(invoice.date), "dd/MM/yy")}) - Saldo: ${invoiceGlobalBalance.toFixed(2)}{dueDateInfo}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {batchPayments.length > 0 && (
                <div className="space-y-2 mt-4">
                  <Label className="font-semibold">Pagos Analizados</Label>
                  <ScrollArea className="h-40 w-full rounded-md border p-2">
                    <div className="space-y-2">
                      {batchPayments.map((payment, index) => (
                        <div key={index} className="flex items-start justify-between p-2 rounded-md bg-muted/50 gap-2">
                          <div className="flex-grow space-y-1">
                            <p className="text-xs font-medium truncate max-w-[200px]">{payment.fileName}</p>
                            {payment.amount !== undefined ? (
                              <>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-center">
                                  <div className="space-y-0.5">
                                    <Label htmlFor={`batch_amount_${index}`} className="text-xs">Monto (VES)</Label>
                                    <Input
                                      id={`batch_amount_${index}`}
                                      type="number"
                                      value={payment.amount || ''}
                                      onChange={(e) => handleBatchPaymentAmountChange(index, parseFloat(e.target.value) || 0)}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-xs">Fecha</Label>
                                    <Popover open={openAnalyzedDatePickers[index]} onOpenChange={(open) => setOpenAnalyzedDatePickers(prev => ({ ...prev, [index]: open }))}>
                                      <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 px-1.5 py-0.5 text-xs w-full justify-start">
                                          <CalendarIcon className="mr-1 h-3 w-3" />
                                          {payment.date ? format(parse(payment.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy") : 'N/A'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={payment.date ? parse(payment.date, 'yyyy-MM-dd', new Date()) : undefined} onSelect={(date) => { handleBatchPaymentDateChange(index, date); setOpenAnalyzedDatePickers(prev => ({ ...prev, [index]: false })); }} initialFocus locale={es} />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>
                                <p className="text-xs">Ref: {payment.referenceNumber}</p>
                                {payment.amountUSD !== undefined && payment.exchangeRate !== undefined && (
                                  <p className="text-xs text-muted-foreground">
                                    Equiv: <FormattedNumber value={payment.amountUSD} prefix="$" /> (Tasa: {payment.exchangeRate.toFixed(2)})
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-destructive">{payment.analysisNotes}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => handleRemoveBatchItem(index)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {customerBalance < -0.01 && (
                <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                  <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-800 dark:text-green-300">Saldo a Favor Disponible</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    <p>Este cliente tiene un saldo a favor de <FormattedNumber value={Math.abs(customerBalance)} prefix="$" />.</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox id="apply_credit_ar" checked={applyCustomerCredit} onCheckedChange={(checked) => setApplyCustomerCredit(!!checked)} />
                      <label htmlFor="apply_credit_ar" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        ¿Desea aplicar este saldo a favor a este pago?
                      </label>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="paid_to_branch_id_dialog_ar">Sede de Ingreso del Pago*</Label>
                  <Select value={paidToBranchIdDialog} onValueChange={setPaidToBranchIdDialog} disabled={isSubmittingPayment || isAnalyzingPayment}>
                    <SelectTrigger id="paid_to_branch_id_dialog_ar"><SelectValue placeholder="Selecciona sede" /></SelectTrigger>
                    <SelectContent>{availableBranches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_notes_ar">Notas Generales (Opcional)</Label>
                  <Textarea id="payment_notes_ar" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="ej., Abono a factura X, pago parcial..." disabled={isSubmittingPayment || isAnalyzingPayment} />
                </div>
              </div>
              {paymentAmountUSD > 0 && (
                <div className="mt-2 p-2 border rounded-md bg-muted/50 text-sm">
                  <p>Monto Total (Pagos + Crédito): <span className="font-semibold"><FormattedNumber value={paymentAmountUSD + (applyCustomerCredit ? Math.abs(customerBalance) : 0)} prefix="$" /></span></p>
                </div>
              )}

            </div>

          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={() => { if (!isSubmittingPayment) { onOpenChange(false); setPayingCustomer(null); } }} disabled={isSubmittingPayment || isAnalyzingPayment}>Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSavePayment} disabled={isSubmittingPayment || isAnalyzingPayment || !paidToBranchIdDialog || (paymentAmountUSD <= 0 && !applyCustomerCredit)}>
            {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
            {isSubmittingPayment ? "Registrando..." : "Registrar Pagos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}













