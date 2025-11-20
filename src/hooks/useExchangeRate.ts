/**
 * Custom hook for managing exchange rate data and operations
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import {
    loadExchangeRate,
    saveExchangeRate,
    removeExchangeRate,
    loadFromLocalStorage,
    KEYS,
    type ExchangeRateEntry
} from '@/lib/data-storage';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface UseExchangeRateReturn {
    currentRate: number;
    rateInput: string;
    setRateInput: (value: string) => void;
    rateHistory: ExchangeRateEntry[];
    pastDate: Date | undefined;
    setPastDate: (date: Date | undefined) => void;
    pastRateInput: string;
    setPastRateInput: (value: string) => void;
    isPastDatePickerOpen: boolean;
    setIsPastDatePickerOpen: (open: boolean) => void;
    saveCurrentRate: () => Promise<{ success: boolean; message: string }>;
    savePastRate: () => Promise<{ success: boolean; message: string }>;
    deleteRate: (entry: ExchangeRateEntry) => Promise<{ success: boolean; message: string }>;
    refreshHistory: () => void;
}

export function useExchangeRate(): UseExchangeRateReturn {
    const [currentRate, setCurrentRate] = useState<number>(0);
    const [rateInput, setRateInput] = useState<string>('');
    const [rateHistory, setRateHistory] = useState<ExchangeRateEntry[]>([]);
    const [pastDate, setPastDate] = useState<Date | undefined>();
    const [pastRateInput, setPastRateInput] = useState<string>('');
    const [isPastDatePickerOpen, setIsPastDatePickerOpen] = useState(false);

    const refreshHistory = useCallback(() => {
        const history = loadFromLocalStorage<ExchangeRateEntry[]>(KEYS.EXCHANGE_RATE_HISTORY, false);
        setRateHistory(history.slice(0, 7)); // Get last 7 entries
    }, []);

    useEffect(() => {
        const loadedRate = loadExchangeRate();
        setCurrentRate(loadedRate);
        setRateInput(loadedRate > 0 ? loadedRate.toString() : '');
        refreshHistory();
    }, [refreshHistory]);

    const saveCurrentRate = useCallback(async (): Promise<{ success: boolean; message: string }> => {
        const rateNumber = parseFloat(rateInput);
        if (isNaN(rateNumber) || rateNumber <= 0) {
            return {
                success: false,
                message: 'Por favor, ingresa una tasa de cambio válida y positiva.'
            };
        }

        saveExchangeRate(rateNumber);
        setCurrentRate(rateNumber);
        refreshHistory();

        return {
            success: true,
            message: `La tasa de cambio USD/VES se ha guardado como ${rateNumber.toFixed(4)}.`
        };
    }, [rateInput, refreshHistory]);

    const savePastRate = useCallback(async (): Promise<{ success: boolean; message: string }> => {
        if (!pastDate) {
            return {
                success: false,
                message: 'Por favor, selecciona una fecha.'
            };
        }

        const rateNumber = parseFloat(pastRateInput);
        if (isNaN(rateNumber) || rateNumber <= 0) {
            return {
                success: false,
                message: 'Por favor, ingresa una tasa válida y positiva.'
            };
        }

        saveExchangeRate(rateNumber, pastDate);
        setPastDate(undefined);
        setPastRateInput('');
        refreshHistory();

        return {
            success: true,
            message: `La tasa para el ${format(pastDate, "dd/MM/yyyy", { locale: es })} se ha guardado como ${rateNumber.toFixed(4)}.`
        };
    }, [pastDate, pastRateInput, refreshHistory]);

    const deleteRate = useCallback(async (entry: ExchangeRateEntry): Promise<{ success: boolean; message: string }> => {
        removeExchangeRate(entry.date);
        refreshHistory();

        return {
            success: true,
            message: `La tasa para el ${format(parseISO(entry.date), "dd/MM/yyyy", { locale: es })} ha sido eliminada.`
        };
    }, [refreshHistory]);

    return {
        currentRate,
        rateInput,
        setRateInput,
        rateHistory,
        pastDate,
        setPastDate,
        pastRateInput,
        setPastRateInput,
        isPastDatePickerOpen,
        setIsPastDatePickerOpen,
        saveCurrentRate,
        savePastRate,
        deleteRate,
        refreshHistory
    };
}
