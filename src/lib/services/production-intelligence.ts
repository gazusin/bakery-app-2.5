"use client";

import { Sale, Product, Recipe, RawMaterialInventoryItem } from '@/lib/types/db-types';
import { convertMaterialToBaseUnit } from '@/lib/data-storage';
import { parseISO, getDay, subWeeks, isSameDay, startOfDay } from 'date-fns';

// --- Types ---

export interface ProductionSuggestion {
    productId: string;
    productName: string;
    category: string;
    averageSales: number;
    suggestedQuantity: number;
    confidence: 'low' | 'medium' | 'high';
    historicalData: number[];
    variance: number;
    hasRecipe: boolean;
}

export interface MaterialRequirement {
    materialName: string;
    requiredAmount: number;
    unit: string;
    currentStock: number;
    shortage: number;
}

// --- Configuration ---
const WEEKS_TO_ANALYZE = 6;
const SAFETY_MARGIN = 0;

// Pesos para promedio ponderado (más reciente = más peso)
const WEEK_WEIGHTS = [0.03, 0.07, 0.15, 0.20, 0.25, 0.30];

// --- Core Functions ---

export function analyzeHistoricalSales(
    targetDate: Date,
    allSales: Sale[],
    allProducts: Product[],
    recipes?: Recipe[]
): ProductionSuggestion[] {
    // La fecha seleccionada es el DÍA DE PRODUCCIÓN
    // Analizamos ventas del DÍA SIGUIENTE (porque se produce hoy para vender mañana)
    const salesDate = new Date(targetDate);
    salesDate.setDate(salesDate.getDate() + 1);
    const targetDayOfWeek = getDay(salesDate);

    const suggestions: ProductionSuggestion[] = [];

    // Filtrar productos que CONTENGAN "No Despachable" en el nombre (case-insensitive)
    const validProducts = allProducts.filter(p => {
        const normalizedName = p.name?.trim().toLowerCase() || '';
        const isNoDespachable = normalizedName.includes('no despachable');
        return !isNoDespachable;
    });

    for (const product of validProducts) {
        const historicalData = extractHistoricalSalesForProduct(
            product.id,
            targetDayOfWeek,
            salesDate,
            allSales
        );

        if (historicalData.length === 0) continue;

        const averageSales = calculateWeightedAverage(historicalData);
        const variance = calculateVariance(historicalData, averageSales);
        const confidence = determineConfidence(variance, averageSales);
        const suggestedQuantity = Math.round(averageSales * (1 + SAFETY_MARGIN));
        const hasRecipe = recipes ? recipes.some(r => r.name === product.name) : false;

        suggestions.push({
            productId: product.id,
            productName: product.name,
            category: product.category,
            averageSales,
            suggestedQuantity,
            confidence,
            historicalData,
            variance,
            hasRecipe,
        });
    }

    return suggestions.sort((a, b) => b.suggestedQuantity - a.suggestedQuantity);
}

function extractHistoricalSalesForProduct(
    productId: string,
    targetDayOfWeek: number,
    targetDate: Date,
    allSales: Sale[]
): number[] {
    const salesByWeek: number[] = [];
    const targetDateStart = startOfDay(targetDate);

    for (let weekOffset = 1; weekOffset <= WEEKS_TO_ANALYZE; weekOffset++) {
        const historicalDate = subWeeks(targetDateStart, weekOffset);
        const salesOnDate = allSales.filter(sale => {
            const saleDate = parseISO(sale.date);
            return isSameDay(saleDate, historicalDate);
        });

        let totalSold = 0;
        for (const sale of salesOnDate) {
            if (!sale.itemsPerBranch || !Array.isArray(sale.itemsPerBranch)) continue;

            for (const branchDetail of sale.itemsPerBranch) {
                if (!branchDetail.items) continue;

                for (const item of branchDetail.items) {
                    if (item.productId === productId) {
                        totalSold += item.quantity || 0;
                    }
                }
            }

            if (sale.changes && Array.isArray(sale.changes)) {
                for (const change of sale.changes) {
                    if (change.productId === productId) {
                        totalSold -= change.quantity || 0;
                    }
                }
            }
        }

        salesByWeek.push(totalSold);
    }

    return salesByWeek.reverse();
}

export function calculateWeightedAverage(values: number[]): number {
    if (values.length === 0) return 0;

    const weightsToUse = WEEK_WEIGHTS.slice(-values.length);
    const totalWeight = weightsToUse.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weightsToUse.map(w => w / totalWeight);

    let weightedSum = 0;
    for (let i = 0; i < values.length; i++) {
        weightedSum += values[i] * normalizedWeights[i];
    }

    return weightedSum;
}

function calculateVariance(values: number[], average: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(v => Math.pow(v - average, 2));
    const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / values.length;
    return variance;
}

export function determineConfidence(
    variance: number,
    average: number
): 'low' | 'medium' | 'high' {
    if (average === 0) return 'low';

    const standardDeviation = Math.sqrt(variance);
    const cv = standardDeviation / average;

    if (cv < 0.15) return 'high';
    if (cv < 0.30) return 'medium';
    return 'low';
}

