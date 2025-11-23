'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, Minus } from 'lucide-react';
import {
    generateDailySummary,
    generateStockAlerts,
    loadAllProductsFromAllBranches,
    type DailySummaryData,
    type StockAlert
} from '@/lib/data-storage';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export function DailySummary() {
    // Cargar productos dinámicamente
    const products = useMemo(() => {
        return loadAllProductsFromAllBranches();
    }, []);

    // Generar alertas de stock
    const stockAlerts = useMemo(() => {
        return generateStockAlerts(products);
    }, [products]);

    // Generar resumen diario
    const summary: DailySummaryData = useMemo(() => {
        return generateDailySummary(stockAlerts);
    }, [stockAlerts]);

    const SentimentIcon =
        summary.sentiment === 'positive' ? TrendingUp :
            summary.sentiment === 'warning' ? AlertCircle :
                Minus;

    const sentimentColor =
        summary.sentiment === 'positive' ? 'text-green-600' :
            summary.sentiment === 'warning' ? 'text-amber-600' :
                'text-blue-600';

    return (
        <Card className="border-2">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <SentimentIcon className={cn("h-5 w-5", sentimentColor)} />
                        <CardTitle className="text-lg">{summary.summary}</CardTitle>
                    </div>
                    <Badge variant={summary.sentiment === 'positive' ? 'default' : summary.sentiment === 'warning' ? 'destructive' : 'secondary'}>
                        {summary.sentiment === 'positive' ? '✨ Bien' : summary.sentiment === 'warning' ? '⚠️ Atención' : '📊 Normal'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Key Points */}
                {summary.keyPoints.length > 0 && (
                    <div className="space-y-2">
                        {summary.keyPoints.map((point, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-muted-foreground">•</span>
                                <span>{point}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Top Action */}
                {summary.topAction && (
                    <div className="mt-4 p-3 bg-primary/10 rounded-lg border-l-4 border-primary">
                        <p className="font-semibold text-sm text-primary">🎯 Acción Prioritaria:</p>
                        <p className="text-sm mt-1">{summary.topAction}</p>
                    </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                    <div>
                        <p className="text-xs text-muted-foreground">Crecimiento Semanal</p>
                        <p className={cn(
                            "text-lg font-bold",
                            summary.metrics.weeklyGrowth > 0 ? 'text-green-600' : summary.metrics.weeklyGrowth < 0 ? 'text-red-600' : 'text-gray-600'
                        )}>
                            {summary.metrics.weeklyGrowth > 0 ? '+' : ''}{summary.metrics.weeklyGrowth}%
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Tendencia</p>
                        <p className="text-sm font-semibold">{summary.metrics.marginTrend}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Alertas Críticas</p>
                        <p className={cn(
                            "text-lg font-bold",
                            summary.metrics.criticalIssues > 0 ? 'text-red-600' : 'text-green-600'
                        )}>
                            {summary.metrics.criticalIssues}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
