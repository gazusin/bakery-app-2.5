"use client";

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, TrendingUp, Calendar as CalendarIcon, Download } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { analyzeWaste, getActiveBranchId } from '@/lib/data-storage';
import type { WasteAnalysis } from '@/lib/data-storage';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

export default function WasteReportPage() {
    const [wasteData, setWasteData] = useState<WasteAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        return { from: start, to: end };
    });

    const loadWasteData = () => {
        if (!dateRange?.from || !dateRange?.to) return;

        setIsLoading(true);
        const data = analyzeWaste(dateRange.from, dateRange.to);
        setWasteData(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadWasteData();
    }, [dateRange]);

    const stats = useMemo(() => {
        const totalExpected = wasteData.reduce((sum, item) => sum + item.expectedYield, 0);
        const totalActual = wasteData.reduce((sum, item) => sum + item.actualYield, 0);
        const totalLoss = wasteData.reduce((sum, item) => sum + item.estimatedCostLoss, 0);
        const avgWaste = wasteData.length > 0
            ? wasteData.reduce((sum, item) => sum + item.wastePercent, 0) / wasteData.length
            : 0;

        const critical = wasteData.filter(w => w.status === 'critical').length;
        const warning = wasteData.filter(w => w.status === 'warning').length;
        const healthy = wasteData.filter(w => w.status === 'healthy').length;

        return { totalExpected, totalActual, totalLoss, avgWaste, critical, warning, healthy };
    }, [wasteData]);

    const getStatusBadge = (status: 'healthy' | 'warning' | 'critical') => {
        switch (status) {
            case 'healthy':
                return <Badge className="bg-green-500">Normal</Badge>;
            case 'warning':
                return <Badge className="bg-yellow-500">Advertencia</Badge>;
            case 'critical':
                return <Badge className="bg-red-500">Crítico</Badge>;
        }
    };

    const handleQuickRange = (weeks: number) => {
        const today = new Date();
        const end = endOfWeek(today, { weekStartsOn: 1 });
        const start = startOfWeek(subWeeks(end, weeks - 1), { weekStartsOn: 1 });
        setDateRange({ from: start, to: end });
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <PageHeader
                title="Reporte de Mermas vs Producción"
                description="Análisis de diferencias entre producción esperada y real"
            />

            {/* Date Range Selector */}
            <Card>
                <CardHeader>
                    <CardTitle>Seleccionar Período</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4 flex-wrap items-center">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "dd MMM yyyy", { locale: es })} -{" "}
                                            {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                                        </>
                                    ) : (
                                        format(dateRange.from, "dd MMM yyyy", { locale: es })
                                    )
                                ) : (
                                    <span>Seleccionar rango</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleQuickRange(1)}>
                            Esta Semana
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleQuickRange(4)}>
                            Último Mes
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleQuickRange(12)}>
                            3 Meses
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Merma Promedio</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.avgWaste > 10 ? 'text-red-600' : 'text-green-600'}`}>
                            {stats.avgWaste.toFixed(1)}%
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pérdida Estimada</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            <FormattedNumber value={stats.totalLoss} prefix="$" decimalPlaces={2} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-yellow-700">Advertencias</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-700">{stats.warning}</div>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-red-700">Críticos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Waste Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Análisis por Producto ({wasteData.length})</CardTitle>
                    <CardDescription>
                        Comparación de producción esperada vs real
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Cargando análisis...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Lotes</TableHead>
                                    <TableHead className="text-right">Esperado</TableHead>
                                    <TableHead className="text-right">Real</TableHead>
                                    <TableHead className="text-right">Diferencia</TableHead>
                                    <TableHead className="text-right">Merma %</TableHead>
                                    <TableHead className="text-right">Pérdida USD</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {wasteData.map((item, idx) => (
                                    <TableRow key={idx} className={
                                        item.status === 'critical' ? 'bg-red-50' :
                                            item.status === 'warning' ? 'bg-yellow-50' : ''
                                    }>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                        <TableCell className="text-right">{item.batchesProduced}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {item.expectedYield.toFixed(0)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {item.actualYield.toFixed(0)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono ${item.difference > 0 ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                            {item.difference > 0 ? '-' : '+'}{Math.abs(item.difference).toFixed(0)}
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${item.wastePercent > 15 ? 'text-red-600' :
                                                item.wastePercent > 5 ? 'text-yellow-600' :
                                                    'text-green-600'
                                            }`}>
                                            {item.wastePercent.toFixed(1)}%
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            <FormattedNumber value={item.estimatedCostLoss} prefix="$" decimalPlaces={2} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {wasteData.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay datos de producción para el período seleccionado.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
