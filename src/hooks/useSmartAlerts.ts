/**
 * Smart alerts hook for intelligent notifications based on business rules
 */

"use client";

import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';

export interface AlertRule {
    id: string;
    condition: () => boolean;
    message: string; title: string;
    variant?: 'default' | 'destructive';
    icon?: string;
}

export function useSmartAlerts(
    lowStockCount: number,
    overdueCredits: number,
    monthlyRevenue: number,
    monthlyGoal: number,
    lowRawMaterialCount: number
) {
    const { toast } = useToast();
    const alertedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const alerts: AlertRule[] = [
            {
                id: 'low-stock-alert',
                condition: () => lowStockCount > 5,
                title: 'Stock Bajo',
                message: `⚠️ Tienes ${lowStockCount} productos con stock bajo`,
                variant: 'destructive',
            },
            {
                id: 'overdue-credits-alert',
                condition: () => overdueCredits > 0,
                title: 'Créditos Vencidos',
                message: `💰 Tienes créditos vencidos por $${overdueCredits.toFixed(2)}`,
                variant: 'destructive',
            },
            {
                id: 'monthly-goal-achieved',
                condition: () => monthlyRevenue >= monthlyGoal && monthlyGoal > 0,
                title: '¡Meta Alcanzada!',
                message: '🎉 ¡Felicitaciones! Has alcanzado tu meta mensual',
                variant: 'default',
            },
            {
                id: 'low-raw-materials',
                condition: () => lowRawMaterialCount > 3,
                title: 'Materia Prima Baja',
                message: `📦 Tienes ${lowRawMaterialCount} materias primas con stock bajo`,
                variant: 'destructive',
            },
        ];

        alerts.forEach(alert => {
            if (alert.condition() && !alertedRef.current.has(alert.id)) {
                toast({
                    title: alert.title,
                    description: alert.message,
                    variant: alert.variant,
                    duration: 8000,
                });
                alertedRef.current.add(alert.id);
            } else if (!alert.condition()) {
                // Reset alert when condition is no longer met
                alertedRef.current.delete(alert.id);
            }
        });
    }, [lowStockCount, overdueCredits, monthlyRevenue, monthlyGoal, lowRawMaterialCount, toast]);
}
