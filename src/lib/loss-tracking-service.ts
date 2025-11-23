/**
 * Service for automatic loss tracking
 * Registers losses from sales to system customers and "No Despachable" products
 */

"use client";

import { KEYS } from './data-storage';
import type { Sale, SaleItem } from './types/db-types';
import { SYSTEM_CUSTOMERS, getCategoryFromSystemCustomer, isSystemCustomer } from './system-customers';

export interface LossRecord {
    id: string;
    productName: string;
    quantity: number;
    category: string;
    date: string;
    cost: number;
    notes: string;
    saleId?: string;
}

/**
 * Register losses from a sale
 * Automatically called after confirming a sale
 */
export function registerLossesFromSale(sale: Sale): void {
    if (typeof window === 'undefined') return;

    try {
        const losses: LossRecord[] = [];
        const isSystemCustomerSale = sale.customerName && isSystemCustomer(sale.customerName);

        // Process all items in the sale
        if (sale.itemsPerBranch && Array.isArray(sale.itemsPerBranch)) {
            sale.itemsPerBranch.forEach(branchDetail => {
                if (branchDetail.items && Array.isArray(branchDetail.items)) {
                    branchDetail.items.forEach(item => {
                        // Check if this item should be registered as a loss
                        const isNoDispatchable = item.productName.toLowerCase().startsWith('no despachable');

                        if (isSystemCustomerSale || isNoDispatchable) {
                            let productName = item.productName;
                            let category = 'Otro';

                            // Extract base product name if it's "No Despachable"
                            if (isNoDispatchable) {
                                const match = item.productName.match(/^no\s*despachable\s+(.*)/i);
                                if (match && match[1]) {
                                    productName = match[1].trim();
                                }
                                category = 'Desperdicio - No Despachable';
                            }

                            // Get category from system customer if applicable
                            if (isSystemCustomerSale && sale.customerName) {
                                category = getCategoryFromSystemCustomer(sale.customerName);
                            }

                            const loss: LossRecord = {
                                id: `LOSS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                productName,
                                quantity: item.quantity,
                                category,
                                date: sale.date,
                                cost: item.subtotal, // Using subtotal as cost
                                notes: `Auto-generado desde venta ${sale.id}${sale.customerName ? ` a ${sale.customerName}` : ''}`,
                                saleId: sale.id
                            };

                            losses.push(loss);
                            console.log(`📊 Registered loss: ${productName} x${item.quantity} - ${category}`);
                        }
                    });
                }
            });
        }

        // Save losses to localStorage
        if (losses.length > 0) {
            const existingLosses = JSON.parse(localStorage.getItem(KEYS.PRODUCT_LOSSES) || '[]');
            const updatedLosses = [...existingLosses, ...losses];
            localStorage.setItem(KEYS.PRODUCT_LOSSES, JSON.stringify(updatedLosses));

            console.log(`✅ Registered ${losses.length} loss(es) from sale ${sale.id}`);

            // Dispatch event to notify components
            window.dispatchEvent(new CustomEvent('data-updated', {
                detail: { key: KEYS.PRODUCT_LOSSES }
            }));
        }
    } catch (error) {
        console.error('❌ Error registering losses from sale:', error);
    }
}

/**
 * Get all losses from localStorage
 */
export function getAllLosses(): LossRecord[] {
    if (typeof window === 'undefined') return [];

    try {
        return JSON.parse(localStorage.getItem(KEYS.PRODUCT_LOSSES) || '[]');
    } catch {
        return [];
    }
}

/**
 * Get losses by date range
 */
export function getLossesByDateRange(startDate: Date, endDate: Date): LossRecord[] {
    const allLosses = getAllLosses();

    return allLosses.filter(loss => {
        const lossDate = new Date(loss.date);
        return lossDate >= startDate && lossDate <= endDate;
    });
}

/**
 * Get losses by category
 */
export function getLossesByCategory(category: string): LossRecord[] {
    const allLosses = getAllLosses();

    return allLosses.filter(loss => loss.category === category);
}

/**
 * Get total cost of losses
 */
export function getTotalLossCost(losses?: LossRecord[]): number {
    const lossesToCalculate = losses || getAllLosses();

    return lossesToCalculate.reduce((total, loss) => total + loss.cost, 0);
}
