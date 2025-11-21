import { AuditLog, AuditAction } from './types/user';

const AUDIT_LOGS_KEY = 'bakery_audit_logs';
const MAX_LOGS = 10000; // Mantener máximo 10,000 logs

/**
 * Registra una acción en el log de auditoría
 */
export function logAudit(params: {
    userId: string;
    userName: string;
    action: AuditAction;
    module: string;
    entityType: string;
    entityId?: string;
    changes?: { before: any; after: any };
    details?: string;
    branchId?: string;
}) {
    if (typeof window === 'undefined') return;

    const logs = getAuditLogs();

    const newLog: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...params,
    };

    logs.push(newLog);

    // Mantener solo los últimos MAX_LOGS logs
    if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
    }

    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));

    // Dispatch evento para actualizar UI si está mostrando logs
    window.dispatchEvent(new CustomEvent('audit-log-added', { detail: newLog }));
}

/**
 * Obtiene los logs de auditoría con filtros opcionales
 */
export function getAuditLogs(filters?: {
    userId?: string;
    module?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    limit?: number;
}): AuditLog[] {
    if (typeof window === 'undefined') return [];

    const logsJson = localStorage.getItem(AUDIT_LOGS_KEY);
    let logs: AuditLog[] = logsJson ? JSON.parse(logsJson) : [];

    if (filters) {
        logs = logs.filter(log => {
            if (filters.userId && log.userId !== filters.userId) return false;
            if (filters.module && log.module !== filters.module) return false;
            if (filters.action && log.action !== filters.action) return false;
            if (filters.branchId && log.branchId !== filters.branchId) return false;
            if (filters.startDate && new Date(log.timestamp) < filters.startDate) return false;
            if (filters.endDate && new Date(log.timestamp) > filters.endDate) return false;
            return true;
        });
    }

    // Ordenar por timestamp descendente (más recientes primero)
    logs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Aplicar límite si se especifica
    if (filters?.limit) {
        logs = logs.slice(0, filters.limit);
    }

    return logs;
}

/**
 * Obtiene estadísticas de auditoría
 */
export function getAuditStats() {
    const logs = getAuditLogs();

    const stats = {
        total: logs.length,
        byAction: {} as Record<string, number>,
        byModule: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
        recent: logs.slice(0, 10), // Últimos 10 logs
    };

    logs.forEach(log => {
        // Por acción
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

        // Por módulo
        stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;

        // Por usuario
        stats.byUser[log.userName] = (stats.byUser[log.userName] || 0) + 1;
    });

    return stats;
}

/**
 * Exporta logs de auditoría a CSV
 */
export function exportAuditLogsToCSV(filters?: Parameters<typeof getAuditLogs>[0]): string {
    const logs = getAuditLogs(filters);

    const headers = ['Fecha/Hora', 'Usuario', 'Acción', 'Módulo', 'Tipo', 'Detalles', 'Sede'];
    const rows = logs.map(log => [
        new Date(log.timestamp).toLocaleString('es-VE'),
        log.userName,
        log.action,
        log.module,
        log.entityType,
        log.details || '',
        log.branchId || 'N/A',
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

/**
 * Limpia logs antiguos (mantiene solo los últimos N días)
 */
export function cleanOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const logs = getAuditLogs();
    const filteredLogs = logs.filter(log =>
        new Date(log.timestamp) >= cutoffDate
    );

    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(filteredLogs));

    return {
        removed: logs.length - filteredLogs.length,
        remaining: filteredLogs.length,
    };
}

// Re-export tipos para conveniencia
export { AuditAction } from './types/user';
export type { AuditLog } from './types/user';
