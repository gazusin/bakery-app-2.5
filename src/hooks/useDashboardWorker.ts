import { useState, useEffect, useRef } from 'react';
import { DashboardData } from './useDashboardData';

export function useDashboardWorker(inputData: any) {
    const [stats, setStats] = useState<Partial<DashboardData> | null>(null);
    const [isCalculating, setIsCalculating] = useState(true);
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize worker
        workerRef.current = new Worker('/workers/dashboard-calculator.worker.js', { type: 'module' });

        workerRef.current.onmessage = (e) => {
            setStats(e.data);
            setIsCalculating(false);
        };

        workerRef.current.onerror = (error) => {
            console.error('Dashboard worker error:', error);
            setIsCalculating(false);
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        if (workerRef.current && inputData) {
            setIsCalculating(true);
            // Send data to worker (cloned automatically)
            // Note: Functions cannot be sent to workers, only serializable data
            workerRef.current.postMessage(inputData);
        }
    }, [inputData]);

    return { stats, isCalculating };
}
