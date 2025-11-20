

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, CalendarDays, Package, Calendar as CalendarIcon, DollarSign, Archive, Layers, BarChart2 as BarChartIconLucide, PieChart as PieChartIconLucide, Loader2, Shuffle, TrendingDown, Combine, Building, Eye, TrendingUp as TrendingUpIcon } from 'lucide-react'; 
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as UiDialogFooter, DialogClose } from '@/components/ui/dialog'; 
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid, differenceInCalendarWeeks, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  salesData as initialSalesDataGlobal,
  type Sale,
  type Expense,
  type Product,
  loadExchangeRate,
  type PurchaseOrder,
  type RawMaterialInventoryItem,
  type Recipe,
  calculateDynamicRecipeCost,
  type Employee,
  loadExpenseFixedCategories,
  type ExpenseFixedCategory,
  WEEKS_IN_MONTH,
  getActiveBranchId,
  availableBranches,
  loadFromLocalStorageForBranch,
  loadExpenseVariableCategories,
  KEYS,
  calculatePackagingCost,
  weeklyLossReportsData as initialWeeklyLossReportsData,
  type WeeklyLossReport,
  weeklyProfitReportsData as initialWeeklyProfitReportsData,
  type WeeklyProfitReport
} from '@/lib/data-storage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ScrollArea } from '@/components/ui/scroll-area';
import { FormattedNumber } from '@/components/ui/formatted-number';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

interface ProductSalesQuantityData { name: string; quantity: number; }
interface ProductChangeData { name: string; quantity: number; }
interface ExpenseChartData { category: string; total: number; fill: string; }
interface StockChartData { name: string; stock: number; }
interface PurchaseOrderChartData { supplierName: string; totalCost: number; }

interface ProductWastageData {
  name: string;
  totalExpected: number;
  totalActual: number;
  totalWastageQuantity: number;
  totalWastageCostUSD: number;
  baseUnitPriceForWastage?: number;
}

interface ProductLossItem {
  name: string;
  quantityChanged: number;
  costChangedUSD: number;
  quantityWasted: number;
  costWastedUSD: number;
  quantitySampled: number;
  costSampledUSD: number;
  totalQuantityLost: number;
  totalCostLostUSD: number;
}


const PIE_CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))"
];
const TOP_N_PRODUCTS_REPORTS = 10;
const TOP_N_CHANGES_REPORTS = 10;
const TOP_N_WASTAGE_PRODUCTS_REPORTS = 10;
const TOP_N_LOSSES_REPORTS = 10;


