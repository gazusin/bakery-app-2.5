import { ComparisonMetrics, SalesComparisonMetrics, ExpensesComparisonMetrics, AllComparisonMetrics } from './comparative-analytics';

export interface Insight {
    id: string;
    type: 'warning' | 'opportunity' | 'success' | 'info';
    title: string;
    description: string;
    metrics?: { label: string; value: string }[];
    priority: 'high' | 'medium' | 'low';
    icon: string;
}

/**
 * Generate all insights from comparative data
 */
export function generateInsights(comparisonData: AllComparisonMetrics): Insight[] {
    const insights: Insight[] = [];

    // Revenue insights
    insights.push(...generateRevenueInsights(comparisonData.sales));

    // Expense insights
    insights.push(...generateExpenseInsights(comparisonData.expenses));

    // Order insights
    insights.push(...generateOrderInsights(comparisonData.sales));

    // Sort by priority
    return insights.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

/**
 * Generate revenue-related insights
 */
function generateRevenueInsights(sales: SalesComparisonMetrics): Insight[] {
    const insights: Insight[] = [];
    const revenueChange = sales.totalRevenue.percentageChange;

    // Significant revenue increase
    if (revenueChange > 20) {
        insights.push({
            id: 'revenue-growth',
            type: 'success',
            title: '🎉 Fuerte Crecimiento en Ventas',
            description: `Las ventas han aumentado un ${revenueChange.toFixed(1)}% comparado con el período anterior. ¡Excelente desempeño!`,
            metrics: [
                { label: 'Ventas Actuales', value: `$${sales.totalRevenue.current.toFixed(2)}` },
                { label: 'Ventas Anteriores', value: `$${sales.totalRevenue.previous.toFixed(2)}` },
                { label: 'Incremento', value: `$${sales.totalRevenue.change.toFixed(2)}` }
            ],
            priority: 'high',
            icon: '📈'
        });
    }

    // Moderate revenue increase
    else if (revenueChange > 10 && revenueChange <= 20) {
        insights.push({
            id: 'revenue-moderate-growth',
            type: 'opportunity',
            title: '📊 Crecimiento Moderado',
            description: `Las ventas muestran un crecimiento saludable del ${revenueChange.toFixed(1)}%. Continúa con las estrategias actuales.`,
            metrics: [
                { label: 'Incremento', value: `$${sales.totalRevenue.change.toFixed(2)}` }
            ],
            priority: 'medium',
            icon: '📊'
        });
    }

    // Significant revenue decline
    if (revenueChange < -15) {
        insights.push({
            id: 'revenue-decline',
            type: 'warning',
            title: '⚠️ Alerta: Caída en Ventas',
            description: `Las ventas han disminuido un ${Math.abs(revenueChange).toFixed(1)}%. Se recomienda revisar estrategias de venta y promociones.`,
            metrics: [
                { label: 'Ventas Actuales', value: `$${sales.totalRevenue.current.toFixed(2)}` },
                { label: 'Ventas Anteriores', value: `$${sales.totalRevenue.previous.toFixed(2)}` },
                { label: 'Disminución', value: `$${sales.totalRevenue.change.toFixed(2)}` }
            ],
            priority: 'high',
            icon: '⚠️'
        });
    }

    return insights;
}

/**
 * Generate expense-related insights
 */
function generateExpenseInsights(expenses: ExpensesComparisonMetrics): Insight[] {
    const insights: Insight[] = [];
    const expenseChange = expenses.totalExpenses.percentageChange;

    // Significant expense increase
    if (expenseChange > 25) {
        insights.push({
            id: 'expense-spike',
            type: 'warning',
            title: '💰 Aumento Significativo en Gastos',
            description: `Los gastos han aumentado un ${expenseChange.toFixed(1)}%. Revisa las categorías de gasto para identificar oportunidades de ahorro.`,
            metrics: [
                { label: 'Gastos Actuales', value: `$${expenses.totalExpenses.current.toFixed(2)}` },
                { label: 'Gastos Anteriores', value: `$${expenses.totalExpenses.previous.toFixed(2)}` },
                { label: 'Aumento', value: `$${expenses.totalExpenses.change.toFixed(2)}` }
            ],
            priority: 'high',
            icon: '💰'
        });
    }

    // Expense decrease (cost saving)
    if (expenseChange < -10) {
        insights.push({
            id: 'cost-savings',
            type: 'success',
            title: '💡 Ahorro en Costos',
            description: `Los gastos han disminuido un ${Math.abs(expenseChange).toFixed(1)}%. Excelente control de costos.`,
            metrics: [
                { label: 'Ahorro', value: `$${Math.abs(expenses.totalExpenses.change).toFixed(2)}` }
            ],
            priority: 'medium',
            icon: '💡'
        });
    }

    return insights;
}

/**
 * Generate order-related insights
 */
function generateOrderInsights(sales: SalesComparisonMetrics): Insight[] {
    const insights: Insight[] = [];
    const orderChange = sales.orderCount.percentageChange;
    const avgOrderChange = sales.averageOrderValue.percentageChange;

    // More orders but lower average value
    if (orderChange > 15 && avgOrderChange < -10) {
        insights.push({
            id: 'order-mix-shift',
            type: 'info',
            title: '🔄 Cambio en Patrón de Compra',
            description: `Hay más clientes (${orderChange.toFixed(1)}% más) pero con compras menores en promedio. Considera estrategias de upselling.`,
            metrics: [
                { label: 'Órdenes', value: `${sales.orderCount.current}` },
                { label: 'Ticket Promedio', value: `$${sales.averageOrderValue.current.toFixed(2)}` }
            ],
            priority: 'medium',
            icon: '🔄'
        });
    }

    // Fewer orders but higher average value
    if (orderChange < -10 && avgOrderChange > 10) {
        insights.push({
            id: 'premium-shift',
            type: 'opportunity',
            title: '💎 Clientes Premium',
            description: `Aunque hay menos clientes, están comprando más por orden. Enfócate en retener estos clientes de alto valor.`,
            metrics: [
                { label: 'Ticket Promedio', value: `$${sales.averageOrderValue.current.toFixed(2)}` },
                { label: 'Aumento', value: `${avgOrderChange.toFixed(1)}%` }
            ],
            priority: 'medium',
            icon: '💎'
        });
    }

    // Significant increase in average order value
    if (avgOrderChange > 20) {
        insights.push({
            id: 'avg-order-growth',
            type: 'success',
            title: '🎯 Mayor Valor por Cliente',
            description: `El valor promedio por orden ha aumentado ${avgOrderChange.toFixed(1)}%. Tus clientes están comprando más.`,
            metrics: [
                { label: 'Ticket Actual', value: `$${sales.averageOrderValue.current.toFixed(2)}` },
                { label: 'Ticket Anterior', value: `$${sales.averageOrderValue.previous.toFixed(2)}` }
            ],
            priority: 'medium',
            icon: '🎯'
        });
    }

    return insights;
}

/**
 * Get variant for Alert component based on insight type
 */
export function getAlertVariant(type: Insight['type']): 'default' | 'destructive' {
    return type === 'warning' ? 'destructive' : 'default';
}
