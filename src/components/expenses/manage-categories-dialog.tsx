
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, ListPlus, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  type ExpenseFixedCategory,
  loadExpenseFixedCategories,
  loadExpenseVariableCategories,
  addExpenseFixedCategory,
  addExpenseVariableCategory,
  removeExpenseFixedCategory,
  removeExpenseVariableCategory,
  saveExpenseFixedCategories,
  getActiveBranchId, // Importar para obtener la sede activa
  availableBranches // Para obtener el nombre de la sede activa
} from '@/lib/data-storage';

interface ManageCategoriesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCategoriesUpdated: () => void;
}

export function ManageCategoriesDialog({ isOpen, onOpenChange, onCategoriesUpdated }: ManageCategoriesDialogProps) {
  const { toast } = useToast();
  const [currentManagingCategoryType, setCurrentManagingCategoryType] = useState<'fixed' | 'variable'>('fixed');
  const [fixedCategoriesList, setFixedCategoriesList] = useState<ExpenseFixedCategory[]>([]);
  const [variableCategoriesList, setVariableCategoriesList] = useState<string[]>([]);
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [newFixedCategoryMonthlyAmount, setNewFixedCategoryMonthlyAmount] = useState<string>('');
  const [isDialogSubmitting, setIsDialogSubmitting] = useState(false);
  const [activeBranchName, setActiveBranchName] = useState<string>('');

  const [editingAmounts, setEditingAmounts] = useState<{ [categoryName: string]: string }>({});

  const refreshLocalCategoriesLists = useCallback(() => {
    const activeBranch = getActiveBranchId();
    if (activeBranch) {
      setFixedCategoriesList(loadExpenseFixedCategories(activeBranch));
      setVariableCategoriesList(loadExpenseVariableCategories(activeBranch));
      const branchInfo = availableBranches.find(b => b.id === activeBranch);
      setActiveBranchName(branchInfo ? branchInfo.name : 'Desconocida');
    } else {
      setFixedCategoriesList([]);
      setVariableCategoriesList([]);
      setActiveBranchName('Ninguna Seleccionada');
      toast({title: "Error de Sede", description: "No hay sede activa para gestionar categorías.", variant: "destructive"});
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      refreshLocalCategoriesLists();
      setCurrentManagingCategoryType('fixed');
      setNewSubCategoryName('');
      setNewFixedCategoryMonthlyAmount('');
    }
  }, [isOpen, refreshLocalCategoriesLists]);

  useEffect(() => {
    if (isOpen && fixedCategoriesList.length > 0) {
      const initialAmounts: { [categoryName: string]: string } = {};
      fixedCategoriesList.forEach(cat => {
        if (cat.name.toLowerCase() !== 'nómina') {
          initialAmounts[cat.name] = cat.monthlyAmount !== undefined ? cat.monthlyAmount.toString() : '';
        }
      });
      setEditingAmounts(initialAmounts);
    } else if (!isOpen) {
      setEditingAmounts({});
    }
  }, [isOpen, fixedCategoriesList]);


  const handleAddNewSubCategory = () => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive"});
      return;
    }
    if (!newSubCategoryName.trim()) {
      toast({ title: "Error", description: "El nombre de la subcategoría no puede estar vacío.", variant: "destructive" });
      return;
    }
    if (newSubCategoryName.trim().toLowerCase() === "compra de materia prima") {
        toast({ title: "Error", description: "No se puede añadir 'Compra de Materia Prima' manualmente.", variant: "destructive" });
        setNewSubCategoryName('');
        setNewFixedCategoryMonthlyAmount('');
        return;
    }

    setIsDialogSubmitting(true);
    let success = false;
    if (currentManagingCategoryType === 'fixed') {
      const amountValue = parseFloat(newFixedCategoryMonthlyAmount);
      success = addExpenseFixedCategory(activeBranch, newSubCategoryName.trim(), isNaN(amountValue) || newSubCategoryName.trim().toLowerCase() === 'nómina' ? undefined : amountValue);
    } else {
      success = addExpenseVariableCategory(activeBranch, newSubCategoryName.trim());
    }

    if (success) {
      refreshLocalCategoriesLists();
      onCategoriesUpdated();
      toast({ title: "Éxito", description: `Subcategoría "${newSubCategoryName.trim()}" añadida a sede ${activeBranchName}.` });
      setNewSubCategoryName('');
      setNewFixedCategoryMonthlyAmount('');
    } else {
      toast({ title: "Información", description: `La subcategoría "${newSubCategoryName.trim()}" ya existe para la sede ${activeBranchName} o es inválida.`, variant: "default" });
    }
    setIsDialogSubmitting(false);
  };

  const handleRemoveSubCategory = (categoryName: string, type: 'fixed' | 'variable') => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive"});
      return;
    }
    if (categoryName.toLowerCase() === "compra de materia prima" || (type === 'fixed' && categoryName.toLowerCase() === "nómina")) {
      toast({ title: "Acción no permitida", description: `La categoría '${categoryName}' no se puede eliminar.`, variant: "destructive" });
      return;
    }
    setIsDialogSubmitting(true);
    if (type === 'fixed') {
      removeExpenseFixedCategory(activeBranch, categoryName);
    } else {
      removeExpenseVariableCategory(activeBranch, categoryName);
    }
    refreshLocalCategoriesLists();
    onCategoriesUpdated();
    toast({ title: "Subcategoría Eliminada", description: `"${categoryName}" ha sido eliminada de la sede ${activeBranchName}.` });
    setIsDialogSubmitting(false);
  };

  const handleSaveFixedCategoryAmounts = async () => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "Selecciona una sede activa primero.", variant: "destructive"});
      return;
    }
    setIsDialogSubmitting(true);
    
    const updatedCategories = fixedCategoriesList.map(cat => {
      if (cat.name.toLowerCase() === 'nómina') {
        return { ...cat, monthlyAmount: undefined };
      }
      const newAmountString = editingAmounts[cat.name];
      const parsedAmount = parseFloat(newAmountString);
      if (!isNaN(parsedAmount) && parsedAmount >= 0) {
        return { ...cat, monthlyAmount: parsedAmount };
      } else {
        return { ...cat, monthlyAmount: undefined };
      }
    });

    saveExpenseFixedCategories(activeBranch, updatedCategories);

    refreshLocalCategoriesLists();
    onCategoriesUpdated();

    toast({
        title: "Montos Actualizados",
        description: `Los montos mensuales para las categorías fijas de la sede ${activeBranchName} han sido guardados.`,
        variant: "default",
    });
    setIsDialogSubmitting(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gestionar Subcategorías de Gastos (Sede: {activeBranchName})</DialogTitle>
          <DialogDescription>Añade o elimina subcategorías para gastos fijos y variables de la sede actual. 'Compra de Materia Prima' y 'Nómina' (fija) son gestionadas por el sistema.</DialogDescription>
        </DialogHeader>
        <Tabs value={currentManagingCategoryType} onValueChange={(value) => { setCurrentManagingCategoryType(value as 'fixed' | 'variable'); setNewSubCategoryName(''); setNewFixedCategoryMonthlyAmount(''); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fixed" disabled={isDialogSubmitting}>Gastos Fijos</TabsTrigger>
            <TabsTrigger value="variable" disabled={isDialogSubmitting}>Gastos Variables</TabsTrigger>
          </TabsList>
          <TabsContent value="fixed" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Subcategorías Fijas (Sede: {activeBranchName})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end space-x-2">
                  <div className="flex-grow space-y-1">
                    <Label htmlFor="new_fixed_subcategory_name">Nombre Nueva Subcategoría Fija</Label>
                    <Input
                      id="new_fixed_subcategory_name"
                      value={newSubCategoryName}
                      onChange={(e) => setNewSubCategoryName(e.target.value)}
                      placeholder="ej., Alquiler Local"
                      disabled={isDialogSubmitting || currentManagingCategoryType !== 'fixed'}
                    />
                  </div>
                  {newSubCategoryName.toLowerCase() !== 'nómina' && (
                    <div className="space-y-1 w-2/5">
                      <Label htmlFor="new_fixed_category_monthly_amount">Monto Mensual (USD)</Label>
                      <Input
                        id="new_fixed_category_monthly_amount"
                        type="number"
                        value={newFixedCategoryMonthlyAmount}
                        onChange={(e) => setNewFixedCategoryMonthlyAmount(e.target.value)}
                        placeholder="ej., 500 (Opcional)"
                        disabled={isDialogSubmitting || currentManagingCategoryType !== 'fixed' || newSubCategoryName.toLowerCase() === 'nómina'}
                      />
                    </div>
                  )}
                  <Button type="button" onClick={handleAddNewSubCategory} disabled={isDialogSubmitting || currentManagingCategoryType !== 'fixed' || !newSubCategoryName.trim() || !getActiveBranchId()}>
                    <ListPlus className="mr-2 h-4 w-4" /> Añadir
                  </Button>
                </div>
                <Separator />
                <Label>Subcategorías Existentes:</Label>
                <ScrollArea className="h-40 rounded-md border p-2">
                  {fixedCategoriesList.filter(cat => cat.name.toLowerCase() !== "compra de materia prima").map(cat => (
                    <div key={`fixed-${cat.name}`} className="flex items-center justify-between py-1.5 hover:bg-muted/50 px-2 rounded-md">
                      <div className="flex-grow flex items-center space-x-2">
                        {cat.name.toLowerCase() !== 'nómina' ? (
                          <Input
                            type="number"
                            value={editingAmounts[cat.name] || ''}
                            onChange={(e) =>
                              setEditingAmounts(prev => ({
                                ...prev,
                                [cat.name]: e.target.value,
                              }))
                            }
                            placeholder="Monto (USD)"
                            className="h-8 w-28 text-xs"
                            disabled={isDialogSubmitting}
                            aria-label={`Monto mensual para ${cat.name}`}
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground h-8 flex items-center">(Monto gestionado por nómina)</span>
                        )}
                        <Label htmlFor={`amount-input-${cat.name}`} className="text-sm">{cat.name}</Label>
                      </div>
                      {cat.name.toLowerCase() !== 'nómina' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleRemoveSubCategory(cat.name, 'fixed')} disabled={isDialogSubmitting || !getActiveBranchId()}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {fixedCategoriesList.filter(cat => cat.name.toLowerCase() !== "compra de materia prima" && cat.name.toLowerCase() !== "nómina").length === 0 && 
                    fixedCategoriesList.some(cat => cat.name.toLowerCase() === "nómina") &&
                    fixedCategoriesList.length === 1 && 
                    <p className="text-xs text-muted-foreground text-center py-2">No hay subcategorías fijas personalizadas. Solo 'Nómina' está activa.</p>
                  }
                   {fixedCategoriesList.filter(cat => cat.name.toLowerCase() !== "compra de materia prima").length === 0 && 
                    !fixedCategoriesList.some(cat => cat.name.toLowerCase() === "nómina") &&
                    <p className="text-xs text-muted-foreground text-center py-2">No hay subcategorías fijas definidas.</p>
                  }
                </ScrollArea>
                 <Button 
                  type="button" 
                  onClick={handleSaveFixedCategoryAmounts} 
                  disabled={isDialogSubmitting || !getActiveBranchId()} 
                  className="w-full mt-2"
                >
                  Guardar Cambios de Montos
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="variable" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Subcategorías Variables (Sede: {activeBranchName})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Input
                    id="new_variable_subcategory_name"
                    value={newSubCategoryName}
                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                    placeholder="Nueva subcategoría variable"
                    disabled={isDialogSubmitting || currentManagingCategoryType !== 'variable'}
                  />
                  <Button type="button" onClick={handleAddNewSubCategory} disabled={isDialogSubmitting || currentManagingCategoryType !== 'variable' || !newSubCategoryName.trim() || !getActiveBranchId()}>
                    <ListPlus className="mr-2 h-4 w-4" /> Añadir
                  </Button>
                </div>
                <Separator />
                <Label>Subcategorías Existentes:</Label>
                <ScrollArea className="h-40 rounded-md border p-2">
                  {variableCategoriesList.filter(cat => cat.toLowerCase() !== "compra de materia prima").map(cat => (
                    <div key={`variable-${cat}`} className="flex items-center justify-between py-1.5 hover:bg-muted/50 px-2 rounded-md">
                      <span>{cat}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleRemoveSubCategory(cat, 'variable')} disabled={isDialogSubmitting || !getActiveBranchId()}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {variableCategoriesList.filter(cat => cat.toLowerCase() !== "compra de materia prima").length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No hay subcategorías variables definidas.</p>}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isDialogSubmitting}>Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
