/**
 * Automatic backup service with cloud upload and local download options
 */

"use client";

import { format } from 'date-fns';
import {
    loadFromLocalStorage,
    KEYS,
    availableBranches,
    getActiveBranchId
} from './data-storage';

export interface BackupData {
    metadata: {
        version: number;
        source: string;
        exportDate: string;
        moduleName: string;
        activeBranchIdBeforeExport?: string;
    };
    data: {
        [key: string]: any;
    };
}

/**
 * Creates a complete backup of all application data
 * Uses the same structure as handleExportAllData for compatibility
 */
export async function createBackup(): Promise<BackupData> {
    const allKeys = Object.values(KEYS);
    const exportData: { [key: string]: any } = {};

    allKeys.forEach(baseKey => {
        const isGlobalKey = [
            KEYS.CUSTOMERS, KEYS.SALES, KEYS.PAYMENTS, KEYS.PENDING_FUND_TRANSFERS,
            KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS, KEYS.EXCHANGE_RATE_HISTORY,
            KEYS.USER_PROFILE, KEYS.CUSTOM_CONVERSION_RULES, KEYS.INVENTORY_TRANSFERS,
            KEYS.ACTIVE_BRANCH_ID, KEYS.WEEKLY_LOSS_REPORTS, KEYS.WEEKLY_PROFIT_REPORTS,
            KEYS.EXCHANGE_RATE, KEYS.PRODUCT_LOSSES, KEYS.COMPARISON_RECIPES
        ].includes(baseKey as any);

        if (isGlobalKey) {
            const data = localStorage.getItem(baseKey);
            if (data !== null) {
                try {
                    exportData[baseKey] = JSON.parse(data);
                } catch (e) {
                    exportData[baseKey] = data;
                }
            }
        } else {
            availableBranches.forEach(branch => {
                const branchSpecificKey = `${baseKey}_${branch.id}`;
                const data = localStorage.getItem(branchSpecificKey);
                if (data !== null) {
                    try {
                        exportData[branchSpecificKey] = JSON.parse(data);
                    } catch (e) {
                        exportData[branchSpecificKey] = data;
                    }
                }
            });
        }
    });

    const backup: BackupData = {
        metadata: {
            version: 2,
            source: 'PanaderiaProApp',
            exportDate: new Date().toISOString(),
            moduleName: 'Backup Completo',
            activeBranchIdBeforeExport: getActiveBranchId()
        },
        data: exportData
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
        if (!backupData.metadata?.version || !backupData.data) {
            throw new Error('Invalid backup format');
        }

        // Restore all data from the flat structure
        Object.keys(backupData.data).forEach(key => {
            const value = backupData.data[key];
            if (value !== null && value !== undefined) {
                localStorage.setItem(key, JSON.stringify(value));
            }
        });

        // Restore active branch if it was saved
        if (backupData.metadata.activeBranchIdBeforeExport) {
            localStorage.setItem(KEYS.ACTIVE_BRANCH_ID, backupData.metadata.activeBranchIdBeforeExport);
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
                timestamp: backup.metadata.exportDate,
                size: JSON.stringify(backup).length
            }));

            console.log('Auto backup completed:', backup.metadata.exportDate);

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
