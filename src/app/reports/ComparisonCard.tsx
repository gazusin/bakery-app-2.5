"use client";

import { ComparisonMetrics } from '@/lib/comparative-analytics';
import { getTrendIndicator, formatPercentageChange } from '@/lib/comparative-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ComparisonCardProps {
    title: string;
    current: number;
    previous: number;
    metrics: ComparisonMetrics;
    formatValue?: (value: number) => string;
    isPositiveBetter?: boolean;
    icon?: React.ReactNode;
}

export function ComparisonCard({
    title,
    current,
    previous,
    metrics,
    formatValue = (v) => `$${v.toFixed(2)}`,
    isPositiveBetter = true,
    icon
}: ComparisonCardProps) {
    const trend = getTrendIndicator(metrics.percentageChange, isPositiveBetter);

    return (
        <Card className="shadow-lg">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Current Value */}
                <div>
                    <div className="text-2xl font-bold">{formatValue(current)}</div>
                    <p className="text-xs text-muted-foreground">Período Actual</p>
                </div>

                {/* Comparison */}
                <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                        <div className="text-sm text-muted-foreground">{formatValue(previous)}</div>
                        <p className="text-xs text-muted-foreground">Período Anterior</p>
                    </div>

                    <div className="text-right">
                        <div className={cn("text-lg font-semibold flex items-center gap-1", trend.color)}>
                            <span>{trend.arrow}</span>
                            <span>{formatPercentageChange(metrics.percentageChange)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{trend.label}</p>
                    </div>
                </div>

                {/* Absolute Change */}
                {metrics.change !== 0 && (
                    <div className="pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                            Cambio: <span className={cn("font-semibold", trend.color)}>
                                {metrics.change > 0 ? '+' : ''}{formatValue(metrics.change)}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
