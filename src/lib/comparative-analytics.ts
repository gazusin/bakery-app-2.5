import { Sale, Expense } from './data-storage';
import { startOfDay, endOfDay, subDays, differenceInDays, subYears, addDays } from 'date-fns';

export interface ComparisonMetrics {
    current: number;
    previous: number;
    change: number;
    percentageChange: number;
    trend: 'up' | 'down' | 'neutral';
}

export interface SalesComparisonMetrics {
    totalRevenue: ComparisonMetrics;
    totalQuantity: ComparisonMetrics;
    averageOrderValue: ComparisonMetrics;
    orderCount: ComparisonMetrics;
}

export interface ExpensesComparisonMetrics {
    totalExpenses: ComparisonMetrics;
    averageExpense: ComparisonMetrics;
    expenseCount: ComparisonMetrics;
}

export interface AllComparisonMetrics {
    sales: SalesComparisonMetrics;
    expenses: ExpensesComparisonMetrics;
    comparisonType: 'previous' | 'yearOverYear';
    currentPeriod: { from: Date; to: Date };
    previousPeriod: { from: Date; to: Date };
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }
    return ((current - previous) / previous) * 100;
}

/**
 * Determine comparison period dates based on current period and comparison type
 */
export function getComparisonPeriodDates(
    currentPeriod: { from: Date; to: Date },
    comparisonType: 'previous' | 'yearOverYear'
): { from: Date; to: Date } {
    const from = startOfDay(currentPeriod.from);
    const to = endOfDay(currentPeriod.to);
    const periodLength = differenceInDays(to, from) + 1; // +1 to include both days

    if (comparisonType === 'previous') {
        // Previous period: same length, immediately before current period
        const previousTo = subDays(from, 1);
        const previousFrom = subDays(previousTo, periodLength - 1);
        return {
            from: startOfDay(previousFrom),
            to: endOfDay(previousTo)
        };
    } else {
        // Year over year: same dates, one year ago
        return {
            from: startOfDay(subYears(from, 1)),
            to: endOfDay(subYears(to, 1))
        };
    }
}

/**
 * Create comparison metrics object
 */
function createComparisonMetrics(current: number, previous: number): ComparisonMetrics {
    const change = current - previous;
    const percentageChange = calculatePercentageChange(current, previous);

    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (Math.abs(percentageChange) > 0.5) { // 0.5% threshold for neutrality
        trend = percentageChange > 0 ? 'up' : 'down';
    }

    return {
        current,
        previous,
        change,
        percentageChange,
        trend
    };
}

/**
 * Calculate comparative metrics for sales
 */
export function calculateSalesComparison(
    currentSales: Sale[],
    previousSales: Sale[]
): SalesComparisonMetrics {
    // Current period metrics
    const currentRevenue = currentSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const currentQuantity = currentSales.reduce((sum, sale) => {
        return sum + (sale.itemsPerBranch?.reduce((branchSum, branch) => {
            return branchSum + (branch.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
        }, 0) || 0);
    }, 0);
    const currentOrderCount = currentSales.length;
    const currentAvgOrderValue = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;

    // Previous period metrics
    const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const previousQuantity = previousSales.reduce((sum, sale) => {
        return sum + (sale.itemsPerBranch?.reduce((branchSum, branch) => {
            return branchSum + (branch.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0);
        }, 0) || 0);
    }, 0);
    const previousOrderCount = previousSales.length;
    const previousAvgOrderValue = previousOrderCount > 0 ? previousRevenue / previousOrderCount : 0;

    return {
        totalRevenue: createComparisonMetrics(currentRevenue, previousRevenue),
        totalQuantity: createComparisonMetrics(currentQuantity, previousQuantity),
        averageOrderValue: createComparisonMetrics(currentAvgOrderValue, previousAvgOrderValue),
        orderCount: createComparisonMetrics(currentOrderCount, previousOrderCount)
    };
}

/**
 * Calculate comparative metrics for expenses
 */
export function calculateExpensesComparison(
    currentExpenses: Expense[],
    previousExpenses: Expense[]
): ExpensesComparisonMetrics {
    // Current period metrics
    const currentTotal = currentExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const currentCount = currentExpenses.length;
    const currentAverage = currentCount > 0 ? currentTotal / currentCount : 0;

    // Previous period metrics
    const previousTotal = previousExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const previousCount = previousExpenses.length;
    const previousAverage = previousCount > 0 ? previousTotal / previousCount : 0;

    return {
        totalExpenses: createComparisonMetrics(currentTotal, previousTotal),
        averageExpense: createComparisonMetrics(currentAverage, previousAverage),
        expenseCount: createComparisonMetrics(currentCount, previousCount)
    };
}

/**
 * Generate trend indicator (arrow, color, direction)
 */
export function getTrendIndicator(percentageChange: number, isPositiveBetter: boolean = true): {
    arrow: string;
    color: string;
    isPositive: boolean;
    label: string;
} {
    const isIncreasing = percentageChange > 0;
    const isPositive = isPositiveBetter ? isIncreasing : !isIncreasing;

    // Neutral if change is very small
    if (Math.abs(percentageChange) < 0.5) {
        return {
            arrow: '→',
            color: 'text-muted-foreground',
            isPositive: true,
            label: 'Sin cambios'
        };
    }

    return {
        arrow: isIncreasing ? '↑' : '↓',
        color: isPositive ? 'text-green-600' : 'text-red-600',
        isPositive,
        label: isIncreasing ? 'Aumento' : 'Disminución'
    };
}

/**
 * Format percentage change for display
 */
export function formatPercentageChange(percentageChange: number): string {
    const absChange = Math.abs(percentageChange);
    const sign = percentageChange > 0 ? '+' : '';
    return `${sign}${absChange.toFixed(1)}%`;
}
