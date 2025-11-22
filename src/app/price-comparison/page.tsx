
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListFilter, Loader2, Star, Info, PlusCircle, Trash2, Save, FolderOpen, TrendingUp, TrendingDown, DollarSign, Calculator, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  suppliersData as initialSuppliersData,
  getCurrentRawMaterialOptions,
  type Supplier,
  type PriceHistoryEntry,
  loadExchangeRate,
  getBestPriceInfo,
  type BestPriceInfo,
  convertMaterialToBaseUnit,
  getCurrentPriceFromHistory,
  commonUnitOptions,
  KEYS,
  loadFromLocalStorage,
  loadFromLocalStorageForBranch,
  saveComparisonRecipesData,
  type Product,
  type Recipe,
  type ExchangeRateEntry,
  availableBranches
} from '@/lib/data-storage';
import { format, parseISO, subDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from "@/components/ui/slider";

// --- Tipos para el Simulador de Recetas (Existente) ---
export interface SimulatedRecipeItem {
  id: string;
  rawMaterialName: string;
  quantity: number;
  unit: string;
}

export interface SimulatedRecipe {
  id: string;
  name: string;
  items: SimulatedRecipeItem[];
  createdAt: string;
}

interface SupplierCostSummary {
  supplierId: string;
  supplierName: string;
  totalCost: number;
  unfulfillableItems: string[];
}

const NEW_RECIPE_VALUE = "__NEW_RECIPE__";

// --- Tipos para el Análisis de Rentabilidad (Nuevo) ---
interface ProductProfitability {
  productId: string;
  productName: string;
  currentCostUSD: number;
  currentPriceUSD: number;
  currentMarginPercent: number;
  simulatedCostUSD: number;
  simulatedPriceUSD: number;
  simulatedMarginPercent: number;
  recipeName?: string;
}

export default function CostSimulatorPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profitability");
  const [isLoading, setIsLoading] = useState(true);

  // --- Estado Global ---
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [exchangeRateHistory, setExchangeRateHistory] = useState<ExchangeRateEntry[]>([]);

  // --- Estado Análisis de Rentabilidad ---
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inflationPercentage, setInflationPercentage] = useState<number>(0);
  const [simulatedExchangeRate, setSimulatedExchangeRate] = useState<number>(0);
  const [customPriceOverrides, setCustomPriceOverrides] = useState<Record<string, number>>({});

  // --- Estado Comparador de Proveedores ---
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [rawMaterialOptions, setRawMaterialOptions] = useState<string[]>([]);
  const [recipeName, setRecipeName] = useState('Mi Nueva Receta');
  const [recipeItems, setRecipeItems] = useState<SimulatedRecipeItem[]>([
    { id: `item-${Date.now()}`, rawMaterialName: '', quantity: 1, unit: 'kg' }
  ]);
  const [savedRecipes, setSavedRecipes] = useState<SimulatedRecipe[]>([]);
  const [selectedSavedRecipeId, setSelectedSavedRecipeId] = useState<string>(NEW_RECIPE_VALUE);

  const COMPARISON_RECIPES_KEY = 'bakery_comparison_recipes';

  const loadPageData = useCallback(() => {
    setIsLoading(true);

    // Cargar datos globales
    const currentRate = loadExchangeRate();
    setExchangeRate(currentRate);
    setSimulatedExchangeRate(currentRate);

    const history = loadFromLocalStorage<ExchangeRateEntry[]>(KEYS.EXCHANGE_RATE_HISTORY) || [];
    setExchangeRateHistory(history);

    // Cargar datos para Rentabilidad (GLOBAL - Todas las sedes)
    const allProducts: Product[] = [];
    const allRecipes: Recipe[] = [];

    availableBranches.forEach(branch => {
      const branchProducts = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branch.id) || [];
      const branchRecipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branch.id) || [];

      // Filtrar "No Despachable"
      const validProducts = branchProducts.filter(p => !p.name.toLowerCase().includes('no despachable'));

      allProducts.push(...validProducts);
      allRecipes.push(...branchRecipes);
    });

    setProducts(allProducts);
    setRecipes(allRecipes);

    // Cargar datos para Comparador
    const suppliers = [...initialSuppliersData];
    const materialOptions = getCurrentRawMaterialOptions().sort((a, b) => a.localeCompare(b));
    setAllSuppliers(suppliers);
    setRawMaterialOptions(materialOptions);

    const loadedSavedRecipes = loadFromLocalStorage<SimulatedRecipe[]>(COMPARISON_RECIPES_KEY) || [];
    setSavedRecipes(loadedSavedRecipes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    if (materialOptions.length > 0 && recipeItems.length === 1 && recipeItems[0].rawMaterialName === '') {
      setRecipeItems([{ id: `item-${Date.now()}`, rawMaterialName: materialOptions[0], quantity: 1, unit: 'kg' }]);
    }

    setIsLoading(false);
  }, [recipeItems]); // recipeItems en dep por el check de inicialización, aunque podría optimizarse

  useEffect(() => {
    loadPageData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if ([KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS, KEYS.PRODUCTS, KEYS.RECIPES, KEYS.EXCHANGE_RATE].includes(customEvent.detail?.key)) {
        loadPageData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, [loadPageData]);

  // --- Lógica Análisis de Rentabilidad ---

  const exchangeRateTrend = useMemo(() => {
    if (exchangeRateHistory.length < 2) return null;

    // Ordenar por fecha descendente (más reciente primero)
    const sortedHistory = [...exchangeRateHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latest = sortedHistory[0];
    const thirtyDaysAgoDate = subDays(new Date(), 30);

    // Buscar el registro más cercano a hace 30 días
    const oldEntry = sortedHistory.find(entry => new Date(entry.date) <= thirtyDaysAgoDate) || sortedHistory[sortedHistory.length - 1];

    if (!latest || !oldEntry || latest.rate === 0 || oldEntry.rate === 0) return null;

    const percentChange = ((latest.rate - oldEntry.rate) / oldEntry.rate) * 100;
    const daysDiff = differenceInDays(parseISO(latest.date), parseISO(oldEntry.date));

    return {
      percentChange,
      daysDiff,
      trend: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral'
    };
  }, [exchangeRateHistory]);

  // Sugerir inflación basada en la tendencia (si es positiva)
  useEffect(() => {
    if (exchangeRateTrend && exchangeRateTrend.percentChange > 0 && inflationPercentage === 0) {
      // Sugerir la mitad de la tendencia mensual como inflación "segura" por defecto, o el usuario lo ajusta
      // setInflationPercentage(Math.ceil(exchangeRateTrend.percentChange)); 
      // Mejor no sobrescribir automáticamente para no molestar, solo mostrar el dato.
    }
  }, [exchangeRateTrend]);

  const profitabilityData = useMemo(() => {
    return products.map(product => {
      // Buscar receta por nombre (case insensitive)
      const recipe = recipes.find(r => r.name.toLowerCase() === product.name.toLowerCase());

      let currentCostUSD = 0;

      if (recipe) {
        // Calcular costo real basado en ingredientes y mejores precios actuales
        recipe.ingredients.forEach(ing => {
          const bestPrice = getBestPriceInfo(ing.name, 'default');
          if (bestPrice) {
            const conversion = convertMaterialToBaseUnit(ing.quantity, ing.unit, ing.name);

            // Ajustar por rendimiento de receta (Batch vs Unidad)
            // La cantidad en receta es para el LOTE completo.
            // Costo del ingrediente para el lote = Cantidad * PrecioBase
            // Costo por unidad = Costo Lote / Yield

            const batchCost = conversion.quantity * bestPrice.pricePerBaseUnit;
            const yieldDivisor = (recipe.expectedYield && recipe.expectedYield > 0) ? recipe.expectedYield : 1;

            currentCostUSD += (batchCost / yieldDivisor);
          }
        });
      } else {
        // Si no hay receta, usar un costo estimado (ej. 60% del precio) o 0
        // Para este simulador, si no hay receta, el costo es 0 y se marca.
      }

      // Precios
      const currentPriceUSD = product.unitPrice; // Asumimos que el precio base del producto es en USD o convertido

      // Simulación
      const simulatedCostUSD = currentCostUSD * (1 + (inflationPercentage / 100));

      // El precio simulado puede ser sobrescrito por el usuario
      const userPriceOverride = customPriceOverrides[product.id];
      const simulatedPriceUSD = userPriceOverride !== undefined ? userPriceOverride : currentPriceUSD;

      // Márgenes
      const currentMarginPercent = currentPriceUSD > 0 ? ((currentPriceUSD - currentCostUSD) / currentPriceUSD) * 100 : 0;
      const simulatedMarginPercent = simulatedPriceUSD > 0 ? ((simulatedPriceUSD - simulatedCostUSD) / simulatedPriceUSD) * 100 : 0;

      return {
        productId: product.id,
        productName: product.name,
        currentCostUSD,
        currentPriceUSD,
        currentMarginPercent,
        simulatedCostUSD,
        simulatedPriceUSD,
        simulatedMarginPercent,
        recipeName: recipe?.name
      };
    }).filter(item => item.recipeName); // Solo mostrar productos con receta para que el análisis sea útil
  }, [products, recipes, inflationPercentage, customPriceOverrides]);

  const handleSimulatedPriceChange = (productId: string, newVal: string) => {
    const val = parseFloat(newVal);
    if (!isNaN(val)) {
      setCustomPriceOverrides(prev => ({ ...prev, [productId]: val }));
    }
  };

  // --- Lógica Comparador de Proveedores (Existente) ---
  const handleItemChange = (id: string, field: keyof SimulatedRecipeItem, value: string | number) => {
    setRecipeItems(prevItems =>
      prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity') {
            updatedItem.quantity = Math.max(0, Number(value));
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleAddItem = () => {
    const newItem: SimulatedRecipeItem = {
      id: `item-${Date.now()}`,
      rawMaterialName: rawMaterialOptions[0] || '',
      quantity: 1,
      unit: 'kg'
    };
    setRecipeItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setRecipeItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim() || recipeItems.length === 0 || recipeItems.every(i => !i.rawMaterialName)) {
      toast({ title: "Error", description: "La receta debe tener un nombre y al menos un ingrediente válido.", variant: "destructive" });
      return;
    }

    const newRecipe: SimulatedRecipe = {
      id: `recipe-${Date.now()}`,
      name: recipeName.trim(),
      items: recipeItems.filter(i => i.rawMaterialName),
      createdAt: new Date().toISOString()
    };

    const updatedSavedRecipes = [newRecipe, ...savedRecipes];
    saveComparisonRecipesData(updatedSavedRecipes);
    setSavedRecipes(updatedSavedRecipes);
    setSelectedSavedRecipeId(newRecipe.id);
    toast({ title: "Receta Guardada", description: `La receta "${newRecipe.name}" ha sido guardada.` });
  };

  const handleLoadRecipe = (recipeId: string) => {
    setSelectedSavedRecipeId(recipeId);
    if (recipeId === NEW_RECIPE_VALUE) {
      setRecipeName('Mi Nueva Receta');
      setRecipeItems([{ id: `item-${Date.now()}`, rawMaterialName: rawMaterialOptions[0] || '', quantity: 1, unit: 'kg' }]);
      return;
    }
    const recipeToLoad = savedRecipes.find(r => r.id === recipeId);
    if (recipeToLoad) {
      setRecipeName(recipeToLoad.name);
      setRecipeItems(recipeToLoad.items.map(item => ({ ...item, id: `item-${Date.now()}-${Math.random()}` })));
    }
  };

  const handleDeleteSavedRecipe = (recipeId: string) => {
    const updatedSavedRecipes = savedRecipes.filter(r => r.id !== recipeId);
    saveComparisonRecipesData(updatedSavedRecipes);
    setSavedRecipes(updatedSavedRecipes);
    if (selectedSavedRecipeId === recipeId) {
      handleLoadRecipe(NEW_RECIPE_VALUE);
    }
    toast({ title: "Receta Eliminada", description: "La receta guardada ha sido eliminada." });
  };

  const comparisonData = useMemo(() => {
    if (recipeItems.length === 0 || recipeItems.every(i => !i.rawMaterialName)) {
      return { supplierSummaries: [], bestPriceSummary: [] };
    }

    const supplierSummaries: SupplierCostSummary[] = allSuppliers.map(supplier => {
      let totalCost = 0;
      const unfulfillableItems: string[] = [];

      recipeItems.forEach(item => {
        if (!item.rawMaterialName) return;

        let itemCost = Infinity;

        const priceListToUse = supplier.priceList || [];

        let bestPriceForSupplier: { pricePerBaseUnit: number } | null = null;

        for (const priceItem of priceListToUse) {
          if (priceItem.rawMaterialName.toLowerCase() === item.rawMaterialName.toLowerCase()) {
            const currentPriceEntry = getCurrentPriceFromHistory(priceItem.priceHistory);
            if (currentPriceEntry) {
              const conversionResult = convertMaterialToBaseUnit(1, priceItem.unit, item.rawMaterialName);
              if (conversionResult.quantity > 0) {
                const pricePerBaseUnit = currentPriceEntry.price / conversionResult.quantity;
                if (bestPriceForSupplier === null || pricePerBaseUnit < bestPriceForSupplier.pricePerBaseUnit) {
                  bestPriceForSupplier = { pricePerBaseUnit };
                }
              }
            }
          }
        }

        if (bestPriceForSupplier) {
          const requiredConversion = convertMaterialToBaseUnit(item.quantity, item.unit, item.rawMaterialName);
          itemCost = requiredConversion.quantity * bestPriceForSupplier.pricePerBaseUnit;
        }

        if (itemCost === Infinity) {
          unfulfillableItems.push(item.rawMaterialName);
        } else {
          totalCost += itemCost;
        }
      });

      return { supplierId: supplier.id, supplierName: supplier.name, totalCost, unfulfillableItems };
    });

    const bestPriceSummary: (BestPriceInfo & { recipeItemId: string; cost: number })[] = [];
    recipeItems.forEach(item => {
      if (!item.rawMaterialName) return;
      const bestPriceInfo = getBestPriceInfo(item.rawMaterialName, 'default');
      if (bestPriceInfo) {
        const conversion = convertMaterialToBaseUnit(item.quantity, item.unit, item.rawMaterialName);
        if (conversion.unit === bestPriceInfo.baseUnit) {
          bestPriceSummary.push({
            ...bestPriceInfo,
            recipeItemId: item.id,
            cost: conversion.quantity * bestPriceInfo.pricePerBaseUnit
          });
        }
      }
    });

    return { supplierSummaries, bestPriceSummary };
  }, [recipeItems, allSuppliers]);

  const bestPriceTotalCost = useMemo(() => {
    return comparisonData.bestPriceSummary.reduce((sum, item) => sum + item.cost, 0);
  }, [comparisonData.bestPriceSummary]);


  if (isLoading) {
    return (<div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Cargando...</p></div>);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulador de Costos y Rentabilidad"
        description="Analiza la rentabilidad de tus productos y compara costos de proveedores."
        icon={Calculator}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profitability">Análisis de Rentabilidad</TabsTrigger>
          <TabsTrigger value="comparison">Comparador de Proveedores</TabsTrigger>
        </TabsList>

        {/* --- PESTAÑA 1: ANÁLISIS DE RENTABILIDAD --- */}
        <TabsContent value="profitability" className="space-y-4 mt-4">

          {/* Panel de Control de Simulación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Controles de Simulación
                </CardTitle>
                <CardDescription>Ajusta las variables para simular escenarios futuros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Inflación de Materia Prima: <span className="font-bold text-primary">{inflationPercentage}%</span></Label>
                    <span className="text-xs text-muted-foreground">Aumenta el costo de ingredientes</span>
                  </div>
                  <Slider
                    value={[inflationPercentage]}
                    onValueChange={(val) => setInflationPercentage(val[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-1">
                    <Label>Tasa de Cambio Simulada (VES/USD)</Label>
                    <Input
                      type="number"
                      value={simulatedExchangeRate}
                      onChange={(e) => setSimulatedExchangeRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => { setInflationPercentage(0); setSimulatedExchangeRate(exchangeRate); setCustomPriceOverrides({}); }}>
                    Resetear Simulación
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tendencia del Dólar</CardTitle>
              </CardHeader>
              <CardContent>
                {exchangeRateTrend ? (
                  <div className="flex flex-col items-center justify-center h-full py-2">
                    <div className={`text-3xl font-bold ${exchangeRateTrend.trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                      {exchangeRateTrend.percentChange > 0 ? '+' : ''}{exchangeRateTrend.percentChange.toFixed(2)}%
                    </div>
                    <p className="text-sm text-muted-foreground text-center mt-1">
                      Variación en los últimos {exchangeRateTrend.daysDiff} días
                    </p>
                    {exchangeRateTrend.trend === 'up' && (
                      <div className="mt-4 p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-600 dark:text-red-400 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Considera aumentar precios preventivamente.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Insuficientes datos históricos.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Resultados */}
          <Card>
            <CardHeader>
              <CardTitle>Rentabilidad por Producto</CardTitle>
              <CardDescription>Comparativa de costos reales vs precios de venta.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Costo Actual</TableHead>
                    <TableHead className="text-right font-bold text-blue-600">Costo Simulado</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right font-bold text-green-600">Precio Simulado</TableHead>
                    <TableHead className="text-right">Margen Actual</TableHead>
                    <TableHead className="text-right font-bold">Margen Simulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitabilityData.map(item => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        {item.productName}
                        <div className="text-xs text-muted-foreground">Receta: {item.recipeName}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <FormattedNumber value={item.currentCostUSD} prefix="$" />
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        <FormattedNumber value={item.simulatedCostUSD} prefix="$" />
                        {inflationPercentage > 0 && <span className="text-xs ml-1 text-red-500">↑</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <FormattedNumber value={item.currentPriceUSD} prefix="$" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-green-600 font-bold">$</span>
                          <Input
                            className="w-20 h-8 text-right p-1"
                            type="number"
                            value={item.simulatedPriceUSD}
                            onChange={(e) => handleSimulatedPriceChange(item.productId, e.target.value)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.currentMarginPercent < 30 ? "destructive" : "secondary"}>
                          {item.currentMarginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={item.simulatedMarginPercent < 30 ? "destructive" : "default"} className={item.simulatedMarginPercent < item.currentMarginPercent ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"}>
                          {item.simulatedMarginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {profitabilityData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron productos con recetas vinculadas. Asegúrate de que los nombres de productos coincidan con las recetas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </TabsContent>

        {/* --- PESTAÑA 2: COMPARADOR DE PROVEEDORES (CÓDIGO EXISTENTE ADAPTADO) --- */}
        <TabsContent value="comparison" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cargar Receta Guardada</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Select value={selectedSavedRecipeId} onValueChange={handleLoadRecipe}>
                    <SelectTrigger><SelectValue placeholder="Cargar receta..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_RECIPE_VALUE}>-- Crear Nueva Receta --</SelectItem>
                      {savedRecipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedSavedRecipeId && selectedSavedRecipeId !== NEW_RECIPE_VALUE && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSavedRecipe(selectedSavedRecipeId)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Constructor de Receta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="recipe-name">Nombre de la Receta</Label>
                    <Input id="recipe-name" value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="Ej: Torta de Chocolate Especial" />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Ingredientes</Label>
                    {recipeItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <Select value={item.rawMaterialName} onValueChange={val => handleItemChange(item.id, 'rawMaterialName', val)}>
                            <SelectTrigger><SelectValue placeholder="Ingrediente..." /></SelectTrigger>
                            <SelectContent>
                              {rawMaterialOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="Cant." />
                        </div>
                        <div className="col-span-2">
                          <Select value={item.unit} onValueChange={val => handleItemChange(item.id, 'unit', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {commonUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4" />Añadir Ingrediente</Button>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={handleSaveRecipe}><Save className="mr-2 h-4 w-4" />Guardar Receta</Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Tabla Comparativa de Costos (Precios en Bolívares)</CardTitle>
                  <CardDescription>Costo total de la receta por proveedor, basado en la lista de precios estándar (VES). Los precios se convierten a USD para comparar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Proveedor</TableHead>
                        {recipeItems.map(item => item.rawMaterialName && (
                          <TableHead key={item.id} className="text-right">
                            {item.rawMaterialName} <span className="text-muted-foreground text-xs">({item.quantity} {item.unit})</span>
                          </TableHead>
                        ))}
                        <TableHead className="text-right font-bold">Costo Total (USD)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-primary/10 hover:bg-primary/20">
                        <TableCell className="font-bold text-primary">
                          <div className="flex items-center">
                            <Star className="mr-2 h-4 w-4 text-yellow-500 fill-yellow-400" />
                            Mejor Opción Individual
                          </div>
                        </TableCell>
                        {recipeItems.map(item => item.rawMaterialName && (
                          <TableCell key={`best-${item.id}`} className="text-right">
                            {(() => {
                              const bestPriceItem = comparisonData.bestPriceSummary.find(bp => bp.recipeItemId === item.id);
                              return bestPriceItem ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="cursor-help">
                                      <FormattedNumber value={bestPriceItem.cost} prefix="$" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{bestPriceItem.supplierName}</p>
                                      <p><FormattedNumber value={bestPriceItem.originalUnitPrice} prefix="$" /> por {bestPriceItem.originalUnit}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : 'N/A';
                            })()}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold text-primary">
                          <FormattedNumber value={bestPriceTotalCost} prefix="$" />
                        </TableCell>
                      </TableRow>
                      {comparisonData.supplierSummaries.sort((a, b) => a.totalCost - b.totalCost).map(summary => (
                        <TableRow key={summary.supplierId}>
                          <TableCell>{summary.supplierName}</TableCell>
                          {recipeItems.map(item => item.rawMaterialName && (
                            <TableCell key={`${summary.supplierId}-${item.id}`} className="text-right">
                              {(() => {
                                if (summary.unfulfillableItems.includes(item.rawMaterialName)) {
                                  return <span className="text-muted-foreground text-xs">No disp.</span>;
                                }
                                const supplier = allSuppliers.find(s => s.id === summary.supplierId);
                                let itemCost = Infinity;

                                if (supplier) {
                                  let bestPriceForSupplier: { pricePerBaseUnit: number } | null = null;
                                  const priceListToUse = supplier.priceList || [];

                                  for (const priceItem of priceListToUse) {
                                    if (priceItem.rawMaterialName.toLowerCase() === item.rawMaterialName.toLowerCase()) {
                                      const currentPriceEntry = getCurrentPriceFromHistory(priceItem.priceHistory);
                                      if (currentPriceEntry) {
                                        const conversionResult = convertMaterialToBaseUnit(1, priceItem.unit, item.rawMaterialName);
                                        if (conversionResult.quantity > 0) {
                                          const pricePerBaseUnit = currentPriceEntry.price / conversionResult.quantity;
                                          if (bestPriceForSupplier === null || pricePerBaseUnit < bestPriceForSupplier.pricePerBaseUnit) {
                                            bestPriceForSupplier = { pricePerBaseUnit };
                                          }
                                        }
                                      }
                                    }
                                  }

                                  if (bestPriceForSupplier) {
                                    const requiredConversion = convertMaterialToBaseUnit(item.quantity, item.unit, item.rawMaterialName);
                                    itemCost = requiredConversion.quantity * bestPriceForSupplier.pricePerBaseUnit;
                                  }
                                }

                                return itemCost !== Infinity ? <FormattedNumber value={itemCost} prefix="$" /> : <span className="text-muted-foreground text-xs">Error</span>;
                              })()}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold">
                            {summary.unfulfillableItems.length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger className="cursor-help">
                                    <FormattedNumber value={summary.totalCost} prefix="$" />
                                    <span className="text-destructive ml-1">({summary.unfulfillableItems.length})</span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>No se pueden comprar:</p>
                                    <ul className="list-disc list-inside">
                                      {summary.unfulfillableItems.map(name => <li key={name}>{name}</li>)}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <FormattedNumber value={summary.totalCost} prefix="$" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
