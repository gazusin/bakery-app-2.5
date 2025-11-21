"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { calculateProductProfitability, calculateCustomerStats } from '@/lib/reports-analytics';
import { salesData as initialSalesDataGlobal } from '@/lib/data-storage';
import type { DateRange } from "react-day-picker";

interface AdvancedReportCardsProps {
    selectedDateRange: DateRange | undefined;
    activeBranchId: string | null;
    activeBranchName: string;
}

export function AdvancedReportCards({ selectedDateRange, activeBranchId, activeBranchName }: AdvancedReportCardsProps) {
    // Calculate profitability data
    const profitabilityData = useMemo(() => {
        return calculateProductProfitability(initialSalesDataGlobal, selectedDateRange, activeBranchId);
    }, [selectedDateRange, activeBranchId]);

    // Calculate customer stats
    const customerStatsData = useMemo(() => {
        return calculateCustomerStats(initialSalesDataGlobal, selectedDateRange);
    }, [selectedDateRange]);

    // Chart configs
    const profitabilityChartConfig = {
        totalProfit: { label: "Ganancia Total (USD)", color: "hsl(var(--chart-2))" },
    } satisfies ChartConfig;

    const customerChartConfig = {
        totalSpent: { label: "Total Gastado (USD)", color: "hsl(var(--chart-3))" },
    } satisfies ChartConfig;

    // Format chart data for display
    const profitChartData = profitabilityData.map(item => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
        totalProfit: parseFloat(item.totalProfit.toFixed(2)),
        marginPercent: item.marginPercent,
        fullName: item.name
    }));

    const customerChartData = customerStatsData.map(item => ({
        name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
        totalSpent: parseFloat(item.totalSpent.toFixed(2)),
        totalOrders: item.totalOrders,
        fullName: item.name
    }));

    return (
        <>
            {/* Product Profitability Card */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" /> Top 10 Productos Más Rentables
                    </CardTitle>
                    <CardDescription>
                        Productos ordenados por ganancia total en el período seleccionado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {profitChartData.length > 0 ? (
                        <ChartContainer config={profitabilityChartConfig} className="h-full w-full">
                            <BarChart data={profitChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12} />
                                <ChartTooltip content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                                                <div className="grid grid-cols-1 gap-1.5">
                                                    <span className="font-medium">{data.fullName}</span>
                                                    <span className="text-muted-foreground">
                                                        Ganancia: <span className="font-semibold text-green-600">${data.totalProfit.toFixed(2)}</span>
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        Margen: <span className="font-semibold">{data.marginPercent.toFixed(1)}%</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Bar dataKey="totalProfit" fill="var(--color-totalProfit)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No hay datos de rentabilidad para el período seleccionado.
                        </p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full" disabled={profitabilityData.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Descargar Rentabilidad (PDF)
                    </Button>
                </CardFooter>
            </Card>

            {/* Customer Stats Card */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Top 10 Mejores Clientes
                    </CardTitle>
                    <CardDescription>
                        Clientes con mayor gasto total en el período seleccionado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    {customerChartData.length > 0 ? (
                        <ChartContainer config={customerChartConfig} className="h-full w-full">
                            <BarChart data={customerChartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} width={120} interval={0} fontSize={12} />
                                <ChartTooltip content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                                                <div className="grid grid-cols-1 gap-1.5">
                                                    <span className="font-medium">{data.fullName}</span>
                                                    <span className="text-muted-foreground">
                                                        Total Gastado: <span className="font-semibold text-primary">${data.totalSpent.toFixed(2)}</span>
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        Pedidos: <span className="font-semibold">{data.totalOrders}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Bar dataKey="totalSpent" fill="var(--color-totalSpent)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No hay datos de clientes para el período seleccionado.
                        </p>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full" disabled={customerStatsData.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> Descargar Clientes (PDF)
                    </Button>
                </CardFooter>
            </Card>
        </>
    );
}
