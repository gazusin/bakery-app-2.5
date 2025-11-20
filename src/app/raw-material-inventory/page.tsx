
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Archive, Loader2, Trash2, Info, PlusCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
    loadRawMaterialInventoryData,
    saveRawMaterialInventoryData,
    type RawMaterialInventoryItem,
    KEYS,
    getLowestPriceInfo,
    getHighestPriceInfo,
    loadExchangeRate,
    recipesData as initialRecipesData, 
    type Recipe,                       
    calculateDynamicRecipeCost,
    getActiveBranchId,
    availableBranches,
    commonUnitOptions,
    getCurrentRawMaterialOptions,
    convertMaterialToBaseUnit,
    normalizeUnit,
    VALID_BASE_UNITS
} from '@/lib/data-storage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FormattedNumber } from '@/components/ui/formatted-number';

export default function RawMaterialInventoryPage() {
  const { toast } = useToast();
  const [rawMaterialsStock, setRawMaterialsStock] = useState<RawMaterialInventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<RawMaterialInventoryItem | null>(null);

  const [activeBranchName, setActiveBranchName] = useState<string>('');
  const [availableRawMaterials, setAvailableRawMaterials] = useState<string[]>([]);
  
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [materialToAdjust, setMaterialToAdjust] = useState('');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentUnit, setAdjustmentUnit] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  const loadAndDisplayInventory = useCallback(() => {
    setIsLoading(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "No se ha seleccionado una sede activa para ver el inventario.", variant: "destructive" });
      setIsLoading(false);
      setRawMaterialsStock([]);
      setRecipes([]);
      setActiveBranchName('Ninguna');
      return;
    }

    const branchInfo = availableBranches.find(b => b.id === activeBranch);
    setActiveBranchName(branchInfo ? branchInfo.name : 'Desconocida');

    const currentInventory = loadRawMaterialInventoryData(activeBranch);
    const sortedInventory = [...currentInventory].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setRawMaterialsStock(sortedInventory);
    setRecipes([...initialRecipesData]); 
    setExchangeRate(loadExchangeRate());
    
    const rawMaterialNames = getCurrentRawMaterialOptions();
    setAvailableRawMaterials(rawMaterialNames);
    if(rawMaterialNames.length > 0) {
      setMaterialToAdjust(rawMaterialNames[0]);
      setAdjustmentUnit(commonUnitOptions[0] || '');
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadAndDisplayInventory();

    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.RAW_MATERIAL_INVENTORY || 
          customEvent.detail?.key === KEYS.EXCHANGE_RATE ||
          customEvent.detail?.key === KEYS.RECIPES ||
          customEvent.detail?.key === KEYS.ACTIVE_BRANCH_ID ||
          customEvent.detail?.key === KEYS.RAW_MATERIAL_OPTIONS) { 
        loadAndDisplayInventory();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadAndDisplayInventory]);

  const resetAdjustForm = () => {
    setAdjustmentType('add');
    setMaterialToAdjust(availableRawMaterials[0] || '');
    setAdjustmentQuantity('');
    setAdjustmentUnit(commonUnitOptions[0] || '');
    setAdjustmentReason('');
  };

  const handleOpenDeleteDialog = (material: RawMaterialInventoryItem) => {
    setItemToDelete(material);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "No se puede eliminar el ítem sin una sede activa.", variant: "destructive" });
      setIsSubmitting(false);
      setIsDeleteConfirmOpen(false);
      return;
    }
    setIsSubmitting(true);

    const currentInventory = loadRawMaterialInventoryData(activeBranch); 
    const updatedInventory = currentInventory.filter(
      item => !(item.name.toLowerCase() === itemToDelete.name.toLowerCase() && item.unit.toLowerCase() === itemToDelete.unit.toLowerCase())
    );

    saveRawMaterialInventoryData(activeBranch, updatedInventory); 

    toast({
      title: "Éxito",
      description: `"${itemToDelete.name}" eliminado del inventario de materia prima de la sede actual.`,
    });

    setIsDeleteConfirmOpen(false);
    setItemToDelete(null);
    setIsSubmitting(false);
  };
  
  const handleSaveAdjustment = () => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error", description: "No hay sede activa.", variant: "destructive" });
      return;
    }
    if (!materialToAdjust || !adjustmentQuantity || !adjustmentUnit) {
      toast({ title: "Error", description: "Material, cantidad y unidad son obligatorios.", variant: "destructive" });
      return;
    }
    const quantityNum = parseFloat(adjustmentQuantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser un número positivo.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    let inventory = loadRawMaterialInventoryData(activeBranch);
    const { quantity: baseQuantity, unit: baseUnit } = convertMaterialToBaseUnit(
      quantityNum,
      adjustmentUnit,
      materialToAdjust
    );

    if (!VALID_BASE_UNITS.includes(baseUnit)) {
      toast({ title: "Error de Unidad", description: `No se pudo convertir '${adjustmentUnit}' a una unidad base válida para '${materialToAdjust}'.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const itemIndex = inventory.findIndex(
      item => item.name.toLowerCase() === materialToAdjust.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(baseUnit)
    );

    if (adjustmentType === 'add') {
      if (itemIndex !== -1) {
        inventory[itemIndex].quantity += baseQuantity;
      } else {
        const existingWithDifferentUnit = inventory.findIndex(item => item.name.toLowerCase() === materialToAdjust.toLowerCase());
        if(existingWithDifferentUnit !== -1) {
             toast({ title: "Error de Unidad", description: `El material '${materialToAdjust}' ya existe en inventario con una unidad base diferente. Realiza el ajuste en la unidad existente.`, variant: "destructive", duration: 7000 });
             setIsSubmitting(false);
             return;
        }
        inventory.push({ name: materialToAdjust, quantity: baseQuantity, unit: baseUnit });
      }
    } else { // subtract
      if (itemIndex === -1) {
        toast({ title: "Error", description: `No se encontró '${materialToAdjust}' con la unidad base '${baseUnit}' en el inventario para restar.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      if (inventory[itemIndex].quantity < baseQuantity) {
        toast({ title: "Error de Stock", description: `No se puede restar ${baseQuantity.toFixed(3)} ${baseUnit}. Stock actual: ${inventory[itemIndex].quantity.toFixed(3)} ${baseUnit}.`, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      inventory[itemIndex].quantity -= baseQuantity;
    }

    saveRawMaterialInventoryData(activeBranch, inventory);
    toast({ title: "Éxito", description: `Inventario para '${materialToAdjust}' ajustado correctamente.` });

    setIsSubmitting(false);
    setIsAdjustDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Inventario de Materia Prima (Sede: ${activeBranchName})`}
        description="Resumen del stock de materia prima y preparaciones intermedias. Ahora puedes hacer ajustes manuales para añadir o restar stock sin una orden de compra."
        icon={Archive}
        actions={
          <Button onClick={() => { resetAdjustForm(); setIsAdjustDialogOpen(true); }} disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajustar Stock
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Stock Actual de Materia Prima y Preparaciones</CardTitle>
          <CardDescription>
            Cantidades en unidades estándar (kg, g, L, ml, unidad) y su valorización estimada.
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-1 h-5 w-5 p-0 align-middle -translate-y-0.5">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>El costo de Materias Primas se basa en los precios de proveedores. El costo de Preparaciones Intermedias (ej. Melado) se basa en el costo de sus ingredientes según la receta.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && rawMaterialsStock.length === 0 ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Cargando inventario de materia prima...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente/Preparación</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Unidad (Base)</TableHead>
                  <TableHead className="text-right">Costo Total Stock (USD)</TableHead>
                  <TableHead className="text-right">Costo Total Stock (VES)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawMaterialsStock.length > 0 ? (
                  rawMaterialsStock.map((material) => {
                    let totalCostMinUSD: number | null = null;
                    let totalCostMaxUSD: number | null = null;

                    const correspondingRecipe = recipes.find(
                      (r) => r.name.toLowerCase() === material.name.toLowerCase() && r.isIntermediate
                    );

                    if (correspondingRecipe && correspondingRecipe.expectedYield && correspondingRecipe.expectedYield > 0) {
                      const costOfTandaMin = calculateDynamicRecipeCost(correspondingRecipe.id, 'lowest');
                      const costOfTandaMax = calculateDynamicRecipeCost(correspondingRecipe.id, 'highest');
                      const costPerUnitMin = costOfTandaMin / correspondingRecipe.expectedYield;
                      const costPerUnitMax = costOfTandaMax / correspondingRecipe.expectedYield;
                      totalCostMinUSD = material.quantity * costPerUnitMin;
                      totalCostMaxUSD = material.quantity * costPerUnitMax;
                    } else {
                      const lowestPriceInfo = getLowestPriceInfo(material.name);
                      const highestPriceInfo = getHighestPriceInfo(material.name);
                      if (lowestPriceInfo && normalizeUnit(lowestPriceInfo.baseUnit) === normalizeUnit(material.unit)) {
                          totalCostMinUSD = material.quantity * lowestPriceInfo.pricePerBaseUnit;
                      }
                      if (highestPriceInfo && normalizeUnit(highestPriceInfo.baseUnit) === normalizeUnit(material.unit)) {
                          totalCostMaxUSD = material.quantity * highestPriceInfo.pricePerBaseUnit;
                      }
                    }

                    return (
                      <TableRow key={`${material.name}-${material.unit}`}>
                        <TableCell className="font-medium">{material.name} {correspondingRecipe ? <span className="text-xs text-muted-foreground">(Preparación)</span> : ''}</TableCell>
                        <TableCell className="text-right">
                          <FormattedNumber value={material.quantity} decimalPlaces={4} />
                        </TableCell>
                        <TableCell>{material.unit}</TableCell>
                        <TableCell className="text-right">
                            {totalCostMinUSD !== null && totalCostMaxUSD !== null ? (
                            Math.abs(totalCostMinUSD - totalCostMaxUSD) < 0.01 ? (
                                <FormattedNumber value={totalCostMinUSD} prefix="$" />
                            ) : (
                                <span className="text-xs">
                                <FormattedNumber value={totalCostMinUSD} prefix="$" />
                                {' - '}
                                <FormattedNumber value={totalCostMaxUSD} prefix="$" />
                                </span>
                            )
                            ) : totalCostMinUSD !== null ? (
                            <>
                                <FormattedNumber value={totalCostMinUSD} prefix="$" />
                                <span className="text-xs text-muted-foreground"> (Mín)</span>
                            </>
                            ) : totalCostMaxUSD !== null ? (
                            <>
                                <FormattedNumber value={totalCostMaxUSD} prefix="$" />
                                <span className="text-xs text-muted-foreground"> (Máx)</span>
                            </>
                            ) : (
                            'N/A'
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            {totalCostMinUSD !== null && totalCostMaxUSD !== null ? (
                            Math.abs(totalCostMinUSD - totalCostMaxUSD) < 0.01 ? (
                                <FormattedNumber value={exchangeRate > 0 ? totalCostMinUSD * exchangeRate : undefined} prefix="Bs. " />
                            ) : (
                                <span className="text-xs">
                                    <FormattedNumber value={exchangeRate > 0 ? totalCostMinUSD * exchangeRate : undefined} prefix="Bs. " />
                                    {' - '}
                                    <FormattedNumber value={exchangeRate > 0 ? totalCostMaxUSD * exchangeRate : undefined} prefix="Bs. " />
                                </span>
                            )
                            ) : totalCostMinUSD !== null ? (
                            <>
                                <FormattedNumber value={exchangeRate > 0 ? totalCostMinUSD * exchangeRate : undefined} prefix="Bs. " />
                                <span className="text-xs text-muted-foreground"> (Mín)</span>
                            </>
                            ) : totalCostMaxUSD !== null ? (
                            <>
                                <FormattedNumber value={exchangeRate > 0 ? totalCostMaxUSD * exchangeRate : undefined} prefix="Bs. " />
                                <span className="text-xs text-muted-foreground"> (Máx)</span>
                            </>
                            ) : (
                            'N/A'
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(material)} disabled={isSubmitting} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10" title={`Eliminar ${material.name}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay materia prima registrada en el inventario de esta sede.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAdjustDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsAdjustDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Inventario</DialogTitle>
            <DialogDescription>Añade o resta cantidad a un ítem del inventario de materia prima para la sede: {activeBranchName}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="adjustment_type">Tipo de Ajuste</Label>
              <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'add' | 'subtract')} disabled={isSubmitting}>
                <SelectTrigger id="adjustment_type"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Añadir al Stock</SelectItem>
                  <SelectItem value="subtract">Restar del Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="material_to_adjust">Materia Prima</Label>
              <Select value={materialToAdjust} onValueChange={setMaterialToAdjust} disabled={isSubmitting || availableRawMaterials.length === 0}>
                <SelectTrigger id="material_to_adjust"><SelectValue placeholder="Selecciona material..."/></SelectTrigger>
                <SelectContent>
                  {availableRawMaterials.map(mat => <SelectItem key={mat} value={mat}>{mat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="adjustment_quantity">Cantidad</Label>
                <Input id="adjustment_quantity" type="number" value={adjustmentQuantity} onChange={(e) => setAdjustmentQuantity(e.target.value)} placeholder="ej., 5.5" disabled={isSubmitting}/>
              </div>
              <div className="space-y-1">
                <Label htmlFor="adjustment_unit">Unidad</Label>
                <Select value={adjustmentUnit} onValueChange={setAdjustmentUnit} disabled={isSubmitting}>
                  <SelectTrigger id="adjustment_unit"><SelectValue placeholder="Unidad"/></SelectTrigger>
                  <SelectContent>{commonUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
             <div className="space-y-1">
                <Label htmlFor="adjustment_reason">Razón/Nota (Opcional)</Label>
                <Input id="adjustment_reason" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} placeholder="ej., Compra local urgente" disabled={isSubmitting}/>
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button type="button" onClick={handleSaveAdjustment} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Guardando..." : "Guardar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsDeleteConfirmOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de que quieres eliminar "{itemToDelete?.name}" ({itemToDelete?.unit}) del inventario de materia prima de la sede actual? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild><Button variant="outline" onClick={() => {if(!isSubmitting){setIsDeleteConfirmOpen(false); setItemToDelete(null)}}} disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Eliminando..." : "Eliminar Ítem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
