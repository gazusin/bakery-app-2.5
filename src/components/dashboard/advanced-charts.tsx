"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Area,
    AreaChart,
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart as BarChartIcon, Activity } from 'lucide-react';

// Colores para los gráficos
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface RevenueVsExpensesData {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
}

interface TopProductData {
    name: string;
    value: number;
    percentage: number;
}

interface TrendData {
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
}

// Componente: Ventas vs Gastos (ComposedChart)
export function RevenueVsExpensesChart({ data }: { data: RevenueVsExpensesData[] }) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Ingresos vs Gastos
                    </CardTitle>
                    <CardDescription>Comparación mensual</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Ingresos vs Gastos
                </CardTitle>
                <CardDescription>Últimos 6 meses - Comparación de ingresos, gastos y ganancias</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={data}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                        />
                        <YAxis
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                        />
                        <Legend />
                        <Bar
                            dataKey="revenue"
                            fill="#10b981"
                            name="Ingresos"
                            radius={[8, 8, 0, 0]}
                        />
                        <Bar
                            dataKey="expenses"
                            fill="#ef4444"
                            name="Gastos"
                            radius={[8, 8, 0, 0]}
                        />
                        <Line
                            type="monotone"
                            dataKey="profit"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            name="Ganancia Neta"
                            dot={{ r: 5 }}
                            activeDot={{ r: 7 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// Componente: Top Productos (PieChart)
export function TopProductsPieChart({ data }: { data: TopProductData[] }) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5" />
                        Distribución de Ventas por Producto
                    </CardTitle>
                    <CardDescription>Top productos del mes</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.05) return null; // No mostrar labels para segmentos menores al 5%

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x >

                    cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="text-xs font-semibold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Distribución de Ventas por Producto
                </CardTitle>
                <CardDescription>Top 8 productos más vendidos este mes</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomLabel}
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={800}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                            formatter={(value: number, name: string, props: any) => [
                                `${value} unidades (${props.payload.percentage.toFixed(1)}%)`,
                                props.payload.name
                            ]}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value, entry: any) => entry.payload.name}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// Componente: Tendencias (LineChart/AreaChart)
export function TrendChart({ data }: { data: TrendData[] }) {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Tendencias de Negocio
                    </CardTitle>
                    <CardDescription>Últimos 30 días</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">No hay datos disponibles</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Tendencias de Negocio
                </CardTitle>
                <CardDescription>Últimos 30 días - Evolución diaria de ingresos, gastos y ganancias</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRevenueArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorProfitArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                        />
                        <Legend />
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorRevenueArea)"
                            name="Ingresos"
                        />
                        <Area
                            type="monotone"
                            dataKey="profit"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorProfitArea)"
                            name="Ganancia"
                        />
                        <Line
                            type="monotone"
                            dataKey="expenses"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Gastos"
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// Componente: Mini Stats Cards para acompañar los gráficos
export function ChartInsight({
    title,
    value,
    trend,
    trendValue,
    icon: Icon
}: {
    title: string;
    value: string;
    trend: 'up' | 'down' | 'neutral';
    trendValue: string;
    icon: React.ElementType;
}) {
    const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground';
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? Activity : BarChartIcon;

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="p-2 rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                {trendValue}
            </div>
        </div>
    );
}
