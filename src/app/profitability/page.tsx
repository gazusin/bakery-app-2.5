"use client";

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, FileText } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { analyzeProfitability, getActiveBranchId } from '@/lib/data-storage';
import type { ProfitabilityAnalysis } from '@/lib/data-storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormattedNumber } from '@/components/ui/formatted-number';

export default function ProfitabilityPage() {
    const [profitabilityData, setProfitabilityData] = useState<ProfitabilityAnalysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'healthy' | 'warning' | 'critical'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');

    useEffect(() => {
        setIsLoading(true);
        const data = analyzeProfitability();
        setProfitabilityData(data);
        setIsLoading(false);
    }, []);

    const categories = useMemo(() => {
        const cats = new Set(profitabilityData.map(p => p.category));
        return ['all', ...Array.from(cats)];
    }, [profitabilityData]);

    const filteredData = useMemo(() => {
        return profitabilityData.filter(item => {
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            if (filterCategory !== 'all' && item.category !== filterCategory) return false;
            return true;
        });
    }, [profitabilityData, filterStatus, filterCategory]);

    const stats = useMemo(() => {
        const healthy = profitabilityData.filter(p => p.status === 'healthy').length;
        const warning = profitabilityData.filter(p => p.status === 'warning').length;
        const critical = profitabilityData.filter(p => p.status === 'critical').length;
        const avgMargin = profitabilityData.length > 0
            ? profitabilityData.reduce((sum, p) => sum + p.margin, 0) / profitabilityData.length
            : 0;

        return { healthy, warning, critical, avgMargin };
    }, [profitabilityData]);

    const getStatusBadge = (status: 'healthy' | 'warning' | 'critical') => {
        switch (status) {
            case 'healthy':
                return <Badge className="bg-green-500">Saludable</Badge>;
            case 'warning':
                return <Badge className="bg-yellow-500">Advertencia</Badge>;
            case 'critical':
                return <Badge className="bg-red-500">Crítico</Badge>;
        }
    };

    const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
        switch (status) {
            case 'healthy':
                return <TrendingUp className="h-4 w-4 text-green-600" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
            case 'critical':
                return <TrendingDown className="h-4 w-4 text-red-600" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-muted-foreground">Cargando análisis de rentabilidad...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <PageHeader
                title="Dashboard de Márgenes Reales"
                description="Análisis de rentabilidad basado en costos actuales de ingredientes"
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Margen Promedio</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgMargin.toFixed(1)}%</div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-green-700">Saludables</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.healthy}</div>
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

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Estado</label>
                        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="healthy">Saludables</SelectItem>
                                <SelectItem value="warning">Advertencias</SelectItem>
                                <SelectItem value="critical">Críticos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1">
                        <label className="text-sm font-medium mb-2 block">Categoría</label>
                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat === 'all' ? 'Todas' : cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Profitability Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Análisis por Producto ({filteredData.length})</CardTitle>
                    <CardDescription>
                        Comparación de precio de venta vs costo actual de ingredientes
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estado</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Precio Venta</TableHead>
                                <TableHead className="text-right">Costo Original</TableHead>
                                <TableHead className="text-right">Costo Actual</TableHead>
                                <TableHead className="text-right">Margen %</TableHead>
                                <TableHead className="text-right">Margen USD</TableHead>
                                <TableHead>Recomendación</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((item) => (
                                <TableRow key={item.productId} className={
                                    item.status === 'critical' ? 'bg-red-50' :
                                        item.status === 'warning' ? 'bg-yellow-50' : ''
                                }>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(item.status)}
                                            {getStatusBadge(item.status)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        <FormattedNumber value={item.salePrice} prefix="$" decimalPlaces={2} />
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-muted-foreground">
                                        <FormattedNumber value={item.originalCost} prefix="$" decimalPlaces={2} />
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                        <FormattedNumber value={item.currentCost} prefix="$" decimalPlaces={2} />
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${item.margin < 0 ? 'text-red-600' :
                                            item.margin < 20 ? 'text-yellow-600' :
                                                'text-green-600'
                                        }`}>
                                        {item.margin.toFixed(1)}%
                                    </TableCell>
                                    <TableCell className={`text-right font-mono font-semibold ${item.marginUSD < 0 ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                        <FormattedNumber value={item.marginUSD} prefix="$" decimalPlaces={2} />
                                    </TableCell>
                                    <TableCell className="text-sm">{item.recommendation}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {filteredData.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay productos que coincidan con los filtros seleccionados.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
