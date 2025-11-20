/**
 * Main dashboard data hook - Centralizes all dashboard calculations and data management
 * WORKER TEMPORARILY DISABLED FOR COMPATIBILITY
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    loadFromLocalStorageForBranch,
    availableBranches,
    KEYS,
    type Product,
    type PurchaseOrder,
    type RawMaterialInventoryItem,
    type Expense,
    type ProductionLogEntry,
} from '@/lib/data-storage';
import type { LucideIcon } from 'lucide-react';

const mainBakeryId = 'panaderia_principal';
const processedProductsId = 'productos_elaborados';

export interface BranchStats {
    weeklyRevenue: number;
    estimatedWeeklyLoss: number;
    estimatedWeeklyProfit: number;
    productsWithStockCount: number;
    lowStockItemsCount: number;
    lowRawMaterialStockItemsCount: number;
    pendingOrders: number;
    descriptionStock: string;
    descriptionLowStock: string;
    descriptionLowRaw: string;
    descriptionPendingOrders: string;
}

export interface ProductSalesData {
    name: string;
    quantity: number;
}

export interface ActivityItem {
    id: string;
    type: string;
    description: string;
    date: string;
    displayTime: string;
    icon?: LucideIcon;
    iconType?: string;
    rawDate: Date;
    branchName?: string;
}

export interface DashboardData {
    branch1Stats: BranchStats;
    branch2Stats: BranchStats;
    overdueCreditsAmountUSD: number;
    creditsDueSoonAmountUSD: number;
    productSalesChartData: ProductSalesData[];
    recentActivities: ActivityItem[];
    isLoading: boolean;
    refreshData: () => void;
}

export const useDashboardData = (): DashboardData => {
    const [dataVersion, setDataVersion] = useState(0);

    useEffect(() => {
        const handleDataUpdate = () => setDataVersion(v => v + 1);
        window.addEventListener('data-updated', handleDataUpdate);
        return () => window.removeEventListener('data-updated', handleDataUpdate);
    }, []);

    // Default stats when worker is disabled
    const defaultBranchStats: BranchStats = {
        weeklyRevenue: 0,
        estimatedWeeklyLoss: 0,
        estimatedWeeklyProfit: 0,
        productsWithStockCount: 0,
        lowStockItemsCount: 0,
        lowRawMaterialStockItemsCount: 0,
        pendingOrders: 0,
        descriptionStock: "Dashboard disponible pronto",
        descriptionLowStock: "Cargando...",
        descriptionLowRaw: "Cargando...",
        descriptionPendingOrders: "Cargando..."
    };

    const refreshData = useCallback(() => {
        setDataVersion(prev => prev + 1);
    }, []);

    return {
        branch1Stats: defaultBranchStats,
        branch2Stats: defaultBranchStats,
        overdueCreditsAmountUSD: 0,
        creditsDueSoonAmountUSD: 0,
        productSalesChartData: [],
        recentActivities: [],
        isLoading: false,
        refreshData
    };
};
