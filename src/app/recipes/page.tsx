
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Utensils, PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, Info, TrendingUp, AlertTriangle, Trash } from 'lucide-react'; // Added Trash
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  type Product, // Importar Product
  recipesData as initialRecipesData,
  saveRecipesData,
  type Recipe,
  type RecipeIngredientItem, // Import new type
  loadExchangeRate,
  calculateDynamicRecipeCost,
  employeesData as initialEmployeesData,
  loadExpenseFixedCategories,
  type ExpenseFixedCategory,
  KEYS,
  productionLogData as initialProductionLogData,
  commonUnitOptions, // Import commonUnitOptions
  getCurrentRawMaterialOptions, // Import for ingredient name suggestions
  calculatePackagingCost,
  getActiveBranchId,
  availableBranches,
  loadProductsForBranch,
  saveProductsDataForBranch,
  loadFromLocalStorageForBranch,
  getLowestPriceInfo
} from '@/lib/data-storage';
import { format as formatDateFns, parseISO, startOfWeek, endOfWeek, isWithinInterval, isValid, compareDesc } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FormattedNumber } from '@/components/ui/formatted-number';

const WEEKS_IN_MONTH = 365.25 / 12 / 7; // Aprox 4.348

export default function RecipesPage() {
  const { toast } = useToast();
  const [currentRecipes, setCurrentRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [availableRawMaterials, setAvailableRawMaterials] = useState<string[]>([]);


  const [isAddRecipeDialogOpen, setIsAddRecipeDialogOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newIngredients, setNewIngredients] = useState<RecipeIngredientItem[]>([{ id: `new-ing-${Date.now()}`, name: '', quantity: 0, unit: commonUnitOptions[0] || 'kg', notes: '' }]);
  const [newInstructions, setNewInstructions] = useState('');
  const [newCostPerUnit, setNewCostPerUnit] = useState('');
  const [newExpectedYield, setNewExpectedYield] = useState('');
  const [newIsIntermediate, setNewIsIntermediate] = useState(false);
  const [newIsResoldProduct, setNewIsResoldProduct] = useState(false);
  const [newCreateNonDispatchableForResold, setNewCreateNonDispatchableForResold] = useState(false);
  const [newOutputUnit, setNewOutputUnit] = useState<'kg' | 'L'>('kg');
  const [newRecipeCategory, setNewRecipeCategory] = useState('');
  const [newRecipeAiHint, setNewRecipeAiHint] = useState('');

  const [isEditRecipeDialogOpen, setIsEditRecipeDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editRecipeName, setEditRecipeName] = useState('');
  const [editIngredients, setEditIngredients] = useState<RecipeIngredientItem[]>([]);
  const [editInstructions, setEditInstructions] = useState('');
  const [editCostPerUnit, setEditCostPerUnit] = useState('');
  const [editExpectedYield, setEditExpectedYield] = useState('');
  const [editIsIntermediate, setEditIsIntermediate] = useState(false);
  const [editIsResoldProduct, setEditIsResoldProduct] = useState(false);
  const [editOutputUnit, setEditOutputUnit] = useState<'kg' | 'L'>('kg');
  const [editRecipeCategory, setEditRecipeCategory] = useState('');
  const [editRecipeAiHint, setEditRecipeAiHint] = useState('');
  
  const [dynamicCostMinForEdit, setDynamicCostMinForEdit] = useState<number | null>(null);
  const [dynamicCostMaxForEdit, setDynamicCostMaxForEdit] = useState<number | null>(null);

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [recipeToDeleteId, setRecipeToDeleteId] = useState<string | null>(null);

  const [weeklyOperatingCost, setWeeklyOperatingCost] = useState<number | null>(null);
  const [fixedWeeklyCost, setFixedWeeklyCost] = useState<number | null>(null);
  const [payrollWeeklyCost, setPayrollWeeklyCost] = useState<number | null>(null);
  
  const [sacksProducedThisWeek, setSacksProducedThisWeek] = useState<number>(0);
  const [costPerSackThisWeek, setCostPerSackThisWeek] = useState<number | null>(null);

  const [dataVersion, setDataVersion] = useState(0);


  const loadAndCalculateData = useCallback(() => {
    setIsLoading(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
        // This case should be handled by the layout redirecting to /select-branch
        setIsLoading(false);
        return;
    }
    const loadedRecipes = [...loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch)];
    setCurrentRecipes(loadedRecipes.sort((a,b) => a.name.localeCompare(b.name)));
    setAvailableRawMaterials(getCurrentRawMaterialOptions());
    const rate = loadExchangeRate();
    setExchangeRate(rate);

    // Calculate Operating Costs
    const fixedCategories = loadExpenseFixedCategories(activeBranch);
    const employees = [...loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranch)];

    const currentFixedWeekly = fixedCategories
      .filter(cat => cat.name.toLowerCase() !== 'nómina' && cat.monthlyAmount && cat.monthlyAmount > 0)
      .reduce((sum, cat) => sum + (cat.monthlyAmount! / WEEKS_IN_MONTH), 0);
    setFixedWeeklyCost(currentFixedWeekly);

    const currentPayrollWeekly = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    setPayrollWeeklyCost(currentPayrollWeekly);
    
    const totalWeeklyOpCost = currentFixedWeekly + currentPayrollWeekly;
    setWeeklyOperatingCost(totalWeeklyOpCost);

    // Calculate Sacks Produced This Week (Only Final Products)
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 });

    const productionThisWeek = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch).filter(log => {
        if (!log.date || !isValid(parseISO(log.date))) return false;
        const logDate = parseISO(log.date);
        return isWithinInterval(logDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
    });

    const totalSacksFinalProducts = productionThisWeek.reduce((sum, log) => {
        const recipeDetails = loadedRecipes.find(r => r.name === log.product);
        if (recipeDetails && !recipeDetails.isIntermediate) {
            return sum + (log.batchSizeMultiplier || 0);
        }
        return sum;
    }, 0);
    setSacksProducedThisWeek(totalSacksFinalProducts);

    // Calculate Cost Per Sack
    if (totalWeeklyOpCost >= 0) { // Ensure totalWeeklyOpCost is a valid number (incl. 0)
        if (totalSacksFinalProducts > 0) {
            setCostPerSackThisWeek(totalWeeklyOpCost / totalSacksFinalProducts);
        } else {
            setCostPerSackThisWeek(0); // If no production, operative cost per sack is 0 for distribution
        }
    } else {
        setCostPerSackThisWeek(null); // If totalWeeklyOpCost is null or negative, cannot determine
    }

    setIsLoading(false);
  }, []);


  useEffect(() => {
    loadAndCalculateData();

    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.RECIPES || 
          customEvent.detail?.key === KEYS.EXPENSE_FIXED_CATEGORIES ||
          customEvent.detail?.key === KEYS.EMPLOYEES ||
          customEvent.detail?.key === KEYS.PRODUCTION_LOG ||
          customEvent.detail?.key === KEYS.RAW_MATERIAL_OPTIONS ||
          customEvent.detail?.key === KEYS.EXCHANGE_RATE ||
          customEvent.detail?.key === KEYS.ACTIVE_BRANCH_ID
          ) {
        setDataVersion(prev => prev + 1);
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadAndCalculateData]);

  useEffect(() => {
    if (dataVersion > 0) {
      loadAndCalculateData();
    }
  }, [dataVersion, loadAndCalculateData]);


  const resetAddForm = () => {
    setNewRecipeName(''); 
    setNewIngredients([{ id: `new-ing-${Date.now()}`, name: availableRawMaterials[0] || '', quantity: 0, unit: commonUnitOptions[0] || 'kg', notes: '' }]);
    setNewInstructions('');
    setNewCostPerUnit(''); setNewExpectedYield(''); setNewIsIntermediate(false);
    setNewIsResoldProduct(false);
    setNewCreateNonDispatchableForResold(false);
    setNewOutputUnit('kg'); setNewRecipeCategory(''); setNewRecipeAiHint('');
  };

  const handleAddRecipe = () => {
    const isNonDispatchable = newRecipeName.toLowerCase().startsWith('no despachable');
    const validIngredients = newIngredients.filter(ing => ing.name.trim() && ing.quantity > 0 && ing.unit.trim());
    
    if (!newRecipeName) {
      toast({ title: "Error", description: "El nombre es obligatorio.", variant: "destructive" }); return;
    }
    if (validIngredients.length === 0 && !isNonDispatchable && !newIsResoldProduct) {
      toast({ title: "Error", description: "Se requiere al menos un ingrediente para recetas estándar.", variant: "destructive" });
      return;
    }
    
    let costNum = 0;
    if (!newIsIntermediate && !isNonDispatchable) {
        if (!newCostPerUnit) {
          toast({ title: "Error", description: "El Precio de Venta Unitario es obligatorio para productos finales.", variant: "destructive" }); return;
        }
        costNum = parseFloat(newCostPerUnit);
        if (isNaN(costNum) || costNum < 0) {
          toast({ title: "Error", description: "El Precio de Venta Unitario debe ser un número no negativo para productos finales.", variant: "destructive" }); return;
        }
    } else if (isNonDispatchable) {
        costNum = parseFloat(newCostPerUnit) || 0;
    }

    const expectedYieldNum = parseFloat(newExpectedYield);
    if (newExpectedYield.trim() === '' || isNaN(expectedYieldNum) || (expectedYieldNum < 0) || (expectedYieldNum <= 0 && !isNonDispatchable && !newIsResoldProduct)) {
        toast({ title: "Error", description: "'Cantidad Producida/Comprada' es obligatoria, no negativa, y positiva para recetas estándar.", variant: "destructive" }); return;
    }
    
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
        toast({ title: "Error", description: "No hay una sede activa seleccionada.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    const branchName = availableBranches.find(b => b.id === activeBranch)?.name || 'Sede Desconocida';

    const finalCategory = isNonDispatchable ? 'No Despachable' : (newIsIntermediate ? 'Preparación Intermedia' : (newIsResoldProduct ? 'Reventa' : (newRecipeCategory.trim() || 'Producto Final')));
    
    const newRecipe: Recipe = {
      id: `REC${Date.now().toString().slice(-4)}${Math.floor(Math.random()*100)}`,
      name: newRecipeName, 
      ingredients: isNonDispatchable || newIsResoldProduct ? [] : validIngredients,
      instructions: newInstructions,
      costPerUnit: costNum, 
      expectedYield: expectedYieldNum,
      lastUpdated: new Date().toISOString().split('T')[0],
      isIntermediate: newIsIntermediate, 
      isResoldProduct: newIsResoldProduct,
      outputUnit: newIsIntermediate ? newOutputUnit : undefined,
      category: finalCategory, 
      aiHint: newRecipeAiHint || newRecipeName.toLowerCase().split(' ').slice(0,2).join(' ')
    };

    let recipesToSave = [newRecipe, ...currentRecipes];
    let toastDescription = "Receta añadida correctamente.";

    let createNonDispatchable = false;
    if (!newIsIntermediate && !isNonDispatchable && !newIsResoldProduct) {
        createNonDispatchable = true; // Para productos fabricados
    } else if (newIsResoldProduct && newCreateNonDispatchableForResold) {
        createNonDispatchable = true; // Para productos de reventa si se marcó la opción
    }
    
    const allProductsForBranch = loadProductsForBranch(activeBranch);

    // Logic to add the main product if it's a final product
    if (!newIsIntermediate && !isNonDispatchable) {
      const productExists = allProductsForBranch.some(p => p.name.toLowerCase() === newRecipeName.trim().toLowerCase());
      if (!productExists) {
        const newProductEntry: Product = {
            id: newRecipe.id,
            name: newRecipeName.trim(),
            category: finalCategory,
            stock: 0,
            unitPrice: costNum, // El precio de venta de la receta
            lastUpdated: new Date().toISOString().split('T')[0],
            image: "https://placehold.co/40x40.png",
            aiHint: newRecipe.aiHint,
            sourceBranchId: activeBranch,
            sourceBranchName: branchName,
        };
        allProductsForBranch.push(newProductEntry);
        toastDescription += " Producto añadido al stock con cantidad 0.";
      }
    }


    if (createNonDispatchable) {
        const costForNonDispatchable = (newIsResoldProduct) 
            ? newRecipe.costPerUnit // Para reventa, la pérdida es el precio de venta
            : (calculateDynamicRecipeCost(newRecipe.id, 'highest', recipesToSave) + ((costPerSackThisWeek || 0) * 1.0) + calculatePackagingCost(newRecipe.expectedYield || 0).maxCost) / (newRecipe.expectedYield || 1); // Para fabricados, el costo de producción

        const noDespachableName = `No despachable ${newRecipeName}`;
        const noDespachableRecipe: Recipe = {
            id: `REC${Date.now().toString().slice(-3)}${Math.floor(Math.random()*100)}`,
            name: noDespachableName,
            ingredients: [],
            instructions: `Receta para registrar devoluciones/pérdidas de "${newRecipeName}". El precio de venta aquí representa el costo de producción/valor del original.`,
            costPerUnit: costForNonDispatchable,
            expectedYield: 0,
            lastUpdated: new Date().toISOString().split('T')[0],
            isIntermediate: false,
            isResoldProduct: false,
            category: 'No Despachable',
            aiHint: newRecipe.aiHint,
        };
        recipesToSave.push(noDespachableRecipe);

        const productExists = allProductsForBranch.some(p => p.name.toLowerCase() === noDespachableName.toLowerCase());
        if (!productExists) {
            const newProductEntry: Product = {
                id: noDespachableRecipe.id,
                name: noDespachableName,
                category: 'No Despachable',
                stock: 0,
                unitPrice: noDespachableRecipe.costPerUnit,
                lastUpdated: new Date().toISOString().split('T')[0],
                image: "https://placehold.co/40x40.png",
                aiHint: noDespachableRecipe.aiHint,
                sourceBranchId: activeBranch,
                sourceBranchName: branchName,
            };
            allProductsForBranch.push(newProductEntry);
        }
        toastDescription += ` También se creó la contraparte "${noDespachableName}".`;
    }

    // Save all changes
    saveProductsDataForBranch(activeBranch, allProductsForBranch);
    const updatedRecipes = recipesToSave.sort((a,b) => a.name.localeCompare(b.name));
    saveRecipesData(updatedRecipes); 
    toast({ title: "Éxito", description: toastDescription });
    setIsAddRecipeDialogOpen(false); 
    resetAddForm(); 
    setIsSubmitting(false);
  };


  const handleOpenEditDialog = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setEditRecipeName(recipe.name); 
    setEditIngredients(Array.isArray(recipe.ingredients) ? JSON.parse(JSON.stringify(recipe.ingredients)) : []);
    setEditInstructions(recipe.instructions || '');
    setEditCostPerUnit(recipe.costPerUnit.toString()); setEditExpectedYield(recipe.expectedYield?.toString() || '');
    const isInter = recipe.isIntermediate || false;
    setEditIsIntermediate(isInter); 
    setEditIsResoldProduct(recipe.isResoldProduct || false);
    setEditOutputUnit(recipe.outputUnit || 'kg');
    setEditRecipeCategory(recipe.category || (isInter ? 'Preparación Intermedia' : 'Producto Final'));
    setEditRecipeAiHint(recipe.aiHint || '');

    const costIngMinPerTanda = calculateDynamicRecipeCost(recipe.id, 'lowest', currentRecipes);
    const costIngMaxPerTanda = calculateDynamicRecipeCost(recipe.id, 'highest', currentRecipes);
    
    let costTotalMin = costIngMinPerTanda;
    let costTotalMax = costIngMaxPerTanda;

    if (!isInter && !recipe.name.toLowerCase().startsWith('no despachable') && !recipe.isResoldProduct) {
        if (costPerSackThisWeek !== null) {
            const costOpPerTanda = costPerSackThisWeek * (recipe.batchSizeMultiplier || 1); // Asumiendo batch size 1 si no está definido
            costTotalMin += costOpPerTanda;
            costTotalMax += costOpPerTanda;
        }
        const packagingCost = calculatePackagingCost(recipe.expectedYield || 0);
        costTotalMin += packagingCost.minCost;
        costTotalMax += packagingCost.maxCost;
    }

    setDynamicCostMinForEdit(costTotalMin);
    setDynamicCostMaxForEdit(costTotalMax);
    setIsEditRecipeDialogOpen(true);
  };

  const handleUpdateRecipe = () => {
    const isNonDispatchable = editRecipeName.toLowerCase().startsWith('no despachable');
    const validIngredients = editIngredients.filter(ing => ing.name.trim() && ing.quantity > 0 && ing.unit.trim());
    
    if (!editingRecipe || !editRecipeName) {
      toast({ title: "Error", description: "El nombre es obligatorio.", variant: "destructive" }); return;
    }

    if (validIngredients.length === 0 && !isNonDispatchable && !editIsResoldProduct) {
        toast({ title: "Error", description: "Se requiere al menos un ingrediente para recetas estándar.", variant: "destructive" }); return;
    }
    
    let costNum = 0;
    if (!editIsIntermediate && !isNonDispatchable) {
        if (!editCostPerUnit) {
          toast({ title: "Error", description: "El Precio de Venta Unitario es obligatorio para productos finales.", variant: "destructive" }); return;
        }
        costNum = parseFloat(editCostPerUnit);
        if (isNaN(costNum) || costNum < 0) {
          toast({ title: "Error", description: "El Precio de Venta Unitario debe ser un número no negativo para productos finales.", variant: "destructive" }); return;
        }
    } else if (isNonDispatchable) {
        costNum = parseFloat(editCostPerUnit) || 0;
    }

    const expectedYieldNum = parseFloat(editExpectedYield);
     if (editExpectedYield.trim() === '' || isNaN(expectedYieldNum) || (expectedYieldNum < 0) || (expectedYieldNum <= 0 && !isNonDispatchable && !editIsResoldProduct)) {
        toast({ title: "Error", description: "'Cantidad Producida/Comprada' es obligatoria, no negativa, y positiva para recetas estándar.", variant: "destructive" }); return;
    }
    
    setIsSubmitting(true);
    const finalCategory = isNonDispatchable ? 'No Despachable' : (editIsIntermediate ? 'Preparación Intermedia' : (editIsResoldProduct ? 'Reventa' : (editRecipeCategory.trim() || 'Producto Final')));
    const updatedRecipes = currentRecipes.map(r =>
      r.id === editingRecipe.id
      ? { ...r, name: editRecipeName, 
          ingredients: isNonDispatchable || editIsResoldProduct ? [] : validIngredients, 
          instructions: editInstructions,
          costPerUnit: costNum, expectedYield: expectedYieldNum, lastUpdated: new Date().toISOString().split('T')[0],
          isIntermediate: editIsIntermediate, 
          isResoldProduct: editIsResoldProduct,
          outputUnit: editIsIntermediate ? editOutputUnit : undefined,
          category: finalCategory, aiHint: editRecipeAiHint || editRecipeName.toLowerCase().split(' ').slice(0,2).join(' '),
        } : r
    );
    
    const originalRecipe = currentRecipes.find(r => r.id === editingRecipe.id);
    if (originalRecipe && originalRecipe.name !== editRecipeName && !originalRecipe.isIntermediate && !originalRecipe.name.toLowerCase().startsWith('no despachable')) {
        const oldCounterpartName = `No despachable ${originalRecipe.name}`;
        const newCounterpartName = `No despachable ${editRecipeName}`;
        const counterpartRecipeIndex = updatedRecipes.findIndex(r => r.name === oldCounterpartName);
        if (counterpartRecipeIndex !== -1) {
            updatedRecipes[counterpartRecipeIndex].name = newCounterpartName;
            updatedRecipes[counterpartRecipeIndex].instructions = `Receta para registrar devoluciones/pérdidas de "${editRecipeName}". El precio de venta aquí representa el costo de producción del original.`;
            updatedRecipes[counterpartRecipeIndex].lastUpdated = new Date().toISOString().split('T')[0];

            const activeBranch = getActiveBranchId();
            if(activeBranch){
              let currentProducts = loadProductsForBranch(activeBranch);
              const productIndex = currentProducts.findIndex(p => p.name === oldCounterpartName);
              if (productIndex !== -1) {
                currentProducts[productIndex].name = newCounterpartName;
                saveProductsDataForBranch(activeBranch, currentProducts);
              }
            }
        }
    }


    const sortedRecipes = updatedRecipes.sort((a,b) => a.name.localeCompare(b.name));
    saveRecipesData(sortedRecipes); 
    toast({ title: "Éxito", description: "Receta actualizada correctamente." });
    setIsEditRecipeDialogOpen(false); setEditingRecipe(null);
    setDynamicCostMinForEdit(null); setDynamicCostMaxForEdit(null);
    setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (recipeId: string) => { setRecipeToDeleteId(recipeId); setIsDeleteConfirmDialogOpen(true); };
  
  const handleConfirmDelete = () => {
    if (!recipeToDeleteId) return;
    setIsSubmitting(true);
    
    let recipesToKeep = [...currentRecipes];
    const recipeToDelete = recipesToKeep.find(r => r.id === recipeToDeleteId);
    
    if (recipeToDelete) {
        recipesToKeep = recipesToKeep.filter(r => r.id !== recipeToDeleteId);
        
        if (!recipeToDelete.isIntermediate && !recipeToDelete.name.toLowerCase().startsWith('no despachable')) {
            const counterpartName = `No despachable ${recipeToDelete.name}`;
            recipesToKeep = recipesToKeep.filter(r => r.name.toLowerCase() !== counterpartName.toLowerCase());
        }
    }
    
    const updatedRecipes = recipesToKeep.sort((a,b) => a.name.localeCompare(b.name));
    saveRecipesData(updatedRecipes); 
    toast({ title: "Éxito", description: "Receta(s) eliminada(s) correctamente." });
    setIsDeleteConfirmDialogOpen(false); setRecipeToDeleteId(null); setIsSubmitting(false);
  };

  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredientItem,
    value: string | number
  ) => {
    const listSetter = isEditRecipeDialogOpen ? setEditIngredients : setNewIngredients;
    listSetter(prev => {
        const newList = [...prev];
        const updatedItem = { ...newList[index] };
        if (field === 'quantity') {
            updatedItem.quantity = Number(value) >= 0 ? Number(value) : 0;
        } else {
            (updatedItem as any)[field] = value;
        }
        newList[index] = updatedItem;
        return newList;
    });
  };

  const addIngredientRow = () => {
    const listSetter = isEditRecipeDialogOpen ? setEditIngredients : setNewIngredients;
    const newId = `${isEditRecipeDialogOpen ? 'edit' : 'new'}-ing-${Date.now()}`;
    listSetter(prev => [...prev, { id: newId, name: availableRawMaterials[0] || '', quantity: 0, unit: commonUnitOptions[0] || 'kg', notes: '' }]);
  };

  const removeIngredientRow = (id: string) => {
    const listSetter = isEditRecipeDialogOpen ? setEditIngredients : setNewIngredients;
    listSetter(prev => prev.filter(item => item.id !== id));
  };


  const renderDialogContent = () => {
    const isEditing = isEditRecipeDialogOpen;
    const recipeName = isEditing ? editRecipeName : newRecipeName;
    const setRecipeName = isEditing ? setEditRecipeName : setNewRecipeName;
    const ingredientsList = isEditing ? editIngredients : newIngredients;
    const instructions = isEditing ? editInstructions : newInstructions;
    const setInstructions = isEditing ? setEditInstructions : setNewInstructions;
    const costPerUnit = isEditing ? editCostPerUnit : newCostPerUnit;
    const setCostPerUnit = isEditing ? setEditCostPerUnit : setNewCostPerUnit;
    const expectedYield = isEditing ? editExpectedYield : newExpectedYield;
    const setExpectedYield = isEditing ? setEditExpectedYield : setNewExpectedYield;
    const isIntermediate = isEditing ? editIsIntermediate : newIsIntermediate;
    const setIsIntermediate = isEditing ? setEditIsIntermediate : setNewIsIntermediate;
    const isResoldProduct = isEditing ? editIsResoldProduct : newIsResoldProduct;
    const setIsResoldProduct = isEditing ? setEditIsResoldProduct : setNewIsResoldProduct;
    const createNonDispatchableForResold = isEditing ? false : newCreateNonDispatchableForResold;
    const setCreateNonDispatchableForResold = isEditing ? () => {} : setNewCreateNonDispatchableForResold;
    const outputUnit = isEditing ? editOutputUnit : newOutputUnit;
    const setOutputUnit = isEditing ? setEditOutputUnit : setNewOutputUnit;
    const category = isEditing ? editRecipeCategory : newRecipeCategory;
    const setCategory = isEditing ? setEditRecipeCategory : setNewRecipeCategory;
    const aiHint = isEditing ? editRecipeAiHint : newRecipeAiHint;
    const setAiHint = isEditing ? setEditRecipeAiHint : setNewRecipeAiHint;
    
    const isNonDispatchableModeDialog = recipeName.toLowerCase().startsWith('no despachable');
    
    const currentDynamicCostMin = isEditing ? dynamicCostMinForEdit : null;
    const currentDynamicCostMax = isEditing ? dynamicCostMaxForEdit : null;

    return (
      <div className="grid gap-4 py-4">
        <div className="space-y-1"><Label htmlFor="recipe_name">Nombre de la Receta (Producto)</Label><Input id="recipe_name" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="ej., Catalina o No despachable Pan Quemado" disabled={isSubmitting}/></div>
        
        {!isNonDispatchableModeDialog && !isResoldProduct && (
          <div className="space-y-2 border p-3 rounded-md">
            <Label className="font-medium">Ingredientes</Label>
            <p className="text-xs text-muted-foreground pb-1">Define los ingredientes para una producción base de <strong>1 saco</strong> (del ingrediente principal, ej. harina).</p>
            <div className="max-h-60 w-full pr-3 overflow-y-auto">
              <div className="space-y-3">
                {ingredientsList.map((ing, index) => (
                  <div key={ing.id} className="grid grid-cols-12 gap-2 items-start border-b pb-2 mb-2 last:border-b-0 last:pb-0">
                    <div className="col-span-12 sm:col-span-4 space-y-0.5">
                      {index === 0 && <Label htmlFor={`ing_name_${index}`} className="text-xs">Nombre</Label>}
                      <Select value={ing.name} onValueChange={(val) => handleIngredientChange(index, 'name', val)} disabled={isSubmitting}>
                        <SelectTrigger id={`ing_name_${index}`} className="h-8 text-xs"><SelectValue placeholder="Material" /></SelectTrigger>
                        <SelectContent>{availableRawMaterials.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-0.5">
                      {index === 0 && <Label htmlFor={`ing_qty_${index}`} className="text-xs">Cant.</Label>}
                      <Input id={`ing_qty_${index}`} type="number" value={ing.quantity} onChange={e => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 text-xs" disabled={isSubmitting}/>
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-0.5">
                      {index === 0 && <Label htmlFor={`ing_unit_${index}`} className="text-xs">Unidad</Label>}
                      <Select value={ing.unit} onValueChange={(val) => handleIngredientChange(index, 'unit', val)} disabled={isSubmitting}>
                        <SelectTrigger id={`ing_unit_${index}`} className="h-8 text-xs"><SelectValue placeholder="Unidad" /></SelectTrigger>
                        <SelectContent>{commonUnitOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-12 sm:col-span-3 space-y-0.5">
                      {index === 0 && <Label htmlFor={`ing_notes_${index}`} className="text-xs">Notas (Ingrediente)</Label>}
                      <Input id={`ing_notes_${index}`} value={ing.notes || ''} onChange={e => handleIngredientChange(index, 'notes', e.target.value)} placeholder="Nota opcional" className="h-8 text-xs" disabled={isSubmitting}/>
                    </div>
                    <div className="col-span-4 sm:col-span-1 flex items-end justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredientRow(ing.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" disabled={isSubmitting}><Trash className="h-3.5 w-3.5"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addIngredientRow} className="mt-2" disabled={isSubmitting || availableRawMaterials.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" /> Añadir Ingrediente
            </Button>
          </div>
        )}

        { !isNonDispatchableModeDialog && !isResoldProduct && (
          <div className="space-y-1"><Label htmlFor="instructions">Instrucciones (Opcional)</Label><Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Instrucciones paso a paso..." rows={5} disabled={isSubmitting}/></div>
        )}
        
        {!isNonDispatchableModeDialog && !isResoldProduct && (
            <div className="flex items-center space-x-2 mt-2"><Checkbox id="is_intermediate" checked={isIntermediate} onCheckedChange={(checked) => { const isChecked = !!checked; setIsIntermediate(isChecked); if (isChecked) { setIsResoldProduct(false); setCategory('Preparación Intermedia'); setCostPerUnit('0'); } else { if (category === 'Preparación Intermedia') setCategory(isEditing && editingRecipe?.category !== 'Preparación Intermedia' ? editingRecipe?.category || '' : ''); }}} disabled={isSubmitting}/><Label htmlFor="is_intermediate" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Es una preparación intermedia (ej. Melado)</Label></div>
        )}
        
         {!isNonDispatchableModeDialog && (
            <div className="flex items-center space-x-2 mt-2">
                <Checkbox id="is_resold" checked={isResoldProduct} onCheckedChange={(checked) => { const isChecked = !!checked; setIsResoldProduct(isChecked); if(isChecked) { setIsIntermediate(false); setCategory('Reventa'); } else { if(category === 'Reventa') setCategory(''); } }} disabled={isSubmitting}/>
                <Label htmlFor="is_resold" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Es Producto de Reventa (comprado y vendido)</Label>
            </div>
         )}

         {isResoldProduct && !isEditing && (
            <div className="flex items-center space-x-2 mt-2 pl-4">
                <Checkbox id="create_non_dispatchable_for_resold" checked={createNonDispatchableForResold} onCheckedChange={(checked) => setCreateNonDispatchableForResold(!!checked)} disabled={isSubmitting}/>
                <Label htmlFor="create_non_dispatchable_for_resold" className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Crear contraparte 'No despachable' para devoluciones</Label>
            </div>
         )}
        
        <div className="space-y-1 mt-2">
          <Label htmlFor="expected_yield">
            {isResoldProduct ? "Cantidad por Paquete/Caja de Compra" : isIntermediate ? "Cantidad Estimada por Tanda Base (ej. 1 L, 1 kg)" : (isNonDispatchableModeDialog ? "Cantidad Producida (Ingresar 0)" : "Unidades Producidas por Tanda Base")}
          </Label>
          <Input id="expected_yield" type="number" value={expectedYield} onChange={(e) => setExpectedYield(e.target.value)} placeholder={isNonDispatchableModeDialog ? "0" : (isIntermediate ? "1" : "ej., 60")} disabled={isSubmitting}/>
          <p className="text-xs text-muted-foreground pt-1">
            {isResoldProduct ? "Cuántas unidades individuales vienen en el empaque que se compra." : isNonDispatchableModeDialog ? "Ingresa 0 para este tipo de ítem." : (isIntermediate ? `Indica cuántas unidades de '${outputUnit.toUpperCase()}' produce la receta base.` : "Cuántas unidades del producto final se obtienen de la receta base.")}
          </p>
        </div>
        
        {isIntermediate && !isNonDispatchableModeDialog && !isResoldProduct && (<div className="space-y-1 mt-2"><Label htmlFor="output_unit">Unidad de Salida del Intermedio</Label><Select value={outputUnit} onValueChange={(value) => setOutputUnit(value as 'kg' | 'L')} disabled={isSubmitting}><SelectTrigger id="output_unit"><SelectValue placeholder="Selecciona unidad" /></SelectTrigger><SelectContent><SelectItem value="kg">Kilogramos (kg)</SelectItem><SelectItem value="L">Litros (L)</SelectItem></SelectContent></Select></div>)}
        
        {!isIntermediate && (<div className="space-y-1 mt-2"><Label htmlFor="cost_per_unit">Precio de Venta / Unidad (USD)</Label><Input id="cost_per_unit" type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder={isNonDispatchableModeDialog ? "ej., 0.50 (costo a reponer)" : "ej., 1.25"} disabled={isSubmitting}/>{costPerUnit && exchangeRate > 0 && <p className="text-xs text-muted-foreground pt-1"><FormattedNumber value={(parseFloat(costPerUnit) || 0) * exchangeRate} prefix="Bs. " /></p>}</div>)}
        
        {isEditing && (currentDynamicCostMin !== null || currentDynamicCostMax !== null) && !isNonDispatchableModeDialog && !isResoldProduct && (
          <div className="mt-2 p-3 border rounded-md bg-muted/50 space-y-1">
            <Label className="font-medium text-sm">Costos Estimados Totales por Tanda (Ingr. + Oper. + Empaque):</Label>
            {Math.abs((currentDynamicCostMin || 0) - (currentDynamicCostMax || 0)) < 0.01 ? (
                <p className="text-sm">Costo: <span className="font-semibold text-primary"><FormattedNumber value={currentDynamicCostMin} prefix="$" /></span><span className="text-xs text-muted-foreground"> (<FormattedNumber value={(currentDynamicCostMin || 0) * exchangeRate} prefix="Bs. " />)</span></p>
            ) : (
                <>
                    <p className="text-sm">Mínimo: <span className="font-semibold text-primary"><FormattedNumber value={currentDynamicCostMin} prefix="$" /></span><span className="text-xs text-muted-foreground"> (<FormattedNumber value={(currentDynamicCostMin || 0) * exchangeRate} prefix="Bs. " />)</span></p>
                    <p className="text-sm">Máximo: <span className="font-semibold text-primary"><FormattedNumber value={currentDynamicCostMax} prefix="$" /></span><span className="text-xs text-muted-foreground"> (<FormattedNumber value={(currentDynamicCostMax || 0) * exchangeRate} prefix="Bs. " />)</span></p>
                </>
            )}
            <p className="text-xs text-muted-foreground mt-1">Para producir {expectedYield || 'N/A'} {isIntermediate ? outputUnit.toUpperCase() : 'unidades'}.</p>
          </div>)}

         <div className="space-y-1 mt-2"><Label htmlFor="recipe_category">Categoría de la Receta/Producto (Opcional)</Label><Input id="recipe_category" value={isNonDispatchableModeDialog ? 'No Despachable' : (isIntermediate ? 'Preparación Intermedia' : (isResoldProduct ? 'Reventa' : category))} onChange={(e) => setCategory(e.target.value)} placeholder={isIntermediate ? "Preparación Intermedia" : "ej., Pan Dulce, Torta Fría"} disabled={isSubmitting || isIntermediate || isNonDispatchableModeDialog || isResoldProduct} className={isIntermediate || isNonDispatchableModeDialog || isResoldProduct ? "bg-muted/50" : ""}/>{(isIntermediate || isNonDispatchableModeDialog || isResoldProduct) && <p className="text-xs text-muted-foreground pt-1">La categoría se establece automáticamente.</p>}</div>
         <div className="space-y-1 mt-2"><Label htmlFor="recipe_ai_hint">Palabras Clave para Imagen (Opcional)</Label><Input id="recipe_ai_hint" value={aiHint} onChange={(e) => setAiHint(e.target.value)} placeholder="ej., torta chocolate (max 2 palabras)" disabled={isSubmitting}/></div>
      </div>
    );
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Cargando recetas...</p></div>);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión de Recetas" description="Gestiona las recetas, define ingredientes, precios de venta y costos. El costo de ingredientes se calcula dinámicamente. La 'tanda' se refiere a la producción basada en 1 saco del ingrediente principal, ej. harina." icon={Utensils} actions={<Button onClick={() => { resetAddForm(); setIsAddRecipeDialogOpen(true); }} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Añadir Nueva Receta</Button>}/>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Gasto Operativo Semanal Estimado</CardTitle>
          <CardDescription>Suma de gastos fijos semanales (sin nómina, promediados del mensual) y nómina semanal total.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2">Calculando costos...</p></div>
          ) : weeklyOperatingCost !== null ? (
            <div>
              <div className="text-2xl font-bold text-primary">
                <FormattedNumber value={weeklyOperatingCost} prefix="$" />
                <span className="text-sm text-muted-foreground ml-2">
                    (<FormattedNumber value={(weeklyOperatingCost || 0) * exchangeRate} prefix="Bs. " />)
                </span>
              </div>
              <Accordion type="single" collapsible className="w-full mt-2 text-sm">
                <AccordionItem value="cost-breakdown-op-total">
                  <AccordionTrigger className="text-xs py-2">Ver Desglose del Cálculo</AccordionTrigger>
                  <AccordionContent className="text-xs space-y-1">
                    <p>Gastos Fijos Semanales Estimados (sin nómina): <FormattedNumber value={fixedWeeklyCost} prefix="$" /> (<FormattedNumber value={(fixedWeeklyCost || 0) * exchangeRate} prefix="Bs. " />)</p>
                    <p>Nómina Semanal Estimada: <FormattedNumber value={payrollWeeklyCost} prefix="$" /> (<FormattedNumber value={(payrollWeeklyCost || 0) * exchangeRate} prefix="Bs. " />)</p>
                    <p className="text-muted-foreground text-[0.65rem] pt-1">Nota: Los gastos fijos semanales se promedian de los montos mensuales (divididos por ~{WEEKS_IN_MONTH.toFixed(2)} semanas/mes).</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <p className="text-muted-foreground">No se pudieron calcular los costos operativos. Revisa los datos de gastos fijos y empleados.</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Costo Operativo por Saco Base (Semana Actual)</CardTitle>
            <CardDescription>Gasto operativo semanal total dividido por la cantidad de sacos base de productos finales producidos en la semana actual.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2">Calculando...</p></div>
            ) : costPerSackThisWeek !== null && weeklyOperatingCost !== null && weeklyOperatingCost >= 0 ? (
                <div>
                    <div className="text-2xl font-bold text-primary">
                        <FormattedNumber value={costPerSackThisWeek} prefix="$" />
                        <span className="text-sm text-muted-foreground ml-2">
                           (<FormattedNumber value={(costPerSackThisWeek || 0) * exchangeRate} prefix="Bs. " />)
                        </span>
                    </div>
                    <Accordion type="single" collapsible className="w-full mt-2 text-sm">
                        <AccordionItem value="cost-per-sack-breakdown">
                        <AccordionTrigger className="text-xs py-2">Ver Desglose del Cálculo</AccordionTrigger>
                        <AccordionContent className="text-xs space-y-1">
                            <p>Gasto Operativo Semanal Total: <FormattedNumber value={weeklyOperatingCost} prefix="$" /> (<FormattedNumber value={(weeklyOperatingCost || 0) * exchangeRate} prefix="Bs. " />)</p>
                            <p>Sacos Base (Productos Finales) Producidos esta Semana: {sacksProducedThisWeek.toFixed(2)}</p>
                        </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            ) : (
                <p className="text-muted-foreground">
                    {weeklyOperatingCost === 0 ? "El gasto operativo semanal es cero. " : ""}
                    {sacksProducedThisWeek === 0 && weeklyOperatingCost !== null && weeklyOperatingCost >= 0 ? "No se han registrado sacos de productos finales esta semana para calcular el costo por saco." : 
                     (weeklyOperatingCost === null ? "No se pudieron calcular los costos operativos." : "")}
                </p>
            )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader><CardTitle>Lista de Recetas</CardTitle><CardDescription>Todas las recetas de tu panadería. "Costo Total / Tanda" incluye ingredientes, operativos y empaque para productos finales.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Costo Total / Tanda (USD)
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-4 w-4 p-0"><Info className="h-3 w-3 text-muted-foreground" /></Button></TooltipTrigger>
                    <TooltipContent className="max-w-xs"><p>Rango de costo de ingredientes (Mín - Máx) + operativos + empaque para la cantidad esperada de unidades.</p></TooltipContent></Tooltip></TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Costo Total / Tanda (VES)</TableHead>
                <TableHead className="text-right">Costo Estimado / Unidad (USD)</TableHead>
                <TableHead className="text-right">Precio Venta / Unidad (USD)</TableHead>
                <TableHead className="text-right">Ingreso Venta / Tanda (USD)</TableHead>
                <TableHead className="text-right">Ganancia Estimada / Tanda (USD)</TableHead>
                <TableHead className="text-right">Ganancia Estimada / Unidad (USD)</TableHead>
                <TableHead>Últ. Act.</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {currentRecipes.map((recipe) => {
                const isNonDispatchable = recipe.name.toLowerCase().startsWith('no despachable');
                let costoTotalMinPorTanda = 0;
                let costoTotalMaxPorTanda = 0;
                let costoEstimadoPorUnidad = 0;
                let ingresoPorTanda = 0;
                let gananciaPorTanda = 0;
                let gananciaEstimadaPorUnidad = 0;

                if (recipe.isResoldProduct) {
                    const priceInfo = getLowestPriceInfo(recipe.name);
                    if (priceInfo) {
                        costoTotalMinPorTanda = costoTotalMaxPorTanda = (priceInfo.originalUnitPrice || 0) * (recipe.expectedYield || 1);
                    }
                } else if (!isNonDispatchable) {
                    const costIngMinPerTanda = calculateDynamicRecipeCost(recipe.id, 'lowest', currentRecipes);
                    const costIngMaxPerTanda = calculateDynamicRecipeCost(recipe.id, 'highest', currentRecipes);
                    costoTotalMinPorTanda = costIngMinPerTanda;
                    costoTotalMaxPorTanda = costIngMaxPerTanda;

                    if (!recipe.isIntermediate && costPerSackThisWeek !== null && costPerSackThisWeek >= 0) {
                        const costOpPerTanda = costPerSackThisWeek * (recipe.batchSizeMultiplier || 1);
                        costoTotalMinPorTanda += costOpPerTanda;
                        costoTotalMaxPorTanda += costOpPerTanda;
                    }

                    if (!recipe.isIntermediate) {
                        const packagingCost = calculatePackagingCost(recipe.expectedYield || 0);
                        costoTotalMinPorTanda += packagingCost.minCost;
                        costoTotalMaxPorTanda += packagingCost.maxCost;
                    }
                }

                const yieldVal = recipe.expectedYield || 1;
                costoEstimadoPorUnidad = yieldVal > 0 ? costoTotalMaxPorTanda / yieldVal : 0;
                ingresoPorTanda = recipe.isIntermediate ? 0 : (recipe.costPerUnit * (recipe.expectedYield || 0));
                gananciaPorTanda = recipe.isIntermediate ? 0 : ingresoPorTanda - costoTotalMaxPorTanda;
                gananciaEstimadaPorUnidad = recipe.isIntermediate || yieldVal === 0 ? 0 : gananciaPorTanda / yieldVal;


                return (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>{recipe.category || (recipe.isIntermediate ? "Preparación Intermedia" : "Producto Final")}</TableCell>
                    <TableCell className="text-right text-xs">
                        {isNonDispatchable ? 'N/A' : recipe.isResoldProduct ? (costoTotalMaxPorTanda > 0 ? <FormattedNumber value={costoTotalMaxPorTanda} prefix="$" /> : 'N/A (sin OC)') : Math.abs(costoTotalMinPorTanda - costoTotalMaxPorTanda) < 0.01 ? (
                            <>Costo: <FormattedNumber value={costoTotalMinPorTanda} prefix="$" /></>
                        ) : (
                            <>Min: <FormattedNumber value={costoTotalMinPorTanda} prefix="$" /> - Max: <FormattedNumber value={costoTotalMaxPorTanda} prefix="$" /></>
                        )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                         {isNonDispatchable ? 'N/A' : recipe.isResoldProduct ? (costoTotalMaxPorTanda > 0 && exchangeRate > 0 ? <FormattedNumber value={costoTotalMaxPorTanda * exchangeRate} prefix="Bs. " /> : 'N/A') : Math.abs(costoTotalMinPorTanda - costoTotalMaxPorTanda) < 0.01 ? (
                            <>Costo: <FormattedNumber value={exchangeRate > 0 ? costoTotalMinPorTanda * exchangeRate : undefined} prefix="Bs. " /></>
                        ) : (
                            <>Min: <FormattedNumber value={exchangeRate > 0 ? costoTotalMinPorTanda * exchangeRate : undefined} prefix="Bs. " /> - Max: <FormattedNumber value={exchangeRate > 0 ? costoTotalMaxPorTanda * exchangeRate : undefined} prefix="Bs. " /></>
                        )}
                    </TableCell>
                    <TableCell className="text-right">{isNonDispatchable || recipe.isResoldProduct ? 'N/A' : <FormattedNumber value={costoEstimadoPorUnidad} prefix="$" decimalPlaces={3} />}</TableCell>
                    <TableCell className="text-right">{recipe.isIntermediate ? '-' : <FormattedNumber value={recipe.costPerUnit} prefix="$" />}</TableCell>
                    <TableCell className="text-right">{isNonDispatchable || recipe.isIntermediate || recipe.isResoldProduct ? '-' : <FormattedNumber value={ingresoPorTanda} prefix="$" />}</TableCell>
                    <TableCell className="text-right">{isNonDispatchable || recipe.isIntermediate || recipe.isResoldProduct ? '-' : <FormattedNumber value={gananciaPorTanda} prefix="$" decimalPlaces={3} />}</TableCell>
                    <TableCell className="text-right">{isNonDispatchable || recipe.isIntermediate || recipe.isResoldProduct ? '-' : <FormattedNumber value={gananciaEstimadaPorUnidad} prefix="$" decimalPlaces={3} />}</TableCell>
                    <TableCell>{recipe.lastUpdated ? formatDateFns(parseISO(recipe.lastUpdated), "dd/MM/yy", {locale: es}) : '-'}</TableCell><TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleOpenEditDialog(recipe)} disabled={isSubmitting}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem><DropdownMenuItem onClick={() => handleOpenDeleteDialog(recipe.id)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>);
              })}
            </TableBody>
          </Table>
           {currentRecipes.length === 0 && !isLoading && (<p className="text-center text-muted-foreground py-8">No hay recetas registradas.</p>)}
        </CardContent>
      </Card>
      <Dialog open={isAddRecipeDialogOpen || isEditRecipeDialogOpen} onOpenChange={(isOpen) => { if (isSubmitting) return; if (isEditRecipeDialogOpen) { if (!isOpen) { setEditingRecipe(null); setEditIsIntermediate(false); setEditIsResoldProduct(false); setEditOutputUnit('kg'); setEditRecipeCategory(''); setEditRecipeAiHint(''); setDynamicCostMinForEdit(null); setDynamicCostMaxForEdit(null); } setIsEditRecipeDialogOpen(isOpen); } else { if (!isOpen) resetAddForm(); setIsAddRecipeDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="flex-shrink-0"><DialogTitle>{isEditRecipeDialogOpen ? "Editar Receta" : "Añadir Nueva Receta"}</DialogTitle><DialogDescription>{isEditRecipeDialogOpen ? "Actualiza los detalles de la receta." : (<>Define los ingredientes e instrucciones. <br/> Los ingredientes deben ser para una producción base de <strong>1 saco</strong> (del ingrediente principal, ej. harina).</>)}</DialogDescription></DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-1 pr-3">
              {renderDialogContent()}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t flex-shrink-0"><DialogClose asChild><Button variant="outline" disabled={isSubmitting} onClick={() => { if (isEditRecipeDialogOpen) { setIsEditRecipeDialogOpen(false); setEditingRecipe(null); setDynamicCostMinForEdit(null); setDynamicCostMaxForEdit(null); } else { setIsAddRecipeDialogOpen(false); resetAddForm(); }}}>Cancelar</Button></DialogClose><Button type="button" onClick={isEditRecipeDialogOpen ? handleUpdateRecipe : handleAddRecipe} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditRecipeDialogOpen ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}{isSubmitting ? "Guardando..." : (isEditRecipeDialogOpen ? "Guardar Cambios" : "Guardar Receta")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Estás seguro de que quieres eliminar esta receta? Esta acción no se puede deshacer.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-end"><DialogClose asChild><Button variant="outline" onClick={() => {if (!isSubmitting) {setIsDeleteConfirmDialogOpen(false); setRecipeToDeleteId(null);}}} disabled={isSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}{isSubmitting ? 'Eliminando...' : 'Eliminar Receta'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
