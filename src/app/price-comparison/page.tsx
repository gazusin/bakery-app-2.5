
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListFilter, Loader2, Star, Info, PlusCircle, Trash2, Save, FolderOpen } from 'lucide-react';
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
  saveComparisonRecipesData
} from '@/lib/data-storage';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export interface SimulatedRecipeItem { // Exportado para uso en data-storage
  id: string;
  rawMaterialName: string;
  quantity: number;
  unit: string;
}

export interface SimulatedRecipe { // Exportado para uso en data-storage
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

export default function PriceComparisonPage() {
  const { toast } = useToast();
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [rawMaterialOptions, setRawMaterialOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [recipeName, setRecipeName] = useState('Mi Nueva Receta');
  const [recipeItems, setRecipeItems] = useState<SimulatedRecipeItem[]>([
    { id: `item-${Date.now()}`, rawMaterialName: '', quantity: 1, unit: 'kg' }
  ]);
  const [savedRecipes, setSavedRecipes] = useState<SimulatedRecipe[]>([]);
  const [selectedSavedRecipeId, setSelectedSavedRecipeId] = useState<string>(NEW_RECIPE_VALUE);

  const COMPARISON_RECIPES_KEY = 'bakery_comparison_recipes';

  const loadPageData = useCallback(() => {
    setIsLoading(true);
    const suppliers = [...initialSuppliersData];
    const materialOptions = getCurrentRawMaterialOptions().sort((a,b) => a.localeCompare(b));
    setAllSuppliers(suppliers);
    setRawMaterialOptions(materialOptions);
    setExchangeRate(loadExchangeRate());
    
    const loadedSavedRecipes = loadFromLocalStorage<SimulatedRecipe[]>(COMPARISON_RECIPES_KEY) || [];
    setSavedRecipes(loadedSavedRecipes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    if (materialOptions.length > 0 && recipeItems.length === 1 && recipeItems[0].rawMaterialName === '') {
      setRecipeItems([{ id: `item-${Date.now()}`, rawMaterialName: materialOptions[0], quantity: 1, unit: 'kg' }]);
    }
    
    setIsLoading(false);
  }, [recipeItems]);

  useEffect(() => {
    loadPageData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.SUPPLIERS || customEvent.detail?.key === KEYS.RAW_MATERIAL_OPTIONS) {
        loadPageData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, [loadPageData]);

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
        toast({title: "Error", description: "La receta debe tener un nombre y al menos un ingrediente válido.", variant: "destructive"});
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
    toast({title: "Receta Guardada", description: `La receta "${newRecipe.name}" ha sido guardada.`});
  };

  const handleLoadRecipe = (recipeId: string) => {
    setSelectedSavedRecipeId(recipeId);
    if(recipeId === NEW_RECIPE_VALUE) {
        setRecipeName('Mi Nueva Receta');
        setRecipeItems([{ id: `item-${Date.now()}`, rawMaterialName: rawMaterialOptions[0] || '', quantity: 1, unit: 'kg' }]);
        return;
    }
    const recipeToLoad = savedRecipes.find(r => r.id === recipeId);
    if (recipeToLoad) {
        setRecipeName(recipeToLoad.name);
        setRecipeItems(recipeToLoad.items.map(item => ({...item, id: `item-${Date.now()}-${Math.random()}`})));
    }
  };
  
  const handleDeleteSavedRecipe = (recipeId: string) => {
    const updatedSavedRecipes = savedRecipes.filter(r => r.id !== recipeId);
    saveComparisonRecipesData(updatedSavedRecipes);
    setSavedRecipes(updatedSavedRecipes);
    if (selectedSavedRecipeId === recipeId) {
        handleLoadRecipe(NEW_RECIPE_VALUE);
    }
    toast({title: "Receta Eliminada", description: "La receta guardada ha sido eliminada."});
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
            if(priceItem.rawMaterialName.toLowerCase() === item.rawMaterialName.toLowerCase()) {
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
        title="Simulador de Costos de Recetas"
        description="Crea recetas virtuales para comparar costos entre proveedores y encontrar la opción más económica."
        icon={ListFilter}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Cargar Receta Guardada</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                    <Select value={selectedSavedRecipeId} onValueChange={handleLoadRecipe}>
                        <SelectTrigger><SelectValue placeholder="Cargar receta..."/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NEW_RECIPE_VALUE}>-- Crear Nueva Receta --</SelectItem>
                            {savedRecipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {selectedSavedRecipeId && selectedSavedRecipeId !== NEW_RECIPE_VALUE && (
                         <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteSavedRecipe(selectedSavedRecipeId)}><Trash2 className="h-4 w-4"/></Button>
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
                      <Input id="recipe-name" value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="Ej: Torta de Chocolate Especial"/>
                  </div>
                  <Separator/>
                <div className="space-y-2">
                    <Label>Ingredientes</Label>
                    {recipeItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-6">
                                <Select value={item.rawMaterialName} onValueChange={val => handleItemChange(item.id, 'rawMaterialName', val)}>
                                    <SelectTrigger><SelectValue placeholder="Ingrediente..."/></SelectTrigger>
                                    <SelectContent>
                                        {rawMaterialOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-3">
                                <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} placeholder="Cant."/>
                            </div>
                            <div className="col-span-2">
                                <Select value={item.unit} onValueChange={val => handleItemChange(item.id, 'unit', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {commonUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-1">
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    ))}
                </div>
                <Button variant="outline" size="sm" onClick={handleAddItem}><PlusCircle className="mr-2 h-4 w-4"/>Añadir Ingrediente</Button>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={handleSaveRecipe}><Save className="mr-2 h-4 w-4"/>Guardar Receta</Button>
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
                                        <Star className="mr-2 h-4 w-4 text-yellow-500 fill-yellow-400"/>
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
                                                <FormattedNumber value={bestPriceItem.cost} prefix="$"/>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{bestPriceItem.supplierName}</p>
                                                <p><FormattedNumber value={bestPriceItem.originalUnitPrice} prefix="$"/> por {bestPriceItem.originalUnit}</p>
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
                            {comparisonData.supplierSummaries.sort((a,b) => a.totalCost - b.totalCost).map(summary => (
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
                                                if(priceItem.rawMaterialName.toLowerCase() === item.rawMaterialName.toLowerCase()) {
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
                                                <FormattedNumber value={summary.totalCost} prefix="$"/>
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
                                        <FormattedNumber value={summary.totalCost} prefix="$"/>
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
    </div>
  );
}
