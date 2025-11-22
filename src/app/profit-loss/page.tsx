"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { calculateProfitLoss } from '@/lib/data-storage';

export default function ProfitLossPage() {
    const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [plData, setPlData] = useState<any>(null);
    const [previousPlData, setPreviousPlData] = useState<any>(null);

    useEffect(() => {
        loadPLData();
    }, [selectedMonth]);

    const loadPLData = () => {
        const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

        const currentData = calculateProfitLoss(monthStart, monthEnd, null);
        setPlData(currentData);

        const prevMonth = subMonths(selectedMonth, 1);
        const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
        const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
        const prevData = calculateProfitLoss(prevStart, prevEnd, null);
        setPreviousPlData(prevData);
    };

    if (!plData) {
        return <div className="container mx-auto py-6">Cargando...</div>;
    }

    const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    const revenueChange = calculateChange(plData.revenue, previousPlData?.revenue || 0);
    const profitChange = calculateChange(plData.netProfit, previousPlData?.netProfit || 0);
    const marginChange = plData.netMargin - (previousPlData?.netMargin || 0);
    const isLowMargin = plData.netMargin < 20;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <PageHeader
                title="Estado de Resultados (P&L)"
                description="Profit & Loss en tiempo real con calculo automatico de costos"
                icon={TrendingUp}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Periodo de Analisis</CardTitle>
                </CardHeader>
                <CardContent>
                    <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[280px]">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(selectedMonth, "MMMM yyyy", { locale: es })}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedMonth}
                                onSelect={(date) => {
                                    setSelectedMonth(date || new Date());
                                    setIsMonthPickerOpen(false);
                                }}
                                initialFocus
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            {isLowMargin && (
                <Card className="border-orange-500 bg-orange-50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                            <CardTitle className="text-orange-800">Margen Neto Bajo</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-orange-700">
                            El margen neto actual es de {plData.netMargin.toFixed(1)}%, por debajo del objetivo de 20%.
                            Revisa costos, gastos y perdidas para identificar oportunidades de mejora.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Ventas Totales</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <FormattedNumber value={plData.revenue} prefix="$" />
                        </div>
                        <div className={cn(
                            "text-sm flex items-center gap-1",
                            revenueChange >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                            {revenueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {Math.abs(revenueChange).toFixed(1)}% vs mes anterior
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Utilidad Neta</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl font-bold",
                            plData.netProfit >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                            <FormattedNumber value={plData.netProfit} prefix="$" />
                        </div>
                        <div className={cn(
                            "text-sm flex items-center gap-1",
                            profitChange >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                            {profitChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            {Math.abs(profitChange).toFixed(1)}% vs mes anterior
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Margen Neto</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl font-bold",
                            plData.netMargin >= 20 ? "text-green-600" : plData.netMargin >= 10 ? "text-yellow-600" : "text-red-600"
                        )}>
                            {plData.netMargin.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">
                            {marginChange >= 0 ? '+' : ''}{marginChange.toFixed(1)} pts vs mes anterior
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Estado de Resultados Detallado</CardTitle>
                    <CardDescription>
                        {format(startOfMonth(selectedMonth), "d 'de' MMMM", { locale: es })} - {format(endOfMonth(selectedMonth), "d 'de' MMMM, yyyy", { locale: es })}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 border-b-2 border-gray-800">
                                <span className="font-bold text-lg">INGRESOS</span>
                                <span className="font-bold text-lg">
                                    <FormattedNumber value={plData.revenue} prefix="$" />
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 pl-4">
                                <span>Ventas ({plData.salesCount} transacciones)</span>
                                <span>
                                    <FormattedNumber value={plData.revenue} prefix="$" />
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="font-semibold">Costo de Ventas (COGS)</span>
                                <span className="font-semibold text-red-600">
                                    (<FormattedNumber value={plData.cogs} prefix="$" />)
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2 bg-green-50 p-3 rounded">
                            <div className="flex justify-between items-center">
                                <span className="font-bold">UTILIDAD BRUTA</span>
                                <span className="font-bold text-green-600">
                                    <FormattedNumber value={plData.grossProfit} prefix="$" />
                                </span>
                            </div>
                            <div className="text-sm text-gray-600">
                                Margen Bruto: {plData.grossMargin.toFixed(1)}%
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="font-semibold">Gastos Operativos</span>
                                <span className="font-semibold text-red-600">
                                    (<FormattedNumber value={plData.operatingExpenses} prefix="$" />)
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 pl-4">
                                <span>{plData.expensesCount} gastos registrados</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="font-semibold">Perdidas de Productos</span>
                                <span className="font-semibold text-red-600">
                                    (<FormattedNumber value={plData.lossesTotal} prefix="$" />)
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 pl-4">
                                <span>{plData.lossesCount} perdidas registradas</span>
                            </div>
                        </div>

                        <div className={cn(
                            "space-y-2 p-4 rounded-lg border-2",
                            plData.netProfit >= 0 ? "bg-green-100 border-green-500" : "bg-red-100 border-red-500"
                        )}>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-lg">UTILIDAD NETA</span>
                                <span className={cn(
                                    "font-bold text-xl",
                                    plData.netProfit >= 0 ? "text-green-700" : "text-red-700"
                                )}>
                                    <FormattedNumber value={plData.netProfit} prefix="$" />
                                </span>
                            </div>
                            <div className="text-sm font-medium">
                                Margen Neto: {plData.netMargin.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {previousPlData && (
                <Card>
                    <CardHeader>
                        <CardTitle>Comparacion con Periodo Anterior</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold mb-2">Mes Actual</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span>Ventas:</span>
                                        <span className="font-medium">
                                            <FormattedNumber value={plData.revenue} prefix="$" />
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Utilidad Neta:</span>
                                        <span className="font-medium">
                                            <FormattedNumber value={plData.netProfit} prefix="$" />
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Margen:</span>
                                        <span className="font-medium">{plData.netMargin.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Mes Anterior</h4>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span>Ventas:</span>
                                        <span className="font-medium">
                                            <FormattedNumber value={previousPlData.revenue} prefix="$" />
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Utilidad Neta:</span>
                                        <span className="font-medium">
                                            <FormattedNumber value={previousPlData.netProfit} prefix="$" />
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Margen:</span>
                                        <span className="font-medium">{previousPlData.netMargin.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
