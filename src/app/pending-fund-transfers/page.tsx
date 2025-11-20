

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, History, Loader2, Shuffle, Edit, Save, DollarSign, Banknote, Landmark, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  pendingFundTransfersData as initialPendingFundTransfersData,
  savePendingFundTransfersData,
  type PendingFundTransfer,
  loadFromLocalStorageForBranch,
  saveToLocalStorageForBranch,
  type CompanyAccountsData,
  type AccountTransaction,
  accountTypeNames,
  type AccountType,
  KEYS,
  loadExchangeRate, 
} from '@/lib/data-storage';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FormattedNumber } from '@/components/ui/formatted-number';

type TransferGroup = {
  groupKey: string; // e.g., 'vesElectronic-VES'
  count: number;
  totalAmount: number;
  currency: 'USD' | 'VES';
  icon: React.ElementType;
  title: string;
};

export default function PendingFundTransfersPage() {
  const { toast } = useToast();
  const [pendingTransfers, setPendingTransfers] = useState<PendingFundTransfer[]>([]);
  const [completedTransfers, setCompletedTransfers] = useState<PendingFundTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [isEditNotesDialogOpen, setIsEditNotesDialogOpen] = useState(false);
  const [editingTransferNotes, setEditingTransferNotes] = useState<PendingFundTransfer | null>(null);
  const [currentNotes, setCurrentNotes] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transferToDeleteId, setTransferToDeleteId] = useState<string | null>(null);
  const [isDeleteNCConfirmOpen, setIsDeleteNCConfirmOpen] = useState(false);

  const loadTransfers = useCallback(() => {
    setIsLoading(true);
    const allTransfers = [...initialPendingFundTransfersData].sort((a, b) =>
      parseISO(b.creationTimestamp).getTime() - parseISO(a.creationTimestamp).getTime()
    );
    setPendingTransfers(allTransfers.filter(t => t.status === 'pendiente'));
    setCompletedTransfers(allTransfers.filter(t => t.status === 'completada'));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTransfers();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.PENDING_FUND_TRANSFERS ||
          customEvent.detail?.key === KEYS.COMPANY_ACCOUNTS ||
          customEvent.detail?.key === KEYS.ACCOUNT_TRANSACTIONS) {
        loadTransfers();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadTransfers]);

  const handleCompleteTransfer = (transferId: string, notes?: string) => {
    setIsProcessing(transferId);
    let currentTransfers = [...initialPendingFundTransfersData];
    const transferIndex = currentTransfers.findIndex(t => t.id === transferId);

    if (transferIndex === -1) {
      toast({ title: "Error", description: "Transferencia no encontrada.", variant: "destructive" });
      setIsProcessing(null);
      return;
    }

    const transfer = { ...currentTransfers[transferIndex] };
    if (transfer.status === 'completada') {
      toast({ title: "Info", description: "Esta transferencia ya fue completada.", variant: "default" });
      setIsProcessing(null);
      return;
    }
    
    // Prioritize stored rate, then load historical, finally load current as last resort
    const rate = transfer.exchangeRateAtPayment || loadExchangeRate(parseISO(transfer.creationTimestamp));

    const fromAccountTypeToUse: AccountType = transfer.originalPaymentAccountId || 'usdCash';
    const toAccountTypeToUse: AccountType = transfer.originalPaymentAccountId || 'usdCash';
    const transactionCurrencyBase: 'USD' | 'VES' = transfer.amountVES && transfer.amountVES > 0 ? 'VES' : (transfer.originalPaymentCurrency || 'USD');


    // 1. Egreso de la sede origen (fromBranchId)
    let fromBranchAccounts = loadFromLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.fromBranchId, true);
    let fromBranchTransactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.fromBranchId);
    const fromAccount = fromBranchAccounts[fromAccountTypeToUse];

    if (!fromAccount) {
        toast({title: "Error Cuenta Origen", description: `Cuenta ${accountTypeNames[fromAccountTypeToUse]} no hallada en ${transfer.fromBranchName}.`, variant:"destructive"});
        setIsProcessing(null); return;
    }
     if (fromAccount.currency !== transactionCurrencyBase) {
        toast({title: "Error de Moneda", description: `La cuenta de origen ${accountTypeNames[fromAccountTypeToUse]} en ${transfer.fromBranchName} es ${fromAccount.currency} pero la transferencia es en ${transactionCurrencyBase}. No se puede procesar.`, variant:"destructive", duration: 8000});
        setIsProcessing(null); return;
    }
    
    let amountInFromCurrency = 0;
    let fromOtherAmount: number | undefined = undefined;

    if (transactionCurrencyBase === 'VES') {
        amountInFromCurrency = transfer.amountVES || 0;
        if (rate > 0) {
            fromOtherAmount = amountInFromCurrency / rate; 
        }
    } else { // transactionCurrencyBase === 'USD'
        amountInFromCurrency = transfer.amountUSD; 
        if (rate > 0) {
            fromOtherAmount = transfer.amountUSD * rate; 
        }
    }


    const egressTx: AccountTransaction = {
      id: `TRN-TFO-${transfer.id}-${Date.now().toString().slice(-3)}`,
      date: format(new Date(), "yyyy-MM-dd"),
      description: `Transferencia de fondos a ${transfer.toBranchName} (Venta: ${transfer.saleId}) desde cta. ${accountTypeNames[fromAccountTypeToUse]}`,
      type: 'egreso',
      accountId: fromAccountTypeToUse,
      amount: parseFloat(amountInFromCurrency.toFixed(2)),
      currency: transactionCurrencyBase,
      exchangeRateOnTransactionDate: rate > 0 ? rate : undefined,
      amountInOtherCurrency: fromOtherAmount ? parseFloat(fromOtherAmount.toFixed(2)) : undefined,
      category: 'Transferencia de Fondos',
      sourceModule: 'Transferencia de Fondos',
      sourceId: transfer.id,
      timestamp: new Date().toISOString(),
    };
    fromAccount.balance = parseFloat((fromAccount.balance - amountInFromCurrency).toFixed(2));
    egressTx.balanceAfterTransaction = fromAccount.balance;
    fromAccount.lastTransactionDate = new Date().toISOString();
    fromBranchTransactions = [egressTx, ...fromBranchTransactions];
    saveToLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.fromBranchId, fromBranchAccounts);
    saveToLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.fromBranchId, fromBranchTransactions);

    // 2. Ingreso a la sede destino (toBranchId)
    let toBranchAccounts = loadFromLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.toBranchId, true);
    let toBranchTransactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.toBranchId);
    const toAccount = toBranchAccounts[toAccountTypeToUse];

    if (!toAccount) {
        toast({title: "Error Cuenta Destino", description: `Cuenta ${accountTypeNames[toAccountTypeToUse]} no hallada en ${transfer.toBranchName}.`, variant:"destructive"});
        fromAccount.balance = parseFloat((fromAccount.balance + amountInFromCurrency).toFixed(2)); // Revertir
        fromBranchTransactions = fromBranchTransactions.filter(tx => tx.id !== egressTx.id);
        saveToLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.fromBranchId, fromBranchAccounts);
        saveToLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.fromBranchId, fromBranchTransactions);
        setIsProcessing(null); return;
    }
    if (toAccount.currency !== transactionCurrencyBase) {
        toast({title: "Error de Moneda", description: `La cuenta destino ${accountTypeNames[toAccountTypeToUse]} en ${transfer.toBranchName} es ${toAccount.currency} pero la transferencia es en ${transactionCurrencyBase}. Transferencia revertida.`, variant:"destructive", duration: 8000});
        fromAccount.balance = parseFloat((fromAccount.balance + amountInFromCurrency).toFixed(2)); 
        fromBranchTransactions = fromBranchTransactions.filter(tx => tx.id !== egressTx.id);
        saveToLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.fromBranchId, fromBranchAccounts);
        saveToLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.fromBranchId, fromBranchTransactions);
        setIsProcessing(null); return;
    }

    let amountInToCurrency = amountInFromCurrency;
    let toOtherAmount = fromOtherAmount;

    const ingressTx: AccountTransaction = {
      id: `TRN-TFI-${transfer.id}-${Date.now().toString().slice(-3)}`,
      date: format(new Date(), "yyyy-MM-dd"),
      description: `Recepción de fondos de ${transfer.fromBranchName} (Venta: ${transfer.saleId}) a cta. ${accountTypeNames[toAccountTypeToUse]}`,
      type: 'ingreso',
      accountId: toAccountTypeToUse,
      amount: parseFloat(amountInToCurrency.toFixed(2)),
      currency: transactionCurrencyBase,
      exchangeRateOnTransactionDate: rate > 0 ? rate : undefined,
      amountInOtherCurrency: toOtherAmount ? parseFloat(toOtherAmount.toFixed(2)) : undefined,
      category: 'Transferencia de Fondos',
      sourceModule: 'Transferencia de Fondos',
      sourceId: transfer.id,
      timestamp: new Date().toISOString(),
    };
    toAccount.balance = parseFloat((toAccount.balance + amountInToCurrency).toFixed(2));
    ingressTx.balanceAfterTransaction = toAccount.balance;
    toAccount.lastTransactionDate = new Date().toISOString();
    toBranchTransactions = [ingressTx, ...toBranchTransactions];
    saveToLocalStorageForBranch<CompanyAccountsData>(KEYS.COMPANY_ACCOUNTS, transfer.toBranchId, toBranchAccounts);
    saveToLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, transfer.toBranchId, toBranchTransactions);

    // 3. Actualizar estado de la transferencia pendiente
    transfer.status = 'completada';
    transfer.completionTimestamp = new Date().toISOString();
    transfer.notes = notes || transfer.notes;
    transfer.fromAccountId = fromAccountTypeToUse; 
    transfer.toAccountId = toAccountTypeToUse;     
    transfer.exchangeRateAtPayment = rate; // Guardar la tasa que se usó
    currentTransfers[transferIndex] = transfer;
    savePendingFundTransfersData(currentTransfers);

    toast({ title: "Transferencia Completada", description: `Fondos (${transactionCurrencyBase}) transferidos de ${transfer.fromBranchName} (${accountTypeNames[fromAccountTypeToUse]}) a ${transfer.toBranchName} (${accountTypeNames[toAccountTypeToUse]}).` });
    setIsProcessing(null);
  };
  
  const handleCompleteBatch = (groupKey: string) => {
    const transfersToComplete = pendingTransfers.filter(t => {
      if (!t.originalPaymentAccountId) return false;
      const currency = (t.amountVES !== undefined && t.amountVES > 0) ? 'VES' : 'USD';
      return `${t.originalPaymentAccountId}-${currency}` === groupKey;
    });

    if (transfersToComplete.length === 0) {
      toast({ title: "Info", description: "No hay transferencias para este grupo.", variant: "default"});
      return;
    }
    
    transfersToComplete.forEach(transfer => {
      handleCompleteTransfer(transfer.id);
    });
    
    // Recargar los datos al final del lote
    loadTransfers();
  };

  const handleOpenDeleteDialog = (transferId: string) => {
    setTransferToDeleteId(transferId);
    setIsDeleteConfirmOpen(true);
  };
  
  const handleConfirmDeleteTransfer = () => {
    if (!transferToDeleteId) return;
    setIsProcessing(transferToDeleteId);
    
    let currentTransfers = [...initialPendingFundTransfersData];
    const initialLength = currentTransfers.length;
    
    currentTransfers = currentTransfers.filter(t => t.id !== transferToDeleteId);

    if (currentTransfers.length < initialLength) {
        savePendingFundTransfersData(currentTransfers);
        toast({ title: "Transferencia Eliminada", description: "La transferencia pendiente ha sido eliminada del sistema."});
        loadTransfers(); // Recargar la data para reflejar el cambio
    } else {
        toast({ title: "Error", description: "No se pudo encontrar la transferencia para eliminar.", variant: "destructive" });
    }
    
    setIsDeleteConfirmOpen(false);
    setTransferToDeleteId(null);
    setIsProcessing(null);
  };

  const handleDeleteAllCreditNoteTransfers = () => {
    setIsProcessing('batch-delete-nc');
    const currentTransfers = [...initialPendingFundTransfersData];
    const transfersToKeep = currentTransfers.filter(t => !t.isFromCreditNote);

    if (transfersToKeep.length === currentTransfers.length) {
        toast({
            title: "Sin Cambios",
            description: "No se encontraron transferencias generadas por Notas de Crédito para eliminar.",
            variant: "default"
        });
        setIsProcessing(null);
        setIsDeleteNCConfirmOpen(false);
        return;
    }

    savePendingFundTransfersData(transfersToKeep);
    toast({
        title: "Operación Exitosa",
        description: "Todas las transferencias de fondos generadas por Notas de Crédito han sido eliminadas."
    });
    loadTransfers();
    setIsProcessing(null);
    setIsDeleteNCConfirmOpen(false);
  };

  const handleOpenEditNotesDialog = (transfer: PendingFundTransfer) => {
    setEditingTransferNotes(transfer);
    setCurrentNotes(transfer.notes || '');
    setIsEditNotesDialogOpen(true);
  };

  const handleSaveNotesAndComplete = () => {
    if (editingTransferNotes) {
      handleCompleteTransfer(editingTransferNotes.id, currentNotes);
      // Cerrar el diálogo después de completar
      setIsEditNotesDialogOpen(false); 
      setEditingTransferNotes(null);
    }
  };
  
  const transferGroups = useMemo((): TransferGroup[] => {
    const groups: { [key: string]: { count: number; totalAmount: number; currency: 'USD' | 'VES'; accountId: AccountType } } = {};
    
    pendingTransfers.forEach(t => {
      if (t.isFromCreditNote) return; // No agrupar las de NC
      const accountId = t.originalPaymentAccountId;
      if (!accountId) return;

      const currency: 'USD' | 'VES' = (t.amountVES !== undefined && t.amountVES > 0) ? 'VES' : 'USD';
      const groupKey = `${accountId}-${currency}`;

      if (!groups[groupKey]) {
        groups[groupKey] = { count: 0, totalAmount: 0, currency, accountId };
      }
      
      groups[groupKey].count++;
      if (currency === 'VES') {
        groups[groupKey].totalAmount += t.amountVES || 0;
      } else {
        groups[groupKey].totalAmount += t.amountUSD;
      }
    });

    return Object.entries(groups).map(([groupKey, groupData]) => {
        const { accountId, currency } = groupData;
        return {
            groupKey,
            count: groupData.count,
            totalAmount: groupData.totalAmount,
            currency,
            icon: accountId === 'usdCash' ? DollarSign : accountId === 'vesCash' ? Banknote : Landmark,
            title: `${accountTypeNames[accountId]} (${currency})`
        };
    });
  }, [pendingTransfers]);

  const hasCreditNoteTransfers = useMemo(() => pendingTransfers.some(t => t.isFromCreditNote), [pendingTransfers]);

  const renderTransfersTable = (transfersToList: PendingFundTransfer[], isPending: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID Venta/Transf.</TableHead>
          <TableHead>De Sede</TableHead>
          <TableHead>A Sede</TableHead>
          <TableHead className="text-right">Monto Original</TableHead>
          <TableHead className="text-right">Monto (USD)</TableHead>
          <TableHead>Cta. Pago Original</TableHead>
          <TableHead className="text-right">Tasa Aplicada</TableHead>
          <TableHead>Fecha Creación</TableHead>
          <TableHead>Estado</TableHead>
          {!isPending && <TableHead>De Cuenta</TableHead>}
          {!isPending && <TableHead>A Cuenta</TableHead>}
          {!isPending && <TableHead>Fecha Completado</TableHead>}
          <TableHead>Notas</TableHead>
          {isPending && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfersToList.map((transfer, index) => {
            let originalAmountDisplay = <FormattedNumber value={transfer.amountUSD} prefix="$" decimalPlaces={3} />;
            const rateForDisplay = transfer.exchangeRateAtPayment || loadExchangeRate(parseISO(transfer.creationTimestamp));

            if (transfer.amountVES !== undefined && transfer.amountVES > 0) {
                originalAmountDisplay = <FormattedNumber value={transfer.amountVES} prefix="Bs. " />;
            } else if (transfer.originalPaymentCurrency === 'VES') {
                const amountVES = rateForDisplay > 0 ? transfer.amountUSD * rateForDisplay : 0;
                originalAmountDisplay = <FormattedNumber value={amountVES} prefix="Bs. " />;
            }

            return (
          <TableRow key={`${transfer.id}-${transfer.creationTimestamp}-${index}`} className={cn(transfer.isFromCreditNote && 'bg-destructive/10')}>
            <TableCell>
                <div className="font-mono text-xs">{transfer.saleId}</div>
                <div className="text-xs text-muted-foreground font-mono">{transfer.id}</div>
            </TableCell>
            <TableCell>{transfer.fromBranchName}</TableCell><TableCell>{transfer.toBranchName}</TableCell>
            <TableCell className="text-right font-semibold">{originalAmountDisplay}</TableCell>
            <TableCell className="text-right text-muted-foreground"><FormattedNumber value={transfer.amountUSD} prefix="$" decimalPlaces={3} /></TableCell>
            <TableCell>{transfer.originalPaymentAccountId ? accountTypeNames[transfer.originalPaymentAccountId] : '-'}</TableCell>
            <TableCell className="text-right text-muted-foreground text-xs">
                {transfer.originalPaymentCurrency === 'VES' ? (rateForDisplay > 0 ? rateForDisplay.toFixed(4) : 'N/A') : '-'}
            </TableCell>
            <TableCell>{format(parseISO(transfer.creationTimestamp), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
            <TableCell>
              <Badge variant={transfer.status === 'completada' ? 'default' : 'secondary'}
                className={cn(transfer.status === 'completada' ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50' : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50')}
              >
                {transfer.status === 'pendiente' ? 'Pendiente' : 'Completada'}
              </Badge>
            </TableCell>
            {!isPending && <TableCell>{transfer.fromAccountId ? accountTypeNames[transfer.fromAccountId] : '-'}</TableCell>}
            {!isPending && <TableCell>{transfer.toAccountId ? accountTypeNames[transfer.toAccountId] : '-'}</TableCell>}
            {!isPending && <TableCell>{transfer.completionTimestamp ? format(parseISO(transfer.completionTimestamp), "dd/MM/yy HH:mm", { locale: es }) : '-'}</TableCell>}
            <TableCell className="max-w-xs truncate" title={transfer.notes}>{transfer.notes || '-'}</TableCell>
            {isPending && (
              <TableCell className="text-right space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEditNotesDialog(transfer)}
                  disabled={isProcessing === transfer.id || transfer.isFromCreditNote}
                  className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/50"
                >
                  {isProcessing === transfer.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Completar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" disabled={isProcessing === transfer.id} onClick={() => handleOpenDeleteDialog(transfer.id)}>
                       <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
                      <AlertDialogDescription>
                          ¿Estás seguro de que deseas eliminar esta transferencia pendiente? Esta acción no se puede deshacer y no afectará los saldos de las cuentas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setTransferToDeleteId(null)}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleConfirmDeleteTransfer()} disabled={!!isProcessing}>
                          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sí, Eliminar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            )}
          </TableRow>
        )})}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando transferencias de fondos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferencias de Fondos Pendientes entre Sedes"
        description="Gestiona las transferencias de dinero que deben realizarse entre sedes para conciliar pagos globales. Al completar, se crearán los movimientos en las cuentas de ambas sedes."
        icon={Shuffle}
        actions={
            <div className="flex space-x-2">
                {hasCreditNoteTransfers && (
                    <AlertDialog open={isDeleteNCConfirmOpen} onOpenChange={setIsDeleteNCConfirmOpen}>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={isProcessing !== null}>
                            <Trash2 className="mr-2 h-4 w-4"/>Eliminar Transferencias de NC
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Eliminación en Lote</AlertDialogTitle>
                            <AlertDialogDescription>
                                ¿Estás seguro de que deseas eliminar TODAS las transferencias de fondos pendientes generadas por Notas de Crédito? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isProcessing !== null}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAllCreditNoteTransfers} disabled={isProcessing !== null} className={cn(isProcessing === 'batch-delete-nc' && 'pointer-events-none')}>
                               {isProcessing === 'batch-delete-nc' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sí, Eliminar Todas'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        }
      />
      
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
          <TabsTrigger value="pending">
            <CheckCircle2 className="mr-2 h-4 w-4 text-yellow-600" /> Pendientes ({pendingTransfers.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            <History className="mr-2 h-4 w-4" /> Completadas ({completedTransfers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
            {pendingTransfers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {transferGroups.map(group => (
                <Card key={group.groupKey} className="shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{group.title}</CardTitle>
                    <group.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                        <FormattedNumber value={group.totalAmount} prefix={group.currency === 'USD' ? '$' : 'Bs. '} />
                    </div>
                    <p className="text-xs text-muted-foreground">{group.count} transferencia(s) pendiente(s)</p>
                  </CardContent>
                  <CardFooter>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button className="w-full" size="sm" disabled={isProcessing !== null || group.count === 0}><CheckCircle2 className="mr-2 h-4 w-4"/>Completar Todas</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar lote?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se completarán {group.count} transferencias por un total de <FormattedNumber value={group.totalAmount} prefix={group.currency === 'USD' ? '$' : 'Bs. '} />. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                           <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleCompleteBatch(group.groupKey)}>Confirmar y Procesar</AlertDialogAction>
                           </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              ))}
            </div>
            )}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Transferencias Pendientes</CardTitle>
              <CardDescription>
                {pendingTransfers.length > 0
                  ? "Fondos que deben ser movidos entre las cuentas de las sedes."
                  : "No hay transferencias de fondos pendientes."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingTransfers.length > 0 ? (
                renderTransfersTable(pendingTransfers, true)
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay transferencias pendientes.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Historial de Transferencias Completadas</CardTitle>
              <CardDescription>Transferencias de fondos entre sedes que ya han sido procesadas.</CardDescription>
            </CardHeader>
            <CardContent>
              {completedTransfers.length > 0 ? (
                renderTransfersTable(completedTransfers, false)
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay transferencias completadas en el historial.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isEditNotesDialogOpen} onOpenChange={(isOpen) => { if (!isProcessing) setIsEditNotesDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Completar Transferencia de Fondos</DialogTitle>
            {editingTransferNotes && (
              <DialogDescription>
                <p>Estás a punto de marcar la transferencia <strong>{editingTransferNotes.id}</strong> como completada.
                Esto moverá el equivalente a <strong><FormattedNumber value={editingTransferNotes.amountUSD} prefix="$" decimalPlaces={3} /> USD</strong>
                desde la cuenta <strong>{editingTransferNotes.originalPaymentAccountId ? accountTypeNames[editingTransferNotes.originalPaymentAccountId] : 'Desconocida'} ({editingTransferNotes.originalPaymentCurrency || 'USD'})</strong> de la sede <strong>{editingTransferNotes.fromBranchName}</strong>
                hacia la sede <strong>{editingTransferNotes.toBranchName}</strong>.</p>
                {editingTransferNotes.originalPaymentCurrency === 'VES' && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Tasa a aplicar (del día del pago): <FormattedNumber value={editingTransferNotes.exchangeRateAtPayment || loadExchangeRate(parseISO(editingTransferNotes.creationTimestamp))} decimalPlaces={4} />
                    </p>
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="transfer_notes">Notas Adicionales (Opcional)</Label>
              <Textarea
                id="transfer_notes"
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                placeholder="ej., Transferencia bancaria #123, Entregado en efectivo por..."
                disabled={isProcessing === editingTransferNotes?.id}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isProcessing === editingTransferNotes?.id}>Cancelar</Button></DialogClose>
            <Button onClick={handleSaveNotesAndComplete} disabled={isProcessing === editingTransferNotes?.id}>
              {isProcessing === editingTransferNotes?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Confirmar y Completar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
