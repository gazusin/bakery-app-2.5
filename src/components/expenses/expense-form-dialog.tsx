
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, PlusCircle, Edit, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type Expense, type ExpenseFixedCategory, type AccountType, accountTypeNames as defaultAccountTypeNames, type Employee, loadFromLocalStorageForBranch, EXPENSES_STORAGE_KEY_BASE, KEYS, getActiveBranchId } from '@/lib/data-storage';
import { FormattedNumber } from '@/components/ui/formatted-number';

interface ExpenseFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expenseToEdit?: Expense | null;
  onSubmit: (expenseData: Omit<Expense, 'id' | 'sourceModule' | 'sourceId'>, isEditing: boolean, originalExpenseId?: string) => Promise<void>;
  fixedCategories: ExpenseFixedCategory[];
  variableCategories: string[];
  mainExpenseCategories: { id: string; name: string }[];
  accountTypeNames?: Record<AccountType, string>;
  exchangeRate: number;
}

const mainExpenseCategoriesInternal = [
  { id: 'fijo', name: 'Gasto Fijo' },
  { id: 'variable', name: 'Gasto Variable' },
];

export function ExpenseFormDialog({
  isOpen,
  onOpenChange,
  expenseToEdit,
  onSubmit,
  fixedCategories,
  variableCategories,
  mainExpenseCategories = mainExpenseCategoriesInternal,
  accountTypeNames = defaultAccountTypeNames,
  exchangeRate,
}: ExpenseFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!expenseToEdit;

  const [expenseDate, setExpenseDate] = useState<Date | undefined>(new Date());
  const [mainCategoryId, setMainCategoryId] = useState<string>(mainExpenseCategories[0]?.id || '');
  const [subCategoryId, setSubCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  const [amountInput, setAmountInput] = useState<string>('');
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'VES'>(exchangeRate > 0 ? 'VES' : 'USD');

  const [paidTo, setPaidTo] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<AccountType>(exchangeRate > 0 ? 'vesElectronic' : 'usdCash');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSalaryDisplay, setEmployeeSalaryDisplay] = useState<string | null>(null);
  
  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([]);
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [payrollHistoryDisplay, setPayrollHistoryDisplay] = useState<React.ReactNode | null>(null);
  const [remainingToPayForWeekUSD, setRemainingToPayForWeekUSD] = useState<number | null>(null);

  const prevInputCurrencyRef = useRef<'USD' | 'VES'>(inputCurrency);
  const prevAmountInputRef = useRef<string>(amountInput);

  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (isOpen) {
      const activeBranchId = getActiveBranchId();
      if(activeBranchId) {
        setEmployees(loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchId).sort((a,b) => a.name.localeCompare(b.name)));
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditing && expenseToEdit) {
      setExpenseDate(expenseToEdit.date && isValid(parseISO(expenseToEdit.date)) ? parseISO(expenseToEdit.date) : new Date());
      const mainCatId = expenseToEdit.mainCategoryType === 'Fijo' ? 'fijo' : expenseToEdit.mainCategoryType === 'Variable' ? 'variable' : '';
      if (mainCatId) setMainCategoryId(mainCatId);
      else {
        if (fixedCategories.find(cat => cat.name === expenseToEdit.category)) setMainCategoryId('fijo');
        else if (variableCategories.includes(expenseToEdit.category)) setMainCategoryId('variable');
        else setMainCategoryId(mainExpenseCategories[0]?.id || '');
      }
      setSubCategoryId(expenseToEdit.category || '');
      setDescription(expenseToEdit.description || '');
      
      setInputCurrency('USD'); // Start with USD for editing
      setAmountInput(expenseToEdit.amount?.toString() || '');
      prevInputCurrencyRef.current = 'USD'; // Ensure ref is also updated

      setPaidTo(expenseToEdit.paidTo || '');
      setPaymentAccountId(expenseToEdit.paymentAccountId || (exchangeRate > 0 ? 'vesElectronic' : 'usdCash'));
      
      const isNominaExpense = (mainCatId === 'fijo' || (fixedCategories.find(cat => cat.name === expenseToEdit.category) && mainExpenseCategories.find(mc => mc.name === 'Gasto Fijo')?.id === 'fijo')) && expenseToEdit.category === 'Nómina';
      const employeeMatch = employees.find(emp => emp.name === expenseToEdit.paidTo);

      if (isNominaExpense && employeeMatch) {
        setSelectedEmployeeId(employeeMatch.id);
        setEmployeeSalaryDisplay(employeeMatch.salary !== undefined ? `$${employeeMatch.salary.toFixed(2)}` : 'Salario no definido');
      } else {
        setSelectedEmployeeId('');
        setEmployeeSalaryDisplay(null);
      }
    } else { // Resetting form for new entry
      setExpenseDate(new Date());
      setMainCategoryId(mainExpenseCategories[0]?.id || '');
      setDescription('');
      setAmountInput('');
      const initialCurrency = exchangeRate > 0 ? 'VES' : 'USD';
      setInputCurrency(initialCurrency);
      prevInputCurrencyRef.current = initialCurrency;
      setPaidTo('');
      setPaymentAccountId(exchangeRate > 0 ? 'vesElectronic' : 'usdCash');
      setSelectedEmployeeId('');
      setEmployeeSalaryDisplay(null);
      setPayrollHistoryDisplay(null);
      setRemainingToPayForWeekUSD(null);
    }
  }, [isEditing, expenseToEdit, mainExpenseCategories, exchangeRate, fixedCategories, variableCategories, employees, isOpen]); // Added isOpen to re-init on open

  useEffect(() => {
    let subs: string[] = [];
    if (mainCategoryId === 'fijo') {
      subs = fixedCategories.map(cat => cat.name).filter(catName => catName.toLowerCase() !== "compra de materia prima");
    } else if (mainCategoryId === 'variable') {
      subs = variableCategories.filter(cat => cat.toLowerCase() !== "compra de materia prima");
    }
    setAvailableSubcategories(subs);

    if (!isEditing) {
      if (subs.length > 0) {
        const currentSubStillValid = subs.includes(subCategoryId);
        if (!subCategoryId || !currentSubStillValid) setSubCategoryId(subs[0]);
      } else setSubCategoryId('');
    } else if (expenseToEdit) {
      const originalMainCatId = expenseToEdit.mainCategoryType === 'Fijo' ? 'fijo' : expenseToEdit.mainCategoryType === 'Variable' ? 'variable' : '';
      if (mainCategoryId === originalMainCatId) {
        if (subs.includes(expenseToEdit.category)) setSubCategoryId(expenseToEdit.category);
        else if (subs.length > 0) setSubCategoryId(subs[0]);
        else setSubCategoryId('');
      } else {
        if (subs.length > 0) setSubCategoryId(subs[0]);
        else setSubCategoryId('');
      }
    }
  }, [mainCategoryId, fixedCategories, variableCategories, isEditing, expenseToEdit, subCategoryId]);

  useEffect(() => {
    const numericAmount = parseFloat(amountInput);
    if (prevInputCurrencyRef.current !== inputCurrency && !isNaN(numericAmount) && exchangeRate > 0) {
      if (inputCurrency === 'VES' && prevInputCurrencyRef.current === 'USD') {
        setAmountInput((numericAmount * exchangeRate).toFixed(2));
      } else if (inputCurrency === 'USD' && prevInputCurrencyRef.current === 'VES') {
        setAmountInput((numericAmount / exchangeRate).toFixed(2));
      }
    }
    prevInputCurrencyRef.current = inputCurrency;
  }, [inputCurrency, exchangeRate, amountInput]); 
  
  useEffect(() => {
    prevAmountInputRef.current = amountInput;
  }, [amountInput]);


  useEffect(() => {
    const employee = employees.find(emp => emp.id === selectedEmployeeId);
    if (mainCategoryId === 'fijo' && subCategoryId === 'Nómina' && employee && expenseDate) {
      setPaidTo(employee.name);
      setDescription(`Pago de nómina a ${employee.name}`);
      setEmployeeSalaryDisplay(employee.salary !== undefined ? `$${employee.salary.toFixed(2)} (Semanal)` : 'Salario no definido');

      const selectedExpenseDate = expenseDate || new Date();
      const weekStartForSelectedDate = startOfWeek(selectedExpenseDate, { weekStartsOn: 1 });
      const weekEndForSelectedDate = endOfWeek(selectedExpenseDate, { weekStartsOn: 1 });
      
      const allExpenses: Expense[] = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, getActiveBranchId() || '');
      const employeePaymentsInSelectedWeek = allExpenses.filter(exp =>
        exp.category === 'Nómina' && exp.paidTo === employee.name &&
        exp.date && isValid(parseISO(exp.date)) &&
        isWithinInterval(parseISO(exp.date), { start: weekStartForSelectedDate, end: weekEndForSelectedDate }) &&
        (!isEditing || exp.id !== expenseToEdit?.id)
      );
      const totalPaidInSelectedWeekUSD = employeePaymentsInSelectedWeek.reduce((sum, exp) => sum + exp.amount, 0);

      if (employeePaymentsInSelectedWeek.length > 0) {
        setPayrollHistoryDisplay(
          <ul className="list-disc pl-4 space-y-1">
            {employeePaymentsInSelectedWeek.map(exp => (
              <li key={exp.id}>{format(parseISO(exp.date), "dd/MM/yy", { locale: es })}: ${exp.amount.toFixed(2)} ({exp.description})</li>
            ))}
            <li className="font-semibold border-t pt-1 mt-1">Total Pagado en Semana de {format(weekStartForSelectedDate, "dd/MM", {locale: es})}: ${totalPaidInSelectedWeekUSD.toFixed(2)}</li>
          </ul>);
      } else {
        setPayrollHistoryDisplay(<p className="text-muted-foreground">No se han registrado pagos a este empleado en la semana del {format(weekStartForSelectedDate, "dd/MM/yyyy", { locale: es })}.</p>);
      }

      if (employee.salary !== undefined) {
        const remainingUSD = Math.max(0, employee.salary - totalPaidInSelectedWeekUSD);
        setRemainingToPayForWeekUSD(remainingUSD);
        if (!isEditing || (isEditing && expenseToEdit?.paidTo !== employee.name) || (isEditing && expenseToEdit?.category !== 'Nómina')) {
          if (inputCurrency === 'USD') setAmountInput(remainingUSD > 0 ? remainingUSD.toFixed(2) : '0');
          else if (inputCurrency === 'VES' && exchangeRate > 0) setAmountInput(remainingUSD > 0 ? (remainingUSD * exchangeRate).toFixed(2) : '0');
          else setAmountInput('0');
        }
      } else {
        setRemainingToPayForWeekUSD(null);
        if (!isEditing) setAmountInput('0');
      }
    } else if (mainCategoryId === 'fijo' && subCategoryId === 'Nómina' && !selectedEmployeeId) {
       if (!isEditing || (isEditing && expenseToEdit?.category !== 'Nómina')) { setAmountInput(''); setPaidTo(''); setDescription(''); }
       setEmployeeSalaryDisplay(null); setPayrollHistoryDisplay(null); setRemainingToPayForWeekUSD(null);
    } else {
        if (!isEditing || (isEditing && (expenseToEdit?.category !== subCategoryId || (subCategoryId !== 'Nómina' && expenseToEdit?.paidTo !== paidTo)))) {
           if (expenseToEdit?.category === 'Nómina' && subCategoryId !== 'Nómina') { setAmountInput(''); setPaidTo(''); setDescription(''); }
        }
        setEmployeeSalaryDisplay(null); setPayrollHistoryDisplay(null); setRemainingToPayForWeekUSD(null);
    }
  }, [selectedEmployeeId, employees, mainCategoryId, subCategoryId, isEditing, expenseToEdit, paidTo, expenseDate, inputCurrency, exchangeRate]);


  const handleSubmitInternal = async () => {
    const parsedAmountInput = parseFloat(amountInput || '0');
    let finalUsdAmount = 0;

    if (inputCurrency === 'USD') {
      finalUsdAmount = parsedAmountInput;
    } else { // VES
      if (exchangeRate > 0) {
        finalUsdAmount = parsedAmountInput / exchangeRate;
      } else {
        toast({ title: "Error de Tasa", description: "Se requiere una tasa de cambio para registrar gastos en VES.", variant: "destructive" });
        return;
      }
    }
    
    if (mainCategoryId === 'fijo' && subCategoryId === 'Nómina' && selectedEmployeeId && remainingToPayForWeekUSD !== null && finalUsdAmount > remainingToPayForWeekUSD + 0.001) {
        toast({
            title: "Error de Monto",
            description: `El monto a pagar ($${finalUsdAmount.toFixed(2)}) excede el saldo pendiente ($${remainingToPayForWeekUSD.toFixed(2)}) para este empleado en la semana seleccionada.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
    }
    
    setIsDialogSubmitting(true);
    let submissionTimestamp = new Date().toISOString();
    if (isEditing && expenseToEdit?.date && expenseDate && isValid(parseISO(expenseToEdit.date)) && isValid(expenseDate)) {
      if (isSameDay(parseISO(expenseToEdit.date), expenseDate)) {
        submissionTimestamp = expenseToEdit.timestamp || new Date().toISOString();
      }
    }

    const expenseData: Omit<Expense, 'id' | 'sourceModule' | 'sourceId'> = {
      date: format(expenseDate!, "yyyy-MM-dd"),
      mainCategoryType: mainCategoryId === 'fijo' ? 'Fijo' : 'Variable',
      category: subCategoryId,
      description,
      amount: parseFloat(finalUsdAmount.toFixed(2)),
      paidTo,
      paymentAccountId,
      timestamp: submissionTimestamp, 
    };
    await onSubmit(expenseData, isEditing, isEditing ? expenseToEdit?.id : undefined);
    setIsDialogSubmitting(false);
  };

  const handleCloseDialog = () => { if (!isDialogSubmitting) onOpenChange(false); };

  const currentAmountNumeric = parseFloat(amountInput) || 0;
  let equivalentDisplayValue = 0;
  let equivalentPrefix = '';

  if (inputCurrency === 'USD' && currentAmountNumeric > 0 && exchangeRate > 0) {
    equivalentDisplayValue = currentAmountNumeric * exchangeRate;
    equivalentPrefix = 'Bs. ';
  } else if (inputCurrency === 'VES' && currentAmountNumeric > 0 && exchangeRate > 0) {
    equivalentDisplayValue = currentAmountNumeric / exchangeRate;
    equivalentPrefix = '$';
  }


  return (
    <Dialog open={isOpen} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Gasto" : "Registrar Nuevo Gasto"}</DialogTitle>
          <DialogDescription>{isEditing ? "Actualiza los detalles del gasto." : "Ingresa los detalles del gasto."}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] p-1 pr-3">
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="dialog_date">Fecha</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button id="dialog_date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !expenseDate && "text-muted-foreground")} disabled={isDialogSubmitting}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{expenseDate ? format(expenseDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={expenseDate} onSelect={(date) => { setExpenseDate(date); setIsDatePickerOpen(false); }} initialFocus locale={es} disabled={isDialogSubmitting} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dialog_main_category">Tipo de Gasto Principal</Label>
              <Select value={mainCategoryId} onValueChange={setMainCategoryId} disabled={isDialogSubmitting}>
                <SelectTrigger id="dialog_main_category"><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                <SelectContent>{mainExpenseCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dialog_subcategory">Subcategoría del Gasto</Label>
              <Select value={subCategoryId} onValueChange={setSubCategoryId} disabled={isDialogSubmitting || availableSubcategories.length === 0}>
                <SelectTrigger id="dialog_subcategory"><SelectValue placeholder={availableSubcategories.length > 0 ? "Selecciona subcategoría" : "Elige tipo principal"} /></SelectTrigger>
                <SelectContent>{availableSubcategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  {availableSubcategories.length === 0 && <SelectItem value="--no-subcategories-placeholder--" disabled>No hay subcategorías</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {mainCategoryId === 'fijo' && subCategoryId === 'Nómina' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="dialog_employee">Empleado</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isDialogSubmitting || employees.length === 0}>
                    <SelectTrigger id="dialog_employee"><SelectValue placeholder={employees.length > 0 ? "Selecciona empleado" : "No hay empleados registrados"} /></SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                      {employees.length === 0 && <SelectItem value="--no-employees-placeholder--" disabled>No hay empleados</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {employeeSalaryDisplay && (
                  <div className="space-y-1">
                    <Label>Salario Registrado del Empleado:</Label>
                    <p className="text-sm font-medium text-muted-foreground">{employeeSalaryDisplay}</p>
                  </div>
                )}
                {employeeSalaryDisplay && payrollHistoryDisplay && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <Label className="text-xs font-semibold text-muted-foreground">Historial de Pagos (Semana del {expenseDate ? format(startOfWeek(expenseDate, {weekStartsOn: 1}), "dd/MM") : format(startOfWeek(new Date(), {weekStartsOn: 1}), "dd/MM", {locale: es})}):</Label>
                    <div className="text-xs p-2 bg-muted/50 rounded-md max-h-24 overflow-y-auto">
                      {payrollHistoryDisplay}
                    </div>
                  </div>
                )}
                {employeeSalaryDisplay && remainingToPayForWeekUSD !== null && (
                  <div className="mt-1 space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Restante por Pagar (Semana del {expenseDate ? format(startOfWeek(expenseDate, {weekStartsOn: 1}), "dd/MM") : format(startOfWeek(new Date(), {weekStartsOn: 1}), "dd/MM", {locale: es})}):</Label>
                    <p className="text-sm font-medium"><FormattedNumber value={remainingToPayForWeekUSD} prefix="$" /></p>
                  </div>
                )}
              </>
            )}
            <div className="space-y-1">
              <Label htmlFor="dialog_description">Descripción</Label>
              <Input id="dialog_description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ej., Compra de insumos" disabled={isDialogSubmitting}/>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="dialog_amount_input">Monto ({inputCurrency})</Label>
                <Input id="dialog_amount_input" type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder={inputCurrency === 'USD' ? "ej., 75.50" : "ej., 2750.00"} disabled={isDialogSubmitting}/>
              </div>
              <div className="col-span-1 space-y-1">
                <Label htmlFor="dialog_input_currency">Moneda</Label>
                <Select value={inputCurrency} onValueChange={(val) => setInputCurrency(val as 'USD' | 'VES')} disabled={isDialogSubmitting}>
                  <SelectTrigger id="dialog_input_currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="VES" disabled={exchangeRate <= 0}>VES {exchangeRate <= 0 ? '(Tasa no disp.)' : ''}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {equivalentDisplayValue > 0 && 
              <p className="text-xs text-muted-foreground pt-1">
                Equivalente: <FormattedNumber value={equivalentDisplayValue} prefix={equivalentPrefix} />
              </p>
            }

            <div className="space-y-1">
              <Label htmlFor="dialog_paidTo">Pagado A</Label>
              <Input id="dialog_paidTo" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="ej., Supermercado XYZ" disabled={isDialogSubmitting || (mainCategoryId === 'fijo' && subCategoryId === 'Nómina' && !!selectedEmployeeId)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dialog_paymentAccountId">Cuenta de Pago</Label>
              <Select value={paymentAccountId} onValueChange={(value) => setPaymentAccountId(value as AccountType)} disabled={isDialogSubmitting}>
                <SelectTrigger id="dialog_paymentAccountId"><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(accountTypeNames) as AccountType[])
                    .sort((a, b) => accountTypeNames[a].localeCompare(accountTypeNames[b]))
                    .map(accKey => (
                      <SelectItem 
                        key={accKey} 
                        value={accKey} 
                        disabled={(accKey === 'vesElectronic' || accKey === 'vesCash') && exchangeRate <= 0}
                      >
                        {accountTypeNames[accKey]} {(accKey === 'vesElectronic' || accKey === 'vesCash') && exchangeRate <= 0 ? "(Tasa no disp.)" : ""}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(paymentAccountId === 'vesElectronic' || paymentAccountId === 'vesCash') && exchangeRate <= 0 && <p className="text-xs text-destructive pt-1">Se requiere tasa de cambio para cuentas VES.</p>}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isDialogSubmitting}>Cancelar</Button></DialogClose>
          <Button type="button" onClick={handleSubmitInternal} disabled={isDialogSubmitting}>
            {isDialogSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
            {isDialogSubmitting ? "Guardando..." : (isEditing ? "Guardar Cambios" : "Guardar Gasto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
    
