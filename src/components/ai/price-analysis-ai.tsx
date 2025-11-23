'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { analyzePriceHistory } from '@/lib/data-storage';
import { cn } from '@/lib/utils';

interface PriceAnalysisAIProps {
    materialName: string;
    supplierId?: string;
}

export function PriceAnalysisAI({ materialName, supplierId }: PriceAnalysisAIProps) {
    if (!materialName) return null;

    const analysis = analyzePriceHistory(materialName, supplierId);

    if (analysis.priceHistory.length === 0) {
        return (
            <Card className="mt-4">
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                        Sin datos históricos para análisis de precio
                    </p>
                </CardContent>
            </Card>
        );
    }

    const Icon = analysis.trend === 'rising' ? TrendingUp :
        analysis.trend === 'falling' ? TrendingDown : Minus;

    const trendColor = analysis.trend === 'rising' ? 'text-red-600' :
        analysis.trend === 'falling' ? 'text-green-600' : 'text-gray-600';

    return (
        <Card className={cn(
            "mt-4",
            analysis.trend === 'rising' && "border-red-500",
            analysis.trend === 'falling' && "border-green-500"
        )}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", trendColor)} />
                    Análisis de Precio IA
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <p className="text-2xl font-bold">${analysis.currentPrice.toFixed(2)}</p>
                    <p className={cn("text-sm font-semibold", trendColor)}>
                        {analysis.trend === 'rising' && `↗️ Subiendo ${analysis.trendPercent}%`}
                        {analysis.trend === 'falling' && `↘️ Bajando ${Math.abs(analysis.trendPercent)}%`}
                        {analysis.trend === 'stable' && `→ Precio estable`}
                    </p>
                </div>

                {analysis.cheapestSupplier && (
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                        <p className="text-sm font-semibold text-green-800">
                            💰 Mejor precio: {analysis.cheapestSupplier.name}
                        </p>
                        <p className="text-lg font-bold text-green-700">
                            ${analysis.cheapestSupplier.price.toFixed(2)}
                        </p>
                    </div>
                )}

                <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <p className="text-sm text-amber-900">
                        <strong>Recomendación:</strong> {analysis.recommendation}
                    </p>
                </div>

                <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver historial ({analysis.priceHistory.length} transacciones)
                    </summary>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {analysis.priceHistory.slice(0, 10).map((h, i) => (
                            <div key={i} className="flex justify-between text-xs p-1">
                                <span>{h.date}</span>
                                <span>{h.supplier}</span>
                                <span className="font-mono">${h.price.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </details>
            </CardContent>
        </Card>
    );
}
