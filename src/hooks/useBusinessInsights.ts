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
    expenses: any[] = [],
    recipes: Recipe[] = []
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

        // 8. PRODUCT PROFITABILITY - Rentabilidad por producto
        if (recipes.length > 0) {
            const profitableProducts = analyzeMostProfitableProducts(sales, recipes);
            profitableProducts.forEach((product, index) => {
                if (index < 3) {
                    generatedInsights.push({
                        id: `profitable-${product.productId}`,
                        type: 'success',
                        category: 'finance',
                        title: `💎 ${product.name} - Producto Rentable #${index + 1}`,
                        description: `Genera $${product.marginPerUnit.toFixed(2)} de margen por unidad (${product.marginPercent.toFixed(0)}% margen). Ventas: ${product.weeklySales} uds/semana = $${product.weeklyProfit.toFixed(2)} utilidad.`,
                        recommendation: product.marginPercent > 60
                            ? '¡Excelente rentabilidad! Considera incrementar producción.'
                            : product.marginPercent > 40
                                ? 'Rentabilidad saludable. Mantén este producto en tu mix.'
                                : 'Margen aceptable. Evalúa si puedes optimizar costos.',
                        priority: index === 0 ? 'medium' : 'low',
                        metrics: [
                            { label: 'Margen/unidad', value: `$${product.marginPerUnit.toFixed(2)}` },
                            { label: '% Margen', value: `${product.marginPercent.toFixed(0)}%`, trend: product.marginPercent > 50 ? 'up' : 'neutral' },
                            { label: 'Ventas semanales', value: `${product.weeklySales} un.` },
                            { label: 'Utilidad/semana', value: `$${product.weeklyProfit.toFixed(2)}` }
                        ],
                        actionable: !product.hasRecipe,
                        actionLabel: product.hasRecipe ? undefined : 'Agregar Receta'
                    });
                }
            });
        }

        // 9. SEASONAL PATTERNS - Patrones estacionales
        const seasonalPatterns = detectSeasonalPatterns(sales);
        seasonalPatterns.forEach((pattern, index) => {
            generatedInsights.push({
                id: `seasonal-${pattern.productId}`,
                type: 'info',
                category: 'forecast',
                title: `📅 ${pattern.name} - Patrón ${pattern.peakDays}`,
                description: `Este producto vende ${pattern.increasePercent}% más los ${pattern.peakDays} vs otros días. Patrón detectado con ${pattern.confidence}% de confianza.`,
                recommendation: pattern.pattern === 'weekend'
                    ? `Aumenta producción 30-40% los ${pattern.peakDays}. Asegura stock antes del fin de semana.`
                    : `Incrementa inventario específicamente para ${pattern.peakDays}.`,
                priority: pattern.increasePercent > 50 ? 'medium' : 'low',
                metrics: [
                    { label: 'Incremento', value: `+${pattern.increasePercent}%`, trend: 'up' },
                    { label: 'Días pico', value: pattern.peakDays },
                    { label: 'Confiabilidad', value: `${pattern.confidence}%` }
                ],
                actionable: false
            });
        });

        // 10. INVENTORY TURNOVER - Rotación de inventario
        const turnoverInsights = calculateInventoryTurnover(products, sales);
        turnoverInsights.forEach(item => {
            generatedInsights.push({
                id: `turnover-${item.productId}`,
                type: item.type,
                category: 'inventory',
                title: item.title,
                description: item.type === 'success'
                    ? `Rotación ${item.turnoverRate}x al mes. Este producto mueve capital eficientemente (${item.daysInStock} días en stock).`
                    : item.type === 'warning'
                        ? `Rotación ${item.turnoverRate}x al mes (${item.daysInStock} días en stock). Aceptable pero podría mejorar.`
                        : `Rotación lenta: ${item.turnoverRate}x al mes (${item.daysInStock} días en stock). Capital atascado.`,
                recommendation: item.type === 'danger'
                    ? '⚠️ ACCIÓN: Reduce producción o implementa promociones para mover stock más rápido.'
                    : item.type === 'success'
                        ? 'Modelo de referencia. Otros productos deberían aspirar a esta velocidad.'
                        : 'Evalúa si puedes reducir stock promedio o incrementar ventas.',
                priority: item.type === 'danger' ? 'high' : item.type === 'success' ? 'low' : 'medium',
                metrics: [
                    { label: 'Rotación mensual', value: `${item.turnoverRate}x` },
                    { label: 'Días en stock', value: item.daysInStock },
                    { label: 'Benchmark', value: item.benchmark }
                ],
                actionable: item.type === 'danger'
            });
        });

        // 11. OPPORTUNITY COST - Costo de oportunidad
        if (recipes.length > 0) {
            const opportunityCosts = calculateOpportunityCost(products, recipes, sales);
            opportunityCosts.forEach(opp => {
                generatedInsights.push({
                    id: opp.id,
                    type: 'warning',
                    category: 'finance',
                    title: opp.title,
                    description: `"${opp.productA}" genera $${opp.profitPerHourA}/h vs "${opp.productB}" con $${opp.profitPerHourB}/h (+${opp.percentDiff}% más rentable).`,
                    recommendation: `Reduce producción de "${opp.productA}" e incrementa "${opp.productB}". Ganancia estimada: +$${opp.dailyGainEstimate}/día.`,
                    priority: opp.percentDiff > 50 ? 'medium' : 'low',
                    metrics: [
                        { label: `${opp.productA} ($/h)`, value: `$${opp.profitPerHourA}` },
                        { label: `${opp.productB} ($/h)`, value: `$${opp.profitPerHourB}`, trend: 'up' },
                        { label: 'Diferencia', value: `+${opp.percentDiff}%` },
                        { label: 'Ganancia extra/día', value: `$${opp.dailyGainEstimate}` }
                    ],
                    actionable: true,
                    actionLabel: 'Ajustar Producción'
                });
            });
        }

        // Ordenar por prioridad
        return generatedInsights.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

    }, [sales, products, customers, expenses, recipes]);

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

