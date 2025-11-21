// Advanced Analytics for Reports Module
// This file contains utility functions for profitability and customer analytics

import { type Sale, type Recipe, calculateDynamicRecipeCost, calculatePackagingCost, KEYS, loadFromLocalStorageForBranch } from '@/lib/data-storage';
import { parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';
import type { DateRange } from "react-day-picker";

export interface ProductProfitabilityData {
    id: string;
    name: string;
    totalSold: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    marginPercent: number;
}

export interface CustomerStatsData {
    id: string;
    name: string;
    totalOrders: number;
    totalSpent: number;
    averageTicket: number;
    lastOrderDate: string | null;
}

/**
 * Calculate product profitability data from sales
 * Returns the top 10 most profitable products by total profit
 */
export function calculateProductProfitability(
    sales: Sale[],
    dateRange: DateRange | undefined,
    activeBranchId: string | null
): ProductProfitabilityData[] {
    // Filter sales by date range if specified
    let filteredSales = sales;
    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        filteredSales = sales.filter(sale => {
            const saleDate = parseISO(sale.date);
            return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
        });
    }

    // Get all recipes for cost calculation
    const allRecipes = activeBranchId ? loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchId) : [];

    // Aggregate sales data by product
    const productMap: {
        [productId: string]: {
            id: string;
            name: string;
            totalSold: number;
            totalRevenue: number;
            totalCost: number;
        }
    } = {};

    filteredSales.forEach(sale => {
        sale.itemsPerBranch.forEach(branchDetail => {
            branchDetail.items.forEach(item => {
                if (!item.productId || !item.productName) return;

                if (!productMap[item.productId]) {
                    productMap[item.productId] = {
                        id: item.productId,
                        name: item.productName,
                        totalSold: 0,
                        totalRevenue: 0,
                        totalCost: 0,
                    };
                }

                const quantity = item.quantity;
                const pricePerUnit = item.price / quantity; // item.price is total for quantity

                // Calculate cost per unit
                const recipe = allRecipes.find(r => r.productId === item.productId);
                let costPerUnit = 0;

                if (recipe && activeBranchId) {
                    const costData = calculateDynamicRecipeCost(activeBranchId, recipe, 1);
                    const ingredientCost = costData.costOfIngredientsPerUnit || 0;
                    const operatingCost = costData.operatingCostPerUnit || 0;
                    const packagingCost = calculatePackagingCost(1).maxCost;
                    costPerUnit = ingredientCost + operatingCost + packagingCost;
                }

                productMap[item.productId].totalSold += quantity;
                productMap[item.productId].totalRevenue += item.price;
                productMap[item.productId].totalCost += costPerUnit * quantity;
            });
        });
    });

    // Convert to array and calculate profit metrics
    const profitabilityData: ProductProfitabilityData[] = Object.values(productMap).map(product => {
        const totalProfit = product.totalRevenue - product.totalCost;
        const marginPercent = product.totalRevenue > 0 ? (totalProfit / product.totalRevenue) * 100 : 0;

        return {
            ...product,
            totalProfit,
            marginPercent,
        };
    });

    // Return top 10 by total profit
    return profitabilityData
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 10);
}

/**
 * Calculate customer purchase statistics
 * Returns the top 10 customers by total spending
 */
export function calculateCustomerStats(
    sales: Sale[],
    dateRange: DateRange | undefined
): CustomerStatsData[] {
    // Filter sales by date range if specified
    let filteredSales = sales;
    if (dateRange?.from) {
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        filteredSales = sales.filter(sale => {
            const saleDate = parseISO(sale.date);
            return isValid(saleDate) && isWithinInterval(saleDate, { start: from, end: to });
        });
    }

    // Aggregate by customer
    const customerMap: {
        [customerId: string]: {
            id: string;
            name: string;
            totalOrders: number;
            totalSpent: number;
            lastOrderDate: string | null;
        }
    } = {};

    filteredSales.forEach(sale => {
        const customerId = sale.customerId || 'WALK_IN';
        const customerName = sale.customerName || 'Cliente General';

        if (!customerMap[customerId]) {
            customerMap[customerId] = {
                id: customerId,
                name: customerName,
                totalOrders: 0,
                totalSpent: 0,
                lastOrderDate: null,
            };
        }

        customerMap[customerId].totalOrders += 1;
        customerMap[customerId].totalSpent += sale.total;

        // Update last order date
        const currentOrderDate = sale.date;
        if (!customerMap[customerId].lastOrderDate || currentOrderDate > customerMap[customerId].lastOrderDate!) {
            customerMap[customerId].lastOrderDate = currentOrderDate;
        }
    });

    // Convert to array and calculate average ticket
    const customerStats: CustomerStatsData[] = Object.values(customerMap).map(customer => ({
        ...customer,
        averageTicket: customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0,
    }));

    // Return top 10 by total spending
    return customerStats
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);
}
