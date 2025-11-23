'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { predictOptimalProduction, loadAllProductsFromAllBranches } from '@/lib/data-storage';

interface AIPredictionsPanelProps {
    targetDate: Date;
    maxProducts?: number;
}

export function AIPredictionsPanel({ targetDate, maxProducts = 10 }: AIPredictionsPanelProps) {
    const [predictions, setPredictions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const products = loadAllProductsFromAllBranches()
            .filter(p => !p.name.toLowerCase().includes('no despachable'))
            .slice(0, maxProducts);

        const productPredictions = products.map(p => ({
            ...p,
            prediction: predictOptimalProduction(p.id, p.name, targetDate)
        })).filter(p => p.prediction.recommended > 0);

        setPredictions(productPredictions);
        setLoading(false);
    }, [targetDate, maxProducts]);

    if (loading) return null;
    if (predictions.length === 0) return null;

    return (
        <Card className="border-2 border-amber-500 bg-amber-50/30">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                    Predicciones IA Avanzadas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Basado en historial de ventas, tendencias y estacionalidad
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {predictions.slice(0, 8).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div className="flex-1">
                                <p className="font-semibold">{p.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {p.prediction.reasoning}
                                </p>
                            </div>
                            <div className="text-right ml-4">
                                <p className="text-2xl font-bold text-amber-700">
                                    {p.prediction.recommended}
                                </p>
                                <Badge variant={
                                    p.prediction.confidence > 80 ? 'default' :
                                        p.prediction.confidence > 50 ? 'secondary' : 'outline'
                                }>
                                    {p.prediction.confidence}% confianza
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
