"use client";

import { useMemo } from 'react';
import {
    differenceInDays,
    startOfWeek,
    endOfWeek,
    subWeeks,
    parseISO,
    isWithinInterval,
    addDays,
    format
} from 'date-fns';
import { es } from 'date-fns/locale';

// Types
interface Sale {
    id: string;
    date: string;
    totalAmount: number;
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

interface Product {
    id: string;
    name: string;
    stock: number;
    category?: string;
    unitPrice: number;
}

interface Customer {
    id: string;
    name: string;
    lastOrder?: string;
}

export interface Insight {
    id: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    category: 'trending' | 'inventory' | 'finance' | 'customer' | 'forecast';
    title: string;
    description: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    metrics?: {
        label: string;
        value: string | number;
        trend?: 'up' | 'down' | 'neutral';
    }[];
    actionable: boolean;
    actionLabel?: string;
    actionData?: any;
}

/**
 * Hook para generar insights automáticos del negocio
 */
export function useBusinessInsights(
    sales: Sale[],
    products: Product[],
    customers: Customer[],
    expenses: any[] = []
) {

    const insights = useMemo(() => {
        const generatedInsights: Insight[] = [];
        const today = new Date();

        // 1. TRENDING PRODUCTS - Productos en tendencia
        const trendingProducts = analyzeTrendingProducts(sales);
        trendingProducts.forEach((product, index) => {
            if (index < 3) { // Top 3
                generatedInsights.push({
                    id: `trending-${product.name}`,
                    type: 'success',
                    category: 'trending',
                    title: `🔥 ${product.name} - Producto en Tendencia`,
                    description: `Este producto ha aumentado sus ventas un ${product.growthPercent.toFixed(0)}% esta semana vs la semana anterior.`,
                    recommendation: product.stockStatus === 'low'
                        ? `¡ACCIÓN REQUERIDA! Stock actual: ${product.currentStock}. Considera aumentar el inventario antes de que se agote.`
                        : `Mantén suficiente stock. Ventas esta semana: ${product.currentWeekSales} unidades.`,
                    priority: product.stockStatus === 'low' ? 'high' : 'medium',
                    metrics: [
                        { label: 'Crecimiento', value: `+${product.growthPercent.toFixed(0)}%`, trend: 'up' },
                        { label: 'Ventas (semana)', value: product.currentWeekSales },
                        { label: 'Stock actual', value: product.currentStock }
                    ],
                    actionable: product.stockStatus === 'low',
                    actionLabel: 'Ver Producto',
                    actionData: { productId: product.productId }
                });
            }
        });

        // 2. DECLINING PRODUCTS - Productos con ventas decrecientes
        const decliningProducts = analyzeDecliningProducts(sales);
        decliningProducts.forEach((product, index) => {
            if (index < 2 && product.decline > 30) { // Solo si el decline es significativo
                generatedInsights.push({
                    id: `declining-${product.name}`,
                    type: 'warning',
                    category: 'trending',
                    title: `📉 ${product.name} - Ventas Decrecientes`,
                    description: `Las ventas han caído un ${product.decline.toFixed(0)}% esta semana.`,
                    recommendation: product.stockLevel === 'high'
                        ? 'Tienes inventario alto. Considera promociones o descuentos para mover el stock.'
                        : 'Evalúa si es estacional o necesita ajuste de precio.',
                    priority: product.stockLevel === 'high' ? 'high' : 'medium',
                    metrics: [
                        { label: 'Caída', value: `-${product.decline.toFixed(0)}%`, trend: 'down' },
                        { label: 'Ventas actuales', value: product.currentSales },
                        { label: 'Stock', value: product.stock }
                    ],
                    actionable: true,
                    actionLabel: 'Ver Producto'
                });
            }
        });

        // 3. LOW STOCK ALERTS - Alertas de stock bajo inteligentes
        const lowStockInsights = analyzeLowStock(products, sales);
        lowStockInsights.forEach(item => {
            generatedInsights.push({
                id: `lowstock-${item.productId}`,
                type: 'danger',
                category: 'inventory',
                title: `⚠️ Stock Crítico: ${item.name}`,
                description: `Solo quedan ${item.stock} unidades. ${item.daysUntilStockout > 0
                    ? `Se agotará en aproximadamente ${item.daysUntilStockout} días según ventas promedio.`
                    : 'Stock crítico - puede agotarse pronto.'}`,
                recommendation: `Reabastecer URGENTE. Ventas promedio diarias: ${item.avgDailySales.toFixed(1)} unidades.`,
                priority: 'high',
                metrics: [
                    { label: 'Stock actual', value: item.stock },
                    { label: 'Días restantes', value: item.daysUntilStockout > 0 ? item.daysUntilStockout : '< 1' },
                    { label: 'Venta diaria promedio', value: item.avgDailySales.toFixed(1) }
                ],
                actionable: true,
                actionLabel: 'Crear Orden de Compra'
            });
        });

        // 4. INACTIVE CUSTOMERS - Clientes inactivos
        const inactiveCustomers = analyzeInactiveCustomers(customers);
        if (inactiveCustomers.length > 0) {
            generatedInsights.push({
                id: 'inactive-customers',
                type: 'warning',
                category: 'customer',
                title: `👥 ${inactiveCustomers.length} Clientes Inactivos`,
                description: `Tienes ${inactiveCustomers.length} clientes que no han comprado en más de 30 días.`,
                recommendation: 'Considera campañas de reactivación: descuentos especiales, recordatorios personalizados, o contacto directo.',
                priority: 'medium',
                metrics: [
                    { label: 'Clientes inactivos', value: inactiveCustomers.length },
                    { label: 'Más inactivo', value: `${inactiveCustomers[0]?.name || 'N/A'}` }
                ],
                actionable: true,
                actionLabel: 'Ver Clientes Inactivos'
            });
        }

        // 5. PROFIT MARGIN ANALYSIS - Análisis de margen
        const profitAnalysis = analyzeProfitMargin(sales, expenses);
        if (profitAnalysis.margin < 20) {
            generatedInsights.push({
                id: 'profit-margin-low',
                type: 'warning',
                category: 'finance',
                title: '💰 Margen de Ganancia Bajo',
                description: `Tu margen de ganancia actual es ${profitAnalysis.margin.toFixed(1)}%, por debajo del objetivo de 20-30%.`,
                recommendation: 'Revisa precios de productos, negocia con proveedores, o reduce gastos operativos.',
                priority: 'high',
                metrics: [
                    { label: 'Margen actual', value: `${profitAnalysis.margin.toFixed(1)}%` },
                    { label: 'Objetivo', value: '20-30%' },
                    { label: 'Ingresos (mes)', value: `$${profitAnalysis.revenue.toFixed(2)}` },
                    { label: 'Gastos (mes)', value: `$${profitAnalysis.expenses.toFixed(2)}` }
                ],
                actionable: false
            });
        } else if (profitAnalysis.margin > 30) {
            generatedInsights.push({
                id: 'profit-margin-excellent',
                type: 'success',
                category: 'finance',
                title: '🎉 Excelente Margen de Ganancia',
                description: `¡Felicidades! Tu margen de ganancia es ${profitAnalysis.margin.toFixed(1)}%, por encima del objetivo.`,
                recommendation: 'Mantén esta tendencia. Considera reinvertir en inventario o marketing.',
                priority: 'low',
                metrics: [
                    { label: 'Margen actual', value: `${profitAnalysis.margin.toFixed(1)}%`, trend: 'up' }
                ],
                actionable: false
            });
        }

        // 6. REVENUE FORECAST - Pronóstico simple
        const forecast = forecastRevenue(sales);
        generatedInsights.push({
            id: 'revenue-forecast',
            type: 'info',
            category: 'forecast',
            title: '📊 Pronóstico de Ingresos',
            description: `Basado en tendencias recientes, se proyecta aproximadamente $${forecast.nextWeekProjection.toFixed(2)} en ingresos para la próxima semana.`,
            recommendation: forecast.trend === 'up'
                ? '¡Tendencia positiva! Asegúrate de tener suficiente inventario.'
                : forecast.trend === 'down'
                    ? 'Tendencia a la baja. Considera promociones o diversificación de productos.'
                    : 'Ventas estables. Mantén el curso actual.',
            priority: 'low',
            metrics: [
                { label: 'Proyección (próxima semana)', value: `$${forecast.nextWeekProjection.toFixed(2)}` },
                { label: 'Promedio actual', value: `$${forecast.currentAverage.toFixed(2)}` },
                { label: 'Tendencia', value: forecast.trend === 'up' ? '↗️ Subiendo' : forecast.trend === 'down' ? '↘️ Bajando' : '→ Estable' }
            ],
            actionable: false
        });

        // 7. BEST SELLING DAY - Mejor día de ventas
        const bestDay = analyzeBestSellingDay(sales);
        if (bestDay) {
            generatedInsights.push({
                id: 'best-selling-day',
                type: 'info',
                category: 'trending',
                title: `📅 Mejor Día: ${bestDay.dayName}`,
                description: `Históricamente, ${bestDay.dayName} es tu mejor día de ventas con un promedio de $${bestDay.avgRevenue.toFixed(2)}.`,
                recommendation: 'Asegúrate de tener stock completo los ' + bestDay.dayName + '. Considera promociones especiales ese día.',
                priority: 'low',
                metrics: [
                    { label: 'Día', value: bestDay.dayName },
                    { label: 'Ingresos promedio', value: `$${bestDay.avgRevenue.toFixed(2)}` }
                ],
                actionable: false
            });
        }

        // Ordenar por prioridad
        return generatedInsights.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

    }, [sales, products, customers, expenses]);

    return {
        insights,
        highPriorityCount: insights.filter(i => i.priority === 'high').length,
        actionableCount: insights.filter(i => i.actionable).length,
    };
}

// Helper functions

function analyzeTrendingProducts(sales: Sale[]) {
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(thisWeekStart, 1);
    const lastWeekEnd = subWeeks(thisWeekEnd, 1);

    const productSalesThisWeek: Record<string, { sales: number; name: string; stock: number }> = {};
    const productSalesLastWeek: Record<string, number> = {};

    // Contar ventas esta semana
    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: thisWeekStart, end: thisWeekEnd })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    if (!productSalesThisWeek[item.productId]) {
                        productSalesThisWeek[item.productId] = { sales: 0, name: item.productName, stock: 0 };
                    }
                    productSalesThisWeek[item.productId].sales += item.quantity;
                });
            });
        }
    });

    // Contar ventas semana pasada
    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: lastWeekStart, end: lastWeekEnd })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    productSalesLastWeek[item.productId] = (productSalesLastWeek[item.productId] || 0) + item.quantity;
                });
            });
        }
    });

    // Calcular tendencias
    const trends = Object.entries(productSalesThisWeek).map(([productId, data]) => {
        const lastWeek = productSalesLastWeek[productId] || 0;
        const growthPercent = lastWeek > 0 ? ((data.sales - lastWeek) / lastWeek) * 100 : 100;

        return {
            productId,
            name: data.name,
            currentWeekSales: data.sales,
            lastWeekSales: lastWeek,
            growthPercent,
            currentStock: data.stock,
            stockStatus: data.stock < data.sales * 0.5 ? 'low' : 'ok'
        };
    });

    return trends
        .filter(t => t.growthPercent > 10) // Solo productos con crecimiento > 10%
        .sort((a, b) => b.growthPercent - a.growthPercent);
}