export default function ReportsPage() {
  const { toast } = useToast();
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(undefined);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranchName, setActiveBranchName] = useState<string>('');
  const [activeBranchIdState, setActiveBranchIdState] = useState<string | null>(null);

  const [weeklyLossReports, setWeeklyLossReports] = useState<WeeklyLossReport[]>([]);
  const [isLossReportDialogOpen, setIsLossReportDialogOpen] = useState(false);
  const [selectedLossReport, setSelectedLossReport] = useState<WeeklyLossReport | null>(null);

  const [weeklyProfitReports, setWeeklyProfitReports] = useState<WeeklyProfitReport[]>([]);
  const [isProfitReportDialogOpen, setIsProfitReportDialogOpen] = useState(false);
  const [selectedProfitReport, setSelectedProfitReport] = useState<WeeklyProfitReport | null>(null);


  useEffect(() => {
    setExchangeRate(loadExchangeRate());
    const currentBranchId = getActiveBranchId();
    setActiveBranchIdState(currentBranchId);
    const branch = availableBranches.find(b => b.id === currentBranchId);
    setActiveBranchName(branch ? branch.name : 'Desconocida');
    setWeeklyLossReports(initialWeeklyLossReportsData);
    setWeeklyProfitReports(initialWeeklyProfitReportsData);
    setIsLoading(false);

    const handleDataUpdate = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.key === KEYS.WEEKLY_LOSS_REPORTS) {
            setWeeklyLossReports([...initialWeeklyLossReportsData]);
        }
        if (customEvent.detail?.key === KEYS.WEEKLY_PROFIT_REPORTS) {
            setWeeklyProfitReports([...initialWeeklyProfitReportsData]);
        }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
        window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, []);

  const formatVesPrice = (usdPrice: number): string => {
    if (exchangeRate > 0 && usdPrice) {
      return `Bs. ${(usdPrice * exchangeRate).toFixed(2)}`;
    }
    return "Bs. --";
  };

  const getReportFilename = (baseName: string): string => {
    const today = format(new Date(), "yyyy-MM-dd");
    let branchSuffix = '';
    const currentBranchId = getActiveBranchId();
    if (baseName.includes("gastos") || baseName.includes("stock") || baseName.includes("materia_prima") || baseName.includes("ordenes_compra") || baseName.includes("merma") || baseName.includes("perdidas")) {
        if (currentBranchId) branchSuffix = `_${currentBranchId}`;
    }

    if (selectedDateRange?.from) {
      const from = format(selectedDateRange.from, "yyyy-MM-dd");
      if (selectedDateRange.to) {
        const to = format(selectedDateRange.to, "yyyy-MM-dd");
        return `${baseName}${branchSuffix}_${from}_a_${to}.pdf`;
      }
      return `${baseName}${branchSuffix}_${from}.pdf`;
    }
    return `${baseName}${branchSuffix}_general_${today}.pdf`;
  };

  const productSalesQuantityChartData = useMemo(() => {
    let filteredSales = initialSalesDataGlobal;
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredSales = initialSalesDataGlobal.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
      });
    }

    const productSales: { [productName: string]: number } = {};
    filteredSales.forEach(sale => {
      sale.itemsPerBranch.forEach(branchDetail => {
        branchDetail.items.forEach(item => {
          if (item.productName) {
            productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
          }
        });
      });
    });

    return Object.entries(productSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, TOP_N_PRODUCTS_REPORTS);
  }, [selectedDateRange]);

  const productSalesQuantityChartConfig = {
    quantity: { label: "Cantidad Vendida", color: "hsl(var(--chart-1))" },
  } satisfies ChartConfig;

  const productChangesChartData = useMemo(() => {
    let filteredSales = initialSalesDataGlobal;
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredSales = initialSalesDataGlobal.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
      });
    }

    const productChanges: { [productName: string]: number } = {};
    filteredSales.forEach(sale => {
      if (sale.changes) {
        sale.changes.forEach(item => {
          if (item.productName) {
            productChanges[item.productName] = (productChanges[item.productName] || 0) + item.quantity;
          }
        });
      }
    });

    return Object.entries(productChanges)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, TOP_N_CHANGES_REPORTS);
  }, [selectedDateRange]);

  const productChangesChartConfig = {
    quantity: { label: "Cantidad Cambiada/Devuelta", color: "hsl(var(--chart-5))" },
  } satisfies ChartConfig;

  const expensesChartData = useMemo(() => {
    if (!activeBranchIdState) return [];
    let branchExpenses = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchIdState);
    let filteredExpenses = branchExpenses;

    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredExpenses = branchExpenses.filter(expense => {
        const expenseDate = parseISO(expense.date);
        return isValid(expenseDate) && isWithinInterval(expenseDate, { start: from, end: to });
      });
    }
    const expensesByCategory: { [category: string]: number } = {};
    const fixedCats = loadExpenseFixedCategories(activeBranchIdState);
    const varCats = loadExpenseVariableCategories(activeBranchIdState);
    const allBranchCategories = [...fixedCats.map(fc => fc.name), ...varCats];

    allBranchCategories.forEach(cat => expensesByCategory[cat] = 0);

    filteredExpenses.forEach(expense => {
      if (expensesByCategory.hasOwnProperty(expense.category)) {
        expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
      } else if (expense.category === 'Compra de Materia Prima') {
        expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
      }
    });

    return Object.entries(expensesByCategory)
      .filter(([_, total]) => total > 0)
      .map(([category, total], index) => ({
        category,
        total: parseFloat(total.toFixed(2)),
        fill: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      }));
  }, [selectedDateRange, activeBranchIdState]);

  const expensesChartConfig = useMemo(() =>
    expensesChartData.reduce((acc, item) => {
      acc[item.category] = { label: item.category, color: item.fill };
      return acc;
    }, {} as ChartConfig)
  , [expensesChartData]);

  const productStockChartData = useMemo(() => {
    if (!activeBranchIdState) return [];
    const productsForBranch = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, activeBranchIdState);
    return productsForBranch
        .filter(p => p.stock > 0)
        .sort((a,b) => b.stock - a.stock)
        .slice(0, 10)
        .map(product => ({
            name: product.name,
            stock: product.stock,
        }));
  }, [activeBranchIdState]);

  const productStockChartConfig = {
    stock: { label: "Stock", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig;

  const rawMaterialStockChartData = useMemo(() => {
    if (!activeBranchIdState) return [];
    const rawMaterialsForBranch = loadFromLocalStorageForBranch<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY, activeBranchIdState);
    return rawMaterialsForBranch
        .filter(m => m.quantity > 0)
        .sort((a,b) => b.quantity - a.quantity)
        .slice(0, 10)
        .map(material => ({
            name: `${material.name} (${material.unit})`,
            stock: parseFloat(material.quantity.toFixed(2)),
        }));
  }, [activeBranchIdState]);

  const rawMaterialStockChartConfig = {
    stock: { label: "Cantidad", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  const purchaseOrdersChartData = useMemo(() => {
    if (!activeBranchIdState) return [];
    const ordersForBranch = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchIdState);
    let filteredOrders = ordersForBranch;
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredOrders = ordersForBranch.filter(po => {
        const orderDate = parseISO(po.orderDate);
        return isValid(orderDate) && isWithinInterval(orderDate, { start: from, end: to });
      });
    }
    const ordersBySupplier: { [supplierName: string]: number } = {};
    filteredOrders.forEach(order => {
        if (order.status === 'Pagado') {
             ordersBySupplier[order.supplierName] = (ordersBySupplier[order.supplierName] || 0) + order.totalCost;
        }
    });
    return Object.entries(ordersBySupplier)
      .map(([supplierName, totalCost]) => ({
        supplierName,
        totalCost: parseFloat(totalCost.toFixed(2)),
      }))
      .sort((a,b) => b.totalCost - a.totalCost)
      .slice(0,10);
  }, [selectedDateRange, activeBranchIdState]);

  const purchaseOrdersChartConfig = {
    totalCost: { label: "Costo Total (USD)", color: "hsl(var(--chart-4))" },
  } satisfies ChartConfig;

  const wastageReportFullData = useMemo(() => {
    if (!activeBranchIdState) return [];
    const productionLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranchIdState);
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchIdState);

    let filteredLogs = productionLogsForBranch;
    let reportRangeStart = selectedDateRange?.from ? startOfDay(selectedDateRange.from) : null;
    let reportRangeEnd = selectedDateRange?.to ? endOfDay(selectedDateRange.to) : (selectedDateRange?.from ? endOfDay(selectedDateRange.from) : null);

    if (reportRangeStart && reportRangeEnd) {
        filteredLogs = productionLogsForBranch.filter(log => {
            const logDate = parseISO(log.date);
            return isValid(logDate) && isWithinInterval(logDate, { start: reportRangeStart!, end: reportRangeEnd! });
        });
    }

    let fixedWeeklyCostForPeriod = 0;
    let payrollWeeklyCostForPeriod = 0;
    let numberOfWeeksInPeriod = 1;

    const fixedCategories: ExpenseFixedCategory[] = loadExpenseFixedCategories(activeBranchIdState);
    const employees: Employee[] = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchIdState);

    fixedWeeklyCostForPeriod = fixedCategories
      .filter(cat => cat.name.toLowerCase() !== 'nómina' && cat.monthlyAmount && cat.monthlyAmount > 0)
      .reduce((sum, cat) => sum + (cat.monthlyAmount! / WEEKS_IN_MONTH), 0);

    payrollWeeklyCostForPeriod = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

    if (reportRangeStart && reportRangeEnd) {
      numberOfWeeksInPeriod = differenceInCalendarWeeks(reportRangeEnd, reportRangeStart, { weekStartsOn: 1 }) + 1;
      if (numberOfWeeksInPeriod <= 0) numberOfWeeksInPeriod = 1;
    }
    const totalOperatingCostForPeriod = (fixedWeeklyCostForPeriod + payrollWeeklyCostForPeriod) * numberOfWeeksInPeriod;


    const totalSacksProducedInPeriod = filteredLogs.reduce((sum, log) => {
      const recipeDetails = recipesForBranch.find(r => r.name === log.product);
      if (recipeDetails && !recipeDetails.isIntermediate) {
        return sum + (log.batchSizeMultiplier || 0);
      }
      return sum;
    }, 0);

    const costPerSackForPeriod = totalSacksProducedInPeriod > 0 && totalOperatingCostForPeriod >=0 ? totalOperatingCostForPeriod / totalSacksProducedInPeriod : 0;

    const productWastageMap: { [productName: string]: ProductWastageData; } = {};
    filteredLogs.forEach(log => {
        const recipe = recipesForBranch.find(r => r.name === log.product);
        if (recipe && !recipe.isIntermediate) {
            const wastageQuantityInThisLog = log.expectedQuantity - log.actualQuantity;
            if (wastageQuantityInThisLog > 0) {
                const costoIngredientesPorTanda = calculateDynamicRecipeCost(recipe.id, 'highest', recipesForBranch);
                const costoIngredientesPorUnidad = (recipe.expectedYield && recipe.expectedYield > 0) ? costoIngredientesPorTanda / recipe.expectedYield : 0;
                
                let costoOperativoPorUnidad = 0;
                if (recipe.expectedYield && recipe.expectedYield > 0 && costPerSackForPeriod >= 0) {
                    costoOperativoPorUnidad = costPerSackForPeriod / recipe.expectedYield;
                }
                const costoTotalPorUnidadParaMerma = costoIngredientesPorUnidad + costoOperativoPorUnidad;
                const wastageCostInThisLog = wastageQuantityInThisLog * costoTotalPorUnidadParaMerma;

                if (!productWastageMap[log.product]) {
                    productWastageMap[log.product] = {
                        name: log.product, totalExpected: 0, totalActual: 0,
                        totalWastageQuantity: 0, totalWastageCostUSD: 0,
                        baseUnitPriceForWastage: costoTotalPorUnidadParaMerma
                    };
                }
                productWastageMap[log.product].totalExpected += log.expectedQuantity;
                productWastageMap[log.product].totalActual += log.actualQuantity;
                productWastageMap[log.product].totalWastageQuantity += wastageQuantityInThisLog;
                productWastageMap[log.product].totalWastageCostUSD += wastageCostInThisLog;
                if (productWastageMap[log.product].baseUnitPriceForWastage === undefined) {
                     productWastageMap[log.product].baseUnitPriceForWastage = costoTotalPorUnidadParaMerma;
                 }
            }
        }
    });

    return Object.values(productWastageMap)
        .sort((a, b) => b.totalWastageCostUSD - a.totalWastageCostUSD);
  }, [selectedDateRange, activeBranchIdState]);

  const productWastageChartData = useMemo(() => {
    return wastageReportFullData.slice(0, TOP_N_WASTAGE_PRODUCTS_REPORTS).map(item => ({
        name: item.name,
        wastageCostUSD: parseFloat(item.totalWastageCostUSD.toFixed(2)),
        wastageQuantity: item.totalWastageQuantity
    }));
  }, [wastageReportFullData]);

  const productWastageChartConfig = {
    wastageCostUSD: { label: "Costo Merma (USD)", color: "hsl(var(--destructive))" },
    wastageQuantity: { label: "Cantidad Mermada", color: "hsl(var(--chart-2))" }
  } satisfies ChartConfig;

  const productLossesData = useMemo(() => {
    const lossesMap: { [productName: string]: ProductLossItem } = {};
    let filteredSales = initialSalesDataGlobal;
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredSales = initialSalesDataGlobal.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
      });
    }

    if (!activeBranchIdState) return [];
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchIdState);
    const productionLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranchIdState);

    let fixedWeeklyCostForPeriod = 0;
    let payrollWeeklyCostForPeriod = 0;
    let numberOfWeeksInPeriod = 1;
    const fixedCategories: ExpenseFixedCategory[] = loadExpenseFixedCategories(activeBranchIdState);
    const employees: Employee[] = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchIdState);
    fixedWeeklyCostForPeriod = fixedCategories
      .filter(cat => cat.name.toLowerCase() !== 'nómina' && cat.monthlyAmount && cat.monthlyAmount > 0)
      .reduce((sum, cat) => sum + (cat.monthlyAmount! / WEEKS_IN_MONTH), 0);
    payrollWeeklyCostForPeriod = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    if (selectedDateRange?.from && selectedDateRange.to) {
      numberOfWeeksInPeriod = differenceInCalendarWeeks(selectedDateRange.to, selectedDateRange.from, { weekStartsOn: 1 }) + 1;
      if (numberOfWeeksInPeriod <= 0) numberOfWeeksInPeriod = 1;
    }
    const totalOperatingCostForPeriod = (fixedWeeklyCostForPeriod + payrollWeeklyCostForPeriod) * numberOfWeeksInPeriod;
    const totalSacksProducedInPeriod = productionLogsForBranch
      .filter(log => {
        if (!selectedDateRange?.from || !selectedDateRange.to) return true;
        const logDate = parseISO(log.date);
        return isValid(logDate) && isWithinInterval(logDate, { start: startOfDay(selectedDateRange.from), end: endOfDay(selectedDateRange.to) });
      })
      .reduce((sum, log) => {
        const recipeDetails = recipesForBranch.find(r => r.name === log.product);
        if (recipeDetails && !recipeDetails.isIntermediate) return sum + (log.batchSizeMultiplier || 0);
        return sum;
      }, 0);
    const costPerSackForPeriod = totalSacksProducedInPeriod > 0 && totalOperatingCostForPeriod >=0 ? totalOperatingCostForPeriod / totalSacksProducedInPeriod : 0;


    filteredSales.forEach(sale => {
      if (sale.changes) {
        sale.changes.forEach(item => {
          if (item.productName && item.sourceBranchId === activeBranchIdState) {
            if (!lossesMap[item.productName]) {
              lossesMap[item.productName] = { name: item.productName, quantityChanged: 0, costChangedUSD: 0, quantityWasted: 0, costWastedUSD: 0, quantitySampled: 0, costSampledUSD: 0, totalQuantityLost: 0, totalCostLostUSD: 0 };
            }
            lossesMap[item.productName].quantityChanged += item.quantity;
            const recipe = recipesForBranch.find(r => r.name === item.productName);
            if (recipe && recipe.name.toLowerCase().startsWith('no despachable')) {
              const lossCostPerUnit = recipe.costPerUnit || 0;
              lossesMap[item.productName].costChangedUSD += item.quantity * lossCostPerUnit;
            }
          }
        });
      }
      if (sale.samples) {
        sale.samples.forEach(sample => {
          if (sample.productName && sample.sourceBranchId === activeBranchIdState) {
            if (!lossesMap[sample.productName]) {
              lossesMap[sample.productName] = { name: sample.productName, quantityChanged: 0, costChangedUSD: 0, quantityWasted: 0, costWastedUSD: 0, quantitySampled: 0, costSampledUSD: 0, totalQuantityLost: 0, totalCostLostUSD: 0 };
            }
            lossesMap[sample.productName].quantitySampled += sample.quantity;
            const recipe = recipesForBranch.find(r => r.name === sample.productName);
            if (recipe) {
                const costOfIngredientsPerTanda = calculateDynamicRecipeCost(recipe.id, 'highest', recipesForBranch);
                const costOfIngredientsPerUnit = (recipe.expectedYield && recipe.expectedYield > 0) ? costOfIngredientsPerTanda / recipe.expectedYield : 0;
                const operatingCostPerUnit = (recipe.expectedYield && recipe.expectedYield > 0 && costPerSackForPeriod >= 0) ? costPerSackForPeriod / recipe.expectedYield : 0;
                const packagingCostPerUnit = calculatePackagingCost(1).maxCost;
                const totalCostPerUnitSampled = costOfIngredientsPerUnit + operatingCostPerUnit + packagingCostPerUnit;
                lossesMap[sample.productName].costSampledUSD += sample.quantity * totalCostPerUnitSampled;
            }
          }
        });
      }
    });

    wastageReportFullData.forEach(wastageItem => {
      if (!lossesMap[wastageItem.name]) {
        lossesMap[wastageItem.name] = { name: wastageItem.name, quantityChanged: 0, costChangedUSD: 0, quantityWasted: 0, costWastedUSD: 0, quantitySampled: 0, costSampledUSD: 0, totalQuantityLost: 0, totalCostLostUSD: 0 };
      }
      lossesMap[wastageItem.name].quantityWasted += wastageItem.totalWastageQuantity;
      lossesMap[wastageItem.name].costWastedUSD += wastageItem.totalWastageCostUSD;
    });

    return Object.values(lossesMap).map(item => ({
      ...item,
      totalQuantityLost: item.quantityChanged + item.quantityWasted + item.quantitySampled,
      totalCostLostUSD: item.costChangedUSD + item.costWastedUSD + item.costSampledUSD,
    }))
    .sort((a, b) => b.totalCostLostUSD - a.totalCostLostUSD)
    .slice(0, TOP_N_LOSSES_REPORTS);

  }, [selectedDateRange, wastageReportFullData, activeBranchIdState]);

  const productLossesChartConfig = {
    totalQuantityLost: { label: "Cantidad Perdida", color: "hsl(var(--chart-2))" },
    totalCostLostUSD: { label: "Costo Pérdida (USD)", color: "hsl(var(--destructive))" },
  } satisfies ChartConfig;


  const handleDownloadSalesReport = () => {
    let filteredSales = initialSalesDataGlobal;
    let reportPeriod = "General";

    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredSales = initialSalesDataGlobal.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
      });
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    if (filteredSales.length === 0) {
      toast({ title: "Sin Datos", description: "No hay ventas para el período seleccionado.", variant: "default" });
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text("Reporte de Ventas (Global)", 14, 30);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 38);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 44);

    const head = [["ID Venta", "Fecha", "Cliente", "Total (USD)", "Total (VES)", "Método Pago", "Estado"]];
    const body = filteredSales.map(sale => [
      sale.id,
      format(parseISO(sale.date), "dd/MM/yyyy", { locale: es }),
      sale.customerName || 'N/A',
      `$${sale.totalAmount.toFixed(2)}`,
      formatVesPrice(sale.totalAmount),
      sale.paymentMethod,
      sale.status
    ]);

    doc.autoTable({
      startY: 52, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });

    doc.save(getReportFilename("reporte_ventas_global"));
    toast({
      title: "Reporte de Ventas Generado",
      description: `Se generó un PDF con ${filteredSales.length} registros de ventas.`,
      duration: 5000,
    });
  };

  const handleDownloadProductChangesReport = () => {
    let filteredSales = initialSalesDataGlobal;
    let reportPeriod = "General";

    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredSales = initialSalesDataGlobal.filter(sale => {
        const saleDate = parseISO(sale.date);
        return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
      });
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    const productChangesAggregated: { name: string; quantity: number; costUSD: number }[] = [];
    const productChangesMap: { [productName: string]: { quantity: number; costUSD: number } } = {};

    const activeBranchRecipes = activeBranchIdState ? loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchIdState) : [];

    filteredSales.forEach(sale => {
      if (sale.changes) {
        sale.changes.forEach(item => {
          if (item.productName) {
            if (!productChangesMap[item.productName]) {
              productChangesMap[item.productName] = { quantity: 0, costUSD: 0 };
            }
            productChangesMap[item.productName].quantity += item.quantity;
            const recipe = activeBranchRecipes.find(r => r.name === item.productName);
            if (recipe && recipe.name.toLowerCase().startsWith('no despachable')) {
              const lossCostPerUnit = recipe.costPerUnit || 0;
              productChangesMap[item.productName].costUSD += item.quantity * lossCostPerUnit;
            }
          }
        });
      }
    });

    for (const name in productChangesMap) {
        productChangesAggregated.push({ name, quantity: productChangesMap[name].quantity, costUSD: productChangesMap[name].costUSD });
    }
    const productChangesList = productChangesAggregated.sort((a, b) => b.costUSD - a.costUSD);

    if (productChangesList.length === 0) {
      toast({ title: "Sin Datos", description: "No hay cambios/devoluciones de productos para el período seleccionado.", variant: "default" });
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text("Reporte de Cambios/Devoluciones de Productos (Global)", 14, 30);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 38);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 44);
    doc.text(`Nota: El costo se basa en el costo de "No despachable" (recetas sede: ${activeBranchName}).`, 14, 50);

    const head = [["Producto", "Cantidad Cambiada/Devuelta", "Costo Total Cambio (USD)", "Costo Total Cambio (VES)"]];
    const body = productChangesList.map(item => [
      item.name,
      item.quantity,
      `$${item.costUSD.toFixed(2)}`,
      formatVesPrice(item.costUSD)
    ]);
    const totalQuantity = productChangesList.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = productChangesList.reduce((sum, item) => sum + item.costUSD, 0);
    body.push([
        { content: "TOTALES", styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totalQuantity, styles: { fontStyle: 'bold' } },
        { content: `$${totalCost.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        { content: formatVesPrice(totalCost), styles: { fontStyle: 'bold' } },
    ]);

    doc.autoTable({
      startY: 58, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_cambios_productos_global"));
    toast({ title: "Reporte de Cambios Generado", description: `Se generó un PDF con ${productChangesList.length} productos cambiados/devueltos.`, duration: 5000, });
  };

  const handleDownloadExpenseReport = () => {
    if (!activeBranchIdState) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive" });
      return;
    }
    let branchExpenses = loadFromLocalStorageForBranch<Expense[]>(KEYS.EXPENSES, activeBranchIdState);
    let filteredExpenses = branchExpenses;
    let reportPeriod = "General";

    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredExpenses = branchExpenses.filter(expense => {
        const expenseDate = parseISO(expense.date);
        return isValid(expenseDate) && isWithinInterval(expenseDate, { start: from, end: to });
      });
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    if (filteredExpenses.length === 0) {
      toast({ title: "Sin Datos", description: `No hay gastos para el período y sede ${activeBranchName}.`, variant: "default" });
      return;
    }

    const doc = new jsPDF() as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text(`Reporte de Gastos (Sede: ${activeBranchName})`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 38);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 44);

    const head = [["ID Gasto", "Fecha", "Categoría", "Descripción", "Monto (USD)", "Monto (VES)", "Pagado A"]];
    const body = filteredExpenses.map(expense => [
      expense.id,
      format(parseISO(expense.date), "dd/MM/yyyy", { locale: es }),
      expense.category,
      expense.description,
      `$${expense.amount.toFixed(2)}`,
      formatVesPrice(expense.amount),
      expense.paidTo
    ]);

    doc.autoTable({
      startY: 52, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_gastos"));
    toast({ title: "Reporte de Gastos Generado", description: `Se generó un PDF con ${filteredExpenses.length} registros de gastos de la sede ${activeBranchName}.`, duration: 5000, });
  };

  const handleDownloadInventoryReport = () => {
    if (!activeBranchIdState) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive" });
      return;
    }
    const productsForReport = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, activeBranchIdState);
    if (productsForReport.length === 0) {
      toast({ title: "Sin Datos", description: `No hay productos en el stock de producción de la sede ${activeBranchName}.`, variant: "default" });
      return;
    }
    const doc = new jsPDF() as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text(`Reporte de Stock de Producción (Sede: ${activeBranchName})`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Fecha del Reporte: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 38);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 44);

    const head = [["ID Producto", "Nombre", "Categoría", "Stock", "P.Unit(USD)", "P.Unit(VES)", "Últ. Actualización"]];
    const body = productsForReport.map(product => [
      product.id, product.name, product.category, product.stock,
      `$${product.unitPrice.toFixed(2)}`, formatVesPrice(product.unitPrice),
      product.lastUpdated ? format(parseISO(product.lastUpdated), "dd/MM/yyyy", { locale: es }) : '-'
    ]);

    doc.autoTable({
      startY: 52, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_stock_produccion"));
    toast({ title: "Reporte de Stock de Producción Generado", description: `Se generó un PDF con ${productsForReport.length} productos de la sede ${activeBranchName}.`, duration: 5000, });
  };

  const handleDownloadRawMaterialInventoryReport = () => {
    if (!activeBranchIdState) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive" });
      return;
    }
    const rawMaterialsForReport = loadFromLocalStorageForBranch<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY, activeBranchIdState);
    if (rawMaterialsForReport.length === 0) {
      toast({ title: "Sin Datos", description: `No hay materia prima en el inventario de la sede ${activeBranchName}.`, variant: "default" });
      return;
    }
    const doc = new jsPDF() as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 22);
    doc.setFontSize(12);
    doc.text(`Reporte de Inventario de Materia Prima (Sede: ${activeBranchName})`, 14, 30);
    doc.setFontSize(10);
    doc.text(`Fecha del Reporte: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 38);

    const head = [["Ingrediente", "Cantidad Total", "Unidad (Base)"]];
    const body = rawMaterialsForReport.map(material => [
      material.name, material.quantity.toFixed(3), material.unit
    ]);

    doc.autoTable({
      startY: 46, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_materia_prima"));
    toast({ title: "Reporte de Materia Prima Generado", description: `Se generó un PDF con ${rawMaterialsForReport.length} ítems de la sede ${activeBranchName}.`, duration: 5000, });
  };

  const handleDownloadPurchaseOrdersReport = () => {
    if (!activeBranchIdState) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive" });
      return;
    }
    const ordersForBranch = loadFromLocalStorageForBranch<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, activeBranchIdState);
    let filteredOrders = ordersForBranch;
    let reportPeriod = "General";

    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      filteredOrders = ordersForBranch.filter(po => {
        const orderDate = parseISO(po.orderDate);
        return isValid(orderDate) && isWithinInterval(orderDate, { start: from, end: to });
      });
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    if (filteredOrders.length === 0) {
      toast({ title: "Sin Datos", description: `No hay órdenes de compra para el período y sede ${activeBranchName}.`, variant: "default" });
      return;
    }

    const doc = new jsPDF("landscape") as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 20);
    doc.setFontSize(12);
    doc.text(`Reporte de Órdenes de Compra (Sede: ${activeBranchName})`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 36);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 42);

    const head = [["ID OC", "Proveedor", "Fecha Pedido", "Entrega Esperada", "Artículos (Resumen)", "Costo Total (USD)", "Costo Total (VES)", "Estado"]];
    const body = filteredOrders.map(po => [
      po.id, po.supplierName, format(parseISO(po.orderDate), "dd/MM/yyyy", { locale: es }),
      format(parseISO(po.expectedDelivery), "dd/MM/yyyy", { locale: es }),
      po.items.map(item => `${item.rawMaterialName} (${item.quantity} ${item.unit})`).join('; '),
      `$${po.totalCost.toFixed(2)}`, formatVesPrice(po.totalCost), po.status
    ]);

    doc.autoTable({
      startY: 50, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
      columnStyles: { 4: { cellWidth: 'auto' } }
    });
    doc.save(getReportFilename("reporte_ordenes_compra"));
    toast({ title: "Reporte de Órdenes de Compra Generado", description: `Se generó un PDF con ${filteredOrders.length} órdenes de la sede ${activeBranchName}.`, duration: 5000, });
  };

  const handleDownloadWastageReport = () => {
    if (wastageReportFullData.length === 0) {
      toast({ title: "Sin Datos", description: `No hay datos de merma para el período y sede ${activeBranchName}.`, variant: "default" });
      return;
    }
    let reportPeriod = "General";
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    const doc = new jsPDF("landscape") as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 20);
    doc.setFontSize(12);
    doc.text(`Reporte de Merma de Producción (Sede: ${activeBranchName})`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 36);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 42);
    doc.text("Nota: Costo de merma incluye costo de ingredientes y operativos (basados en sede actual).", 14, 48);

    const head = [["Producto", "Esperado", "Real", "Mermado", "Costo Unit. Merma (USD)", "Costo Merma (USD)", "Costo Merma (VES)"]];
    const body = wastageReportFullData.map(item => [
      item.name, item.totalExpected, item.totalActual, item.totalWastageQuantity,
      `$${(item.baseUnitPriceForWastage || 0).toFixed(2)}`, `$${item.totalWastageCostUSD.toFixed(2)}`, formatVesPrice(item.totalWastageCostUSD)
    ]);
    const totalWastageQty = wastageReportFullData.reduce((sum, item) => sum + item.totalWastageQuantity, 0);
    const totalWastageCost = wastageReportFullData.reduce((sum, item) => sum + item.totalWastageCostUSD, 0);
    body.push([
        { content: "TOTALES", colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totalWastageQty, styles: { fontStyle: 'bold' } },
        { content: "", styles: { fontStyle: 'bold' } }, // Empty for unit cost
        { content: `$${totalWastageCost.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        { content: formatVesPrice(totalWastageCost), styles: { fontStyle: 'bold' } },
    ]);

    doc.autoTable({
      startY: 56, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_merma_produccion"));
    toast({ title: "Reporte de Merma Generado", description: `Se generó un PDF para la sede ${activeBranchName}.`, duration: 5000, });
  };

  const handleDownloadLossesReport = () => {
    if (productLossesData.length === 0 && wastageReportFullData.length === 0 && productChangesChartData.length === 0) {
      toast({ title: "Sin Datos", description: "No hay datos de pérdidas (merma, cambios o muestras) para el período y sede actual.", variant: "default" });
      return;
    }
    let reportPeriod = "General";
    if (selectedDateRange?.from) {
      const from = startOfDay(selectedDateRange.from);
      const to = selectedDateRange.to ? endOfDay(selectedDateRange.to) : endOfDay(selectedDateRange.from);
      reportPeriod = `${format(from, "dd/MM/yyyy", { locale: es })}${selectedDateRange.to ? ` - ${format(to, "dd/MM/yyyy", { locale: es })}` : ''}`;
    }

    const doc = new jsPDF("landscape") as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 20);
    doc.setFontSize(12);
    doc.text(`Reporte de Pérdidas Totales (Sede: ${activeBranchName})`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Período: ${reportPeriod}`, 14, 36);
    doc.text(`Tasa de Cambio (USD/VES): ${exchangeRate > 0 ? exchangeRate.toFixed(2) : 'No establecida'}`, 14, 42);
    doc.text("Nota: Costo cambios/muestras/merma basados en costos de la sede actual.", 14, 48);

    const head = [["Producto", "Cant. Cambiada", "Costo Cambios (USD)", "Cant. Mermada", "Costo Merma (USD)", "Cant. Muestras", "Costo Muestras (USD)", "Cant. Total Perdida", "Costo Total Pérdida (USD)"]];
    const body = productLossesData.map(item => [
      item.name, item.quantityChanged, `$${item.costChangedUSD.toFixed(2)}`,
      item.quantityWasted, `$${item.costWastedUSD.toFixed(2)}`,
      item.quantitySampled, `$${item.costSampledUSD.toFixed(2)}`,
      item.totalQuantityLost, `$${item.totalCostLostUSD.toFixed(2)}`,
    ]);
    const totalQuantityChanged = productLossesData.reduce((sum, item) => sum + item.quantityChanged, 0);
    const totalCostChanged = productLossesData.reduce((sum, item) => sum + item.costChangedUSD, 0);
    const totalQuantityWasted = productLossesData.reduce((sum, item) => sum + item.quantityWasted, 0);
    const totalCostWasted = productLossesData.reduce((sum, item) => sum + item.costWastedUSD, 0);
    const totalQuantitySampled = productLossesData.reduce((sum, item) => sum + item.quantitySampled, 0);
    const totalCostSampled = productLossesData.reduce((sum, item) => sum + item.costSampledUSD, 0);
    const grandTotalQuantityLost = productLossesData.reduce((sum, item) => sum + item.totalQuantityLost, 0);
    const grandTotalCostLost = productLossesData.reduce((sum, item) => sum + item.totalCostLostUSD, 0);

    body.push([
        { content: "TOTALES", styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totalQuantityChanged, styles: { fontStyle: 'bold' } },
        { content: `$${totalCostChanged.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        { content: totalQuantityWasted, styles: { fontStyle: 'bold' } },
        { content: `$${totalCostWasted.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        { content: totalQuantitySampled, styles: { fontStyle: 'bold' } },
        { content: `$${totalCostSampled.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        { content: grandTotalQuantityLost, styles: { fontStyle: 'bold' } },
        { content: `$${grandTotalCostLost.toFixed(2)}`, styles: { fontStyle: 'bold' } },
    ]);

    doc.autoTable({
      startY: 56, head: head, body: body, theme: 'striped', headStyles: { fillColor: [224, 122, 95], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });
    doc.save(getReportFilename("reporte_perdidas_totales"));
    toast({ title: "Reporte de Pérdidas Generado", description: `Se generó un PDF con el resumen de pérdidas de la sede ${activeBranchName}.`, duration: 5000, });
  };
  
  const handleDownloadDetailedLossReportPDF = (report: WeeklyLossReport) => {
    const doc = new jsPDF("landscape") as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 20);
    doc.setFontSize(12);
    doc.text(`Reporte Detallado de Pérdidas Semanales`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Semana del: ${format(parseISO(report.weekStartDate), "dd/MM/yyyy", { locale: es })} al ${format(parseISO(report.weekEndDate), "dd/MM/yyyy", { locale: es })}`, 14, 36);
    doc.text(`Generado el: ${format(parseISO(report.generatedOn), "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 42);

    const head = [["Fecha", "Sede", "Tipo Pérdida", "Producto", "Cliente", "Cant.", "Costo Unit. (USD)", "Costo Total (USD)"]];
    const body = report.entries.map(entry => [
      format(parseISO(entry.date), "dd/MM/yy", { locale: es }),
      entry.sourceBranchName,
      entry.type,
      entry.productName,
      entry.customerName || '-',
      entry.quantity,
      `$${entry.costPerUnitUSD.toFixed(3)}`,
      `$${entry.totalCostUSD.toFixed(2)}`
    ]);
    body.push([
        { content: "TOTAL PÉRDIDA SEMANAL", colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `$${report.totalLossUSD.toFixed(2)}`, styles: { fontStyle: 'bold' } },
    ]);

    doc.autoTable({
      startY: 50, head: head, body: body, theme: 'striped', headStyles: { fillColor: [220, 53, 69], fontSize: 10 }, bodyStyles: { fontSize: 9 },
    });

    doc.save(`reporte_perdida_semanal_${format(parseISO(report.weekEndDate), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Reporte de Pérdida Detallado Generado", description: "PDF descargado.", duration: 5000 });
};

const handleDownloadDetailedProfitReportPDF = (report: WeeklyProfitReport) => {
    const doc = new jsPDF("landscape") as jsPDFWithAutoTable;
    doc.setFontSize(18);
    doc.text("Panificadora Valladares", 14, 20);
    doc.setFontSize(12);
    doc.text(`Reporte Detallado de Ganancias Semanales`, 14, 28);
    doc.setFontSize(10);
    doc.text(`Semana del: ${format(parseISO(report.weekStartDate), "dd/MM/yyyy", { locale: es })} al ${format(parseISO(report.weekEndDate), "dd/MM/yyyy", { locale: es })}`, 14, 36);
    doc.text(`Generado el: ${format(parseISO(report.generatedOn), "dd/MM/yyyy HH:mm", { locale: es })}`, 14, 42);

    const head = [["Fecha", "Sede", "Producto", "Cant. Vendida", "P. Venta (USD)", "Costo Prod. (USD)", "Ganancia Unit. (USD)", "Ganancia Total (USD)"]];
    const body = report.entries.map(entry => [
      format(parseISO(entry.date), "dd/MM/yy", { locale: es }),
      entry.sourceBranchName,
      entry.productName,
      entry.quantitySold,
      `$${entry.salePricePerUnitUSD.toFixed(2)}`,
      `$${entry.costPerUnitUSD.toFixed(3)}`,
      `$${entry.profitPerUnitUSD.toFixed(3)}`,
      `$${entry.totalProfitUSD.toFixed(2)}`
    ]);

    // Totals footer row
    body.push([
        { content: "TOTALES", colSpan: 7, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `$${report.totalProfitUSD.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [230, 245, 230] } },
    ]);

    // Summary below the table
    let finalY = (doc as any).lastAutoTable.finalY || 50;
    const addSummaryText = (label: string, value: string, yOffset: number) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(label, 14, finalY + yOffset);
        doc.setFont("helvetica", "normal");
        doc.text(value, 50, finalY + yOffset);
    };

    doc.autoTable({
      startY: 50, head: head, body: body, theme: 'striped', headStyles: { fillColor: [34, 139, 34], fontSize: 10 }, bodyStyles: { fontSize: 9 },
      didDrawPage: (data) => {
          finalY = data.cursor?.y ?? 50;
      }
    });

    finalY = (doc as any).lastAutoTable.finalY + 10;
    
    addSummaryText("Ingresos Totales (USD):", `$${report.totalRevenueUSD.toFixed(2)}`, 0);
    addSummaryText("Costos Totales (USD):", `$${report.totalCostsUSD.toFixed(2)}`, 6);
    addSummaryText("Ganancia Neta (USD):", `$${report.totalProfitUSD.toFixed(2)}`, 12);

    doc.save(`reporte_ganancia_semanal_${format(parseISO(report.weekEndDate), "yyyy-MM-dd")}.pdf`);
    toast({ title: "Reporte de Ganancia Detallado Generado", description: "PDF descargado.", duration: 5000 });
};




  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Cargando reportes...</p></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes y Analíticas"
        description={`Información de rendimiento. Ventas y Cambios son globales. Inventarios, Producción, OCs, Merma, Pérdidas y Gastos se muestran para la Sede Actual: ${activeBranchName}.`}
        icon={FileText}
        actions={
            <Button variant="outline" onClick={() => setIsDateRangeDialogOpen(true)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Seleccionar Rango de Fechas
            </Button>
        }
      />
        {selectedDateRange?.from && (
            <Card className="shadow-sm border-dashed border-primary">
                <CardContent className="p-3 text-center">
                    <p className="text-sm text-primary font-medium">
                        Rango de fechas activo para reportes (Ventas, Gastos, OC, Cambios, Merma, Pérdidas):
                        {format(selectedDateRange.from, "dd/MM/yyyy", { locale: es })}
                        {selectedDateRange.to && ` - ${format(selectedDateRange.to, "dd/MM/yyyy", { locale: es })}`}
                    </p>
                </CardContent>
            </Card>
        )}
        
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Historial de Reportes de Pérdida Semanal</CardTitle>
              <CardDescription>Reportes detallados de todas las pérdidas (merma, cambios, muestras) generados automáticamente cada domingo.</CardDescription>
            </CardHeader>
            <CardContent>
              {weeklyLossReports.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Semana del</TableHead><TableHead className="text-right">Pérdida Total (USD)</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {weeklyLossReports.map(report => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="font-medium">{format(parseISO(report.weekStartDate), "dd MMM yyyy", { locale: es })} - {format(parseISO(report.weekEndDate), "dd MMM yyyy", { locale: es })}</div>
                          <div className="text-sm text-muted-foreground">Generado: {format(parseISO(report.generatedOn), "dd/MM/yy HH:mm", { locale: es })}</div>
                        </TableCell>
                        <TableCell className="text-right text-destructive font-semibold">${report.totalLossUSD.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedLossReport(report); setIsLossReportDialogOpen(true); }}>
                            <Eye className="mr-2 h-4 w-4" />Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (<p className="text-center text-muted-foreground py-8">No se han generado reportes semanales de pérdidas.</p>)}
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Historial de Reportes de Ganancia Semanal</CardTitle>
              <CardDescription>Reportes detallados de la ganancia estimada generados automáticamente cada domingo.</CardDescription>
            </CardHeader>
            <CardContent>
              {weeklyProfitReports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semana del</TableHead>
                      <TableHead className="text-right">Ingresos Totales (USD)</TableHead>
                      <TableHead className="text-right">Ganancia Total (USD)</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyProfitReports.map(report => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="font-medium">{format(parseISO(report.weekStartDate), "dd MMM yyyy", { locale: es })} - {format(parseISO(report.weekEndDate), "dd MMM yyyy", { locale: es })}</div>
                          <div className="text-sm text-muted-foreground">Generado: {format(parseISO(report.generatedOn), "dd/MM/yy HH:mm", { locale: es })}</div>
                        </TableCell>
                        <TableCell className="text-right">${report.totalRevenueUSD.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">${report.totalProfitUSD.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => { setSelectedProfitReport(report); setIsProfitReportDialogOpen(true); }}>
                            <Eye className="mr-2 h-4 w-4" />Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (<p className="text-center text-muted-foreground py-8">No se han generado reportes semanales de ganancias.</p>)}
            </CardContent>
          </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChartIconLucide className="h-5 w-5 text-primary" /> Top {TOP_N_PRODUCTS_REPORTS} Productos Vendidos (Global)</CardTitle>
            <CardDescription>Cantidad de unidades vendidas por producto en el período seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productSalesQuantityChartData.length > 0 ? (
              <ChartContainer config={productSalesQuantityChartConfig} className="h-full w-full">
                <BarChart data={productSalesQuantityChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} fontSize={12}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12}/>
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" className="text-sm"/>} />
                  <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} nameKey="name" />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay datos de ventas de productos para el período.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadSalesReport}><Download className="mr-2 h-4 w-4" /> Descargar Ventas (Global)</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shuffle className="h-5 w-5 text-primary" /> Top {TOP_N_CHANGES_REPORTS} Productos Cambiados (Global)</CardTitle>
            <CardDescription>Cantidad cambiada/devuelta por producto en el período. Costo basado en recetas sede: {activeBranchName}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productChangesChartData.length > 0 ? (
              <ChartContainer config={productChangesChartConfig} className="h-full w-full">
                <BarChart data={productChangesChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tickMargin={10} fontSize={12}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12}/>
                  <ChartTooltip content={<ChartTooltipContent indicator="dot" className="text-sm"/>} />
                  <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} nameKey="name" />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay datos de cambios/devoluciones para el período.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadProductChangesReport}><Download className="mr-2 h-4 w-4" /> Descargar Cambios (Global)</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-destructive" /> Top {TOP_N_WASTAGE_PRODUCTS_REPORTS} Merma (Costo - Sede: {activeBranchName})</CardTitle>
            <CardDescription>Costo total de merma (USD, ingr. + oper. sede actual) por producto en el período.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productWastageChartData.length > 0 ? (
              <ChartContainer config={productWastageChartConfig} className="h-full w-full">
                <BarChart data={productWastageChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} tickMargin={10} fontSize={12}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12}/>
                  <ChartTooltip content={({ active, payload }) => { if (active && payload && payload.length) { const data = payload[0].payload; return (<div className="rounded-lg border bg-background p-2 shadow-sm text-sm"><div className="grid grid-cols-1 gap-1.5"><span className="font-medium">{data.name}</span><span className="text-muted-foreground">Costo Merma: <span className="font-semibold text-destructive">${data.wastageCostUSD.toFixed(2)}</span></span><span className="text-muted-foreground">Cant. Mermada: <span className="font-semibold">{data.wastageQuantity} unid.</span></span></div></div>); } return null; }} />
                  <Bar dataKey="wastageCostUSD" fill="var(--color-wastageCostUSD)" radius={4} nameKey="name" />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay datos de merma para el período y sede actual.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadWastageReport}><Download className="mr-2 h-4 w-4" /> Descargar Merma (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Combine className="h-5 w-5 text-destructive" /> Top {TOP_N_LOSSES_REPORTS} Pérdidas Totales (Costo - Sede: {activeBranchName})</CardTitle>
            <CardDescription>Suma de costo merma, cambios y muestras (todos costos basados en sede actual).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {productLossesData.length > 0 ? (
              <ChartContainer config={productLossesChartConfig} className="h-full w-full">
                <BarChart data={productLossesData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} tickMargin={10} fontSize={12}/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12}/>
                  <ChartTooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                          <div className="grid grid-cols-1 gap-1.5">
                            <span className="font-medium">{data.name}</span>
                            <span className="text-muted-foreground">Costo Total Perdido: <span className="font-semibold text-destructive">${data.totalCostLostUSD.toFixed(2)}</span></span>
                            <span className="text-muted-foreground">Cant. Total Perdida: <span className="font-semibold">{data.totalQuantityLost} unid.</span></span>
                            <span className="text-xs text-muted-foreground">(Cambios: {data.quantityChanged} unid, ${data.costChangedUSD.toFixed(2)})</span>
                            <span className="text-xs text-muted-foreground">(Merma: {data.quantityWasted} unid, ${data.costWastedUSD.toFixed(2)})</span>
                            <span className="text-xs text-muted-foreground">(Muestras: {data.quantitySampled} unid, ${data.costSampledUSD.toFixed(2)})</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="totalCostLostUSD" fill="var(--color-totalCostLostUSD)" radius={4} nameKey="name" />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay datos consolidados de pérdidas para el período y sede actual.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadLossesReport}><Download className="mr-2 h-4 w-4" /> Descargar Pérdidas (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChartIconLucide className="h-5 w-5 text-primary" /> Desglose de Gastos (Sede: {activeBranchName})</CardTitle>
            <CardDescription>Distribución de gastos por categoría en el período para la sede actual.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {expensesChartData.length > 0 ? (
              <ChartContainer config={expensesChartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%"><PieChart><ChartTooltip content={<ChartTooltipContent nameKey="category" hideLabel className="text-sm"/>} /><Pie data={expensesChartData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const RADIAN = Math.PI / 180; const radius = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + radius * Math.cos(-midAngle * RADIAN); const y = cy + radius * Math.sin(-midAngle * RADIAN); return (percent || 0) * 100 > 5 ? (<text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>{`${((percent || 0) * 100).toFixed(0)}%`}</text>) : null; }}>{expensesChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}</Pie><ChartLegend content={<ChartLegendContent nameKey="category" className="text-sm"/>} /></PieChart></ResponsiveContainer>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay datos de gastos para el período y sede actual.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadExpenseReport}><Download className="mr-2 h-4 w-4" /> Descargar Gastos (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Stock de Producción (Sede: {activeBranchName})</CardTitle>
            <CardDescription>Top 10 productos con más stock en la sede actual.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
             {productStockChartData.length > 0 ? (
              <ChartContainer config={productStockChartConfig} className="h-full w-full">
                <BarChart data={productStockChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} /><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} fontSize={12} width={120} interval={0} /><ChartTooltip content={<ChartTooltipContent className="text-sm"/>} /><Bar dataKey="stock" fill="var(--color-stock)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay productos en stock en la sede actual.</p>)}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleDownloadInventoryReport}><Download className="mr-2 h-4 w-4" /> Descargar Stock Prod. (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-primary" /> Inventario Materia Prima (Sede: {activeBranchName})</CardTitle>
            <CardDescription>Top 10 materias primas con más stock en la sede actual (en unidad base).</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {rawMaterialStockChartData.length > 0 ? (
              <ChartContainer config={rawMaterialStockChartConfig} className="h-full w-full">
                <BarChart data={rawMaterialStockChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} /><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} fontSize={12} width={120} interval={0} /><ChartTooltip content={<ChartTooltipContent className="text-sm"/>} /><Bar dataKey="stock" fill="var(--color-stock)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay materia prima en inventario en la sede actual.</p>)}
          </CardContent>
          <CardFooter>
             <Button className="w-full" onClick={handleDownloadRawMaterialInventoryReport}><Download className="mr-2 h-4 w-4" /> Descargar Materia Prima (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Órdenes de Compra (Pagadas - Sede: {activeBranchName})</CardTitle>
            <CardDescription>Top 10 proveedores por costo total (USD) en el período para la sede actual.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {purchaseOrdersChartData.length > 0 ? (
              <ChartContainer config={purchaseOrdersChartConfig} className="h-full w-full">
                <BarChart data={purchaseOrdersChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} /><YAxis dataKey="supplierName" type="category" tickLine={false} axisLine={false} tickMargin={5} fontSize={12} width={120} interval={0} /><ChartTooltip content={<ChartTooltipContent className="text-sm"/>} /><Bar dataKey="totalCost" fill="var(--color-totalCost)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (<p className="text-center text-muted-foreground py-8">No hay órdenes de compra pagadas para el período y sede actual.</p>)}
          </CardContent>
          <CardFooter>
             <Button className="w-full" onClick={handleDownloadPurchaseOrdersReport}><Download className="mr-2 h-4 w-4" /> Descargar Órdenes Compra (Sede: {activeBranchName})</Button>
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isDateRangeDialogOpen} onOpenChange={setIsDateRangeDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleccionar Rango de Fechas para Reportes</DialogTitle>
            <DialogDescription>Elige un rango para reportes. Los de Inventarios y Stock siempre muestran el estado actual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 justify-center">
            <Calendar mode="range" selected={selectedDateRange} onSelect={setSelectedDateRange} locale={es} numberOfMonths={2}/>
            {selectedDateRange?.from && (<p className="text-center text-sm text-muted-foreground">Rango: {format(selectedDateRange.from, "dd/MM/yyyy", { locale: es })}{selectedDateRange.to && ` - ${format(selectedDateRange.to, "dd/MM/yyyy", { locale: es })}`}</p>)}
          </div>
          <UiDialogFooter>
            <Button variant="outline" onClick={() => setSelectedDateRange(undefined)}>Limpiar Rango</Button>
            <DialogClose asChild><Button onClick={() => { setIsDateRangeDialogOpen(false); if (selectedDateRange?.from) { toast({ title: "Rango Aplicado", description: `Reportes usarán este rango.`}); } else { toast({ title: "Rango Limpiado", description: `Reportes mostrarán todos los datos.`}); }}}>Aplicar y Cerrar</Button></DialogClose>
          </UiDialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isLossReportDialogOpen} onOpenChange={setIsLossReportDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalle del Reporte de Pérdida Semanal</DialogTitle>
            {selectedLossReport && (
                <DialogDescription>
                    Semana del {format(parseISO(selectedLossReport.weekStartDate), "dd MMM yyyy", { locale: es })} al {format(parseISO(selectedLossReport.weekEndDate), "dd MMM yyyy", { locale: es })}.
                    Pérdida Total: <span className="font-bold text-destructive">${selectedLossReport.totalLossUSD.toFixed(2)}</span>.
                </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-[60vh]">
              <Table className="text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Tipo Pérdida</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Costo Unit. (USD)</TableHead>
                    <TableHead className="text-right">Costo Total (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedLossReport?.entries.map((entry, index) => (
                    <TableRow key={`${entry.date}-${entry.productName}-${index}`}>
                      <TableCell>{format(parseISO(entry.date), "dd/MM/yy", { locale: es })}</TableCell>
                      <TableCell>{entry.sourceBranchName}</TableCell>
                      <TableCell>{entry.type}</TableCell>
                      <TableCell>{entry.productName}</TableCell>
                      <TableCell>{entry.customerName || '-'}</TableCell>
                      <TableCell className="text-right">{entry.quantity}</TableCell>
                      <TableCell className="text-right">${entry.costPerUnitUSD.toFixed(3)}</TableCell>
                      <TableCell className="text-right text-destructive">${entry.totalCostUSD.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <UiDialogFooter>
            <Button variant="outline" onClick={() => setIsLossReportDialogOpen(false)}>Cerrar</Button>
            <Button onClick={() => selectedLossReport && handleDownloadDetailedLossReportPDF(selectedLossReport)} disabled={!selectedLossReport}>
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
          </UiDialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProfitReportDialogOpen} onOpenChange={setIsProfitReportDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalle del Reporte de Ganancia Semanal</DialogTitle>
            {selectedProfitReport && (
                <DialogDescription>
                    <p>Semana del {format(parseISO(selectedProfitReport.weekStartDate), "dd MMM yyyy", { locale: es })} al {format(parseISO(selectedProfitReport.weekEndDate), "dd MMM yyyy", { locale: es })}.</p>
                    <p>
                        <span className="font-semibold">Ingresos Totales:</span> <span className="text-green-600">${selectedProfitReport.totalRevenueUSD.toFixed(2)}</span> | 
                        <span className="font-semibold"> Costos Totales:</span> <span className="text-destructive">${selectedProfitReport.totalCostsUSD.toFixed(2)}</span> | 
                        <span className="font-semibold"> Ganancia Neta:</span> <span className="font-bold text-primary">${selectedProfitReport.totalProfitUSD.toFixed(2)}</span>
                    </p>
                </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-[60vh]">
              <Table className="text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cant. Vendida</TableHead>
                    <TableHead className="text-right">P. Venta (USD)</TableHead>
                    <TableHead className="text-right">Costo Prod. (USD)</TableHead>
                    <TableHead className="text-right">Ganancia Unit. (USD)</TableHead>
                    <TableHead className="text-right">Ganancia Total (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProfitReport?.entries.map((entry, index) => (
                    <TableRow key={`${entry.date}-${entry.productName}-${index}`}>
                      <TableCell>{format(parseISO(entry.date), "dd/MM/yy", { locale: es })}</TableCell>
                      <TableCell>{entry.sourceBranchName}</TableCell>
                      <TableCell>{entry.productName}</TableCell>
                      <TableCell className="text-right">{entry.quantitySold}</TableCell>
                      <TableCell className="text-right">${entry.salePricePerUnitUSD.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${entry.costPerUnitUSD.toFixed(3)}</TableCell>
                      <TableCell className="text-right text-green-600">${entry.profitPerUnitUSD.toFixed(3)}</TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">${entry.totalProfitUSD.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          <UiDialogFooter>
            <Button variant="outline" onClick={() => setIsProfitReportDialogOpen(false)}>Cerrar</Button>
            <Button onClick={() => selectedProfitReport && handleDownloadDetailedProfitReportPDF(selectedProfitReport)} disabled={!selectedProfitReport}>
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
          </UiDialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

