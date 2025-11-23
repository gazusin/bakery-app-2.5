'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { generateStockAlerts, loadAllProductsFromAllBranches } from '@/lib/data-storage';
import { cn } from '@/lib/utils';

export function StockAlertsAI() {
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        const products = loadAllProductsFromAllBranches();
        const stockAlerts = generateStockAlerts(products).filter(
            a => a.urgency === 'critical' || a.urgency === 'high'
        );
        setAlerts(stockAlerts.slice(0, 5));
    }, []);

    if (alerts.length === 0) return null;

    const criticalCount = alerts.filter(a => a.urgency === 'critical').length;

    return (
        <Alert
            variant={criticalCount > 0 ? "destructive" : "default"}
            className={cn(
                "mb-4",
                criticalCount > 0 && "border-red-500 bg-red-50"
            )}
        >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
                ⚠️ {alerts.length} Alerta{alerts.length > 1 ? 's' : ''} de Stock
                {criticalCount > 0 && ` (${criticalCount} crítica${criticalCount > 1 ? 's' : ''})`}
            </AlertTitle>
            <AlertDescription>
                <div className="mt-3 space-y-2">
                    {alerts.map(alert => (
                        <div
                            key={alert.productId}
                            className="flex items-center justify-between p-2 bg-white rounded text-sm"
                        >
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">{alert.productName}</p>
                                <p className="text-xs text-gray-600 mt-1">{alert.reasoning}</p>
                            </div>
                            <div className="text-right ml-4">
                                {alert.urgency === 'critical' ? (
                                    <span className="text-red-600 font-bold">
                                        🚨 {alert.daysUntilStockout < 1 ? 'HOY' : `${alert.daysUntilStockout.toFixed(1)} días`}
                                    </span>
                                ) : (
                                    <span className="text-orange-600 font-semibold">
                                        ⚠️ {alert.daysUntilStockout.toFixed(1)} días
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </AlertDescription>
        </Alert>
    );
}
