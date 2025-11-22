"use client";

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Calendar, Package, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
    analyzeHistoricalSales,
    calculateMaterialRequirements,
    getOverallConfidenceSummary,
    type ProductionSuggestion,
    type MaterialRequirement
} from '@/lib/services/production-intelligence';
import { loadFromLocalStorage, loadFromLocalStorageForBranch, KEYS, getActiveBranchId, availableBranches } from '@/lib/data-storage';
import type { Sale, Product, Recipe, RawMaterialInventoryItem } from '@/lib/types/db-types';

export default function ProductionPlannerPage() {
    const [targetDate, setTargetDate] = useState<Date>(new Date());
    const [suggestions, setSuggestions] = useState<ProductionSuggestion[]>([]);
    const [plannedQuantities, setPlannedQuantities] = useState<Map<string, number>>(new Map());
    const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([]);
    const [activeBranch, setActiveBranch] = useState<string>('');

    // Cargar datos y generar sugerencias (GLOBAL)
    useEffect(() => {
        const branchId = getActiveBranchId();
        if (!branchId) return;
        setActiveBranch(branchId);

        // Cargar datos de TODAS las sedes
        const allProducts: Product[] = [];
        const allRecipes: Recipe[] = [];

        availableBranches.forEach(branch => {
            const branchProducts = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branch.id) || [];
            const branchRecipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branch.id) || [];

            // Filtrar "No Despachable"
            const validProducts = branchProducts.filter((p: Product) => {
                if (!p || !p.name) return false;
                return !p.name.toLowerCase().includes('no despachable');
            });

            allProducts.push(...validProducts);
            allRecipes.push(...branchRecipes);
        });

        // Ventas son globales
        const sales = loadFromLocalStorage<Sale[]>(KEYS.SALES) || [];

        const generatedSuggestions = analyzeHistoricalSales(targetDate, sales, allProducts, allRecipes);
        setSuggestions(generatedSuggestions);

        // Inicializar cantidades planificadas con las sugerencias
        const initialPlanned = new Map<string, number>();
        generatedSuggestions.forEach((s: ProductionSuggestion) => {
            initialPlanned.set(s.productId, s.suggestedQuantity);
        });
        setPlannedQuantities(initialPlanned);
    }, [targetDate]);

    // Calcular materia prima cuando cambien las cantidades
    useEffect(() => {
        if (!activeBranch || plannedQuantities.size === 0) return;

        const recipes = loadFromLocalStorage<Recipe[]>(KEYS.RECIPES);
        const inventory = loadFromLocalStorage<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY);

        const requirements = calculateMaterialRequirements(plannedQuantities, recipes, inventory);
        setMaterialRequirements(requirements);
    }, [plannedQuantities, activeBranch]);

    const handleQuantityChange = (productId: string, newQuantity: number) => {
        const updated = new Map(plannedQuantities);
        updated.set(productId, Math.max(0, newQuantity));
        setPlannedQuantities(updated);
    };

    const confidenceSummary = useMemo(() => {
        return getOverallConfidenceSummary(suggestions);
    }, [suggestions]);

    const getConfidenceIcon = (confidence: 'low' | 'medium' | 'high') => {
        switch (confidence) {
            case 'high':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'medium':
                return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
            case 'low':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
    };

    const getConfidenceLabel = (confidence: 'low' | 'medium' | 'high') => {
        switch (confidence) {
            case 'high':
                return 'Alta';
            case 'medium':
                return 'Media';
            case 'low':
                return 'Baja';
        }
    };

    // Agrupar por categorías
    const suggestionsByCategory = useMemo(() => {
        const grouped = new Map<string, ProductionSuggestion[]>();
        suggestions.forEach((s: ProductionSuggestion) => {
            const category = s.category || 'Sin Categoría';
            if (!grouped.has(category)) {
                grouped.set(category, []);
            }
            grouped.get(category)!.push(s);
        });
        return grouped;
    }, [suggestions]);

    const totalPlanned = useMemo(() => {
        let total = 0;
        plannedQuantities.forEach((qty: number) => total += qty);
        return total;
    }, [plannedQuantities]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">Planificador Inteligente</h1>
                            <p className="text-sm text-gray-500">Sugerencias basadas en análisis de ventas históricas</p>
                        </div>
                    </div>

                    {/* Date Picker */}
                    <div className="bg-white rounded-xl shadow-md p-4 mb-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                                <label className="text-sm font-medium text-gray-700">Fecha de Producción:</label>
                            </div>
                            <input
                                type="date"
                                value={format(targetDate, 'yyyy-MM-dd')}
                                onChange={(e) => {
                                    // Parsear la fecha correctamente sin problemas de zona horaria
                                    const [year, month, day] = e.target.value.split('-').map(Number);
                                    const selected = new Date(year, month - 1, day);
                                    const dayOfWeek = selected.getDay();

                                    // Bloquear sábados (6) y domingos (0)
                                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                                        alert('No se puede planificar producción para fines de semana. Solo de lunes a viernes.');
                                        return;
                                    }

                                    setTargetDate(selected);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <div className="ml-2 text-sm text-gray-600">
                                → Para vender: <span className="font-semibold text-indigo-600">
                                    {format(new Date(targetDate.getTime() + 86400000), "EEEE d 'de' MMMM", { locale: es })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Confidence Summary */}
                    <div className="flex items-center gap-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-gray-700">Alta: {confidenceSummary.high}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium text-gray-700">Media: {confidenceSummary.medium}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-gray-700">Baja: {confidenceSummary.low}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tabla de Sugerencias */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Package className="w-6 h-6" />
                                    Sugerencias de Producción
                                </h2>
                            </div>

                            <div className="p-6">
                                {Array.from(suggestionsByCategory.entries()).map(([category, items]) => (
                                    <div key={category} className="mb-6 last:mb-0">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                                            {category}
                                        </h3>
                                        <div className="space-y-2">
                                            {items.map(suggestion => (
                                                <div
                                                    key={suggestion.productId}
                                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-800">{suggestion.productName}</span>
                                                            {getConfidenceIcon(suggestion.confidence)}
                                                            <span className="text-xs text-gray-500">
                                                                ({getConfidenceLabel(suggestion.confidence)})
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-600 mt-1">
                                                            Promedio: {suggestion.averageSales.toFixed(1)} unidades
                                                            {!suggestion.hasRecipe && (
                                                                <span className="ml-2 text-orange-600">⚠️ Sin receta</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-600">A Producir:</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={plannedQuantities.get(suggestion.productId) || 0}
                                                            onChange={(e) =>
                                                                handleQuantityChange(suggestion.productId, parseInt(e.target.value) || 0)
                                                            }
                                                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {suggestions.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No hay suficientes datos históricos para generar sugerencias.</p>
                                        <p className="text-sm mt-1">Asegúrate de tener ventas registradas.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Panel de Materia Prima */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden sticky top-6">
                            <div className="p-6 bg-gradient-to-r from-green-500 to-emerald-600">
                                <h2 className="text-xl font-bold text-white">Materia Prima</h2>
                            </div>

                            <div className="p-6 max-h-[600px] overflow-y-auto">
                                {materialRequirements.length > 0 ? (
                                    <div className="space-y-3">
                                        {materialRequirements.map((req, index) => (
                                            <div
                                                key={index}
                                                className={`p-3 rounded-lg ${req.shortage > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="font-medium text-gray-800">{req.materialName}</span>
                                                    {req.shortage > 0 && (
                                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    Necesario: <span className="font-semibold">{req.requiredAmount.toFixed(2)}</span> {req.unit}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Stock: <span className="font-semibold">{req.currentStock.toFixed(2)}</span> {req.unit}
                                                </div>
                                                {req.shortage > 0 && (
                                                    <div className="text-sm text-red-600 font-semibold mt-1">
                                                        ⚠️ Falta: {req.shortage.toFixed(2)} {req.unit}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Configure cantidades para ver<br />materiales necesarios</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