export function calculateMaterialRequirements(
    plannedProduction: Map<string, number>,
    recipes: Recipe[],
    inventory: RawMaterialInventoryItem[]
): MaterialRequirement[] {
    // Map to store total needs in BASE UNITS (g, ml, unidad)
    // Key: materialName, Value: { amount: number, baseUnit: string }
    const materialNeeds = new Map<string, { amount: number, baseUnit: string }>();

    for (const [productId, quantity] of plannedProduction.entries()) {
        if (quantity <= 0) continue;

        let recipe = recipes.find(r =>
            r.name === productId ||
            r.id === productId ||
            r.name.toLowerCase() === productId.toLowerCase()
        );

        if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
            console.warn(`No se encontró receta o ingredientes para: ${productId}`);
            continue;
        }

        for (const ingredient of recipe.ingredients) {
            const materialName = ingredient.name || '';
            if (!materialName) continue;

            // Convert ingredient quantity to base unit
            const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(
                ingredient.quantity || 0,
                ingredient.unit || 'unidad',
                materialName
            );

            // ADJUSTMENT FOR YIELD (BATCH SIZE)
            // Recipes are defined per "Batch" (e.g. 1 sack of flour).
            // expectedYield is the number of units produced by that batch.
            // So, usage per unit = baseQuantity / expectedYield.

            const yieldAmount = (recipe.expectedYield && recipe.expectedYield > 0) ? recipe.expectedYield : 1;
            const baseQuantityPerUnit = baseQuantity / yieldAmount;

            const totalBaseAmountNeeded = baseQuantityPerUnit * quantity;

            const currentEntry = materialNeeds.get(materialName);
            if (currentEntry) {
                // If units match (should, as they are base units), add up
                if (currentEntry.baseUnit === baseUnit) {
                    currentEntry.amount += totalBaseAmountNeeded;
                } else {
                    // Mismatch in base units for same material name? Rare but possible if data is messy.
                    // We'll assume the first one is correct or just add if they are compatible?
                    // For now, just add and hope.
                    currentEntry.amount += totalBaseAmountNeeded;
                }
            } else {
                materialNeeds.set(materialName, { amount: totalBaseAmountNeeded, baseUnit });
            }
        }
    }

    const requirements: MaterialRequirement[] = [];

    for (const [materialName, need] of materialNeeds.entries()) {
        const stockItem = inventory.find(
            item => item.name?.toLowerCase() === materialName.toLowerCase()
        );

        const inventoryUnit = stockItem?.unit || need.baseUnit || 'kg';
        const currentStock = stockItem?.quantity || 0;

        // We need to compare the Need (in Base Unit) vs Stock (in Inventory Unit)
        // Best approach: Convert Need to Inventory Unit

        let requiredAmountInInventoryUnit = need.amount;

        // Simple conversion back from Base Unit to Inventory Unit
        // This covers the most common cases: g -> kg, ml -> l
        if (need.baseUnit === 'g' && (inventoryUnit === 'kg' || inventoryUnit === 'kilo')) {
            requiredAmountInInventoryUnit = need.amount / 1000;
        } else if (need.baseUnit === 'ml' && (inventoryUnit === 'l' || inventoryUnit === 'litro')) {
            requiredAmountInInventoryUnit = need.amount / 1000;
        } else if (need.baseUnit === 'g' && inventoryUnit === 'g') {
            requiredAmountInInventoryUnit = need.amount;
        } else if (need.baseUnit === 'ml' && inventoryUnit === 'ml') {
            requiredAmountInInventoryUnit = need.amount;
        } else {
            // Fallback: If we can't easily convert back, we might have a mismatch.
            // But convertMaterialToBaseUnit handles 'kg' -> 'g'.
            // If inventory is 'saco' (e.g. 50kg), we need to know the factor.
            // Since we don't have a 'convertBaseToCustom' easily, we will try to convert Stock to Base for shortage calc,
            // but for Display, we want to show in Inventory Units.

            // Let's try to convert Stock to Base to calculate shortage accurately first.
            const { quantity: stockInBase } = convertMaterialToBaseUnit(currentStock, inventoryUnit, materialName);

            // Shortage in Base Units
            const shortageInBase = Math.max(0, need.amount - stockInBase);

            // Now we have Requirement (Base) and Shortage (Base).
            // We want to display them in Inventory Units if possible.
            // If we can't convert Base -> Inventory Unit easily, we might just show Base Units?
            // User prefers Inventory Units ("dice kilos").

            // Let's try to derive a factor: StockBase / StockOriginal = Factor.
            // If Stock is 0, we can't derive.
            // We can use convertMaterialToBaseUnit(1, inventoryUnit) to get the factor!
            const { quantity: oneUnitInBase } = convertMaterialToBaseUnit(1, inventoryUnit, materialName);

            if (oneUnitInBase > 0) {
                requiredAmountInInventoryUnit = need.amount / oneUnitInBase;
            }
        }

        const shortage = Math.max(0, requiredAmountInInventoryUnit - currentStock);

        requirements.push({
            materialName,
            requiredAmount: requiredAmountInInventoryUnit,
            unit: inventoryUnit,
            currentStock,
            shortage,
        });
    }

    return requirements.sort((a, b) => b.shortage - a.shortage);
}

export function getOverallConfidenceSummary(suggestions: ProductionSuggestion[]): {
    high: number;
    medium: number;
    low: number;
    noData: number;
} {
    const summary = { high: 0, medium: 0, low: 0, noData: 0 };

    for (const suggestion of suggestions) {
        if (suggestion.historicalData.length === 0) {
            summary.noData++;
        } else {
            summary[suggestion.confidence]++;
        }
    }

    return summary;
}