// ===== NUEVOS INSIGHTS ESTRATÉGICOS =====

interface Recipe {
    id: string;
    name: string;
    costPerUnit: number;
}

/**
 * 1. Analiza los productos más rentables
 * Calcula margen por unidad y utilidad total
 */
function analyzeMostProfitableProducts(sales: Sale[], recipes: Recipe[]) {
    const today = new Date();
    const oneWeekAgo = subWeeks(today, 1);

    // Calcular ventas y rentabilidad por producto
    const productProfitability: Record<string, {
        productName: string;
        totalSales: number;
        totalRevenue: number;
        totalCost: number;
        avgSalePrice: number;
        costPerUnit: number;
    }> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: oneWeekAgo, end: today })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    if (!productProfitability[item.productId]) {
                        const recipe = recipes.find(r =>
                            r.name.toLowerCase() === item.productName.toLowerCase()
                        );
                        const cost = recipe?.costPerUnit || item.unitPrice * 0.4; // Estimar 40% si no hay receta

                        productProfitability[item.productId] = {
                            productName: item.productName,
                            totalSales: 0,
                            totalRevenue: 0,
                            totalCost: 0,
                            avgSalePrice: item.unitPrice,
                            costPerUnit: cost
                        };
                    }

                    const data = productProfitability[item.productId];
                    data.totalSales += item.quantity;
                    data.totalRevenue += item.subtotal;
                    data.totalCost += data.costPerUnit * item.quantity;
                });
            });
        }
    });

    // Calcular métricas de rentabilidad
    const profitableProducts = Object.entries(productProfitability)
        .map(([productId, data]) => {
            const marginPerUnit = data.avgSalePrice - data.costPerUnit;
            const marginPercent = data.avgSalePrice > 0
                ? (marginPerUnit / data.avgSalePrice) * 100
                : 0;
            const totalProfit = data.totalRevenue - data.totalCost;

            return {
                productId,
                name: data.productName,
                costPerUnit: data.costPerUnit,
                avgSalePrice: data.avgSalePrice,
                marginPerUnit,
                marginPercent,
                weeklySales: data.totalSales,
                weeklyProfit: totalProfit,
                hasRecipe: recipes.some(r => r.name.toLowerCase() === data.productName.toLowerCase())
            };
        })
        .filter(p => p.weeklySales > 5 && p.marginPercent > 0) // Solo productos con ventas significativas
        .sort((a, b) => b.weeklyProfit - a.weeklyProfit); // Ordenar por utilidad total

    return profitableProducts.slice(0, 3); // Top 3
}

/**
 * 2. Detecta patrones estacionales (día de semana)
 * Identifica productos que venden más en ciertos días
 */
