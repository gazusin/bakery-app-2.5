"use client";

import { useMemo } from 'react';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    subMonths,
    isWithinInterval,
    parseISO,
    startOfDay,
    endOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';

interface Sale {
    id: string;
    date: string;
    totalAmount: number;
    timestamp?: string;
    itemsPerBranch: Array<{
        branchId: string;
        items: Array<{
            productId: string;
            productName: string;
            quantity: number;
            unitPrice: number;
            subtotal: number;
        }>;
    }>;
}

interface Expense {
    id: string;
    date: string;
    amount: number;
}

/**
 * Hook para calcular datos de analytics avanzados
 */
export function useAdvancedAnalytics(sales: Sale[], expenses: any[], exchangeRate: number = 1) {

    // 1. Datos de Ingresos vs Gastos (últimos 6 meses)
    const revenueVsExpensesData = useMemo(() => {
        const monthsData = [];
        const today = new Date();

        for (let i = 5; i >= 0; i--) {
            const monthDate = subMonths(today, i);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            const monthName = format(monthDate, 'MMM yy', { locale: es });

            // Calcular ingresos del mes
            const monthRevenue = sales
                .filter(sale => {
                    const saleDate = parseISO(sale.date);
                    return isWithinInterval(saleDate, { start: monthStart, end: monthEnd });
                })
                .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

            // Calcular gastos del mes
            const monthExpenses = expenses
                .filter((expense: any) => {
                    const expenseDate = parseISO(expense.date);
                    return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
                })
                .reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);

            monthsData.push({
                month: monthName,
                revenue: parseFloat(monthRevenue.toFixed(2)),
                expenses: parseFloat(monthExpenses.toFixed(2)),
                profit: parseFloat((monthRevenue - monthExpenses).toFixed(2)),
            });
        }

        return monthsData;
    }, [sales, expenses]);

    // 2. Top Productos (últimos 30 días)
    const topProductsData = useMemo(() => {
        const today = new Date();
        const thirtyDaysAgo = subMonths(today, 1);

        // Contar ventas por producto
        const productSales: Record<string, number> = {};

        sales.forEach(sale => {
            const saleDate = parseISO(sale.date);
            if (isWithinInterval(saleDate, { start: thirtyDaysAgo, end: today })) {
                sale.itemsPerBranch.forEach(branch => {
                    branch.items.forEach(item => {
                        const key = item.productName;
                        productSales[key] = (productSales[key] || 0) + item.quantity;
                    });
                });
            }
        });

        // Convertir a array y ordenar
        const sortedProducts = Object.entries(productSales)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8

        // Calcular porcentajes
        const total = sortedProducts.reduce((sum, p) => sum + p.value, 0);

        return sortedProducts.map(product => ({
            name: product.name.length > 20 ? product.name.substring(0, 17) + '...' : product.name,
            value: product.value,
            percentage: (product.value / total) * 100,
        }));
    }, [sales]);

    // 3. Tendencias diarias (últimos 30 días)
    const trendData = useMemo(() => {
        const today = new Date();
        const thirtyDaysAgo = subMonths(today, 1);
        const daysInterval = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

        return daysInterval.map(day => {
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);

            // Ingresos del día
            const dayRevenue = sales
                .filter(sale => {
                    const saleDate = parseISO(sale.date);
                    return isWithinInterval(saleDate, { start: dayStart, end: dayEnd });
                })
                .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);

            // Gastos del día
            const dayExpenses = expenses
                .filter((expense: any) => {
                    const expenseDate = parseISO(expense.date);
                    return isWithinInterval(expenseDate, { start: dayStart, end: dayEnd });
                })
                .reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0);

            return {
                date: format(day, 'dd/MM', { locale: es }),
                revenue: parseFloat(dayRevenue.toFixed(2)),
                expenses: parseFloat(dayExpenses.toFixed(2)),
                profit: parseFloat((dayRevenue - dayExpenses).toFixed(2)),
            };
        }).filter((_, index, arr) => {
            // Mostrar solo cada 3 días para no saturar el gráfico
            return index % 3 === 0 || index === arr.length - 1;
        });
    }, [sales, expenses]);

    // 4. Insights calculados
    const insights = useMemo(() => {
        const currentMonth = revenueVsExpensesData[revenueVsExpensesData.length - 1];
        const previousMonth = revenueVsExpensesData[revenueVsExpensesData.length - 2];

        if (!currentMonth || !previousMonth) {
            return {
                revenueGrowth: 0,
                profitGrowth: 0,
                expenseGrowth: 0,
                averageDailyRevenue: 0,
                topProduct: 'N/A',
                profitMargin: 0,
            };
        }

        const revenueGrowth = previousMonth.revenue > 0
            ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
            : 0;

        const profitGrowth = previousMonth.profit > 0
            ? ((currentMonth.profit - previousMonth.profit) / previousMonth.profit) * 100
            : 0;

        const expenseGrowth = previousMonth.expenses > 0
            ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
            : 0;

        const averageDailyRevenue = trendData.length > 0
            ? trendData.reduce((sum, day) => sum + day.revenue, 0) / trendData.length
            : 0;

        const profitMargin = currentMonth.revenue > 0
            ? (currentMonth.profit / currentMonth.revenue) * 100
            : 0;

        return {
            revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
            profitGrowth: parseFloat(profitGrowth.toFixed(1)),
            expenseGrowth: parseFloat(expenseGrowth.toFixed(1)),
            averageDailyRevenue: parseFloat(averageDailyRevenue.toFixed(2)),
            topProduct: topProductsData[0]?.name || 'N/A',
            profitMargin: parseFloat(profitMargin.toFixed(1)),
        };
    }, [revenueVsExpensesData, trendData, topProductsData]);

    return {
        revenueVsExpensesData,
        topProductsData,
        trendData,
        insights,
    };
}
