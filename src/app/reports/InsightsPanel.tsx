"use client";

import { Insight, getAlertVariant } from '@/lib/insights-generator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { InfoIcon, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from 'lucide-react';

interface InsightsPanelProps {
    insights: Insight[];
    isLoading?: boolean;
}

export function InsightsPanel({ insights, isLoading = false }: InsightsPanelProps) {
    if (isLoading) {
        return (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Insights y Recomendaciones
                    </CardTitle>
                    <CardDescription>Cargando análisis...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (insights.length === 0) {
        return (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        Insights y Recomendaciones
                    </CardTitle>
                    <CardDescription>Análisis automático basado en tus datos</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <InfoIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No hay insights disponibles para el período seleccionado.</p>
                        <p className="text-sm mt-2">Selecciona un rango de fechas para comparar.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getInsightIcon = (type: Insight['type']) => {
        switch (type) {
            case 'success':
                return <TrendingUp className="h-4 w-4" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4" />;
            case 'opportunity':
                return <Lightbulb className="h-4 w-4" />;
            default:
                return <InfoIcon className="h-4 w-4" />;
        }
    };

    const getPriorityColor = (priority: Insight['priority']) => {
        switch (priority) {
            case 'high':
                return 'destructive';
            case 'medium':
                return 'default';
            case 'low':
                return 'secondary';
        }
    };

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-yellow-500" />
                            Insights y Recomendaciones
                        </CardTitle>
                        <CardDescription>Análisis automático basado en tus datos</CardDescription>
                    </div>
                    <Badge variant="outline">{insights.length} insights</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {insights.map((insight) => (
                    <Alert key={insight.id} variant={getAlertVariant(insight.type)} className="relative">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {getInsightIcon(insight.type)}
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <AlertTitle className="mb-0">{insight.title}</AlertTitle>
                                    <Badge variant={getPriorityColor(insight.priority)} className="text-xs">
                                        {insight.priority === 'high' ? 'Alta' : insight.priority === 'medium' ? 'Media' : 'Baja'}
                                    </Badge>
                                </div>
                                <AlertDescription className="text-sm">
                                    {insight.description}
                                </AlertDescription>
                                {insight.metrics && insight.metrics.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t mt-3">
                                        {insight.metrics.map((metric, idx) => (
                                            <div key={idx} className="text-sm">
                                                <span className="text-muted-foreground">{metric.label}:</span>{' '}
                                                <span className="font-semibold">{metric.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Alert>
                ))}
            </CardContent>
        </Card>
    );
}