function detectSeasonalPatterns(sales: Sale[]) {
    const today = new Date();
    const fourWeeksAgo = subWeeks(today, 4);

    // Agrupar ventas por producto y día de semana
    const productDaySales: Record<string, {
        name: string;
        byDay: Record<string, number[]>; // día => [semana1, semana2, ...]
    }> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: fourWeeksAgo, end: today })) {
            const dayName = format(saleDate, 'EEEE', { locale: es });
            const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    if (!productDaySales[item.productId]) {
                        productDaySales[item.productId] = {
                            name: item.productName,
                            byDay: {
                                'Lunes': [], 'Martes': [], 'Miércoles': [],
                                'Jueves': [], 'Viernes': [], 'Sábado': [], 'Domingo': []
                            }
                        };
                    }

                    if (!productDaySales[item.productId].byDay[capitalizedDay]) {
                        productDaySales[item.productId].byDay[capitalizedDay] = [];
                    }

                    productDaySales[item.productId].byDay[capitalizedDay].push(item.quantity);
                });
            });
        }
    });

    // Analizar patrones
    const patterns = [];

    for (const [productId, data] of Object.entries(productDaySales)) {
        const dayAverages: Record<string, number> = {};

        // Calcular promedio por día
        Object.entries(data.byDay).forEach(([day, sales]) => {
            dayAverages[day] = sales.length > 0
                ? sales.reduce((a, b) => a + b, 0) / sales.length
                : 0;
        });

        // Calcular promedio general
        const overallAvg = Object.values(dayAverages).reduce((a, b) => a + b, 0) / 7;

        // Buscar días con incremento significativo (>30%)
        const peakDays = Object.entries(dayAverages)
            .filter(([_, avg]) => avg > overallAvg * 1.3)
            .map(([day, _]) => day);

        if (peakDays.length > 0 && overallAvg > 2) { // Solo si hay ventas consistentes
            const peakAvg = peakDays.reduce((sum, day) => sum + dayAverages[day], 0) / peakDays.length;
            const increasePercent = ((peakAvg - overallAvg) / overallAvg) * 100;

            // Calcular confianza (consistencia de ventas)
            const allSales = Object.values(data.byDay).flat();
            const stdDev = Math.sqrt(
                allSales.reduce((sum, val) => sum + Math.pow(val - overallAvg, 2), 0) / allSales.length
            );
            const confidence = Math.max(0, Math.min(100, 100 - (stdDev / overallAvg) * 50));

            patterns.push({
                productId,
                name: data.name,
                pattern: peakDays.length >= 2 ? 'weekend' as const : 'specific-day' as const,
                peakDays: peakDays.join(', '),
                increasePercent: Math.round(increasePercent),
                confidence: Math.round(confidence),
                overallAvg
            });
        }
    }

    return patterns
        .filter(p => p.confidence > 60) // Solo patrones confiables
        .sort((a, b) => b.increasePercent - a.increasePercent)
        .slice(0, 3); // Top 3 patrones más fuertes
}

/**
 * 3. Calcula velocidad de rotación de inventario
 * Identifica productos que rotan rápido vs lento
 */
function calculateInventoryTurnover(products: Product[], sales: Sale[]) {
    const today = new Date();
    const thirtyDaysAgo = subWeeks(today, 4);

    // Calcular ventas mensuales por producto
    const monthlySales: Record<string, number> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: thirtyDaysAgo, end: today })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    monthlySales[item.productId] = (monthlySales[item.productId] || 0) + item.quantity;
                });
            });
        }
    });

    const turnoverAnalysis = products
        .filter(p => p.stock > 0 && monthlySales[p.id]) // Solo productos con stock y ventas
        .map(product => {
            const monthSales = monthlySales[product.id] || 0;
            const avgStock = product.stock; // Simplificado: usar stock actual

            // Rotación = Ventas / Stock promedio
            const turnoverRate = avgStock > 0 ? monthSales / avgStock : 0;
            const daysInStock = turnoverRate > 0 ? 30 / turnoverRate : 999;

            let type: 'success' | 'warning' | 'danger' = 'success';
            let title = '';
            let benchmark = '15-20x óptimo';

            if (turnoverRate >= 15) {
                type = 'success';
                title = `⚡ ${product.name} - Rotación Óptima`;
            } else if (turnoverRate >= 8) {
                type = 'warning';
                title = `🔄 ${product.name} - Rotación Normal`;
                benchmark = '8-15x aceptable';
            } else {
                type = 'danger';
                title = `🐌 ${product.name} - Rotación Lenta`;
                benchmark = '<8x bajo';
            }

            return {
                productId: product.id,
                name: product.name,
                type,
                title,
                turnoverRate: Math.round(turnoverRate * 10) / 10,
                daysInStock: Math.round(daysInStock * 10) / 10,
                benchmark,
                monthSales
            };
        })
        .sort((a, b) => {
            // Priorizar extremos: muy rápido (éxito) y muy lento (problema)
            if (a.type === 'danger' && b.type !== 'danger') return -1;
            if (b.type === 'danger' && a.type !== 'danger') return 1;
            if (a.type === 'success' && b.type !== 'success') return -1;
            if (b.type === 'success' && a.type !== 'success') return 1;
            return b.turnoverRate - a.turnoverRate;
        });

    return turnoverAnalysis.slice(0, 3); // Top 3 casos relevantes
}

