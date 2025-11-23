"use client";

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { TrendingUp, Calendar, Package, AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import {
    analyzeHistoricalSales,
    calculateMaterialRequirements,
    getOverallConfidenceSummary,
    type ProductionSuggestion,
    type MaterialRequirement
} from '@/lib/services/production-intelligence';
import {
    loadFromLocalStorage,
    loadFromLocalStorageForBranch,
    KEYS,
    getActiveBranchId,
    availableBranches,
    loadAllProductsFromAllBranches,
    loadPendingProductionsData,
    savePendingProductionsData
} from '@/lib/data-storage';
import type { Sale, Product, Recipe, RawMaterialInventoryItem } from '@/lib/types/db-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export default function ProductionPlannerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [targetDate, setTargetDate] = useState<Date>(new Date());
    const [suggestions, setSuggestions] = useState<ProductionSuggestion[]>([]);
    const [plannedQuantities, setPlannedQuantities] = useState<Map<string, number>>(new Map());
    const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([]);
    const [activeBranch, setActiveBranch] = useState<string>('');

    // New states for execution
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);

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
    // Calcular materia prima cuando cambien las cantidades
    useEffect(() => {
        if (!activeBranch || plannedQuantities.size === 0) return;

        const recipes = loadFromLocalStorage<Recipe[]>(KEYS.RECIPES);
        const inventory = loadFromLocalStorage<RawMaterialInventoryItem[]>(KEYS.RAW_MATERIAL_INVENTORY);

        // Convertir IDs a Nombres para el cálculo de materiales
        const plannedByName = new Map<string, number>();
        plannedQuantities.forEach((qty, id) => {
            const suggestion = suggestions.find(s => s.productId === id);
            if (suggestion) {
                plannedByName.set(suggestion.productName, qty);
            } else {
                plannedByName.set(id, qty);
            }
        });

        const requirements = calculateMaterialRequirements(plannedByName, recipes, inventory);
        setMaterialRequirements(requirements);
    }, [plannedQuantities, activeBranch, suggestions]);

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
                                                    <Checkbox
                                                        checked={selectedProducts.has(suggestion.productId)}
                                                        onCheckedChange={(checked) => {
                                                            const newSelected = new Set(selectedProducts);
                                                            if (checked) {
                                                                newSelected.add(suggestion.productId);
                                                            } else {
                                                                newSelected.delete(suggestion.productId);
                                                            }
                                                            setSelectedProducts(newSelected);
                                                        }}
                                                    />
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

                {/* Floating Execute Button */}
                {/* Floating Execute Button */}
                {suggestions.length > 0 && (
                    <div className="fixed bottom-6 right-6 z-50">
                        <Button
                            onClick={() => setIsExecutionDialogOpen(true)}
                            size="lg"
                            disabled={selectedProducts.size === 0}
                            className={selectedProducts.size === 0
                                ? "bg-gray-400 hover:bg-gray-400 shadow-xl px-8 py-6 text-lg font-bold cursor-not-allowed"
                                : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-2xl px-8 py-6 text-lg font-bold"
                            }
                        >
                            <CheckCircle2 className="mr-2 h-6 w-6" />
                            Enviar a Producción ({selectedProducts.size})
                        </Button>
                    </div>
                )}

                {/* Execution Confirmation Dialog */}
                <Dialog open={isExecutionDialogOpen} onOpenChange={setIsExecutionDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                                Confirmar Envío a Producción
                            </DialogTitle>
                            <DialogDescription>
                                Se enviarán {selectedProducts.size} producto(s) a la cola de producción pendiente de cada sede correspondiente.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {Array.from(selectedProducts).map(productId => {
                                const suggestion = suggestions.find(s => s.productId === productId);
                                const quantity = plannedQuantities.get(productId) || 0;

                                if (!suggestion || quantity === 0) return null;

                                return (
                                    <div key={productId} className="p-4 bg-gray-50 rounded-lg border">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-gray-800">{suggestion.productName}</span>
                                            <span className="text-sm font-mono bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                                                {quantity} lote(s)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsExecutionDialogOpen(false)}
                                disabled={isExecuting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={async () => {
                                    setIsExecuting(true);
                                    try {
                                        // 1. Cargar todos los productos para obtener sourceBranchId
                                        const allProducts = loadAllProductsFromAllBranches();

                                        // 2. Cargar todas las recetas para calcular batchMultiplier
                                        const allRecipesMap = new Map<string, Recipe>();
                                        availableBranches.forEach(branch => {
                                            const recipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branch.id) || [];
                                            recipes.forEach(r => allRecipesMap.set(r.name.toLowerCase(), r));
                                        });

                                        // 3. Agrupar ítems por sede
                                        const pendingItemsByBranch = new Map<string, any[]>();

                                        Array.from(selectedProducts).forEach(productId => {
                                            const suggestion = suggestions.find(s => s.productId === productId);
                                            const quantity = plannedQuantities.get(productId) || 0;

                                            if (suggestion && quantity > 0) {
                                                const product = allProducts.find(p => p.id === productId);
                                                if (!product || !product.sourceBranchId) {
                                                    console.warn(`Producto ${suggestion.productName} no tiene sede asignada.`);
                                                    return;
                                                }

                                                const branchId = product.sourceBranchId;
                                                const branchName = availableBranches.find(b => b.id === branchId)?.name || 'Desconocida';

                                                // Calcular batchMultiplier
                                                const recipe = allRecipesMap.get(suggestion.productName.toLowerCase());
                                                let batchMultiplier = 1;
                                                if (recipe && typeof recipe.expectedYield === 'number' && recipe.expectedYield > 0) {
                                                    batchMultiplier = parseFloat((quantity / recipe.expectedYield).toFixed(2));
                                                }

                                                const pendingItem = {
                                                    id: `PEND-${Date.now()}-${productId}-${Math.random().toString(36).substr(2, 5)}`,
                                                    productId,
                                                    productName: suggestion.productName,
                                                    plannedQuantity: quantity,
                                                    batchMultiplier,
                                                    branchId,
                                                    branchName,
                                                    date: format(targetDate, 'yyyy-MM-dd'),
                                                    status: 'pending',
                                                    timestamp: new Date().toISOString()
                                                };

                                                if (!pendingItemsByBranch.has(branchId)) {
                                                    pendingItemsByBranch.set(branchId, []);
                                                }
                                                pendingItemsByBranch.get(branchId)!.push(pendingItem);
                                            }
                                        });

                                        // 4. Guardar por sede
                                        let totalSent = 0;
                                        const summaryBranches: string[] = [];

                                        pendingItemsByBranch.forEach((items, branchId) => {
                                            const existing = loadPendingProductionsData(branchId);
                                            savePendingProductionsData(branchId, [...existing, ...items]);
                                            totalSent += items.length;
                                            const bName = items[0].branchName;
                                            summaryBranches.push(`${bName} (${items.length})`);
                                        });

                                        toast({
                                            title: "✅ Enviado a Producción",
                                            description: `${totalSent} órdenes enviadas a: ${summaryBranches.join(', ')}`,
                                            duration: 4000
                                        });

                                        setSelectedProducts(new Set());
                                        setIsExecutionDialogOpen(false);
                                        router.push('/production');

                                    } catch (error) {
                                        console.error(error);
                                        toast({
                                            title: "Error",
                                            description: "No se pudo enviar a producción.",
                                            variant: "destructive"
                                        });
                                    } finally {
                                        setIsExecuting(false);
                                    }
                                }}
                                disabled={isExecuting}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isExecuting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Confirmar Envío
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
