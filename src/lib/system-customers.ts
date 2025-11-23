/**
 * System customers for automatic loss tracking
 * These customers are created automatically and cannot be deleted
 */

"use client";

import { loadFromLocalStorage, KEYS } from './data-storage';
import type { Customer } from './types/db-types';

export const SYSTEM_CUSTOMERS = {
    CONSUMO_PANADERIA: 'Consumo panaderia',
    PRODUCTO_EXTRAVIADO: 'Producto extraviado',
    PRODUCTO_REGALADO: 'Producto regalado',
    DESPERDICIO: 'Desperdicio'
} as const;

export type SystemCustomerKey = keyof typeof SYSTEM_CUSTOMERS;

/**
 * Initialize system customers
 * Creates them if they don't exist
 */
export function initializeSystemCustomers(): void {
    const customers = loadFromLocalStorage<Customer[]>(KEYS.CUSTOMERS) || [];
    let needsSave = false;

    Object.values(SYSTEM_CUSTOMERS).forEach(customerName => {
        const exists = customers.some(c => c.name === customerName);

        if (!exists) {
            const newCustomer: Customer = {
                id: `SYSCUST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: customerName,
                contact: '', // System customers don't have contact info
                phone: '',
                email: '',
                address: '',
                notes: 'Cliente del sistema - No eliminar',
                isSystemCustomer: true,
                createdAt: new Date().toISOString()
            };

            customers.push(newCustomer);
            needsSave = true;
            console.log(`Created system customer: ${customerName}`);
        }
    });

    if (needsSave) {
        localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
        console.log('System customers initialized');
    }
}

/**
 * Check if a customer is a system customer
 */
export function isSystemCustomer(customerName: string): boolean {
    return Object.values(SYSTEM_CUSTOMERS).includes(customerName as any);
}

/**
 * Get category from system customer
 */
export function getCategoryFromSystemCustomer(customerName: string): string {
    switch (customerName) {
        case SYSTEM_CUSTOMERS.CONSUMO_PANADERIA:
            return 'Consumo Interno';
        case SYSTEM_CUSTOMERS.PRODUCTO_EXTRAVIADO:
            return 'Extraviado';
        case SYSTEM_CUSTOMERS.PRODUCTO_REGALADO:
            return 'Regalado';
        case SYSTEM_CUSTOMERS.DESPERDICIO:
            return 'Desperdicio';
        default:
            return 'Otro';
    }
}
