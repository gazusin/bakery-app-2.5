"use client";

import { useCallback } from 'react';
import { logAudit, AuditAction } from '@/lib/audit';
import { getCurrentUser } from '@/lib/user-management';

/**
 * Hook para registrar acciones en el log de auditoría
 */
export function useAudit() {
    const log = useCallback((params: {
        action: AuditAction;
        module: string;
        entityType: string;
        entityId?: string;
        changes?: { before: any; after: any };
        details?: string;
        branchId?: string;
    }) => {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            console.warn('No hay usuario actual para registrar auditoría');
            return;
        }

        logAudit({
            userId: currentUser.id,
            userName: currentUser.fullName,
            ...params,
        });
    }, []);

    /**
     * Registra una creación
     */
    const logCreate = useCallback((
        module: string,
        entityType: string,
        entityId: string,
        details?: string,
        branchId?: string
    ) => {
        log({
            action: AuditAction.CREATE,
            module,
            entityType,
            entityId,
            details,
            branchId,
        });
    }, [log]);

    /**
     * Registra una actualización
     */
    const logUpdate = useCallback((
        module: string,
        entityType: string,
        entityId: string,
        changes?: { before: any; after: any },
        details?: string,
        branchId?: string
    ) => {
        log({
            action: AuditAction.UPDATE,
            module,
            entityType,
            entityId,
            changes,
            details,
            branchId,
        });
    }, [log]);

    /**
     * Registra una eliminación
     */
    const logDelete = useCallback((
        module: string,
        entityType: string,
        entityId: string,
        details?: string,
        branchId?: string
    ) => {
        log({
            action: AuditAction.DELETE,
            module,
            entityType,
            entityId,
            details,
            branchId,
        });
    }, [log]);

    /**
     * Registra una exportación
     */
    const logExport = useCallback((
        module: string,
        details?: string,
        branchId?: string
    ) => {
        log({
            action: AuditAction.EXPORT,
            module,
            entityType: 'export',
            details,
            branchId,
        });
    }, [log]);

    return {
        log,
        logCreate,
        logUpdate,
        logDelete,
        logExport,
    };
}
