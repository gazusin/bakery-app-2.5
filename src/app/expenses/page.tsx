

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
import { DollarSign, PlusCircle, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, Filter, Loader2, Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  loadFromLocalStorageForBranch,
  saveExpensesData,
  type Expense,
  type ExpenseFixedCategory,
  loadExchangeRate,
  saveAccountTransactionsData,
  type AccountTransaction,
  loadCompanyAccountsData,
  saveCompanyAccountsData,
  type CompanyAccountsData,
  type AccountType,
  accountTypeNames,
  type Employee,
  KEYS,
  loadExpenseFixedCategories,
  loadExpenseVariableCategories,
  getActiveBranchId,
  availableBranches,
} from '@/lib/data-storage';
import { ExpenseFormDialog } from '@/components/expenses/expense-form-dialog';
import { ManageCategoriesDialog } from '@/components/expenses/manage-categories-dialog';
import { FormattedNumber } from '@/components/ui/formatted-number';

const mainExpenseCategoriesInternal = [
  { id: 'fijo', name: 'Gasto Fijo' },
  { id: 'variable', name: 'Gasto Variable' },
];

export default function ExpensesPage() {
  const { toast } = useToast();
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageSubmitting, setIsPageSubmitting] = useState(false);
  const [activeBranchName, setActiveBranchName] = useState<string>('');

  const [isExpenseFormDialogOpen, setIsExpenseFormDialogOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [originalExpenseForEdit, setOriginalExpenseForEdit] = useState<Expense | null>(null);

  const [isManageCategoriesDialogOpen, setIsManageCategoriesDialogOpen] = useState(false);
  const [fixedCategoriesListFromStorage, setFixedCategoriesListFromStorage] = useState<ExpenseFixedCategory[]>([]);
  const [variableCategoriesListFromStorage, setVariableCategoriesListFromStorage] = useState<string[]>([]);

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);

  const refreshExpenseCategoriesLists = useCallback(() => {
    const activeBranch = getActiveBranchId();
    if(activeBranch) {
      setFixedCategoriesListFromStorage(loadExpenseFixedCategories(activeBranch));
      setVariableCategoriesListFromStorage(loadExpenseVariableCategories(activeBranch));
    } else {
      setFixedCategoriesListFromStorage([]);
      setVariableCategoriesListFromStorage([]);
    }
  }, []);

  const loadExpensesAndRate = useCallback(() => {
    setIsLoading(true);
    const currentActiveBranchId = getActiveBranchId();
    const branchInfo = availableBranches.find(b => b.id === currentActiveBranchId);
    setActiveBranchName(branchInfo ? branchInfo.name : 'Desconocida');

    if (currentActiveBranchId) {
      const currentExpenses = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, currentActiveBranchId);
      const sortedExpenses = [...currentExpenses].sort((a, b) => {
          const dateA = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : (a.date && isValid(parseISO(a.date)) ? parseISO(a.date).getTime() : 0);
          const dateB = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : (b.date && isValid(parseISO(b.date)) ? parseISO(b.date).getTime() : 0);
          return dateB - dateA;
      });
      setAllExpenses(sortedExpenses);
      setFilteredExpenses(sortedExpenses); 
      setEmployees(loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, currentActiveBranchId).sort((a,b) => a.name.localeCompare(b.name)));
    } else {
      setAllExpenses([]);
      setFilteredExpenses([]);
      setEmployees([]);
      toast({ title: "Error de Sede", description: "No se pudo determinar la sede activa para cargar los gastos.", variant: "destructive" });
    }
    const rate = loadExchangeRate();
    setExchangeRate(rate);
    refreshExpenseCategoriesLists();
    setIsLoading(false);
  }, [refreshExpenseCategoriesLists, toast]);


  useEffect(() => {
    loadExpensesAndRate();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.EXPENSES || 
          customEvent.detail?.key === KEYS.ACTIVE_BRANCH_ID ||
          customEvent.detail?.key === KEYS.EXPENSE_FIXED_CATEGORIES || 
          customEvent.detail?.key === KEYS.EXPENSE_VARIABLE_CATEGORIES ||
          customEvent.detail?.key === KEYS.EXCHANGE_RATE_HISTORY
         ) {
        loadExpensesAndRate();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadExpensesAndRate]);

  const applyFilters = useCallback(() => {
    let expensesToFilter = [...allExpenses];
    if (dateRangeFilter?.from) {
      const toDate = dateRangeFilter.to ? endOfDay(dateRangeFilter.to) : endOfDay(dateRangeFilter.from);
      expensesToFilter = expensesToFilter.filter(expense =>
        expense.date && isValid(parseISO(expense.date)) && isWithinInterval(parseISO(expense.date), { start: startOfDay(dateRangeFilter.from!), end: toDate })
      );
    }
    setFilteredExpenses(expensesToFilter);
  }, [allExpenses, dateRangeFilter]);

  useEffect(() => {
    applyFilters();
  }, [dateRangeFilter, allExpenses, applyFilters]);

  const handleApplyFilters = () => { applyFilters(); };
  const handleClearFilters = () => { setDateRangeFilter(undefined); };

  const handleOpenExpenseFormDialog = (expense?: Expense) => {
    setExpenseToEdit(expense || null);
    if (expense) {
        setOriginalExpenseForEdit(JSON.parse(JSON.stringify(expense)));
    } else {
        setOriginalExpenseForEdit(null);
    }
    setIsExpenseFormDialogOpen(true);
  };

  const handleSubmitExpense = async (
    expenseData: Omit<Expense, 'id' | 'sourceModule' | 'sourceId'>,
    isEditing: boolean,
    originalExpenseId?: string
  ) => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Sede", description: "No se pudo determinar la sede activa para registrar el gasto.", variant: "destructive" });
      return;
    }

    const { date, mainCategoryType, category, description, amount, paidTo, paymentAccountId, timestamp } = expenseData;

    if (!date || !mainCategoryType || !category || !description || !amount || !paidTo || !paymentAccountId) {
      toast({ title: "Error", description: "Todos los campos son obligatorios.", variant: "destructive" });
      return;
    }
    if (category === "Compra de Materia Prima") {
        toast({ title: "Error", description: "Gastos por 'Compra de Materia Prima' deben registrarse vía Órdenes de Compra.", variant: "destructive", duration: 7000 });
        return;
    }
    const amountNumUSD = parseFloat(amount.toString());
    if (isNaN(amountNumUSD) || amountNumUSD <= 0) {
      toast({ title: "Error", description: "El monto debe ser un número positivo.", variant: "destructive" });
      return;
    }
    
    // Usar la tasa para la fecha del gasto, no la actual
    const currentGlobalRate = loadExchangeRate(expenseData.date ? parseISO(expenseData.date) : new Date());

    if ((paymentAccountId === 'vesElectronic' || paymentAccountId === 'vesCash') && currentGlobalRate <= 0) {
        toast({ title: "Error de Tasa", description: `No hay tasa de cambio configurada para la fecha ${expenseData.date} para procesar pagos en VES.`, variant: "destructive", duration: 7000 });
        return;
    }
    
    try {
      setIsPageSubmitting(true);

      let currentAllExpenses = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchId);
      let currentCompanyAccounts = loadCompanyAccountsData(activeBranchId);
      let currentAccountTransactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, activeBranchId);
      const paymentAccountDetails = currentCompanyAccounts[paymentAccountId];

      if (!paymentAccountDetails) {
          toast({ title: "Error de Cuenta", description: `La cuenta de pago ${accountTypeNames[paymentAccountId]} no fue encontrada para la sede ${activeBranchName}.`, variant: "destructive" });
          setIsPageSubmitting(false); 
          return;
      }

      let transactionAmountInAccountCurrency = amountNumUSD;
      let expenseCurrencyForTx: 'USD' | 'VES' = 'USD';
      let amountInOtherCurrencyForTx: number | undefined = undefined;

      if (paymentAccountDetails.currency === 'VES') {
          transactionAmountInAccountCurrency = amountNumUSD * currentGlobalRate;
          expenseCurrencyForTx = 'VES';
          amountInOtherCurrencyForTx = amountNumUSD;
      } else {
          transactionAmountInAccountCurrency = amountNumUSD;
          expenseCurrencyForTx = 'USD';
          if (currentGlobalRate > 0) {
              amountInOtherCurrencyForTx = amountNumUSD * currentGlobalRate;
          }
      }

      if (isEditing && originalExpenseForEdit && originalExpenseId) {
          currentAllExpenses = currentAllExpenses.filter(e => e.id !== originalExpenseId);
          const originalTxIndex = currentAccountTransactions.findIndex(tx => tx.sourceId === originalExpenseId && tx.sourceModule === 'Gastos Operativos');
          if (originalTxIndex !== -1) {
              const originalTx = currentAccountTransactions[originalTxIndex];
              const originalPaymentAccId = originalExpenseForEdit.paymentAccountId!;
              const accountToRevert = currentCompanyAccounts[originalPaymentAccId];
              if (accountToRevert) {
                  accountToRevert.balance = parseFloat((accountToRevert.balance + originalTx.amount).toFixed(2)); 
              }
              currentAccountTransactions.splice(originalTxIndex, 1);
          }
      }

      const newOrUpdatedExpense: Expense = {
        id: isEditing && originalExpenseId ? originalExpenseId : `EXP${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 100)}`,
        date, mainCategoryType: mainCategoryType as 'Fijo' | 'Variable', category, description, amount: amountNumUSD, paidTo,
        sourceModule: 'Gastos Operativos', paymentAccountId,
        timestamp: timestamp || new Date().toISOString(),
      };

      const accountTransactionForStorage: AccountTransaction = {
        id: `TRN-EXP-${newOrUpdatedExpense.id.slice(-5)}-${Date.now().toString().slice(-3)}`,
        date: newOrUpdatedExpense.date,
        description: `Gasto${isEditing ? ' (actualizado)' : ''}: ${newOrUpdatedExpense.description} (Pagado a: ${newOrUpdatedExpense.paidTo})`,
        type: 'egreso',
        accountId: paymentAccountId,
        amount: parseFloat(transactionAmountInAccountCurrency.toFixed(2)),
        currency: expenseCurrencyForTx,
        exchangeRateOnTransactionDate: currentGlobalRate > 0 ? currentGlobalRate : undefined,
        amountInOtherCurrency: amountInOtherCurrencyForTx ? parseFloat(amountInOtherCurrencyForTx.toFixed(2)) : undefined,
        category: `${newOrUpdatedExpense.mainCategoryType} - ${newOrUpdatedExpense.category}`,
        sourceModule: 'Gastos Operativos',
        sourceId: newOrUpdatedExpense.id,
        timestamp: newOrUpdatedExpense.timestamp,
      };

      const accountToUpdate = currentCompanyAccounts[paymentAccountId];
      if (accountToUpdate) {
          accountToUpdate.balance = parseFloat((accountToUpdate.balance - accountTransactionForStorage.amount).toFixed(2));
          accountTransactionForStorage.balanceAfterTransaction = accountToUpdate.balance;
          accountToUpdate.lastTransactionDate = new Date().toISOString();
      }

      const finalExpenses = [newOrUpdatedExpense, ...currentAllExpenses].sort((a, b) => {
          const dateA = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : (a.date && isValid(parseISO(a.date)) ? parseISO(a.date).getTime() : 0);
          const dateB = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : (b.date && isValid(parseISO(b.date)) ? parseISO(b.date).getTime() : 0);
          return dateB - dateA;
      });
      saveExpensesData(activeBranchId, finalExpenses);

      const finalAccountTransactions = [accountTransactionForStorage, ...currentAccountTransactions];
      saveAccountTransactionsData(activeBranchId, finalAccountTransactions);
      saveCompanyAccountsData(activeBranchId, currentCompanyAccounts);

      toast({ title: "Éxito", description: `Gasto ${isEditing ? 'actualizado' : 'registrado'} y cuenta actualizada en sede ${activeBranchName}.` });
      setIsExpenseFormDialogOpen(false);
      setExpenseToEdit(null);
      setOriginalExpenseForEdit(null);
    } catch (error) {
      console.error("Error al procesar el gasto:", error);
      toast({ title: "Error Inesperado", description: "Ocurrió un error al procesar el gasto. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsPageSubmitting(false);
    }
  };


  const handleOpenDeleteConfirmation = (expense: Expense) => {
    if (expense.sourceModule === 'Compra Materia Prima') {
        toast({ title: "Información", description: "Este gasto se originó desde una Orden de Compra y debe gestionarse allí.", variant: "default" });
        return;
    }
    setExpenseToDeleteId(expense.id);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDeleteExpense = () => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Sede", description: "No se pudo determinar la sede activa para eliminar el gasto.", variant: "destructive" });
      return;
    }
    if (!expenseToDeleteId) {
        toast({ title: "Error", description: "ID de gasto a eliminar no especificado.", variant: "destructive" });
        return;
    }

    try {
      setIsPageSubmitting(true);
      let currentAllExpenses = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchId);
      const expenseToDeleteDetails = currentAllExpenses.find(e => e.id === expenseToDeleteId);

      if (!expenseToDeleteDetails || expenseToDeleteDetails.sourceModule === 'Compra Materia Prima') {
        toast({ title: "Error", description: "Gasto no encontrado o no se puede eliminar desde aquí.", variant: "destructive" });
        return;
      }

      const updatedExpensesList = currentAllExpenses.filter(e => e.id !== expenseToDeleteId).sort((a, b) => {
        const dateA = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : (a.date && isValid(parseISO(a.date)) ? parseISO(a.date).getTime() : 0);
        const dateB = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : (b.date && isValid(parseISO(b.date)) ? parseISO(b.date).getTime() : 0);
        return dateB - dateA;
      });
      saveExpensesData(activeBranchId, updatedExpensesList);

      let currentCompanyAccounts = loadCompanyAccountsData(activeBranchId);
      let currentAccountTransactions = loadFromLocalStorageForBranch<AccountTransaction[]>(KEYS.ACCOUNT_TRANSACTIONS, activeBranchId);
      const txIndexToDelete = currentAccountTransactions.findIndex(tx => tx.sourceId === expenseToDeleteId && tx.sourceModule === 'Gastos Operativos');

      if (txIndexToDelete !== -1) {
        const txToDelete = currentAccountTransactions[txIndexToDelete];
        const paymentAccIdOfDeletedTx = expenseToDeleteDetails.paymentAccountId!;
        const accountToRevert = currentCompanyAccounts[paymentAccIdOfDeletedTx];
        if (accountToRevert) {
            accountToRevert.balance = parseFloat((accountToRevert.balance + txToDelete.amount).toFixed(2)); 
            accountToRevert.lastTransactionDate = new Date().toISOString();
        }
        currentAccountTransactions.splice(txIndexToDelete, 1);
        saveAccountTransactionsData(activeBranchId, currentAccountTransactions);
        saveCompanyAccountsData(activeBranchId, currentCompanyAccounts);
      }
      toast({ title: "Éxito", description: `Gasto eliminado y cuenta ajustada en sede ${activeBranchName}.` });
    } catch (error) {
      console.error("Error al eliminar el gasto:", error);
      toast({ title: "Error Inesperado", description: "Ocurrió un error al eliminar el gasto. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setIsPageSubmitting(false);
      setIsDeleteConfirmDialogOpen(false);
      setExpenseToDeleteId(null);
    }
  };

  const formatVesPriceLocal = (usdPrice: number) => {
    if (exchangeRate > 0 && usdPrice) {
      return `Bs. ${(usdPrice * exchangeRate).toFixed(2)}`;
    }
    return "Bs. --";
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Cargando gastos de la sede {activeBranchName}...</p></div>);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Registro de Gastos (Sede: ${activeBranchName})`}
        description="Lleva un registro de todos los gastos de tu panadería para la sede actual. Cada gasto se reflejará como un egreso en la cuenta seleccionada de esta sede."
        icon={DollarSign}
        actions={
          <div className="flex space-x-2">
            <Button onClick={() => setIsManageCategoriesDialogOpen(true)} variant="outline" disabled={isPageSubmitting}><Settings className="mr-2 h-4 w-4" />Gestionar Categorías (Sede: {activeBranchName})</Button>
            <Button onClick={() => handleOpenExpenseFormDialog()} disabled={isPageSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Registrar Gasto (Sede Actual)</Button>
          </div>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><CardTitle>Historial de Gastos (Sede: ${activeBranchName})</CardTitle><CardDescription>Un registro detallado de todos los gastos registrados para esta sede.</CardDescription></div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Popover><PopoverTrigger asChild><Button id="date-filter-expenses" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !dateRangeFilter && "text-muted-foreground")} disabled={isPageSubmitting || isLoading}><CalendarIcon className="mr-2 h-4 w-4" />{dateRangeFilter?.from ? (dateRangeFilter.to ? (<>{format(dateRangeFilter.from, "LLL dd, y", { locale: es })} - {format(dateRangeFilter.to, "LLL dd, y", { locale: es })}</>) : (format(dateRangeFilter.from, "LLL dd, y", { locale: es }))) : (<span>Filtrar por Fecha</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={dateRangeFilter?.from} selected={dateRangeFilter} onSelect={setDateRangeFilter} numberOfMonths={2} locale={es} disabled={isPageSubmitting || isLoading}/></PopoverContent></Popover>
              <Button onClick={handleApplyFilters} className="w-full sm:w-auto" disabled={isPageSubmitting || isLoading}><Filter className="mr-2 h-4 w-4" /> Aplicar Filtro</Button>
              <Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto" disabled={isPageSubmitting || isLoading}>Limpiar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Fecha/Hora Registro</TableHead><TableHead>Tipo Gasto</TableHead><TableHead>Categoría (Detalle)</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Monto (USD)</TableHead><TableHead className="text-right">Monto (VES)</TableHead><TableHead>Pagado A</TableHead><TableHead>Pagado Desde</TableHead><TableHead>Origen</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredExpenses.map((expense, index) => (
                <TableRow key={`${expense.id}-${index}`}>
                  <TableCell>
                    {expense.date && isValid(parseISO(expense.date)) ? format(parseISO(expense.date), "dd/MM/yy", { locale: es }) : '-'}
                    {expense.timestamp && isValid(parseISO(expense.timestamp)) && (
                        <span className="block text-xs text-muted-foreground">
                            {format(parseISO(expense.timestamp), "hh:mm a", { locale: es })}
                        </span>
                    )}
                  </TableCell>
                  <TableCell>{expense.mainCategoryType || 'N/A'}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell className="font-medium max-w-xs truncate" title={expense.description}>{expense.description}</TableCell>
                  <TableCell className="text-right"><FormattedNumber value={expense.amount} prefix="$" /></TableCell>
                  <TableCell className="text-right"><FormattedNumber value={exchangeRate > 0 ? expense.amount * exchangeRate : undefined} prefix="Bs. " /></TableCell>
                  <TableCell>{expense.paidTo}</TableCell>
                  <TableCell>{expense.paymentAccountId ? accountTypeNames[expense.paymentAccountId] : 'N/A'}</TableCell>
                  <TableCell>{expense.sourceModule === 'Compra Materia Prima' ? (<Badge variant="secondary">Orden Compra</Badge>) : (<Badge variant="outline">Manual</Badge>)}</TableCell>
                  <TableCell className="text-right">
                    <div key={`actions-wrapper-${expense.id}-${isPageSubmitting}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isPageSubmitting || expense.sourceModule === 'Compra Materia Prima'}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleOpenExpenseFormDialog(expense)} 
                            disabled={isPageSubmitting || expense.sourceModule === 'Compra Materia Prima'}
                          >
                            <Edit className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleOpenDeleteConfirmation(expense)} 
                            className="text-destructive focus:text-destructive-foreground focus:bg-destructive" 
                            disabled={isPageSubmitting || expense.sourceModule === 'Compra Materia Prima'}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredExpenses.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-8">{dateRangeFilter?.from ? "No hay gastos para el rango de fechas seleccionado." : "No hay gastos registrados."}</p>}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        isOpen={isExpenseFormDialogOpen}
        onOpenChange={(isOpen) => {
            if (!isPageSubmitting) {
                 setIsExpenseFormDialogOpen(isOpen);
                 if (!isOpen) {
                     setExpenseToEdit(null);
                     setOriginalExpenseForEdit(null);
                 }
            }
        }}
        expenseToEdit={expenseToEdit}
        onSubmit={handleSubmitExpense}
        fixedCategories={fixedCategoriesListFromStorage}
        variableCategories={variableCategoriesListFromStorage}
        mainExpenseCategories={mainExpenseCategoriesInternal}
        accountTypeNames={accountTypeNames}
        exchangeRate={exchangeRate}
      />

      <ManageCategoriesDialog
        isOpen={isManageCategoriesDialogOpen}
        onOpenChange={setIsManageCategoriesDialogOpen}
        onCategoriesUpdated={refreshExpenseCategoriesLists}
      />

      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => { if (!isPageSubmitting) setIsDeleteConfirmDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Estás seguro de que quieres eliminar este gasto? Esta acción no se puede deshacer y afectará el saldo de la cuenta de la sede actual.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-end"><DialogClose asChild><Button variant="outline" onClick={() => { if (!isPageSubmitting) { setIsDeleteConfirmDialogOpen(false); setExpenseToDeleteId(null); }}} disabled={isPageSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDeleteExpense} disabled={isPageSubmitting}>{isPageSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{isPageSubmitting ? "Eliminando..." : "Eliminar Gasto"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
