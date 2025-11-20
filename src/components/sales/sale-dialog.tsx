import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, PlusCircle, Gift, Info, ShieldCheck, Loader2 } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { SaleItemRow } from './sale-item-row';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Sale, SaleItem, Product, Customer, Recipe, PaymentSplit, PaymentMethodType, AccountType, SaleBranchDetail, calculateCustomerBalance, getInvoiceStatus, Payment } from '@/lib/data-storage';

interface SaleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'new' | 'edit';
    initialData?: Sale | null;
    availableProducts: Product[];
    availableCustomers: Customer[];
    allRecipes: Recipe[];
    exchangeRate: number;
    userProfileData: any;
    availableBranches: any[];
    onSave: (saleData: any) => Promise<void>;
    initialPaymentsDataGlobal: Payment[];
    allSales?: Sale[];
}

export function SaleDialog({
    open,
    onOpenChange,
    mode,
    initialData,
    availableProducts,
    availableCustomers,
    allRecipes,
    exchangeRate,
    userProfileData,
    availableBranches,
    onSave,
    initialPaymentsDataGlobal,
    allSales = []
}: SaleDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [date, setDate] = useState<Date>(new Date());
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [customerId, setCustomerId] = useState('');
    const [items, setItems] = useState<SaleItem[]>([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
    const [changes, setChanges] = useState<SaleItem[]>([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
    const [samples, setSamples] = useState<SaleItem[]>([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
    const [paymentMethod, setPaymentMethod] = useState<'Pagado' | 'Crédito'>('Pagado');
    const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
    const [notes, setNotes] = useState('');
    const [creditNoteTargetInvoiceId, setCreditNoteTargetInvoiceId] = useState('');
    const [applyCustomerCredit, setApplyCustomerCredit] = useState(false);
    const [customerBalance, setCustomerBalance] = useState(0);
    const [pendingInvoicesForCustomer, setPendingInvoicesForCustomer] = useState<Sale[]>([]);

    // Load initial data when editing
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && initialData) {
                setDate(parseISO(initialData.date));
                setCustomerId(initialData.customerId || '');

                const allItems = initialData.itemsPerBranch?.flatMap(bd => bd.items) || [];
                setItems(allItems.length > 0 ? allItems : [{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setChanges(initialData.changes && initialData.changes.length > 0 ? initialData.changes : [{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setSamples(initialData.samples && initialData.samples.length > 0 ? initialData.samples : [{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setPaymentMethod(initialData.paymentMethod);
                setPaymentSplits(initialData.paymentSplits || []);
                setNotes(initialData.notes || '');
                setCreditNoteTargetInvoiceId(initialData.creditNoteTargetInvoiceId || '');
                setApplyCustomerCredit(false);

            } else {
                // Reset for new sale
                setDate(new Date());
                setCustomerId('');
                setItems([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setChanges([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setSamples([{ productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
                setPaymentMethod('Pagado');
                setNotes('');
                setCreditNoteTargetInvoiceId('');
                setApplyCustomerCredit(false);

                // Default split
                const initialBranchId = availableBranches.length > 0 ? availableBranches[0].id : '';
                setPaymentSplits([{
                    id: `split-${Date.now()}`,
                    amount: 0,
                    currency: 'VES',
                    paymentMethod: 'Transferencia (VES)',
                    paidToBranchId: initialBranchId,
                    paidToAccountId: 'vesElectronic',
                    referenceNumber: ''
                }]);
            }
        }
    }, [open, mode, initialData, availableBranches]);

    // Update Customer Info
    useEffect(() => {
        if (customerId) {
            // Calculate customer balance using the utility function
            const balance = calculateCustomerBalance(customerId, allSales, initialPaymentsDataGlobal);
            setCustomerBalance(balance);

            // Calculate pending invoices for credit note application
            const invoices = allSales
                .filter(s => s.customerId === customerId && getInvoiceStatus(s, initialPaymentsDataGlobal) !== 'Completada')
                .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
            setPendingInvoicesForCustomer(invoices);
        } else {
            setCustomerBalance(0);
            setPendingInvoicesForCustomer([]);
        }
    }, [customerId, allSales, initialPaymentsDataGlobal]);

    // Calculate totals
    const itemsTotal = items.filter(i => i.productId).reduce((sum, item) => sum + item.subtotal, 0);
    const changesTotal = changes.filter(i => i.productId).reduce((sum, item) => sum + item.subtotal, 0);
    const netTotal = itemsTotal - changesTotal;
    const creditToApply = applyCustomerCredit && customerBalance < 0 ? Math.min(Math.abs(customerBalance), netTotal) : 0;
    const totalToPayAfterCredit = Math.max(0, netTotal - creditToApply);

    const handleItemOrChangeValue = useCallback((index: number, field: keyof Omit<SaleItem, 'subtotal'>, value: string | number, formType: 'new' | 'edit', itemType: 'items' | 'changes' | 'samples') => {
        const listSetter = itemType === 'items' ? setItems : itemType === 'changes' ? setChanges : setSamples;

        listSetter(prev => {
            const updated = [...prev];
            const item = { ...updated[index] };

            if (field === 'productId') {
                const product = availableProducts.find(p => p.id === value);
                if (product) {
                    item.productId = product.id;
                    item.productName = product.name;
                    item.sourceBranchId = product.sourceBranchId || '';
                    item.sourceBranchName = product.sourceBranchName || '';

                    // Find the recipe for this product to get the correct sale price
                    const recipe = allRecipes.find(r =>
                        r.id === product.id ||
                        r.name.toLowerCase() === product.name.toLowerCase()
                    );

                    // Use recipe's costPerUnit if found, otherwise fall back to product's unitPrice
                    item.unitPrice = recipe?.costPerUnit || product.unitPrice;
                    item.subtotal = item.quantity * item.unitPrice;
                }
            } else if (field === 'quantity') {
                item.quantity = typeof value === 'string' ? parseFloat(value) || 0 : value;
                item.subtotal = item.quantity * item.unitPrice;
            } else if (field === 'unitPrice') {
                item.unitPrice = typeof value === 'string' ? parseFloat(value) || 0 : value;
                item.subtotal = item.quantity * item.unitPrice;
            } else {
                (item as any)[field] = value;
            }

            updated[index] = item;
            return updated;
        });
    }, [availableProducts, allRecipes]);

    const handleRemoveItemOrChange = useCallback((index: number, formType: 'new' | 'edit', itemType: 'items' | 'changes' | 'samples') => {
        const listSetter = itemType === 'items' ? setItems : itemType === 'changes' ? setChanges : setSamples;
        listSetter(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleAddItem = (type: 'items' | 'changes' | 'samples') => {
        const listSetter = type === 'items' ? setItems : type === 'changes' ? setChanges : setSamples;
        listSetter(prev => [...prev, { productId: '', productName: '', quantity: 1, unitPrice: 0, subtotal: 0, sourceBranchId: '', sourceBranchName: '' }]);
    };

    const handleSplitChange = (id: string, field: keyof PaymentSplit, value: any) => {
        setPaymentSplits(prev => prev.map(split => {
            if (split.id !== id) return split;
            return { ...split, [field]: value };
        }));
    };

    const handleAddSplit = () => {
        setPaymentSplits(prev => [...prev, {
            id: `split-${Date.now()}`,
            amount: 0,
            currency: 'VES',
            paymentMethod: 'Transferencia (VES)',
            paidToBranchId: availableBranches[0]?.id || '',
            paidToAccountId: 'vesElectronic',
            referenceNumber: ''
        }]);
    };

    const handleRemoveSplit = (id: string) => {
        setPaymentSplits(prev => prev.filter(s => s.id !== id));
    };

    const handleSaveInternal = async () => {
        setIsSubmitting(true);
        try {
            const saleData = {
                date,
                customerId,
                items: items.filter(i => i.productId),
                changes: changes.filter(i => i.productId),
                samples: samples.filter(i => i.productId),
                paymentMethod,
                paymentSplits,
                notes,
                creditNoteTargetInvoiceId: creditNoteTargetInvoiceId === 'none' ? '' : creditNoteTargetInvoiceId,
                applyCustomerCredit,
            };
            await onSave(saleData);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter out non-dispatchable products by both category AND name
    const vendibleProducts = availableProducts.filter(p =>
        p.category?.toLowerCase() !== 'no despachable' &&
        !p.name.toLowerCase().startsWith('no despachable')
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>{mode === 'new' ? 'Nueva Venta' : 'Editar Venta'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'new' ? 'Registra una nueva venta o devolución.' : 'Modifica los detalles de la venta.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="grid gap-4 py-4">
                        {/* Date and Customer */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Fecha</Label>
                                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start", !date && "text-muted-foreground")} disabled={isSubmitting}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {date ? format(date, "PPP", { locale: es }) : <span>Elige</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d || new Date()); setIsDatePickerOpen(false); }} initialFocus locale={es} disabled={isSubmitting} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label>Cliente</Label>
                                <Select value={customerId} onValueChange={setCustomerId} disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                                    <SelectContent>
                                        {availableCustomers.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Customer Credit Alert */}
                        {customerBalance < -0.01 && (
                            <Alert variant="default" className="bg-green-50 border-green-200">
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800">Saldo a Favor Disponible</AlertTitle>
                                <AlertDescription className="text-green-700">
                                    <p>Este cliente tiene un saldo a favor de <FormattedNumber value={Math.abs(customerBalance)} prefix="$" />.</p>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <Checkbox id="apply_credit" checked={applyCustomerCredit} onCheckedChange={(c) => setApplyCustomerCredit(!!c)} disabled={netTotal <= 0} />
                                        <label htmlFor="apply_credit" className="text-sm font-medium">¿Aplicar a esta factura?</label>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Items Section */}
                        <div className="space-y-2 border p-3 rounded-md max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                            <Label className="font-medium">Ítems de la Venta</Label>
                            {items.map((item, index) => (
                                <SaleItemRow
                                    key={`item-${index}`}
                                    item={item}
                                    index={index}
                                    formType={mode}
                                    itemType="items"
                                    availableProducts={vendibleProducts}
                                    onValueChange={handleItemOrChangeValue}
                                    onRemove={handleRemoveItemOrChange}
                                    isSubmitting={isSubmitting}
                                />
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem('items')} disabled={isSubmitting} className="mt-2">
                                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ítem
                            </Button>
                        </div>

                        {/* Changes Section */}
                        <div className="space-y-2 border p-3 rounded-md max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                            <Label className="font-medium">Cambios/Devoluciones</Label>
                            {changes.map((item, index) => (
                                <SaleItemRow
                                    key={`change-${index}`}
                                    item={item}
                                    index={index}
                                    formType={mode}
                                    itemType="changes"
                                    availableProducts={availableProducts}
                                    onValueChange={handleItemOrChangeValue}
                                    onRemove={handleRemoveItemOrChange}
                                    isSubmitting={isSubmitting}
                                />
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem('changes')} disabled={isSubmitting} className="mt-2">
                                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cambio
                            </Button>
                        </div>

                        {/* Samples Section */}
                        <div className="space-y-2 border p-3 rounded-md max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                            <Label className="font-medium">Muestras/Regalos</Label>
                            {samples.map((item, index) => (
                                <SaleItemRow
                                    key={`sample-${index}`}
                                    item={item}
                                    index={index}
                                    formType={mode}
                                    itemType="samples"
                                    availableProducts={availableProducts}
                                    onValueChange={handleItemOrChangeValue}
                                    onRemove={handleRemoveItemOrChange}
                                    isSubmitting={isSubmitting}
                                />
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem('samples')} disabled={isSubmitting} className="mt-2">
                                <Gift className="mr-2 h-4 w-4" /> Añadir Muestra
                            </Button>
                        </div>

                        {/* Totals and Payment */}
                        <div className="flex flex-col gap-2 border-t pt-4">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal Ítems:</span>
                                <FormattedNumber value={itemsTotal} prefix="$" />
                            </div>
                            {changesTotal > 0 && (
                                <div className="flex justify-between text-sm text-destructive">
                                    <span>(-) Cambios/Devoluciones:</span>
                                    <FormattedNumber value={changesTotal} prefix="-$" />
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold border-t pt-1 mt-1">
                                <span>Total Neto:</span>
                                <FormattedNumber value={netTotal} prefix="$" />
                            </div>
                            {creditToApply > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Crédito Aplicado:</span>
                                    <span>-<FormattedNumber value={creditToApply} prefix="$" /></span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-black border-t pt-2">
                                <span>A Pagar:</span>
                                <FormattedNumber value={totalToPayAfterCredit} prefix="$" />
                            </div>
                        </div>

                        {/* Credit Note Section - Show when total is negative */}
                        {netTotal < 0 && (
                            <Alert variant="default" className="bg-blue-50 border-blue-200">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-blue-800">Nota de Crédito (Devolución)</AlertTitle>
                                <AlertDescription className="text-blue-700">
                                    <p>El total es negativo (<FormattedNumber value={netTotal} prefix="$" />). Se generará una Nota de Crédito.</p>
                                    <div className="mt-3 space-y-1">
                                        <Label htmlFor="target_invoice">Aplicar a Factura Pendiente (Opcional)</Label>
                                        <Select value={creditNoteTargetInvoiceId} onValueChange={setCreditNoteTargetInvoiceId} disabled={isSubmitting}>
                                            <SelectTrigger id="target_invoice">
                                                <SelectValue placeholder="Selecciona factura o deja como saldo a favor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No aplicar (Dejar como saldo a favor)</SelectItem>
                                                {pendingInvoicesForCustomer.map(inv => {
                                                    const balance = inv.totalAmount - (inv.amountPaidUSD || 0);
                                                    return (
                                                        <SelectItem key={inv.id} value={inv.id}>
                                                            {inv.id} - {format(parseISO(inv.date), 'dd/MM/yy')} - Pendiente: <FormattedNumber value={balance} prefix="$" />
                                                        </SelectItem>
                                                    );
                                                })}
                                                {pendingInvoicesForCustomer.length === 0 && (
                                                    <SelectItem value="no-invoices" disabled>
                                                        No hay facturas pendientes para este cliente
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Payment Methods */}
                        {netTotal >= 0 && (
                            <div className="space-y-4 border-t pt-4">
                                <div className="space-y-1">
                                    <Label>Método de Pago Global</Label>
                                    <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} disabled={isSubmitting}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pagado">Pagado (Contado/Múltiple)</SelectItem>
                                            <SelectItem value="Crédito">Crédito (Por Cobrar)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {paymentMethod === 'Pagado' && (
                                    <div className="space-y-3 border p-3 rounded-md bg-slate-50 dark:bg-slate-900">
                                        <Label className="font-medium">Desglose de Pagos</Label>
                                        {paymentSplits.map((split, index) => (
                                            <div key={split.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end border-b pb-2 mb-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Monto</Label>
                                                    <Input type="number" value={split.amount} onChange={e => handleSplitChange(split.id, 'amount', parseFloat(e.target.value) || 0)} className="h-8" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Moneda</Label>
                                                    <Select value={split.currency} onValueChange={v => handleSplitChange(split.id, 'currency', v)}>
                                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                        <SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="VES">VES</SelectItem></SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1 lg:col-span-2">
                                                    <Label className="text-xs">Método</Label>
                                                    <Select value={split.paymentMethod} onValueChange={v => handleSplitChange(split.id, 'paymentMethod', v)}>
                                                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {split.currency === 'USD' ? <SelectItem value="Efectivo USD">Efectivo USD</SelectItem> :
                                                                <><SelectItem value="Pago Móvil (VES)">Pago Móvil</SelectItem><SelectItem value="Transferencia (VES)">Transferencia</SelectItem><SelectItem value="Efectivo VES">Efectivo VES</SelectItem></>}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {(split.paymentMethod === 'Pago Móvil (VES)' || split.paymentMethod === 'Transferencia (VES)') && (
                                                    <div className="space-y-1 lg:col-span-2">
                                                        <Label className="text-xs">Referencia (6 dígitos)</Label>
                                                        <Input
                                                            value={split.referenceNumber || ''}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                                handleSplitChange(split.id, 'referenceNumber', val);
                                                            }}
                                                            placeholder="123456"
                                                            maxLength={6}
                                                            className={cn("h-8", (split.referenceNumber?.length !== 6) && "border-red-500")}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex items-end">
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveSplit(split.id)} className="h-8 w-8 text-destructive"><PlusCircle className="h-4 w-4 rotate-45" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" onClick={handleAddSplit}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Pago</Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-1">
                            <Label>Notas</Label>
                            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales..." />
                        </div>

                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={() => {
                        // Validation for Reference Numbers
                        if (paymentMethod === 'Pagado') {
                            for (const split of paymentSplits) {
                                if ((split.paymentMethod === 'Pago Móvil (VES)' || split.paymentMethod === 'Transferencia (VES)')) {
                                    if (!split.referenceNumber || split.referenceNumber.length !== 6) {
                                        toast({ title: "Error de Validación", description: "La referencia para Pago Móvil/Transferencia debe tener 6 dígitos.", variant: "destructive" });
                                        return;
                                    }
                                }
                            }
                        }
                        handleSaveInternal();
                    }} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'new' ? 'Registrar Venta' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
