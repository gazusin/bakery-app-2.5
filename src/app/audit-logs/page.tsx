"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { getAuditLogs, getAuditStats, exportAuditLogsToCSV } from '@/lib/audit';
import { AuditLog, AuditAction } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, Download, Filter, FileText, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function AuditLogsPage() {
    const { currentUser, isAdmin, isManager } = useUser();
    const { toast } = useToast();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    // Filters
    const [filterModule, setFilterModule] = useState<string>('all');
    const [filterAction, setFilterAction] = useState<string>('all');
    const [filterLimit, setFilterLimit] = useState<number>(50);

    const canViewLogs = isAdmin || isManager;

    useEffect(() => {
        if (canViewLogs) {
            refreshLogs();
            setStats(getAuditStats());
        }
    }, [canViewLogs, filterModule, filterAction, filterLimit]);

    const refreshLogs = () => {
        const filters: any = { limit: filterLimit };
        if (filterModule && filterModule !== 'all') filters.module = filterModule;
        if (filterAction && filterAction !== 'all') filters.action = filterAction as AuditAction;

        setLogs(getAuditLogs(filters));
    };

    const handleExportCSV = () => {
        try {
            const filters: any = {};
            if (filterModule && filterModule !== 'all') filters.module = filterModule;
            if (filterAction && filterAction !== 'all') filters.action = filterAction as AuditAction;

            const csvContent = exportAuditLogsToCSV(filters);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast({
                title: "Exportación Exitosa",
                description: "Los logs han sido exportados a CSV",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const getActionBadge = (action: AuditAction) => {
        const variants: Record<AuditAction, { variant: "default" | "secondary" | "destructive" | "outline" }> = {
            [AuditAction.CREATE]: { variant: 'default' },
            [AuditAction.UPDATE]: { variant: 'secondary' },
            [AuditAction.DELETE]: { variant: 'destructive' },
            [AuditAction.EXPORT]: { variant: 'outline' },
            [AuditAction.VIEW]: { variant: 'outline' },
            [AuditAction.LOGIN]: { variant: 'default' },
            [AuditAction.LOGOUT]: { variant: 'secondary' },
        };

        return <Badge variant={variants[action].variant}>{action}</Badge>;
    };

    const getModuleBadge = (module: string) => {
        return <Badge variant="outline">{module}</Badge>;
    };

    if (!canViewLogs) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle className="text-destructive">Acceso Denegado</CardTitle>
                        <CardDescription>
                            Solo administradores y gerentes pueden acceder a esta página.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="h-8 w-8" />
                        Logs de Auditoría
                    </h1>
                    <p className="text-muted-foreground">
                        Historial completo de acciones realizadas en el sistema
                    </p>
                </div>

                <Button onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                </Button>
            </div>

            {/* Estadísticas */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Creaciones</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.byAction[AuditAction.CREATE] || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ediciones</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.byAction[AuditAction.UPDATE] || 0}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Eliminaciones</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.byAction[AuditAction.DELETE] || 0}</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="filter-module">Módulo</Label>
                            <Select value={filterModule} onValueChange={setFilterModule}>
                                <SelectTrigger id="filter-module">
                                    <SelectValue placeholder="Todos los módulos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="auth">Autenticación</SelectItem>
                                    <SelectItem value="users">Usuarios</SelectItem>
                                    <SelectItem value="ventas">Ventas</SelectItem>
                                    <SelectItem value="inventario">Inventario</SelectItem>
                                    <SelectItem value="gastos">Gastos</SelectItem>
                                    <SelectItem value="finanzas">Finanzas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-action">Acción</Label>
                            <Select value={filterAction} onValueChange={setFilterAction}>
                                <SelectTrigger id="filter-action">
                                    <SelectValue placeholder="Todas las acciones" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value={AuditAction.CREATE}>Crear</SelectItem>
                                    <SelectItem value={AuditAction.UPDATE}>Editar</SelectItem>
                                    <SelectItem value={AuditAction.DELETE}>Eliminar</SelectItem>
                                    <SelectItem value={AuditAction.EXPORT}>Exportar</SelectItem>
                                    <SelectItem value={AuditAction.VIEW}>Ver</SelectItem>
                                    <SelectItem value={AuditAction.LOGIN}>Login</SelectItem>
                                    <SelectItem value={AuditAction.LOGOUT}>Logout</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-limit">Límite</Label>
                            <Select value={filterLimit.toString()} onValueChange={(v) => setFilterLimit(Number(v))}>
                                <SelectTrigger id="filter-limit">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="500">500</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setFilterModule('all');
                                    setFilterAction('all');
                                    setFilterLimit(50);
                                }}
                            >
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla de Logs */}
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Acciones</CardTitle>
                    <CardDescription>
                        Mostrando {logs.length} registro{logs.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha/Hora</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Módulo</TableHead>
                                <TableHead>Detalles</TableHead>
                                <TableHead className="text-right">Ver</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-sm">
                                        {new Date(log.timestamp).toLocaleString('es-VE')}
                                    </TableCell>
                                    <TableCell>{log.userName}</TableCell>
                                    <TableCell>{getActionBadge(log.action)}</TableCell>
                                    <TableCell>{getModuleBadge(log.module)}</TableCell>
                                    <TableCell className="text-muted-foreground max-w-md truncate">
                                        {log.details || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {log.changes && (
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setSelectedLog(log)}
                                                    >
                                                        Ver Cambios
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Detalles del Cambio</DialogTitle>
                                                        <DialogDescription>
                                                            {log.action} en {log.module} - {new Date(log.timestamp).toLocaleString('es-VE')}
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <h4 className="font-semibold mb-2">Antes:</h4>
                                                            <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-60">
                                                                {JSON.stringify(log.changes?.before, null, 2)}
                                                            </pre>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-2">Después:</h4>
                                                            <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-60">
                                                                {JSON.stringify(log.changes?.after, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
