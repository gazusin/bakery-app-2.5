"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, Users, FileSpreadsheet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { calculateProductProfitability, calculateCustomerStats } from '@/lib/reports-analytics';
import { exportToExcel } from '@/lib/export-utils';
import { salesData as initialSalesDataGlobal } from '@/lib/data-storage';
import type { DateRange } from "react-day-picker";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { UserOptions } from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: UserOptions) => void;
}

interface AdvancedReportCardsProps {
    selectedDateRange: DateRange | undefined;
    activeBranchId: string | null;
    activeBranchName: string;
}

export function AdvancedReportCards({ selectedDateRange, activeBranchId, activeBranchName }: AdvancedReportCardsProps) {
    const { toast } = useToast();

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

    const handleExportProfitabilityExcel = () => {
        exportToExcel(profitabilityData, `Rentabilidad_Productos_${activeBranchName || 'Global'}`);
    };

    const handleExportCustomerStatsExcel = () => {
        exportToExcel(customerStatsData, `Top_Clientes_${activeBranchName || 'Global'}`);
    };

    const handleDownloadProfitabilityReportPDF = async () => {
        const chartElement = document.getElementById('profitability-chart');
        if (!chartElement) return;

        try {
            const canvas = await html2canvas(chartElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const doc = new jsPDF() as unknown as jsPDFWithAutoTable;
            const reportDate = selectedDateRange?.from ? format(selectedDateRange.from, "dd/MM/yyyy", { locale: es }) : "General";

            doc.setFontSize(18);
            doc.text("Panificadora Valladares", 14, 22);
            doc.setFontSize(12);
            doc.text(`Reporte de Rentabilidad de Productos (${activeBranchName || 'Global'})`, 14, 30);
            doc.setFontSize(10);
            doc.text(`Período: ${reportDate}`, 14, 38);

            // Add Chart
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', 15, 45, imgWidth, imgHeight);

            // Add Table
            const head = [["Producto", "Ganancia Total (USD)", "Margen %"]];
            const body = profitabilityData.map(item => [
                item.name,
                `$${item.totalProfit.toFixed(2)}`,
                `${item.marginPercent.toFixed(1)}%`
            ]);

            doc.autoTable({
                startY: 45 + imgHeight + 10,
                head: head,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [224, 122, 95] }
            });

            doc.save(`Rentabilidad_Productos_${activeBranchName || 'Global'}.pdf`);
            toast({ title: "PDF Generado", description: "Reporte de rentabilidad descargado con éxito." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
        }
    };

    const handleDownloadCustomerStatsReportPDF = async () => {
        const chartElement = document.getElementById('customer-stats-chart');
        if (!chartElement) return;

        try {
            const canvas = await html2canvas(chartElement, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');

            const doc = new jsPDF() as unknown as jsPDFWithAutoTable;
            const reportDate = selectedDateRange?.from ? format(selectedDateRange.from, "dd/MM/yyyy", { locale: es }) : "General";

            doc.setFontSize(18);
            doc.text("Panificadora Valladares", 14, 22);
            doc.setFontSize(12);
            doc.text(`Reporte de Mejores Clientes (${activeBranchName || 'Global'})`, 14, 30);
            doc.setFontSize(10);
            doc.text(`Período: ${reportDate}`, 14, 38);
            // Add Chart
            const imgWidth = 180;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            doc.addImage(imgData, 'PNG', 15, 45, imgWidth, imgHeight);

            // Add Table
            const head = [["Cliente", "Total Gastado (USD)", "Pedidos"]];
            const body = customerStatsData.map(item => [
                item.name,
                `$${item.totalSpent.toFixed(2)}`,
                item.totalOrders
            ]);

            doc.autoTable({
                startY: 45 + imgHeight + 10,
                head: head,
                body: body,
                theme: 'striped',
                headStyles: { fillColor: [224, 122, 95] }
            });

            doc.save(`Top_Clientes_${activeBranchName || 'Global'}.pdf`);
            toast({ title: "PDF Generado", description: "Reporte de clientes descargado con éxito." });
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
        }
    };

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
                        <div id="profitability-chart" className="h-full w-full">
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
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No hay datos de rentabilidad para el período seleccionado.
                        </p>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button className="flex-1" onClick={handleDownloadProfitabilityReportPDF} disabled={profitabilityData.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleExportProfitabilityExcel} disabled={profitabilityData.length === 0}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
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
                        <div id="customer-stats-chart" className="h-full w-full">
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
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No hay datos de clientes para el período seleccionado.
                        </p>
                    )}
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button className="flex-1" onClick={handleDownloadCustomerStatsReportPDF} disabled={customerStatsData.length === 0}>
                        <Download className="mr-2 h-4 w-4" /> PDF
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleExportCustomerStatsExcel} disabled={customerStatsData.length === 0}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                    </Button>
                </CardFooter>
            </Card>
        </>
    );
}