function analyzeDecliningProducts(sales: Sale[]) {
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(thisWeekStart, 1);
    const lastWeekEnd = subWeeks(thisWeekEnd, 1);

    const productSalesThisWeek: Record<string, number> = {};
    const productSalesLastWeek: Record<string, number> = {};
    const productNames: Record<string, string> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        const isThisWeek = isWithinInterval(saleDate, { start: thisWeekStart, end: thisWeekEnd });
        const isLastWeek = isWithinInterval(saleDate, { start: lastWeekStart, end: lastWeekEnd });

        if (isThisWeek || isLastWeek) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    productNames[item.productId] = item.productName;
                    if (isThisWeek) {
                        productSalesThisWeek[item.productId] = (productSalesThisWeek[item.productId] || 0) + item.quantity;
                    }
                    if (isLastWeek) {
                        productSalesLastWeek[item.productId] = (productSalesLastWeek[item.productId] || 0) + item.quantity;
                    }
                });
            });
        }
    });

    const declining = Object.keys(productSalesLastWeek)
        .filter(productId => productSalesLastWeek[productId] > 5) // Solo productos con ventas significativas
        .map(productId => {
            const thisWeek = productSalesThisWeek[productId] || 0;
            const lastWeek = productSalesLastWeek[productId] || 0;
            const decline = lastWeek > 0 ? ((lastWeek - thisWeek) / lastWeek) * 100 : 0;

            return {
                productId,
                name: productNames[productId],
                currentSales: thisWeek,
                previousSales: lastWeek,
                decline,
                stock: 0,
                stockLevel: 'unknown' as 'high' | 'low' | 'unknown'
            };
        })
        .filter(p => p.decline > 20)
        .sort((a, b) => b.decline - a.decline);

    return declining;
}

