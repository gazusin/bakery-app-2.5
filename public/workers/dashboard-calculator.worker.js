/* eslint-disable no-restricted-globals */
import {
    startOfWeek,
    endOfWeek,
    isWithinInterval,
    parseISO,
    isValid,
    isAfter,
    isBefore,
    addDays,
    subDays,
    startOfToday,
    compareDesc,
    format
} from 'date-fns';

// Constants
const LOW_STOCK_THRESHOLD = 10;
const RAW_MATERIAL_LOW_STOCK_THRESHOLD = 5;
const CREDITS_DUE_SOON_DAYS = 3;
const TOP_N_PRODUCTS_DASHBOARD = 10;
const mainBakeryId = 'panaderia_principal';
const processedProductsId = 'productos_elaborados';

self.onmessage = (e) => {
    const {
        sales,
        payments,
        productsB1,
        productsB2,
        rawMaterialsB1,
        rawMaterialsB2,
        purchaseOrdersB1,
        purchaseOrdersB2,
        expensesB1,
        expensesB2,
        productionLogsB1,
        productionLogsB2,
        inventoryTransfers,
        pendingFundTransfers,
        availableBranches
    } = e.data;

    const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    const endOfCurrentWeek = endOfWeek(new Date(), { weekStartsOn: 1 });

    // Helper to calculate branch stats
    const calculateBranchStats = (
        branchId,
        branchSales,
        branchExpenses,
        branchProducts,
        branchRawMaterials,
        branchOrders
    ) => {
        // 1. Weekly Revenue
        const weeklyRevenue = branchSales.reduce((acc, sale) => {
            if (sale.timestamp && isValid(parseISO(sale.timestamp))) {
                const date = parseISO(sale.timestamp);
                if (isWithinInterval(date, { start: startOfCurrentWeek, end: endOfCurrentWeek })) {
                    // Filter by branch if needed, assuming sales passed are already filtered or global
                    // Logic from original hook: check paidToBranchId
                    if (sale.paidToBranchId === branchId) {
                        return acc + (sale.totalAmount || 0);
                    }
                }
            }
            return acc;
        }, 0);

        // 2. Estimated Weekly Loss (Simplified for worker: sum expenses in week)
        const estimatedWeeklyLoss = branchExpenses.reduce((acc, expense) => {
            if (expense.date && isValid(parseISO(expense.date))) {
                const date = parseISO(expense.date);
                if (isWithinInterval(date, { start: startOfCurrentWeek, end: endOfCurrentWeek })) {
                    return acc + (expense.amount || 0);
                }
            }
            return acc;
        }, 0);

        // 3. Profit
        const estimatedWeeklyProfit = weeklyRevenue - estimatedWeeklyLoss;

        // 4. Stock Counts
        const productsWithStockCount = branchProducts.filter(p => p.stock > 0).length;

        // 5. Low Stock
        const lowStockItems = branchProducts.filter(p => p.stock <= LOW_STOCK_THRESHOLD && p.stock > 0);
        const lowStockItemsCount = lowStockItems.length;
        const descriptionStock = branchProducts
            .filter(p => p.stock > 0)
            .sort((a, b) => b.stock - a.stock)
            .slice(0, 3)
            .map(p => `${p.name} (${p.stock})`)
            .join(", ");

        const descriptionLowStock = lowStockItems
            .slice(0, 3)
            .map(p => `${p.name} (${p.stock})`)
            .join(", ");

        // 6. Raw Materials
        const lowRawItems = branchRawMaterials.filter(m => m.currentStock <= RAW_MATERIAL_LOW_STOCK_THRESHOLD);
        const lowRawMaterialStockItemsCount = lowRawItems.length;
        const descriptionLowRaw = lowRawItems
            .slice(0, 3)
            .map(m => `${m.name} (${m.currentStock} ${m.unit})`)
            .join(", ");

        // 7. Pending Orders
        const pendingOrdersList = branchOrders.filter(po => po.status === 'Pedido' || po.status === 'Pendiente');
        const pendingOrders = pendingOrdersList.length;
        const descriptionPendingOrders = pendingOrders > 0
            ? `Total ${pendingOrders}. No recibidas o no pagadas.`
            : "Sin órdenes pendientes.";

        return {
            weeklyRevenue,
            estimatedWeeklyLoss,
            estimatedWeeklyProfit,
            productsWithStockCount,
            lowStockItemsCount,
            lowRawMaterialStockItemsCount,
            pendingOrders,
            descriptionStock,
            descriptionLowStock,
            descriptionLowRaw,
            descriptionPendingOrders
        };
    };

    const statsB1 = calculateBranchStats(
        mainBakeryId,
        sales,
        expensesB1,
        productsB1,
        rawMaterialsB1,
        purchaseOrdersB1
    );

    const statsB2 = calculateBranchStats(
        processedProductsId,
        sales,
        expensesB2,
        productsB2,
        rawMaterialsB2,
        purchaseOrdersB2
    );

    // Credits Logic
    const startOfTodayDate = startOfToday();
    let overdueAmount = 0;
    let dueSoonAmount = 0;

    sales.forEach(sale => {
        if (sale.paymentMethod === 'Crédito' && sale.dueDate) {
            const dueDate = parseISO(sale.dueDate);
            if (isValid(dueDate)) {
                const outstandingAmount = sale.totalAmount - (sale.amountPaidUSD || 0);
                if (outstandingAmount > 0) {
                    if (isBefore(dueDate, startOfTodayDate)) overdueAmount += outstandingAmount;
                    else if (isBefore(dueDate, addDays(startOfTodayDate, CREDITS_DUE_SOON_DAYS + 1)) && isAfter(dueDate, subDays(startOfTodayDate, 1))) dueSoonAmount += outstandingAmount;
                }
            }
        }
    });

    // Product Sales Chart
    const sevenDaysAgo = subDays(new Date(), 6);
    const productSales = {};

    sales.forEach(sale => {
        if (sale.date && isValid(parseISO(sale.date))) {
            const saleDate = parseISO(sale.date);
            if (isAfter(saleDate, subDays(sevenDaysAgo, 1)) && isBefore(saleDate, addDays(new Date(), 1))) {
                if (Array.isArray(sale.itemsPerBranch)) {
                    sale.itemsPerBranch.forEach(branchDetail => {
                        if (Array.isArray(branchDetail.items)) {
                            branchDetail.items.forEach(item => {
                                if (item.productName) productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
                            });
                        }
                    });
                }
            }
        }
    });

    const productSalesChartData = Object.entries(productSales)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, TOP_N_PRODUCTS_DASHBOARD);

    // Recent Activities
    let activities = [];

    // Sales
    sales.forEach(sale => {
        if (sale.timestamp && isValid(parseISO(sale.timestamp))) {
            activities.push({
                id: sale.id,
                type: "Venta",
                description: `Venta a ${sale.customerName || 'N/A'} por $${sale.totalAmount.toFixed(2)}`,
                date: sale.timestamp,
                rawDate: sale.timestamp, // Keep string for serialization, parse on client if needed or sort here
                branchName: sale.paidToBranchId ? availableBranches.find(b => b.id === sale.paidToBranchId)?.name || 'Global' : 'Global',
                iconType: 'ShoppingCart'
            });
        }
    });

    // Payments
    payments.filter(p => p.status === 'verificado').forEach(payment => {
        const pDate = payment.verificationDate || payment.creationTimestamp || payment.paymentDate;
        if (pDate && isValid(parseISO(pDate))) {
            activities.push({
                id: payment.id,
                type: "Pago",
                description: `Pago de ${payment.clientName || 'Cliente'} por $${payment.amountUSD.toFixed(2)}`,
                date: pDate,
                rawDate: pDate,
                branchName: 'Global',
                iconType: 'DollarSign'
            });
        }
    });

    // Production Logs
    [...productionLogsB1, ...productionLogsB2].forEach(log => {
        if (log.timestamp && isValid(parseISO(log.timestamp))) {
            activities.push({
                id: log.id,
                type: "Producción",
                description: `Producción de ${log.productName} (${log.quantityProduced})`,
                date: log.timestamp,
                rawDate: log.timestamp,
                branchName: log.branchId ? availableBranches.find(b => b.id === log.branchId)?.name || 'Sede' : 'Sede',
                iconType: 'Utensils'
            });
        }
    });

    // Expenses
    [...expensesB1, ...expensesB2].forEach(expense => {
        if (expense.date && isValid(parseISO(expense.date))) {
            activities.push({
                id: expense.id,
                type: "Gasto",
                description: `${expense.category}: ${expense.description} ($${expense.amount})`,
                date: expense.date,
                rawDate: expense.date,
                branchName: expense.branchId ? availableBranches.find(b => b.id === expense.branchId)?.name || 'Sede' : 'Sede',
                iconType: 'Receipt'
            });
        }
    });

    // Transfers
    pendingFundTransfers.forEach(transfer => {
        if (transfer.date && isValid(parseISO(transfer.date))) {
            activities.push({
                id: transfer.id,
                type: "Transferencia",
                description: `Transferencia de fondos: $${transfer.amount}`,
                date: transfer.date,
                rawDate: transfer.date,
                branchName: 'Global',
                iconType: 'Shuffle'
            });
        }
    });

    inventoryTransfers.forEach(transfer => {
        if (transfer.date && isValid(parseISO(transfer.date))) {
            activities.push({
                id: transfer.id,
                type: "Transferencia MP",
                description: `Transferencia MP: ${transfer.materialName} (${transfer.quantity})`,
                date: transfer.date,
                rawDate: transfer.date,
                branchName: 'Global',
                iconType: 'ArrowRightLeft'
            });
        }
    });

    // Sort and slice activities
    activities.sort((a, b) => {
        return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
    });

    activities = activities.slice(0, 5);

    self.postMessage({
        branch1Stats: statsB1,
        branch2Stats: statsB2,
        overdueCreditsAmountUSD: overdueAmount,
        creditsDueSoonAmountUSD: dueSoonAmount,
        productSalesChartData,
        recentActivities: activities
    });
};