/**
 * 4. Calcula costo de oportunidad
 * Compara productos para optimizar recursos de producción
 */
function calculateOpportunityCost(products: Product[], recipes: Recipe[], sales: Sale[]) {
    const today = new Date();
    const twoWeeksAgo = subWeeks(today, 2);

    // Calcular margen y volumen por producto
    const productMetrics: Record<string, {
        name: string;
        margin: number;
        weeklySales: number;
        category?: string;
    }> = {};

    sales.forEach(sale => {
        const saleDate = parseISO(sale.date);
        if (isWithinInterval(saleDate, { start: twoWeeksAgo, end: today })) {
            sale.itemsPerBranch.forEach(branch => {
                branch.items.forEach(item => {
                    const recipe = recipes.find(r =>
                        r.name.toLowerCase() === item.productName.toLowerCase()
                    );
                    const cost = recipe?.costPerUnit || item.unitPrice * 0.4;
                    const margin = item.unitPrice - cost;

                    if (!productMetrics[item.productId]) {
                        productMetrics[item.productId] = {
                            name: item.productName,
                            margin,
                            weeklySales: 0,
                            category: products.find(p => p.id === item.productId)?.category
                        };
                    }

                    productMetrics[item.productId].weeklySales += item.quantity;
                });
            });
        }
    });

    // Estimar $/hora (simplificado: asumiendo 1h producción promedio)
    // En la realidad, esto debería venir de datos de producción reales
    const productsByCategory: Record<string, Array<{ id: string; name: string; profitPerHour: number; weeklySales: number }>> = {};

    Object.entries(productMetrics).forEach(([productId, data]) => {
        const category = data.category || 'General';
        const profitPerHour = data.margin * (data.weeklySales / 7 / 8); // Asumiendo 8h/día

        if (!productsByCategory[category]) {
            productsByCategory[category] = [];
        }

        productsByCategory[category].push({
            id: productId,
            name: data.name,
            profitPerHour,
            weeklySales: data.weeklySales
        });
    });

    // Buscar oportunidades de optimización
    const opportunities = [];

    Object.entries(productsByCategory).forEach(([category, products]) => {
        if (products.length >= 2) {
            // Ordenar por rentabilidad/hora
            products.sort((a, b) => b.profitPerHour - a.profitPerHour);

            const best = products[0];
            const worst = products[products.length - 1];

            // Solo sugerir si la diferencia es significativa (>30%)
            if (worst.profitPerHour > 0 &&
                best.profitPerHour / worst.profitPerHour > 1.3 &&
                worst.weeklySales > 5) { // El producto "malo" tiene ventas

                const percentDiff = Math.round(((best.profitPerHour - worst.profitPerHour) / worst.profitPerHour) * 100);
                const dailyGainEstimate = (best.profitPerHour - worst.profitPerHour) * 2; // 2h reasignadas

                opportunities.push({
                    id: `opp-${category}`,
                    title: `⏰ Optimiza: ${category}`,
                    productA: worst.name,
                    productB: best.name,
                    profitPerHourA: Math.round(worst.profitPerHour * 100) / 100,
                    profitPerHourB: Math.round(best.profitPerHour * 100) / 100,
                    percentDiff,
                    dailyGainEstimate: Math.round(dailyGainEstimate * 100) / 100,
                    recommendSwitch: true
                });
            }
        }
    });

    return opportunities.slice(0, 2); // Top 2 oportunidades
}

