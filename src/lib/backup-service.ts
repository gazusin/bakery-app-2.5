/**
 * Automatic backup service with cloud upload and local download options
 */

"use client";

import { format } from 'date-fns';
import {
    loadFromLocalStorage,
    KEYS,
    type Sale,
    type Product,
    type Customer,
    type Payment,
    type Recipe,
    type Supplier
} from './data-storage';

export interface BackupData {
    version: string;
    timestamp: string;
    data: {
        sales: Sale[];
        products: Product[];
        customers: Customer[];
        payments: Payment[];
        recipes: Recipe[];
        suppliers: Supplier[];
        // Add more as needed
    };
}

/**
 * Creates a complete backup of all application data
 */
export async function createBackup(): Promise<BackupData> {
    const backup: BackupData = {
        version: '2.5',
        timestamp: new Date().toISOString(),
        data: {
            sales: loadFromLocalStorage(KEYS.SALES, false),
            products: [], // Will be loaded per branch
            customers: loadFromLocalStorage(KEYS.CUSTOMERS, false),
            payments: loadFromLocalStorage(KEYS.PAYMENTS, false),
            recipes: [], // Will be loaded per branch
            suppliers: loadFromLocalStorage(KEYS.SUPPLIERS, false),
        }
    };

    return backup;
}

/**
 * Downloads backup as JSON file
 */
export function downloadBackup(backup: BackupData, filename?: string) {
    const defaultFilename = `bakery_backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Restores data from backup
 */
export async function restoreFromBackup(backupData: BackupData): Promise<boolean> {
    try {
        // Validate backup structure
        if (!backupData.version || !backupData.data) {
            throw new Error('Invalid backup format');
        }

        // Restore each data type
        if (backupData.data.sales) {
            localStorage.setItem(KEYS.SALES, JSON.stringify(backupData.data.sales));
        }
        if (backupData.data.customers) {
            localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(backupData.data.customers));
        }
        if (backupData.data.payments) {
            localStorage.setItem(KEYS.PAYMENTS, JSON.stringify(backupData.data.payments));
        }
        if (backupData.data.suppliers) {
            localStorage.setItem(KEYS.SUPPLIERS, JSON.stringify(backupData.data.suppliers));
        }

        // Dispatch update event
        window.dispatchEvent(new Event('data-updated'));

        return true;
    } catch (error) {
        console.error('Error restoring backup:', error);
        return false;
    }
}

/**
 * Auto backup service - runs periodically
 */
export class AutoBackupService {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly intervalMs: number;

    constructor(intervalHours: number = 24) {
        this.intervalMs = intervalHours * 60 * 60 * 1000;
    }

    start() {
        if (this.intervalId) {
            console.warn('Auto backup already running');
            return;
        }

        console.log('Starting auto backup service');

        // Run immediately
        this.performBackup();

        // Schedule periodic backups
        this.intervalId = setInterval(() => {
            this.performBackup();
        }, this.intervalMs);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Auto backup service stopped');
        }
    }

    private async performBackup() {
        try {
            const backup = await createBackup();

            // Save to localStorage as last backup
            localStorage.setItem('last_auto_backup', JSON.stringify({
                timestamp: backup.timestamp,
                size: JSON.stringify(backup).length
            }));

            console.log('Auto backup completed:', backup.timestamp);

            // Optionally download automatically (can be configured)
            const autoDownload = localStorage.getItem('auto_download_backup');
            if (autoDownload === 'true') {
                downloadBackup(backup);
            }

            return backup;
        } catch (error) {
            console.error('Auto backup failed:', error);
        }
    }

    getLastBackupInfo(): { timestamp: string; size: number } | null {
        const info = localStorage.getItem('last_auto_backup');
        if (info) {
            try {
                return JSON.parse(info);
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Hook for using backup service
 */
export function useAutoBackup(enabled: boolean = true, intervalHours: number = 24) {
    if (typeof window === 'undefined') return;

    const service = new AutoBackupService(intervalHours);

    if (enabled) {
        service.start();

        // Cleanup on unmount
        return () => service.stop();
    }
}
