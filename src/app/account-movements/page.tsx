

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Landmark, ArrowDownCircle, ArrowUpCircle, Loader2, PiggyBank, Banknote, DollarSign, Filter, Calendar as CalendarIcon, FileText as PdfIcon } from 'lucide-react';
import {
  loadFromLocalStorage,
  ACCOUNT_TRANSACTIONS_STORAGE_KEY_BASE,
  COMPANY_ACCOUNTS_STORAGE_KEY_BASE,
  loadExchangeRate,
  type AccountTransaction,
  type CompanyAccountsData,
  type AccountType,
  accountTypeNames,
  accountTypes,
  KEYS
} from '@/lib/data-storage';
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FormattedNumber } from '@/components/ui/formatted-number';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

const ALL_ACCOUNTS_FILTER_VALUE = "all";

export default function AccountMovementsPage() {
  const { toast } = useToast();
  const [allTransactions, setAllTransactions] = useState<AccountTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<AccountTransaction[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccountsData | null>(null);
  const [globalExchangeRate, setGlobalExchangeRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pathname = usePathname();

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [selectedAccountIdFilter, setSelectedAccountIdFilter] = useState<AccountType | typeof ALL_ACCOUNTS_FILTER_VALUE>(ALL_ACCOUNTS_FILTER_VALUE);

  const loadAccountData = useCallback(() => {
    setIsLoading(true);
    const currentTransactions = loadFromLocalStorage<AccountTransaction[]>(ACCOUNT_TRANSACTIONS_STORAGE_KEY_BASE);
    
    const sortedTransactions = [...currentTransactions].sort((a, b) => {
      const dateA = a.date && isValid(parseISO(a.date)) ? parseISO(a.date) : new Date(0);
      const dateB = b.date && isValid(parseISO(b.date)) ? parseISO(b.date) : new Date(0);
      
      const dateComparison = dateB.getTime() - dateA.getTime();
      if (dateComparison !== 0) return dateComparison;

      // Ordenamiento secundario por timestamp si las fechas son idénticas
      const timestampA = a.timestamp && isValid(parseISO(a.timestamp)) ? parseISO(a.timestamp).getTime() : 0;
      const timestampB = b.timestamp && isValid(parseISO(b.timestamp)) ? parseISO(b.timestamp).getTime() : 0;
      
      return timestampB - timestampA; // Más reciente primero
    });

    setAllTransactions(sortedTransactions);

    const currentCompanyAccounts = loadFromLocalStorage<CompanyAccountsData>(COMPANY_ACCOUNTS_STORAGE_KEY_BASE, true);
    setCompanyAccounts(currentCompanyAccounts);

    setGlobalExchangeRate(loadExchangeRate());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (pathname === '/account-movements') {
      loadAccountData();
    }
    const handleDataUpdate = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.key === KEYS.ACCOUNT_TRANSACTIONS || customEvent.detail?.key === KEYS.COMPANY_ACCOUNTS) {
            if (pathname === '/account-movements') { // Solo recargar si estamos en la página
                loadAccountData();
            }
        }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
        window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [pathname, loadAccountData]);


  const applyFilters = useCallback(() => {
    let transactionsToFilter = [...allTransactions];

    if (dateRangeFilter?.from) {
      const toDate = dateRangeFilter.to ? endOfDay(dateRangeFilter.to) : endOfDay(dateRangeFilter.from);
      transactionsToFilter = transactionsToFilter.filter(transaction => {
        if (!transaction.date || !isValid(parseISO(transaction.date))) return false;
        return isWithinInterval(parseISO(transaction.date), { start: startOfDay(dateRangeFilter.from!), end: toDate });
      });
    }

    if (selectedAccountIdFilter !== ALL_ACCOUNTS_FILTER_VALUE) {
      transactionsToFilter = transactionsToFilter.filter(transaction => transaction.accountId === selectedAccountIdFilter);
    }

    setFilteredTransactions(transactionsToFilter);
  }, [allTransactions, dateRangeFilter, selectedAccountIdFilter]);

  useEffect(() => {
    applyFilters();
  }, [allTransactions, dateRangeFilter, selectedAccountIdFilter, applyFilters]);

  const handleApplyFiltersButton = () => {
    applyFilters(); 
  };

  const handleClearFiltersButton = () => {
    setDateRangeFilter(undefined);
    setSelectedAccountIdFilter(ALL_ACCOUNTS_FILTER_VALUE);
  };

  const getAccountIcon = (accountId?: AccountType): React.ElementType => {
    if (!accountId) return Landmark;
    switch(accountId) {
      case 'vesElectronic': return PiggyBank;
      case 'usdCash': return DollarSign;
      case 'vesCash': return Banknote;
      default: return Landmark;
    }
  }

  const handleGeneratePdf = () => {
    if (filteredTransactions.length === 0) {
      toast({ title: "Sin Datos", description: "No hay transacciones para generar el PDF con los filtros actuales.", variant: "default" });
      return;
    }
    setIsGeneratingPdf(true);
    const doc = new jsPDF() as jsPDFWithAutoTable;

    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(11);

    let reportSubtitle = "Reporte de Movimientos de Cuenta";
    if (selectedAccountIdFilter !== ALL_ACCOUNTS_FILTER_VALUE && companyAccounts && companyAccounts[selectedAccountIdFilter]) {
      reportSubtitle = `Reporte de Movimientos - ${accountTypeNames[selectedAccountIdFilter]}`;
    }
    
    doc.text(reportSubtitle, 14, 32);
    doc.setFontSize(10);
    
    let currentY = 40;
    
    let dateRangeString = "General";
    if (dateRangeFilter?.from) {
        const fromStr = format(dateRangeFilter.from, "dd/MM/yyyy", { locale: es });
        if (dateRangeFilter.to) {
            const toStr = format(dateRangeFilter.to, "dd/MM/yyyy", { locale: es });
            dateRangeString = `${fromStr} - ${toStr}`;
        } else {
            dateRangeString = `Desde ${fromStr}`;
        }
    }
    doc.text(`Período: ${dateRangeString}`, 14, currentY);
    currentY += 6;

    if (selectedAccountIdFilter === ALL_ACCOUNTS_FILTER_VALUE) {
        doc.text(`Cuentas: Todas las Cuentas (Filtradas)`, 14, currentY);
        currentY += 6;
    }


    const head = [["Fecha", "Descripción", "Cuenta", "Tipo", "Categoría", "Monto", "Tasa", "Equivalente", "Saldo Post-Tx"]];
    const body = filteredTransactions.map(tx => {
      const accountName = tx.accountId ? accountTypeNames[tx.accountId] : "General (Antigua)";
      const amountPrefix = tx.type === 'ingreso' ? '+' : '-';
      const currencySymbol = tx.currency === 'USD' ? '$' : 'Bs.';
      const otherCurrencySymbol = tx.currency === 'USD' ? 'Bs.' : '$';
      const amountDisplay = `${amountPrefix}${currencySymbol} ${tx.amount.toFixed(2)}`;
      const otherAmountDisplay = tx.amountInOtherCurrency !== undefined ? `${amountPrefix}${otherCurrencySymbol} ${tx.amountInOtherCurrency.toFixed(2)}` : '-';
      const balanceAfterDisplay = tx.balanceAfterTransaction !== undefined ? `${currencySymbol} ${tx.balanceAfterTransaction.toFixed(2)}` : '-';

      return [
        tx.date && isValid(parseISO(tx.date)) ? format(parseISO(tx.date), "dd/MM/yy", { locale: es }) : '-',
        tx.description,
        accountName,
        tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        tx.category || '-',
        amountDisplay,
        tx.exchangeRateOnTransactionDate ? tx.exchangeRateOnTransactionDate.toFixed(2) : '-',
        otherAmountDisplay,
        balanceAfterDisplay
      ];
    });

    doc.autoTable({
      startY: currentY + 2,
      head: head,
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [34, 139, 34] }, 
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.text(`Página ${doc.internal.pages.L > 0 ? doc.internal.pages.P : doc.internal.pages.L}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });
    
    let pdfFilename = `reporte_movimientos_${selectedAccountIdFilter === ALL_ACCOUNTS_FILTER_VALUE ? 'todas' : selectedAccountIdFilter}`;
    if (dateRangeFilter?.from) {
        pdfFilename += `_${format(dateRangeFilter.from, "yyyyMMdd")}`;
        if (dateRangeFilter.to) pdfFilename += `_a_${format(dateRangeFilter.to, "yyyyMMdd")}`;
    }
    pdfFilename += '.pdf';

    doc.save(pdfFilename);
    toast({ title: "Reporte Generado", description: `PDF ${pdfFilename} descargado.` });
    setIsGeneratingPdf(false);
  };

  if (isLoading || !companyAccounts) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando movimientos de cuenta...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimientos de Cuentas"
        description="Saldos y historial de transacciones para cada cuenta de la empresa."
        icon={Landmark}
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Saldos Actuales de las Cuentas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(companyAccounts) as AccountType[]).map(accountId => {
            const account = companyAccounts[accountId];
            if (!account) return null;
            const Icon = getAccountIcon(accountId);
            let balanceDisplay: React.ReactNode = "";
            let equivalentDisplay: React.ReactNode = "";

            if (account.currency === 'VES') {
              balanceDisplay = <FormattedNumber value={account.balance} prefix="Bs. " />;
              if (globalExchangeRate > 0) {
                equivalentDisplay = <FormattedNumber value={account.balance / globalExchangeRate} prefix="Equiv. $" />;
              }
            } else { 
              balanceDisplay = <FormattedNumber value={account.balance} prefix="$" />;
              if (globalExchangeRate > 0) {
                equivalentDisplay = <FormattedNumber value={account.balance * globalExchangeRate} prefix="Equiv. Bs. " />;
              }
            }

            return (
              <div key={accountId} className="p-4 border rounded-lg bg-muted/50 flex flex-col items-center text-center">
                <Icon className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-medium text-muted-foreground">{accountTypeNames[accountId]}</p>
                <p className="text-2xl font-bold text-primary">{balanceDisplay}</p>
                {equivalentDisplay && <p className="text-xs text-muted-foreground">{equivalentDisplay}</p>}
                 {account.lastTransactionDate && isValid(parseISO(account.lastTransactionDate)) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Últ. Mov: {format(parseISO(account.lastTransactionDate), "dd/MM/yy HH:mm", { locale: es })}
                    </p>
                  )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Historial General de Transacciones</CardTitle>
              <CardDescription>
                {filteredTransactions.length > 0
                  ? "Lista de todos los ingresos y egresos registrados, la más reciente primero."
                  : "No hay transacciones para los filtros seleccionados."}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-filter-account-movements"
                    variant={"outline"}
                    className={cn("w-full sm:w-auto min-w-[200px] justify-start text-left font-normal", !dateRangeFilter && "text-muted-foreground")}
                    disabled={isLoading || isGeneratingPdf}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeFilter?.from ? (
                      dateRangeFilter.to ? (
                        <>
                          {format(dateRangeFilter.from, "LLL dd, y", { locale: es })} -{" "}
                          {format(dateRangeFilter.to, "LLL dd, y", { locale: es })}
                        </>
                      ) : (
                        format(dateRangeFilter.from, "LLL dd, y", { locale: es })
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
                    defaultMonth={dateRangeFilter?.from}
                    selected={dateRangeFilter}
                    onSelect={setDateRangeFilter}
                    numberOfMonths={2}
                    locale={es}
                    disabled={isLoading || isGeneratingPdf}
                  />
                </PopoverContent>
              </Popover>
              <Select 
                value={selectedAccountIdFilter} 
                onValueChange={(value) => setSelectedAccountIdFilter(value as AccountType | typeof ALL_ACCOUNTS_FILTER_VALUE)}
                disabled={isLoading || isGeneratingPdf}
              >
                <SelectTrigger className="w-full sm:w-auto min-w-[180px]">
                  <SelectValue placeholder="Filtrar por Cuenta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACCOUNTS_FILTER_VALUE}>Todas las Cuentas</SelectItem>
                  {accountTypes
                    .slice()
                    .sort((a, b) => accountTypeNames[a].localeCompare(accountTypeNames[b]))
                    .map(accType => (
                      <SelectItem key={accType} value={accType}>{accountTypeNames[accType]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleApplyFiltersButton} className="w-full sm:w-auto" disabled={isLoading || isGeneratingPdf}>
                <Filter className="mr-2 h-4 w-4" /> Aplicar Filtros
              </Button>
              <Button onClick={handleClearFiltersButton} variant="outline" className="w-full sm:w-auto" disabled={isLoading || isGeneratingPdf}>Limpiar</Button>
              <Button onClick={handleGeneratePdf} variant="secondary" className="w-full sm:w-auto" disabled={isLoading || isGeneratingPdf || filteredTransactions.length === 0}>
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PdfIcon className="mr-2 h-4 w-4" />}
                {isGeneratingPdf ? "Generando..." : "Descargar PDF"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Tasa Aplicada</TableHead>
                  <TableHead className="text-right">Equivalente</TableHead>
                  <TableHead className="text-right">Saldo Post (Cuenta)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const accountName = transaction.accountId ? accountTypeNames[transaction.accountId] : "General (Antigua)";
                  const amountPrefix = transaction.type === 'ingreso' ? '+' : '-';
                  const amountColor = transaction.type === 'ingreso' ? 'text-green-600' : 'text-red-600';
                  
                  const transactionAmount = typeof transaction.amount === 'number' ? transaction.amount : 0;
                  const currencySymbol = transaction.currency === 'USD' ? '$' : 'Bs.';
                  
                  let otherCurrencySymbol = '';
                  let otherAmountDisplay: React.ReactNode = '-';
                  if (transaction.amountInOtherCurrency !== undefined && typeof transaction.amountInOtherCurrency === 'number') {
                    otherCurrencySymbol = transaction.currency === 'USD' ? 'Bs.' : '$';
                    otherAmountDisplay = (
                      <FormattedNumber
                        value={transaction.amountInOtherCurrency}
                        prefix={`${amountPrefix}${otherCurrencySymbol} `}
                      />
                    );
                  }

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {transaction.date && isValid(parseISO(transaction.date)) ? format(parseISO(transaction.date), "dd/MM/yy", { locale: es }) : '-'}
                        {transaction.timestamp && isValid(parseISO(transaction.timestamp)) && (
                            <span className="block text-xs text-muted-foreground">
                                {format(parseISO(transaction.timestamp), "HH:mm", { locale: es })}
                            </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate" title={transaction.description}>{transaction.description}</TableCell>
                      <TableCell>{accountName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={transaction.type === 'ingreso' ? 'default' : 'destructive'}
                          className={cn(
                            transaction.type === 'ingreso'
                              ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50'
                              : 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/50'
                          )}
                        >
                          {transaction.type === 'ingreso' ?
                            <ArrowUpCircle className="mr-1 h-3.5 w-3.5" /> :
                            <ArrowDownCircle className="mr-1 h-3.5 w-3.5" />
                          }
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{transaction.category || '-'}</TableCell>
                      <TableCell className={cn("text-right font-semibold", amountColor)}>
                        <FormattedNumber value={transactionAmount} prefix={`${amountPrefix}${currencySymbol} `} />
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.exchangeRateOnTransactionDate ? <FormattedNumber value={transaction.exchangeRateOnTransactionDate}/> : '-'}
                      </TableCell>
                      <TableCell className={cn("text-right font-semibold", amountColor)}>
                        {otherAmountDisplay}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.balanceAfterTransaction !== undefined && typeof transaction.balanceAfterTransaction === 'number' 
                          ? <FormattedNumber value={transaction.balanceAfterTransaction} prefix={`${currencySymbol} `} />
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            !isLoading && <p className="text-center text-muted-foreground py-8">No hay transacciones que coincidan con los filtros aplicados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    

    

    


