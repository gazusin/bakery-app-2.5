"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle,
    Info,
    Lightbulb,
    ArrowRight,
    BarChart3,
    Users,
    DollarSign,
    Package
} from 'lucide-react';
import { type Insight } from '@/hooks/useBusinessInsights';
import { cn } from '@/lib/utils';

interface InsightsCardProps {
    insights: Insight[];
    highPriorityCount: number;
    actionableCount: number;
    onActionClick?: (insight: Insight) => void;
}

export function BusinessInsightsPanel({
    insights,
    highPriorityCount,
    actionableCount,
    onActionClick
}: InsightsCardProps) {

    const getIconByCategory = (category: Insight['category']) => {
        switch (category) {
            case 'trending': return BarChart3;
            case 'inventory': return Package;
            case 'finance': return DollarSign;
            case 'customer': return Users;
            case 'forecast': return TrendingUp;
            default: return Info;
        }
    };

    const getTypeIcon = (type: Insight['type']) => {
        switch (type) {
            case 'success': return CheckCircle;
            case 'warning': return AlertTriangle;
            case 'danger': return AlertTriangle;
            case 'info': return Info;
            default: return Lightbulb;
        }
    };

    const getTypeColor = (type: Insight['type']) => {
        switch (type) {
            case 'success': return 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
            case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
            case 'danger': return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
            case 'info': return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
            default: return 'text-muted-foreground bg-muted border-border';
        }
    };

    const getPriorityBadge = (priority: Insight['priority']) => {
        const variants = {
            high: { label: 'Alta Prioridad', variant: 'destructive' as const },
            medium: { label: 'Media Prioridad', variant: 'default' as const },
            low: { label: 'Baja Prioridad', variant: 'secondary' as const }
        };
        return variants[priority];
    };

    if (insights.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5" />
                        Insights del Negocio
                    </CardTitle>
                    <CardDescription>Recomendaciones automáticas basadas en tus datos</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">¡Todo en orden!</h3>
                        <p className="text-muted-foreground">
                            No hay alertas críticas en este momento. Sigue monitoreando tu negocio.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-amber-500" />
                            Insights del Negocio
                        </CardTitle>
                        <CardDescription>
                            {insights.length} recomendaciones automáticas
                            {highPriorityCount > 0 && ` • ${highPriorityCount} de alta prioridad`}
                        </CardDescription>
                    </div>
                    {actionableCount > 0 && (
                        <Badge variant="outline" className="bg-primary/10">
                            {actionableCount} accionables
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-4">
                        {insights.map((insight) => {
                            const CategoryIcon = getIconByCategory(insight.category);
                            const TypeIcon = getTypeIcon(insight.type);
                            const priorityBadge = getPriorityBadge(insight.priority);

                            return (
                                <div
                                    key={insight.id}
                                    className={cn(
                                        'rounded-lg border-2 p-4 transition-all hover:shadow-md',
                                        getTypeColor(insight.type)
                                    )}
                                >
                                    {/* Header */}
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                                            <CategoryIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h4 className="font-semibold text-sm leading-tight">
                                                    {insight.title}
                                                </h4>
                                                <Badge
                                                    variant={priorityBadge.variant}
                                                    className="shrink-0 text-xs"
                                                >
                                                    {priorityBadge.label}
                                                </Badge>
                                            </div>
                                            <p className="text-sm opacity-90 leading-relaxed">
                                                {insight.description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Metrics */}
                                    {insight.metrics && insight.metrics.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                                            {insight.metrics.map((metric, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-white/60 dark:bg-black/30 rounded-md p-2"
                                                >
                                                    <p className="text-xs text-muted-foreground mb-0.5">
                                                        {metric.label}
                                                    </p>
                                                    <p className="text-sm font-semibold flex items-center gap-1">
                                                        {metric.value}
                                                        {metric.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                                                        {metric.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Recommendation */}
                                    <div className="bg-white/60 dark:bg-black/30 rounded-md p-3 mb-3">
                                        <div className="flex items-start gap-2">
                                            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Recomendación
                                                </p>
                                                <p className="text-sm font-medium">
                                                    {insight.recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    {insight.actionable && insight.actionLabel && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full bg-white/80 dark:bg-black/40"
                                            onClick={() => onActionClick?.(insight)}
                                        >
                                            {insight.actionLabel}
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

// Componente compacto para mostrar en otras vistas
export function InsightsSummary({
    insights,
    highPriorityCount
}: {
    insights: Insight[];
    highPriorityCount: number;
}) {
    if (insights.length === 0) return null;

    const highPriorityInsights = insights.filter(i => i.priority === 'high').slice(0, 3);

    return (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                    Insights Destacados
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {highPriorityInsights.map((insight) => (
                        <div key={insight.id} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                            <p className="text-xs">
                                <span className="font-medium">{insight.title}:</span> {insight.description}
                            </p>
                        </div>
                    ))}
                    {highPriorityCount > 3 && (
                        <p className="text-xs text-muted-foreground pt-2 border-t">
                            +{highPriorityCount - 3} insights más de alta prioridad
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