function analyzeLowStock(products: Product[], sales: Sale[]) {
    const today = new Date();
    const last7Days = subWeeks(today, 1);

    const productSales: Record<string, number> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: last7Days, end: today })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
                });
            });
        }
    });

    const lowStockProducts = products
        .filter(p => p.stock < 20) // Stock bajo
        .map(product => {
            const weekSales = productSales[product.id] || 0;
            const avgDailySales = weekSales / 7;
            const daysUntilStockout = avgDailySales > 0 ? Math.floor(product.stock / avgDailySales) : 999;

            return {
                productId: product.id,
                name: product.name,
                stock: product.stock,
                avgDailySales,
                daysUntilStockout
            };
        })
        .filter(p => p.daysUntilStockout < 7 || p.avgDailySales > 2) // Críticos
        .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

    return lowStockProducts;
}

function analyzeInactiveCustomers(customers: Customer[]) {
    const today = new Date();
    const thirtyDaysAgo = addDays(today, -30);

    return customers
        .filter(c => c.lastOrder)
        .filter(c => {
            const lastOrderDate = parseISO(c.lastOrder!);
            return lastOrderDate < thirtyDaysAgo;
        })
        .sort((a, b) => {
            const dateA = a.lastOrder ? parseISO(a.lastOrder) : new Date(0);
            const dateB = b.lastOrder ? parseISO(b.lastOrder) : new Date(0);
            return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 10); // Top 10 más inactivos
}

function analyzeProfitMargin(sales: Sale[], expenses: any[]) {
    const today = new Date();
    const thirtyDaysAgo = addDays(today, -30);

    const revenue = sales
        .filter(s => isWithinInterval(parseISO(s.date), { start: thirtyDaysAgo, end: today }))
        .reduce((sum, s) => sum + s.totalAmount, 0);

    const totalExpenses = expenses
        .filter((e: any) => isWithinInterval(parseISO(e.date), { start: thirtyDaysAgo, end: today }))
        .reduce((sum: number, e: any) => sum + e.amount, 0);

    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { revenue, expenses: totalExpenses, profit, margin };
}

function forecastRevenue(sales: Sale[]) {
    const today = new Date();
    const fourWeeksAgo = subWeeks(today, 4);

    const weeklySales = [];
    for (let i = 0; i < 4; i++) {
        const weekStart = subWeeks(today, i + 1);
        const weekEnd = subWeeks(today, i);

        const weekRevenue = sales
            .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
            .reduce((sum, s) => sum + s.totalAmount, 0);

        weeklySales.push(weekRevenue);
    }

    const currentAverage = weeklySales.reduce((a, b) => a + b, 0) / 4;

    // Simple linear regression
    const trend = weeklySales[0] > weeklySales[weeklySales.length - 1] ? 'up' :
        weeklySales[0] < weeklySales[weeklySales.length - 1] ? 'down' : 'stable';

    const trendMultiplier = trend === 'up' ? 1.05 : trend === 'down' ? 0.95 : 1;
    const nextWeekProjection = currentAverage * trendMultiplier;

    return { currentAverage, nextWeekProjection, trend };
}

function analyzeBestSellingDay(sales: Sale[]) {
    const daySales: Record<string, { total: number; count: number }> = {
        'Lunes': { total: 0, count: 0 },
        'Martes': { total: 0, count: 0 },
        'Miércoles': { total: 0, count: 0 },
        'Jueves': { total: 0, count: 0 },
        'Viernes': { total: 0, count: 0 },
        'Sábado': { total: 0, count: 0 },
        'Domingo': { total: 0, count: 0 }
    };

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        const dayName = format(saleDate, 'EEEE', { locale: es });
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

        if (daySales[capitalizedDay]) {
            daySales[capitalizedDay].total += sale.totalAmount;
            daySales[capitalizedDay].count += 1;
        }
    });

    const dayAverages = Object.entries(daySales).map(([day, data]) => ({
        dayName: day,
        avgRevenue: data.count > 0 ? data.total / data.count : 0
    }));

    return dayAverages.sort((a, b) => b.avgRevenue - a.avgRevenue)[0];
}
