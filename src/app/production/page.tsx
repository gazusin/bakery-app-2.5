
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Layers, PlusCircle, Calendar as CalendarIcon, Edit, Trash2, MoreHorizontal, Loader2, Filter, Info, Search, Trash, Package } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isSameMonth, isSameYear, startOfWeek, endOfWeek, addDays, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  type Product,
  type ProductionLogEntry,
  type RawMaterialInventoryItem,
  type PurchaseOrder,
  type Recipe,
  type Employee,
  type ExpenseFixedCategory,
  type InventoryTransfer,
  type PendingProductionItem,
  type ProductionGoal,
  type PurchaseOrderItem
} from '@/lib/types/db-types';
import {
  saveProductionLogData,
  saveRawMaterialInventoryData,
  loadRawMaterialInventoryData,
  normalizeUnit,
  convertMaterialToBaseUnit,
  loadExchangeRate,
  savePurchaseOrdersData,
  getBestPriceInfo,
  KEYS,
  calculateDynamicRecipeCost,
  loadExpenseFixedCategories,
  WEEKS_IN_MONTH,
  getDirectIngredientsForRecipe,
  VALID_BASE_UNITS,
  getActiveBranchId,
  availableBranches,
  loadFromLocalStorageForBranch,
  saveToLocalStorageForBranch,
  loadProductsForBranch,
  saveProductsDataForBranch,
  calculateGoalStatus,
  loadPurchaseOrdersFromStorage,
  calculatePackagingCost,
  type Branch,
  inventoryTransfersData,
  saveInventoryTransfersData,
  savePendingProductionsData
} from '@/lib/data-storage';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


// Removed batchSizeOptions in favor of numeric input


export default function ProductionPage() {
  const { toast } = useToast();

  const [productOptionsFromRecipes, setProductOptionsFromRecipes] = useState<{ id: string, name: string, isIntermediate?: boolean }[]>([]);

  const [allProductionLog, setAllProductionLog] = useState<ProductionLogEntry[]>([]);
  const [filteredProductionLog, setFilteredProductionLog] = useState<ProductionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [newProductName, setNewProductName] = useState<string>('');
  const [newBatchSizeMultiplier, setNewBatchSizeMultiplier] = useState<number>(1.0);
  const [newExpectedQuantity, setNewExpectedQuantity] = useState<string>('');
  const [newActualQuantity, setNewActualQuantity] = useState<string>('');
  const [newDate, setNewDate] = React.useState<Date | undefined>(new Date());
  const [newStaff, setNewStaff] = useState<string>('');
  const [newUnitPrice, setNewUnitPrice] = useState<string>('');
  const [newBatchNumber, setNewBatchNumber] = useState<string>('');
  const [selectedBagName, setSelectedBagName] = useState<string>('Bolsas 22x60');
  const [selectedLabelName, setSelectedLabelName] = useState<string>('Etiquetas');
  const [availableBags, setAvailableBags] = useState<string[]>([]);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);

  const [selectedPendingItemId, setSelectedPendingItemId] = useState<string | null>(null);

  const [isEditLogDialogOpen, setIsEditLogDialogOpen] = useState(false);
  const [editingLogEntry, setEditingLogEntry] = useState<ProductionLogEntry | null>(null);
  const [originalLogEntryForEdit, setOriginalLogEntryForEdit] = useState<ProductionLogEntry | null>(null);
  const [editProduct, setEditProduct] = useState<string>('');
  const [editBatchSizeMultiplier, setEditBatchSizeMultiplier] = useState<number>(1.0);
  const [editExpectedQuantity, setEditExpectedQuantity] = useState<string>('');
  const [editActualQuantity, setEditActualQuantity] = useState<string>('');
  const [editDate, setEditDate] = React.useState<Date | undefined>(undefined);
  const [editStaff, setEditStaff] = useState<string>('');
  const [editUnitPrice, setEditUnitPrice] = useState<string>('');
  const [editBatchNumber, setEditBatchNumber] = useState<string>('');
  const [editSelectedBagName, setEditSelectedBagName] = useState<string>('');
  const [editSelectedLabelName, setEditSelectedLabelName] = useState<string>('');

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [logToDeleteId, setLogToDeleteId] = useState<string | null>(null);

  const [dateRangeFilter, setDateRangeFilter] = useState<DateRange | undefined>(undefined);
  const [filterProductName, setFilterProductName] = useState<string>('');

  const [showDeficitAlert, setShowDeficitAlert] = useState(false);
  const [deficitMaterials, setDeficitMaterials] = useState<{ name: string; needed: number; unit: string; available?: number; inventoryUnit?: string, isIntermediate?: boolean }[]>([]);
  const [currentProductionDeficitData, setCurrentProductionDeficitData] = useState<{ productName: string, batchMultiplier: number } | null>(null);
  const [deficitType, setDeficitType] = useState<'raw_material_shortage' | 'intermediate_stock_shortage' | 'intermediate_missing_components_available' | 'intermediate_missing_components_missing' | null>(null);

  const [bestTransferSourceInfo, setBestTransferSourceInfo] = useState<{ branch: Branch; transferableItems: { name: string; needed: number; available: number; unit: string }[] } | null>(null);

  const [dataVersion, setDataVersion] = useState(0);
  const [costPerSackThisWeek, setCostPerSackThisWeek] = useState<number | null>(null);
  const [isNewDatePickerOpen, setIsNewDatePickerOpen] = useState(false);
  const [isEditDatePickerOpen, setIsEditDatePickerOpen] = useState(false);
  const [pendingProductions, setPendingProductions] = useState<PendingProductionItem[]>([]);


  const loadPageData = useCallback(() => {
    setIsLoading(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error", description: "No se ha seleccionado una sede activa.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const sortedLogData = [...loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch)].sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    setAllProductionLog(sortedLogData);

    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const currentRecipeOptions = recipesForBranch
      .filter(r => !r.name.toLowerCase().startsWith('no despachable'))
      .map(r => ({ id: r.id, name: r.name, isIntermediate: r.isIntermediate }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setProductOptionsFromRecipes(currentRecipeOptions);

    const rawMaterials = loadRawMaterialInventoryData(activeBranch);
    const bags = rawMaterials.filter(item => item.name.toLowerCase().includes('bolsa') && normalizeUnit(item.unit) === 'unidad').map(item => item.name).sort();
    const labels = rawMaterials.filter(item => item.name.toLowerCase().includes('etiqueta') && normalizeUnit(item.unit) === 'unidad').map(item => item.name).sort();
    setAvailableBags(bags);
    setAvailableLabels(labels);

    setExchangeRate(loadExchangeRate());

    const fixedCategories = loadExpenseFixedCategories(activeBranch);
    const employees = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranch);

    const currentFixedWeekly = fixedCategories
      .filter(cat => cat.name.toLowerCase() !== 'nómina' && cat.monthlyAmount && cat.monthlyAmount > 0)
      .reduce((sum, cat) => sum + (cat.monthlyAmount! / WEEKS_IN_MONTH), 0);
    const currentPayrollWeekly = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const totalWeeklyOpCost = currentFixedWeekly + currentPayrollWeekly;

    const todayForCost = new Date();
    const startOfCurrentWeekForCost = startOfWeek(todayForCost, { weekStartsOn: 1 });
    const endOfCurrentWeekForCost = endOfWeek(todayForCost, { weekStartsOn: 1 });

    const productionThisWeekForCost = sortedLogData.filter(log => {
      if (!log.date || !isValid(parseISO(log.date))) return false;
      const logDate = parseISO(log.date);
      return isWithinInterval(logDate, { start: startOfCurrentWeekForCost, end: endOfCurrentWeekForCost });
    });

    const totalSacksFinalProductsForCost = productionThisWeekForCost.reduce((sum, log) => {
      const recipeDetails = recipesForBranch.find(r => r.name === log.product);
      if (recipeDetails && !recipeDetails.isIntermediate) {
        return sum + (log.batchSizeMultiplier || 0);
      }
      return sum;
    }, 0);

    if (totalWeeklyOpCost >= 0) {
      if (totalSacksFinalProductsForCost > 0) {
        setCostPerSackThisWeek(totalWeeklyOpCost / totalSacksFinalProductsForCost);
      } else {
        setCostPerSackThisWeek(0);
      }
    } else {
      setCostPerSackThisWeek(null);
    }


    const pending = loadFromLocalStorageForBranch<PendingProductionItem[]>(KEYS.PENDING_PRODUCTIONS, activeBranch) || [];
    setPendingProductions(pending.filter(item => item.status === 'pending'));

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData, dataVersion]);

  useEffect(() => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;

    if (productOptionsFromRecipes.length > 0) {
      const isCurrentNewProductValid = productOptionsFromRecipes.some(p => p.name === newProductName);
      if (!newProductName || !isCurrentNewProductValid) {
        setNewProductName(productOptionsFromRecipes[0].name);
      }
    } else {
      if (newProductName !== '') {
        setNewProductName('');
      }
    }
  }, [productOptionsFromRecipes, newProductName]);


  useEffect(() => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);

    if (newProductName) {
      const selectedRecipe = recipesForBranch.find(r => r.name === newProductName);
      if (selectedRecipe) {
        const baseYield = selectedRecipe.expectedYield || 0;
        setNewExpectedQuantity((baseYield * newBatchSizeMultiplier).toString());
        setNewUnitPrice(selectedRecipe.isIntermediate ? '0' : (selectedRecipe.costPerUnit ? selectedRecipe.costPerUnit.toString() : ''));
      } else {
        setNewExpectedQuantity('');
        setNewUnitPrice('');
      }
    } else {
      setNewExpectedQuantity('');
      setNewUnitPrice('');
    }
  }, [newProductName, newBatchSizeMultiplier]);


  useEffect(() => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);

    if (isEditLogDialogOpen && editProduct) {
      const selectedRecipe = recipesForBranch.find(r => r.name === editProduct);
      if (selectedRecipe) {
        const baseYield = selectedRecipe.expectedYield || 0;
        setEditExpectedQuantity((baseYield * editBatchSizeMultiplier).toString());
        setEditUnitPrice(selectedRecipe.isIntermediate ? '0' : (selectedRecipe.costPerUnit ? selectedRecipe.costPerUnit.toString() : ''));
      } else {
        setEditExpectedQuantity('');
        setEditUnitPrice('');
      }
    }
  }, [editProduct, editBatchSizeMultiplier, isEditLogDialogOpen]);


  const applyFilters = useCallback(() => {
    let logsToDisplay = [...allProductionLog];
    if (dateRangeFilter?.from) {
      const toDate = dateRangeFilter.to ? endOfDay(dateRangeFilter.to) : endOfDay(dateRangeFilter.from);
      logsToDisplay = logsToDisplay.filter(log =>
        log.date && isValid(parseISO(log.date)) && isWithinInterval(parseISO(log.date), { start: startOfDay(dateRangeFilter.from!), end: toDate })
      );
    }
    if (filterProductName) {
      logsToDisplay = logsToDisplay.filter(log =>
        log.product.toLowerCase().includes(filterProductName.toLowerCase())
      );
    }
    setFilteredProductionLog(logsToDisplay);
  }, [allProductionLog, dateRangeFilter, filterProductName]);

  useEffect(() => {
    applyFilters();
  }, [allProductionLog, dateRangeFilter, filterProductName, applyFilters]);

  useEffect(() => {
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.PRODUCTION_LOG ||
        customEvent.detail?.key === KEYS.RECIPES ||
        customEvent.detail?.key === KEYS.RAW_MATERIAL_INVENTORY ||
        customEvent.detail?.key === KEYS.PRODUCTS ||
        customEvent.detail?.key === KEYS.EMPLOYEES ||
        customEvent.detail?.key === KEYS.EXPENSE_FIXED_CATEGORIES ||
        customEvent.detail?.key === KEYS.ACTIVE_BRANCH_ID
      ) {
        setDataVersion(prev => prev + 1);
      }
    };

    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, []);

  const resetAddForm = useCallback(() => {
    const firstProduct = productOptionsFromRecipes.length > 0 ? productOptionsFromRecipes[0].name : '';
    setNewProductName(firstProduct);

    const activeBranch = getActiveBranchId();
    if (activeBranch) {
      const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
      const firstRecipe = recipesForBranch.find(r => r.name === firstProduct);
      const initialMultiplier = 1.0;
      setNewBatchSizeMultiplier(initialMultiplier);
      setNewExpectedQuantity(firstRecipe && firstRecipe.expectedYield ? (firstRecipe.expectedYield * initialMultiplier).toString() : '');
      setNewUnitPrice(firstRecipe && !firstRecipe.isIntermediate ? (firstRecipe.costPerUnit ? firstRecipe.costPerUnit.toString() : '') : '0');
    }

    setNewActualQuantity('');
    setNewDate(new Date());
    setNewStaff('');
    setNewBatchNumber('');
    setSelectedBagName('Bolsas 22x60');
    setSelectedLabelName('Etiquetas');
    setSelectedPendingItemId(null);
  }, [productOptionsFromRecipes]);

  const updateProductionGoals = useCallback((
    productName: string,
    quantity: number,
    productionDateStr: string,
    operation: 'add' | 'subtract'
  ) => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;

    const productionDate = parseISO(productionDateStr);
    if (!isValid(productionDate)) return;

    // Update Weekly Goals
    const weeklyGoals = loadFromLocalStorageForBranch<ProductionGoal[]>(KEYS.WEEKLY_GOALS, activeBranch);
    let weeklyGoalsUpdated = false;
    const updatedWeeklyGoals = weeklyGoals.map(goal => {
      const goalStartDate = goal.startDate ? parseISO(goal.startDate) : null;
      if (goalStartDate && goal.product === productName && isWithinInterval(productionDate, { start: startOfWeek(goalStartDate, { weekStartsOn: 1 }), end: endOfWeek(goalStartDate, { weekStartsOn: 1 }) })) {
        const newAchieved = operation === 'add'
          ? goal.achieved + quantity
          : Math.max(0, goal.achieved - quantity);

        if (goal.achieved !== newAchieved) {
          weeklyGoalsUpdated = true;
          return {
            ...goal,
            achieved: newAchieved,
            status: calculateGoalStatus(goal.target, newAchieved)
          };
        }
      }
      return goal;
    });

    if (weeklyGoalsUpdated) {
      saveToLocalStorageForBranch<ProductionGoal[]>(KEYS.WEEKLY_GOALS, activeBranch, updatedWeeklyGoals);
    }

    // Update Monthly Goals
    const monthlyGoals = loadFromLocalStorageForBranch<ProductionGoal[]>(KEYS.MONTHLY_GOALS, activeBranch);
    let monthlyGoalsUpdated = false;
    const updatedMonthlyGoals = monthlyGoals.map(goal => {
      const goalStartDate = goal.startDate ? parseISO(goal.startDate) : null;
      if (goalStartDate && goal.product === productName && isSameMonth(productionDate, goalStartDate) && isSameYear(productionDate, goalStartDate)) {
        const newAchieved = operation === 'add'
          ? goal.achieved + quantity
          : Math.max(0, goal.achieved - quantity);

        if (goal.achieved !== newAchieved) {
          monthlyGoalsUpdated = true;
          return {
            ...goal,
            achieved: newAchieved,
            status: calculateGoalStatus(goal.target, newAchieved)
          };
        }
      }
      return goal;
    });

    if (monthlyGoalsUpdated) {
      saveToLocalStorageForBranch<ProductionGoal[]>(KEYS.MONTHLY_GOALS, activeBranch, updatedMonthlyGoals);
    }
  }, []);

  const updatePackagingMaterials = useCallback((
    quantity: number,
    operation: 'consume' | 'revert',
    packagingItems: { bagName?: string, labelName?: string }
  ): { success: boolean; deficits?: { name: string; available: number }[] } => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch || quantity <= 0) return { success: true };

    const materialsToProcess: string[] = [];
    if (packagingItems.bagName) materialsToProcess.push(packagingItems.bagName);
    if (packagingItems.labelName) materialsToProcess.push(packagingItems.labelName);

    if (materialsToProcess.length === 0) return { success: true };

    let currentRawMaterialsInventory = loadRawMaterialInventoryData(activeBranch);
    let inventoryChanged = false;
    const currentDeficits: { name: string; available: number }[] = [];

    // Pre-check for consumption
    if (operation === 'consume') {
      for (const materialName of materialsToProcess) {
        const materialUnit = "unidad";
        const materialIndex = currentRawMaterialsInventory.findIndex(
          item => item.name.toLowerCase() === materialName.toLowerCase() && normalizeUnit(item.unit) === materialUnit
        );

        if (materialIndex === -1) {
          currentDeficits.push({ name: materialName, available: 0 });
        } else {
          const currentStock = currentRawMaterialsInventory[materialIndex].quantity;
          if (currentStock < quantity) {
            currentDeficits.push({ name: materialName, available: currentStock });
          }
        }
      }
      if (currentDeficits.length > 0) {
        return { success: false, deficits: currentDeficits };
      }
    }

    // If pre-check passes or it's a revert, perform the operation
    materialsToProcess.forEach(materialName => {
      const materialUnit = "unidad";
      const materialIndex = currentRawMaterialsInventory.findIndex(
        item => item.name.toLowerCase() === materialName.toLowerCase() && normalizeUnit(item.unit) === materialUnit
      );

      if (materialIndex !== -1) {
        if (operation === 'consume') {
          currentRawMaterialsInventory[materialIndex].quantity -= quantity;
        } else { // revert
          currentRawMaterialsInventory[materialIndex].quantity += quantity;
        }
        inventoryChanged = true;
      } else if (operation === 'revert') {
        currentRawMaterialsInventory.push({ name: materialName, quantity: quantity, unit: materialUnit });
        inventoryChanged = true;
      }
    });

    if (inventoryChanged) {
      saveRawMaterialInventoryData(activeBranch, currentRawMaterialsInventory.filter(item => item.quantity > 0.0001));
    }
    return { success: true };
  }, []);

  const consumeOrRevertMaterials = useCallback((
    productName: string,
    batchMultiplier: number,
    operation: 'consume' | 'revert'
  ): {
    success: boolean;
    materialsDeficit?: { name: string; needed: number; unit: string; available?: number; inventoryUnit?: string, isIntermediate?: boolean }[];
    deficitType?: 'raw_material_shortage' | 'intermediate_stock_shortage' | 'intermediate_missing_components_available' | 'intermediate_missing_components_missing' | null;
    bestTransferSourceInfo?: { branch: Branch; transferableItems: { name: string; needed: number; available: number; unit: string }[] } | null
  } => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) return { success: false };

    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranchId);
    let inventory = loadRawMaterialInventoryData(activeBranchId);

    const directIngredients = getDirectIngredientsForRecipe(productName, batchMultiplier, recipesForBranch);

    if (directIngredients.length === 0) {
      const recipe = recipesForBranch.find(r => r.name === productName);
      if (recipe && recipe.ingredients.length > 0) {
        return { success: false };
      }
      return { success: true };
    }

    const deficits: { name: string; needed: number; unit: string; available?: number; inventoryUnit?: string, isIntermediate?: boolean }[] = [];
    let currentDeficitType: 'raw_material_shortage' | 'intermediate_stock_shortage' | 'intermediate_missing_components_available' | 'intermediate_missing_components_missing' | null = null;
    let bestBranchForTransfer: { branch: Branch; transferableItems: { name: string; needed: number; available: number; unit: string }[] } | null = null;

    if (operation === 'consume') {
      for (const ingredient of directIngredients) {
        const inventoryItemIndex = inventory.findIndex(item =>
          item.name.toLowerCase() === ingredient.name.toLowerCase() &&
          normalizeUnit(item.unit) === normalizeUnit(ingredient.unit)
        );

        if (inventoryItemIndex === -1 || inventory[inventoryItemIndex].quantity < ingredient.quantity) {
          const availableQuantity = inventoryItemIndex !== -1 ? inventory[inventoryItemIndex].quantity : 0;
          deficits.push({
            name: ingredient.name, needed: ingredient.quantity, unit: ingredient.unit,
            available: availableQuantity,
            inventoryUnit: inventoryItemIndex !== -1 ? inventory[inventoryItemIndex].unit : undefined,
            isIntermediate: ingredient.isIntermediate
          });
        }
      }
    }

    if (deficits.length > 0 && operation === 'consume') {
      const firstDeficit = deficits[0];
      if (firstDeficit.isIntermediate) {
        const hasRawMaterialDeficit = deficits.some(d => !d.isIntermediate);
        if (hasRawMaterialDeficit) currentDeficitType = 'intermediate_missing_components_missing';
        else currentDeficitType = 'intermediate_missing_components_available';
      } else {
        currentDeficitType = 'raw_material_shortage';
      }

      const otherBranches = availableBranches.filter(b => b.id !== activeBranchId);
      let bestScore = 0;
      for (const branch of otherBranches) {
        const sourceInventory = loadRawMaterialInventoryData(branch.id);
        let score = 0;
        const transferableItems: { name: string; needed: number; available: number; unit: string }[] = [];

        for (const deficit of deficits) {
          const sourceItem = sourceInventory.find(i => i.name.toLowerCase() === deficit.name.toLowerCase() && normalizeUnit(i.unit) === normalizeUnit(deficit.unit));
          if (sourceItem && sourceItem.quantity > 0.0001) {
            const availableForTransfer = sourceItem.quantity;
            const canCover = availableForTransfer >= deficit.needed;
            if (canCover) score += 2; else score += 1;
            transferableItems.push({ name: deficit.name, needed: deficit.needed, available: availableForTransfer, unit: deficit.unit });
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestBranchForTransfer = { branch, transferableItems };
        }
      }

      return { success: false, materialsDeficit: deficits, deficitType: currentDeficitType, bestTransferSourceInfo: bestBranchForTransfer };
    }

    for (const ingredient of directIngredients) {
      const itemIndex = inventory.findIndex(item =>
        item.name.toLowerCase() === ingredient.name.toLowerCase() &&
        normalizeUnit(item.unit) === normalizeUnit(ingredient.unit)
      );

      if (itemIndex !== -1) {
        if (operation === 'consume') inventory[itemIndex].quantity -= ingredient.quantity;
        else inventory[itemIndex].quantity += ingredient.quantity;
      } else if (operation === 'revert') {
        inventory.push({ name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit });
      }
    }

    saveRawMaterialInventoryData(activeBranchId, inventory.filter(item => item.quantity > 0.0001));
    return { success: true };
  }, []);

  const handleCreatePOFromDeficit = () => {
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error", description: "No hay sede activa para crear OC.", variant: "destructive" });
      return;
    }
    if (!currentProductionDeficitData || deficitMaterials.length === 0) return;
    setIsSubmitting(true);

    const supplierScores: { [supplierId: string]: { count: number; supplierName: string } } = {};
    const bestPricePerItem: { [materialName: string]: any | null } = {};

    deficitMaterials.filter(m => !m.isIntermediate).forEach(material => {
      const bestPrice = getBestPriceInfo(material.name);
      bestPricePerItem[material.name] = bestPrice;
      if (bestPrice) {
        if (!supplierScores[bestPrice.supplierId]) {
          supplierScores[bestPrice.supplierId] = { count: 0, supplierName: bestPrice.supplierName };
        }
        supplierScores[bestPrice.supplierId].count++;
      }
    });

    let primarySupplierId: string | null = null;
    let primarySupplierName = "Proveedor por Asignar (Automático)";
    let maxScore = 0;

    for (const supplierId in supplierScores) {
      if (supplierScores[supplierId].count > maxScore) {
        maxScore = supplierScores[supplierId].count;
        primarySupplierId = supplierId;
        primarySupplierName = supplierScores[supplierId].supplierName;
      }
    }
    if (!primarySupplierId && Object.values(bestPricePerItem).filter(bp => bp !== null).length > 0) {
      const firstAvailableBestPrice = Object.values(bestPricePerItem).find(bp => bp !== null);
      if (firstAvailableBestPrice) {
        primarySupplierId = firstAvailableBestPrice.supplierId;
        primarySupplierName = firstAvailableBestPrice.supplierName;
      }
    }

    const poItems: PurchaseOrderItem[] = deficitMaterials
      .filter(material => !material.isIntermediate)
      .map((material, index) => {
        const netDeficitInBaseUnit = Math.max(0, material.needed - (material.available || 0));
        if (netDeficitInBaseUnit <= 0.0001) return null;

        let purchaseUnitToUse: string = material.unit;
        let unitPriceForOCItem: number = 0;
        let quantityToOrderInPurchaseUnit: number = Math.ceil(netDeficitInBaseUnit);

        const bestPriceInfo = bestPricePerItem[material.name];

        if (bestPriceInfo) {
          const conversionFromPurchaseUnitToBase = convertMaterialToBaseUnit(1, bestPriceInfo.originalUnit, material.name);

          if (normalizeUnit(conversionFromPurchaseUnitToBase.unit) === normalizeUnit(material.unit) && conversionFromPurchaseUnitToBase.quantity > 0) {
            purchaseUnitToUse = bestPriceInfo.originalUnit;
            unitPriceForOCItem = bestPriceInfo.originalUnitPrice;
            quantityToOrderInPurchaseUnit = Math.ceil(netDeficitInBaseUnit / conversionFromPurchaseUnitToBase.quantity);
          } else if (normalizeUnit(bestPriceInfo.baseUnit) === normalizeUnit(material.unit)) {
            purchaseUnitToUse = material.unit;
            unitPriceForOCItem = bestPriceInfo.pricePerBaseUnit;
            quantityToOrderInPurchaseUnit = Math.ceil(netDeficitInBaseUnit);
          } else {
            console.warn(`Cannot match units for ${material.name} from supplier ${bestPriceInfo.supplierName}. Deficit unit: ${material.unit}, Supplier best price unit: ${bestPriceInfo.originalUnit} (base: ${bestPriceInfo.baseUnit}). Using default price 0 and deficit unit.`);
          }
        }

        if (netDeficitInBaseUnit > 0 && quantityToOrderInPurchaseUnit <= 0) {
          quantityToOrderInPurchaseUnit = 1;
          if (bestPriceInfo && purchaseUnitToUse !== bestPriceInfo.originalUnit) {
            if (unitPriceForOCItem === bestPriceInfo.originalUnitPrice) {
              purchaseUnitToUse = bestPriceInfo.originalUnit;
            }
          }
        }
        if (unitPriceForOCItem < 0) unitPriceForOCItem = 0;


        return {
          id: `POC-ITEM-${Date.now()}-${index}`,
          rawMaterialName: material.name,
          quantity: quantityToOrderInPurchaseUnit,
          unit: purchaseUnitToUse,
          unitPrice: parseFloat(unitPriceForOCItem.toFixed(2)),
          subtotal: parseFloat((quantityToOrderInPurchaseUnit * unitPriceForOCItem).toFixed(2)),
        };
      })
      .filter(item => item !== null && item.quantity > 0) as PurchaseOrderItem[];


    if (poItems.length === 0) {
      toast({ title: "Info", description: "No se requieren ítems en la orden de compra después de considerar el stock disponible o compatibilidad de unidades.", variant: "default" });
      setShowDeficitAlert(false);
      setDeficitMaterials([]);
      setCurrentProductionDeficitData(null);
      setDeficitType(null);
      setIsSubmitting(false);
      return;
    }


    const totalPOCost = poItems.reduce((sum, item) => sum + item.subtotal, 0);

    const newPurchaseOrder: PurchaseOrder = {
      id: `POC-DEF-${Date.now().toString().slice(-5)}`,
      supplierId: primarySupplierId || "AUTO_POC_SUPPLIER",
      supplierName: primarySupplierName,
      orderDate: format(new Date(), "yyyy-MM-dd"),
      expectedDelivery: format(addDays(new Date(), 3), "yyyy-MM-dd"),
      items: poItems,
      totalCost: totalPOCost,
      status: 'Pendiente',
      timestamp: new Date().toISOString(),
    };

    const currentPurchaseOrders = loadPurchaseOrdersFromStorage(activeBranchId);
    const updatedPOs = [newPurchaseOrder, ...currentPurchaseOrders].sort((a, b) => {
      const timeA = a.orderDate && isValid(parseISO(a.orderDate)) ? parseISO(a.orderDate).getTime() : 0;
      const timeB = b.orderDate && isValid(parseISO(b.orderDate)) ? parseISO(b.orderDate).getTime() : 0;
      if (timeB === 0 && timeA === 0) return 0;
      if (timeB === 0) return -1;
      if (timeA === 0) return 1;
      return timeB - timeA;
    });
    savePurchaseOrdersData(activeBranchId, updatedPOs);
    toast({ title: "Orden de Compra Creada", description: `OC Pendiente ${newPurchaseOrder.id} creada para materiales faltantes con ${primarySupplierName}. Por favor, revisa precios y unidades en la OC.` });

    setShowDeficitAlert(false);
    setDeficitMaterials([]);
    setCurrentProductionDeficitData(null);
    setDeficitType(null);
    setIsSubmitting(false);
  };

  const handleCreateTransferFromDeficit = (
    sourceBranchId: string,
    transferableItems: { name: string; needed: number; available: number; unit: string }[]
  ) => {
    const destBranchId = getActiveBranchId();
    if (!destBranchId || !sourceBranchId) {
      toast({ title: "Error", description: "Sede de origen o destino no válida.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const sourceBranch = availableBranches.find(b => b.id === sourceBranchId);
    const destBranch = availableBranches.find(b => b.id === destBranchId);
    if (!sourceBranch || !destBranch) {
      toast({ title: "Error", description: "Sede de origen o destino no encontrada.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let sourceInventory = loadRawMaterialInventoryData(sourceBranchId);
    let destInventory = loadRawMaterialInventoryData(destBranchId);
    let currentTransfers = inventoryTransfersData;

    const transfersToCreate: InventoryTransfer[] = [];

    for (const item of transferableItems) {
      const neededQuantityInBase = item.needed;

      let totalAvailableInBase = 0;
      const sourceItemsForMaterial = sourceInventory.filter(i => i.name.toLowerCase() === item.name.toLowerCase());

      for (const sourceItem of sourceItemsForMaterial) {
        const conversion = convertMaterialToBaseUnit(sourceItem.quantity, sourceItem.unit, sourceItem.name);
        if (normalizeUnit(conversion.unit) === normalizeUnit(item.unit)) {
          totalAvailableInBase += conversion.quantity;
        }
      }

      const transferQuantity = Math.min(neededQuantityInBase, totalAvailableInBase);
      if (transferQuantity <= 0.0001) continue;

      let remainingToDeduct = transferQuantity;
      for (const sourceItem of sourceItemsForMaterial) {
        if (remainingToDeduct <= 0.0001) break;
        const conversion = convertMaterialToBaseUnit(sourceItem.quantity, sourceItem.unit, sourceItem.name);
        if (normalizeUnit(conversion.unit) === normalizeUnit(item.unit)) {
          const deductionInBase = Math.min(remainingToDeduct, conversion.quantity);
          const { quantity: deductionInOriginalUnit } = convertMaterialToBaseUnit(deductionInBase, item.unit, item.name); // Esto podría necesitar una función inversa
          // A simpler approach for now, assuming base units are consistent or direct.
          // For simplicity, let's assume we can deduct from the base-unit-equivalent entry.
          const sourceItemIndex = sourceInventory.findIndex(i => i.name === sourceItem.name && i.unit === sourceItem.unit);
          sourceInventory[sourceItemIndex].quantity -= deductionInBase; // THIS IS RISKY if units mismatch.
          remainingToDeduct -= deductionInBase;
        }
      }


      const destItemIndex = destInventory.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase() && normalizeUnit(i.unit) === normalizeUnit(item.unit));
      if (destItemIndex !== -1) {
        destInventory[destItemIndex].quantity += transferQuantity;
      } else {
        destInventory.push({ name: item.name, quantity: transferQuantity, unit: item.unit });
      }

      const newTransfer: InventoryTransfer = {
        id: `TRNFR-DEF-${Date.now().toString().slice(-5)}-${transfersToCreate.length}`,
        date: format(new Date(), "yyyy-MM-dd"),
        fromBranchId: sourceBranchId,
        fromBranchName: sourceBranch.name,
        toBranchId: destBranchId,
        toBranchName: destBranch.name,
        materialName: item.name,
        quantity: transferQuantity,
        unit: item.unit,
        notes: `Transferencia automática por déficit para producción de: ${currentProductionDeficitData?.productName || 'N/A'}.`,
        timestamp: new Date().toISOString(),
      };
      transfersToCreate.push(newTransfer);
    }

    if (transfersToCreate.length > 0) {
      saveRawMaterialInventoryData(sourceBranchId, sourceInventory.filter(item => item.quantity > 0.0001));
      saveRawMaterialInventoryData(destBranchId, destInventory.filter(item => item.quantity > 0.0001));
      saveInventoryTransfersData([...currentTransfers, ...transfersToCreate]);
      toast({ title: "Transferencia Parcial Creada", description: `Se transfirieron ${transfersToCreate.length} ítem(s) desde ${sourceBranch.name}. Intenta registrar la producción de nuevo o crea una OC para lo restante.` });
    } else {
      toast({ title: "Sin ítems transferibles", description: "No se encontraron ítems con stock suficiente para transferir.", variant: "default" });
    }

    setShowDeficitAlert(false);
    setDeficitMaterials([]);
    setCurrentProductionDeficitData(null);
    setDeficitType(null);
    setBestTransferSourceInfo(null);
    setIsSubmitting(false);
  };


  const handleAddLogEntry = () => {
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error de Sede", description: "No hay sede activa.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);

    const recipeDetails = recipesForBranch.find(r => r.name.toLowerCase() === newProductName.toLowerCase());
    const isIntermediateProduct = recipeDetails?.isIntermediate || false;

    if (!newProductName || !newActualQuantity || !newDate || !newStaff || !newExpectedQuantity) {
      toast({ title: "Error", description: "Producto, cantidad esperada, cantidad real, fecha y personal son obligatorios.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let unitPriceNum = parseFloat(newUnitPrice);
    if (!isIntermediateProduct && (isNaN(unitPriceNum) || unitPriceNum < 0)) {
      toast({ title: "Error", description: "El precio unitario debe ser un número válido no negativo para productos finales.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    } else if (isIntermediateProduct) {
      unitPriceNum = parseFloat(newUnitPrice) || 0;
    }

    const expectedNum = parseInt(newExpectedQuantity, 10);
    const actualNum = parseInt(newActualQuantity, 10);

    if (isNaN(expectedNum) || expectedNum <= 0 || isNaN(actualNum) || actualNum < 0) {
      toast({ title: "Error", description: "Cantidades deben ser números válidos (esperada positiva, real no negativa).", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const productDateStr = format(newDate!, "yyyy-MM-dd");
    const currentTimestamp = new Date().toISOString();

    const materialConsumptionResult = consumeOrRevertMaterials(newProductName, newBatchSizeMultiplier, 'consume');

    if (!materialConsumptionResult.success) {
      if (materialConsumptionResult.materialsDeficit) {
        setDeficitMaterials(materialConsumptionResult.materialsDeficit);
        setCurrentProductionDeficitData({ productName: newProductName, batchMultiplier: newBatchSizeMultiplier });
        setDeficitType(materialConsumptionResult.deficitType || 'raw_material_shortage');
        setBestTransferSourceInfo(materialConsumptionResult.bestTransferSourceInfo || null);
        setShowDeficitAlert(true);
      } else {
        toast({ title: "Error de Materiales", description: "No se pudo consumir la materia prima necesaria.", variant: "destructive" });
      }
      setIsSubmitting(false);
      return;
    }

    if (!isIntermediateProduct && actualNum > 0) {
      const packagingResult = updatePackagingMaterials(actualNum, 'consume', { bagName: selectedBagName, labelName: selectedLabelName });
      if (!packagingResult.success) {
        toast({
          title: "Error: Faltan Materiales de Empaque",
          description: `No hay suficiente stock para: ${packagingResult.deficits?.map(d => `${d.name} (Disp: ${d.available})`).join(', ')}. Necesitas ${actualNum}.`,
          variant: "destructive",
          duration: 8000
        });
        // Revert material consumption if packaging fails
        consumeOrRevertMaterials(newProductName, newBatchSizeMultiplier, 'revert');
        setIsSubmitting(false);
        return;
      }
    }


    if (isIntermediateProduct && recipeDetails) {
      let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
      const existingIntermediateIndex = currentRawInventory.findIndex(
        item => item.name.toLowerCase() === recipeDetails.name.toLowerCase()
      );

      let intermediateUnitToUse = normalizeUnit(recipeDetails.outputUnit);
      if (!VALID_BASE_UNITS.includes(intermediateUnitToUse)) {
        const defaultIntermediateUnit = recipeDetails.name.toLowerCase().includes("melado") || recipeDetails.name.toLowerCase().includes("jarabe") ? "l" : "kg";
        console.warn(`Unidad de salida '${recipeDetails.outputUnit}' para preparación intermedia '${recipeDetails.name}' no es una unidad base válida. Usando '${defaultIntermediateUnit}' por defecto. La cantidad ${actualNum} se guardará en esta unidad base.`);
        intermediateUnitToUse = defaultIntermediateUnit;
      }

      if (existingIntermediateIndex !== -1) {
        if (normalizeUnit(currentRawInventory[existingIntermediateIndex].unit) === intermediateUnitToUse) {
          currentRawInventory[existingIntermediateIndex].quantity += actualNum;
        } else {
          console.warn(`Preparación intermedia '${recipeDetails.name}' existe con unidad ${currentRawInventory[existingIntermediateIndex].unit}, añadiendo nueva entrada con ${intermediateUnitToUse}.`);
          currentRawInventory.push({ name: recipeDetails.name, quantity: actualNum, unit: intermediateUnitToUse as any });
        }
      } else {
        currentRawInventory.push({ name: recipeDetails.name, quantity: actualNum, unit: intermediateUnitToUse as any });
      }
      saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));

      // Remove from pending if applicable
      if (selectedPendingItemId) {
        const updatedPending = pendingProductions.filter(p => p.id !== selectedPendingItemId);
        setPendingProductions(updatedPending);
        savePendingProductionsData(activeBranch, updatedPending);
        setSelectedPendingItemId(null);
      }

      toast({ title: "Éxito", description: "Producción registrada correctamente." });
    } else {
      let currentProducts = loadProductsForBranch(activeBranch);
      const productIndex = currentProducts.findIndex(p => p.name.toLowerCase() === newProductName.toLowerCase());
      if (productIndex !== -1) {
        currentProducts[productIndex].stock += actualNum;
        currentProducts[productIndex].lastUpdated = productDateStr;
        currentProducts[productIndex].unitPrice = unitPriceNum;
      } else {
        currentProducts.unshift({
          id: `PROD_NEW_${Date.now()}`,
          name: newProductName,
          category: recipeDetails?.category || "General",
          stock: actualNum,
          unitPrice: unitPriceNum,
          lastUpdated: productDateStr,
          image: "https://placehold.co/40x40.png",
          aiHint: recipeDetails?.aiHint || "producto panaderia",
          sourceBranchId: activeBranch,
          sourceBranchName: availableBranches.find(b => b.id === activeBranch)?.name || 'Desconocida'
        });
      }
      saveProductsDataForBranch(activeBranch, currentProducts);
      if (!isIntermediateProduct) {
        updateProductionGoals(newProductName, actualNum, productDateStr, 'add');
      }
      toast({ title: "Éxito", description: `Producción de '${newProductName}' registrada.` });
    }

    const newLogEntry: ProductionLogEntry = {
      id: `PL${Date.now().toString().slice(-3)}${Math.floor(Math.random() * 100)}`,
      product: newProductName,
      batchSizeMultiplier: newBatchSizeMultiplier,
      expectedQuantity: expectedNum,
      actualQuantity: actualNum,
      date: productDateStr,
      staff: newStaff.trim(),
      unitPrice: unitPriceNum,
      batchNumber: newBatchNumber.trim() || undefined,
      timestamp: currentTimestamp,
      bagUsed: selectedBagName || undefined,
      labelUsed: selectedLabelName || undefined,
    };

    const currentLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch);
    const updatedLogs = [newLogEntry, ...currentLogsForBranch].sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    saveProductionLogData(updatedLogs);
    setAllProductionLog(updatedLogs);

    // Remove from pending if applicable
    if (selectedPendingItemId) {
      const updatedPending = pendingProductions.filter(p => p.id !== selectedPendingItemId);
      setPendingProductions(updatedPending);
      savePendingProductionsData(activeBranch, updatedPending);
      setSelectedPendingItemId(null);
    }

    resetAddForm();
    setIsSubmitting(false);
  };

  const handleOpenEditDialog = (logEntry: ProductionLogEntry) => {
    setEditingLogEntry(logEntry);
    setOriginalLogEntryForEdit(JSON.parse(JSON.stringify(logEntry)));
    setEditProduct(logEntry.product);
    setEditBatchSizeMultiplier(logEntry.batchSizeMultiplier);

    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const recipeForEdit = recipesForBranch.find(r => r.name === logEntry.product);
    const baseYieldForEdit = recipeForEdit?.expectedYield || 0;
    setEditExpectedQuantity((baseYieldForEdit * logEntry.batchSizeMultiplier).toString());
    setEditActualQuantity(logEntry.actualQuantity.toString());
    setEditDate(logEntry.date && isValid(parseISO(logEntry.date)) ? parseISO(logEntry.date) : new Date());
    setEditStaff(logEntry.staff);
    setEditUnitPrice(logEntry.unitPrice.toString());
    setEditBatchNumber(logEntry.batchNumber || '');
    setEditSelectedBagName(logEntry.bagUsed || '');
    setEditSelectedLabelName(logEntry.labelUsed || '');

    setIsEditLogDialogOpen(true);
  };

  const handleSelectPendingProduction = (item: PendingProductionItem) => {
    setNewProductName(item.productName);
    setNewBatchSizeMultiplier(item.batchMultiplier);
    setSelectedPendingItemId(item.id);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: "Producción Cargada", description: `Se cargó la orden pendiente para ${item.productName}. Verifica los datos y registra.` });
  };

  const handleDismissPendingProduction = (itemId: string) => {
    const activeBranch = getActiveBranchId();
    if (!activeBranch) return;
    const updatedPending = pendingProductions.map(p => p.id === itemId ? { ...p, status: 'cancelled' } : p) as PendingProductionItem[];
    // Filter out non-pending for display but save all status updates if we were keeping history, 
    // but here we just want to remove from list.
    // Actually let's just remove it from the active list we save back.
    const remainingPending = pendingProductions.filter(p => p.id !== itemId);
    setPendingProductions(remainingPending);
    savePendingProductionsData(activeBranch, remainingPending);
    toast({ title: "Orden Descartada", description: "La orden pendiente ha sido eliminada de la lista." });
  };

  const handleRegisterProduction = async () => {
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch) {
      toast({ title: "Error", description: "No hay sede activa.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const recipeDetails = recipesForBranch.find(r => r.name.toLowerCase() === newProductName.toLowerCase());
    const isIntermediateProduct = recipeDetails?.isIntermediate || false;

    if (!newProductName || !newDate || !newStaff || !newExpectedQuantity || !newActualQuantity) {
      toast({ title: "Error", description: "Faltan campos obligatorios.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const expectedNum = parseInt(newExpectedQuantity, 10);
    const actualNum = parseInt(newActualQuantity, 10);
    let unitPriceNum = parseFloat(newUnitPrice);

    if (isNaN(expectedNum) || expectedNum <= 0 || isNaN(actualNum) || actualNum < 0) {
      toast({ title: "Error", description: "Cantidades deben ser números válidos.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (!isIntermediateProduct && (isNaN(unitPriceNum) || unitPriceNum < 0)) {
      toast({ title: "Error", description: "El precio unitario debe ser un número válido.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    } else if (isIntermediateProduct) {
      unitPriceNum = 0;
    }

    const productDateStr = format(newDate!, "yyyy-MM-dd");

    // Consume materials
    const consumeMaterialsResult = consumeOrRevertMaterials(newProductName, newBatchSizeMultiplier, 'consume');
    if (!consumeMaterialsResult.success) {
      if (consumeMaterialsResult.materialsDeficit) {
        setDeficitMaterials(consumeMaterialsResult.materialsDeficit);
        setCurrentProductionDeficitData({ productName: newProductName, batchMultiplier: newBatchSizeMultiplier });
        setDeficitType(consumeMaterialsResult.deficitType || 'raw_material_shortage');
        setBestTransferSourceInfo(consumeMaterialsResult.bestTransferSourceInfo || null);
        setShowDeficitAlert(true);
      } else {
        toast({ title: "Error de Materiales", description: "No se pudo consumir materiales.", variant: "destructive" });
      }
      setIsSubmitting(false);
      return;
    }

    // Consume packaging materials for final products
    if (!isIntermediateProduct && actualNum > 0) {
      const packagingBagName = selectedBagName === 'none' ? '' : selectedBagName;
      const packagingLabelName = selectedLabelName === 'none' ? '' : selectedLabelName;

      const packagingResult = updatePackagingMaterials(actualNum, 'consume', { bagName: packagingBagName, labelName: packagingLabelName });
      if (!packagingResult.success) {
        toast({
          title: "Error: Faltan Materiales de Empaque",
          description: `No hay suficiente stock para: ${packagingResult.deficits?.map(d => `${d.name} (Disp: ${d.available})`).join(', ')}. Se revirtieron los cambios.`,
          variant: "destructive",
          duration: 8000
        });
        consumeOrRevertMaterials(newProductName, newBatchSizeMultiplier, 'revert');
        setIsSubmitting(false);
        return;
      }
    }

    // Update stock
    if (isIntermediateProduct && recipeDetails) {
      let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
      const idx = currentRawInventory.findIndex(item => item.name.toLowerCase() === recipeDetails.name.toLowerCase());
      let intermediateUnit = normalizeUnit(recipeDetails.outputUnit || (recipeDetails.name.toLowerCase().includes("melado") || recipeDetails.name.toLowerCase().includes("jarabe") ? "l" : "kg"));

      if (!VALID_BASE_UNITS.includes(intermediateUnit)) {
        intermediateUnit = recipeDetails.name.toLowerCase().includes("melado") || recipeDetails.name.toLowerCase().includes("jarabe") ? "l" : "kg";
      }

      if (idx !== -1) {
        if (normalizeUnit(currentRawInventory[idx].unit) === intermediateUnit) {
          currentRawInventory[idx].quantity += actualNum;
        } else {
          currentRawInventory.push({ name: recipeDetails.name, quantity: actualNum, unit: intermediateUnit as any });
        }
      } else {
        currentRawInventory.push({ name: recipeDetails.name, quantity: actualNum, unit: intermediateUnit as any });
      }
      saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
      let products = loadProductsForBranch(activeBranch);
      const productIndex = products.findIndex(p => p.name.toLowerCase() === newProductName.toLowerCase());
      if (productIndex !== -1) {
        products[productIndex].stock += actualNum;
        products[productIndex].lastUpdated = productDateStr;
        products[productIndex].unitPrice = unitPriceNum;
      } else {
        products.unshift({
          id: `PROD_NEW_${Date.now()}`,
          name: newProductName,
          category: recipeDetails?.category || "General",
          stock: actualNum,
          unitPrice: unitPriceNum,
          lastUpdated: productDateStr,
          image: "https://placehold.co/40x40.png",
          aiHint: recipeDetails?.aiHint || "producto panaderia",
          sourceBranchId: activeBranch,
          sourceBranchName: availableBranches.find(b => b.id === activeBranch)?.name || 'Desconocida'
        });
      }
      saveProductsDataForBranch(activeBranch, products);
    }

    if (!isIntermediateProduct && recipeDetails) {
      updateProductionGoals(newProductName, actualNum, productDateStr, 'add');
    }

    // Save production log
    const currentLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch);
    const newLog: ProductionLogEntry = {
      id: `PRODLOG-${Date.now()}`,
      product: newProductName,
      batchSizeMultiplier: newBatchSizeMultiplier,
      expectedQuantity: expectedNum,
      actualQuantity: actualNum,
      date: productDateStr,
      staff: newStaff.trim(),
      unitPrice: unitPriceNum,
      batchNumber: newBatchNumber.trim() || undefined,
      bagUsed: (selectedBagName === 'none' ? '' : selectedBagName) || undefined,
      labelUsed: (selectedLabelName === 'none' ? '' : selectedLabelName) || undefined,
      timestamp: new Date().toISOString()
    };

    const updatedLog = [newLog, ...currentLogsForBranch].sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    saveProductionLogData(updatedLog);
    setAllProductionLog(updatedLog);

    // Remove from pending if it matches
    let pendingIdToRemove = selectedPendingItemId;
    if (!pendingIdToRemove && pendingProductions.length > 0) {
      const matchingPending = pendingProductions.find(p => p.productName === newProductName && Math.abs(p.batchMultiplier - newBatchSizeMultiplier) < 0.01);
      if (matchingPending) pendingIdToRemove = matchingPending.id;
    }

    if (pendingIdToRemove) {
      const remainingPending = pendingProductions.filter(p => p.id !== pendingIdToRemove);
      setPendingProductions(remainingPending);
      savePendingProductionsData(activeBranch, remainingPending);
      setSelectedPendingItemId(null);
    }

    toast({ title: "Éxito", description: `Producción de ${newProductName} registrada.` });

    // Reset form
    setNewActualQuantity('');
    setNewBatchNumber('');
    setIsSubmitting(false);
  };

  const handleUpdateLogEntry = async () => {
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch || !editingLogEntry || !originalLogEntryForEdit) {
      toast({ title: "Error", description: "Faltan datos para editar o no hay sede activa.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const recipeDetailsOriginal = recipesForBranch.find(r => r.name.toLowerCase() === originalLogEntryForEdit.product.toLowerCase());
    const isIntermediateOriginal = recipeDetailsOriginal?.isIntermediate || false;
    const recipeDetailsNew = recipesForBranch.find(r => r.name.toLowerCase() === editProduct.toLowerCase());
    const isIntermediateNew = recipeDetailsNew?.isIntermediate || false;

    if (!editProduct || !editDate || !editStaff || !editExpectedQuantity || !editActualQuantity) {
      toast({ title: "Error", description: "Faltan campos obligatorios para editar.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const updatedExpectedNum = parseInt(editExpectedQuantity, 10);
    const updatedActualNum = parseInt(editActualQuantity, 10);
    let updatedUnitPriceNum = parseFloat(editUnitPrice);

    if (isNaN(updatedExpectedNum) || updatedExpectedNum <= 0 || isNaN(updatedActualNum) || updatedActualNum < 0) {
      toast({ title: "Error", description: "Cantidades deben ser números válidos.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (!isIntermediateNew && (isNaN(updatedUnitPriceNum) || updatedUnitPriceNum < 0)) {
      toast({ title: "Error", description: "El precio unitario debe ser un número válido no negativo para productos finales.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    } else if (isIntermediateNew) {
      updatedUnitPriceNum = parseFloat(editUnitPrice) || 0;
    }

    const productDateStrNew = format(editDate!, "yyyy-MM-dd");
    const originalProductDateStr = originalLogEntryForEdit.date;
    const currentTimestamp = new Date().toISOString();

    const revertOriginalMaterialsResult = consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'revert');
    if (!revertOriginalMaterialsResult.success) {
      toast({ title: "Error al Revertir Original", description: "No se pudo revertir el consumo de materiales original al editar.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
      updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'revert', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
    }

    if (isIntermediateOriginal && recipeDetailsOriginal) {
      let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
      const idx = currentRawInventory.findIndex(item => item.name.toLowerCase() === recipeDetailsOriginal.name.toLowerCase());
      if (idx !== -1) {
        currentRawInventory[idx].quantity -= originalLogEntryForEdit.actualQuantity;
        if (currentRawInventory[idx].quantity <= 0.0001) currentRawInventory.splice(idx, 1);
      }
      saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
      let tempProducts = loadProductsForBranch(activeBranch);
      const productIndex = tempProducts.findIndex(p => p.name.toLowerCase() === originalLogEntryForEdit.product.toLowerCase());
      if (productIndex !== -1) {
        tempProducts[productIndex].stock -= originalLogEntryForEdit.actualQuantity;
        if (tempProducts[productIndex].stock < 0) tempProducts[productIndex].stock = 0;
        saveProductsDataForBranch(activeBranch, tempProducts);
      }
    }
    if (!isIntermediateOriginal && recipeDetailsOriginal) {
      updateProductionGoals(originalLogEntryForEdit.product, originalLogEntryForEdit.actualQuantity, originalProductDateStr, 'subtract');
    }

    const consumeUpdatedMaterialsResult = consumeOrRevertMaterials(editProduct, editBatchSizeMultiplier, 'consume');
    if (!consumeUpdatedMaterialsResult.success) {
      consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'consume');
      if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
        updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'consume', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
      }

      if (consumeUpdatedMaterialsResult.materialsDeficit) {
        setDeficitMaterials(consumeUpdatedMaterialsResult.materialsDeficit);
        setCurrentProductionDeficitData({ productName: editProduct, batchMultiplier: editBatchSizeMultiplier });
        setDeficitType(consumeUpdatedMaterialsResult.deficitType || 'raw_material_shortage');
        setBestTransferSourceInfo(consumeUpdatedMaterialsResult.bestTransferSourceInfo || null);
        setShowDeficitAlert(true);
      } else {
        toast({ title: "Error al Editar: Consumo de Materiales", description: "No se pudo actualizar el consumo de materiales", variant: "destructive" });
      }
      setIsSubmitting(false);
      return;
    }

    if (!isIntermediateNew && updatedActualNum > 0) {
      const packagingResult = updatePackagingMaterials(updatedActualNum, 'consume', { bagName: editSelectedBagName, labelName: editSelectedLabelName });
      if (!packagingResult.success) {
        toast({
          title: "Error al Editar: Faltan Materiales de Empaque",
          description: `No hay suficiente stock para: ${packagingResult.deficits?.map(d => `${d.name} (Disp: ${d.available})`).join(', ')}. Cambios revertidos.`,
          variant: "destructive",
          duration: 8000
        });
        consumeOrRevertMaterials(editProduct, editBatchSizeMultiplier, 'revert');
        consumeOrRevertMaterials(originalLogEntryForEdit.product, originalLogEntryForEdit.batchSizeMultiplier, 'consume');
        if (!isIntermediateOriginal && originalLogEntryForEdit.actualQuantity > 0) {
          updatePackagingMaterials(originalLogEntryForEdit.actualQuantity, 'consume', { bagName: originalLogEntryForEdit.bagUsed, labelName: originalLogEntryForEdit.labelUsed });
        }
        setIsSubmitting(false);
        return;
      }
    }

    if (isIntermediateNew && recipeDetailsNew) {
      let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
      const idx = currentRawInventory.findIndex(item => item.name.toLowerCase() === recipeDetailsNew.name.toLowerCase());
      let intermediateUnitNew = normalizeUnit(recipeDetailsNew.outputUnit || (recipeDetailsNew.name.toLowerCase().includes("melado") || recipeDetailsNew.name.toLowerCase().includes("jarabe") ? "l" : "kg")) as any;
      if (!VALID_BASE_UNITS.includes(intermediateUnitNew)) {
        intermediateUnitNew = recipeDetailsNew.name.toLowerCase().includes("melado") || recipeDetailsNew.name.toLowerCase().includes("jarabe") ? "l" : "kg";
      }
      if (idx !== -1) {
        if (normalizeUnit(currentRawInventory[idx].unit) === intermediateUnitNew) {
          currentRawInventory[idx].quantity += updatedActualNum;
        } else {
          currentRawInventory.push({ name: recipeDetailsNew.name, quantity: updatedActualNum, unit: intermediateUnitNew as any });
        }
      } else {
        currentRawInventory.push({ name: recipeDetailsNew.name, quantity: updatedActualNum, unit: intermediateUnitNew as any });
      }
      saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
      let tempProducts = loadProductsForBranch(activeBranch);
      const productIndex = tempProducts.findIndex(p => p.name.toLowerCase() === editProduct.toLowerCase());
      if (productIndex !== -1) {
        tempProducts[productIndex].stock += updatedActualNum;
        tempProducts[productIndex].lastUpdated = productDateStrNew;
        tempProducts[productIndex].unitPrice = updatedUnitPriceNum;
      } else {
        tempProducts.unshift({
          id: `PROD_NEW_EDIT_${Date.now()}`,
          name: editProduct,
          category: recipeDetailsNew?.category || "General",
          stock: updatedActualNum,
          unitPrice: updatedUnitPriceNum,
          lastUpdated: productDateStrNew,
          image: "https://placehold.co/40x40.png",
          aiHint: recipeDetailsNew?.aiHint || "producto panaderia",
          sourceBranchId: activeBranch,
          sourceBranchName: availableBranches.find(b => b.id === activeBranch)?.name || 'Desconocida'
        });
      }
      saveProductsDataForBranch(activeBranch, tempProducts);
    }

    if (!isIntermediateNew && recipeDetailsNew) {
      updateProductionGoals(editProduct, updatedActualNum, productDateStrNew, 'add');
    }

    const currentLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch);
    const updatedLogs = currentLogsForBranch.map(log =>
      log.id === editingLogEntry.id
        ? {
          ...log,
          product: editProduct,
          batchSizeMultiplier: editBatchSizeMultiplier,
          expectedQuantity: updatedExpectedNum,
          actualQuantity: updatedActualNum,
          date: productDateStrNew,
          staff: editStaff.trim(),
          unitPrice: updatedUnitPriceNum,
          batchNumber: editBatchNumber.trim() || undefined,
          bagUsed: editSelectedBagName || undefined,
          labelUsed: editSelectedLabelName || undefined,
          timestamp: currentTimestamp,
        }
        : log
    ).sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    saveProductionLogData(updatedLogs);
    setAllProductionLog(updatedLogs);

    if (pendingProductions.length > 0) {
      const matchingPending = pendingProductions.find(p => p.productName === editProduct && Math.abs(p.batchMultiplier - editBatchSizeMultiplier) < 0.01);
      if (matchingPending) {
        const remainingPending = pendingProductions.filter(p => p.id !== matchingPending.id);
        setPendingProductions(remainingPending);
        savePendingProductionsData(activeBranch, remainingPending);
      }
    }

    toast({ title: "Éxito", description: `Producción de ${editProduct} actualizada.` });
    setIsEditLogDialogOpen(false);
    setEditingLogEntry(null);
    setOriginalLogEntryForEdit(null);
    setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (logEntryId: string) => {
    setLogToDeleteId(logEntryId);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    setIsSubmitting(true);
    const activeBranch = getActiveBranchId();
    if (!activeBranch || !logToDeleteId) {
      toast({ title: "Error", description: "No hay sede activa o ID de registro para eliminar.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    const currentLogsForBranch = loadFromLocalStorageForBranch<ProductionLogEntry[]>(KEYS.PRODUCTION_LOG, activeBranch);
    const logEntryToDelete = currentLogsForBranch.find(entry => entry.id === logToDeleteId);

    if (!logEntryToDelete) {
      toast({ title: "Error", description: "Registro no encontrado.", variant: "destructive" });
      setIsSubmitting(false);
      setIsDeleteConfirmDialogOpen(false);
      return;
    }
    const recipesForBranch = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch);
    const recipeDetails = recipesForBranch.find(r => r.name.toLowerCase() === logEntryToDelete.product.toLowerCase());
    const materialsRevertedResult = consumeOrRevertMaterials(logEntryToDelete.product, logEntryToDelete.batchSizeMultiplier, 'revert');

    if (!materialsRevertedResult.success) {
      toast({ title: "Error", description: "No se pudo revertir el consumo de materiales al eliminar.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (recipeDetails && !recipeDetails.isIntermediate && logEntryToDelete.actualQuantity > 0) {
      updatePackagingMaterials(logEntryToDelete.actualQuantity, 'revert', { bagName: logEntryToDelete.bagUsed, labelName: logEntryToDelete.labelUsed });
    }

    if (recipeDetails && recipeDetails.isIntermediate) {
      let currentRawInventory = loadRawMaterialInventoryData(activeBranch);
      const idx = currentRawInventory.findIndex(
        item => item.name.toLowerCase() === recipeDetails.name.toLowerCase()
      );
      if (idx !== -1) {
        currentRawInventory[idx].quantity -= logEntryToDelete.actualQuantity;
        if (currentRawInventory[idx].quantity <= 0.0001) {
          currentRawInventory.splice(idx, 1);
        }
      }
      saveRawMaterialInventoryData(activeBranch, currentRawInventory.filter(item => item.quantity > 0.0001));
    } else {
      let currentProducts = loadProductsForBranch(activeBranch);
      const productIndex = currentProducts.findIndex(p => p.name.toLowerCase() === logEntryToDelete.product.toLowerCase());
      if (productIndex !== -1) {
        currentProducts[productIndex].stock -= logEntryToDelete.actualQuantity;
        if (currentProducts[productIndex].stock < 0) currentProducts[productIndex].stock = 0;
        saveProductsDataForBranch(activeBranch, currentProducts);
      }
      if (recipeDetails && !recipeDetails.isIntermediate) {
        updateProductionGoals(logEntryToDelete.product, logEntryToDelete.actualQuantity, logEntryToDelete.date, 'subtract');
      }
    }

    const updatedLogs = currentLogsForBranch.filter(log => log.id !== logToDeleteId).sort((a, b) => {
      const dateA = a.timestamp ? parseISO(a.timestamp).getTime() : (a.date ? parseISO(a.date).getTime() : 0);
      const dateB = b.timestamp ? parseISO(b.timestamp).getTime() : (b.date ? parseISO(b.date).getTime() : 0);
      return dateB - dateA;
    });
    saveProductionLogData(updatedLogs);
    setAllProductionLog(updatedLogs);

    toast({ title: "Éxito", description: "Registro de producción eliminado y stock ajustado." });
    setIsDeleteConfirmDialogOpen(false);
    setLogToDeleteId(null);
    setIsSubmitting(false);
  };

  const formatBatchSize = (multiplier: number) => {
    return `${multiplier} Sacos`;
  };

  const calculateWastagePercentage = (expected: number, actual: number): string => {
    if (expected <= 0) return "N/A";
    if (actual >= expected) return "0.00%";
    const wastage = ((expected - actual) / expected) * 100;
    return `${wastage.toFixed(2)}%`;
  };

  const handleFilterApply = () => {
    applyFilters();
  };

  const handleClearFilters = () => {
    setDateRangeFilter(undefined);
    setFilterProductName('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando registros de producción...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento de Producción"
        description="Registra las tandas de producción, actualiza stock y metas."
        icon={Layers}
      />

      {/* Pending Productions Section */}
      {pendingProductions.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-indigo-800">
              <CalendarIcon className="h-5 w-5" />
              Producción Planificada / Pendiente
            </CardTitle>
            <CardDescription>
              Órdenes enviadas desde el Planificador. Selecciona una para registrarla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingProductions.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-800">{item.productName}</h4>
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-mono">
                        {format(parseISO(item.date), 'dd/MM')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Planificado: <span className="font-medium">{item.plannedQuantity} un.</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Tandas Sugeridas: <span className="font-medium">{item.batchMultiplier}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleSelectPendingProduction(item)}
                    >
                      Cargar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDismissPendingProduction(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Registrar Nueva Producción</CardTitle>
          <CardDescription>Ingresa los detalles de la producción del día.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product">Producto</Label>
              <Select value={newProductName} onValueChange={setNewProductName}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productOptionsFromRecipes.map((product) => (
                    <SelectItem key={product.id} value={product.name}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchSize">Tandas (Sacos)</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-10 w-10 shrink-0"
                  onClick={() => setNewBatchSizeMultiplier(prev => Math.max(0.25, prev - 0.25))}
                >
                  -
                </Button>
                <div className="relative flex-1">
                  <Input
                    id="batchSize"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newBatchSizeMultiplier}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) setNewBatchSizeMultiplier(val);
                    }}
                    className="text-center font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    Sacos
                  </span>
                </div>
                <Button
                  variant="outline" size="icon" className="h-10 w-10 shrink-0"
                  onClick={() => setNewBatchSizeMultiplier(prev => prev + 0.25)}
                >
                  +
                </Button>
              </div>
              <div className="flex gap-1 justify-center">
                {[0.25, 0.5, 1, 2].map(val => (
                  <Button
                    key={val}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => setNewBatchSizeMultiplier(val)}
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedQuantity">Cantidad Esperada</Label>
              <Input
                id="expectedQuantity"
                type="number"
                value={newExpectedQuantity}
                readOnly
                className="bg-gray-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actualQuantity">Cantidad Real (Obtenida)</Label>
              <Input
                id="actualQuantity"
                type="number"
                value={newActualQuantity}
                onChange={(e) => setNewActualQuantity(e.target.value)}
                placeholder="Ej: 500"
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover open={isNewDatePickerOpen} onOpenChange={setIsNewDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(date) => { setNewDate(date); setIsNewDatePickerOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff">Personal</Label>
              <Input
                id="staff"
                value={newStaff}
                onChange={(e) => setNewStaff(e.target.value)}
                placeholder="Nombre del panadero"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Costo Unitario (Ref)</Label>
              <Input
                id="unitPrice"
                type="number"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                placeholder="Calculado autom."
                readOnly
                className="bg-gray-100"
              />
            </div>
          </div>

          {/* Packaging Selection (Optional) */}
          {!productOptionsFromRecipes.find(p => p.name === newProductName)?.isIntermediate && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-100">
              <h4 className="text-sm font-medium mb-3 text-gray-700 flex items-center gap-2">
                <Package className="h-4 w-4" /> Material de Empaque (Opcional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bagSelect" className="text-xs">Bolsa</Label>
                  <Select value={selectedBagName} onValueChange={setSelectedBagName}>
                    <SelectTrigger id="bagSelect" className="h-8 text-sm">
                      <SelectValue placeholder="Seleccionar Bolsa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {availableBags.map(bag => (
                        <SelectItem key={bag} value={bag}>{bag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="labelSelect" className="text-xs">Etiqueta</Label>
                  <Select value={selectedLabelName} onValueChange={setSelectedLabelName}>
                    <SelectTrigger id="labelSelect" className="h-8 text-sm">
                      <SelectValue placeholder="Seleccionar Etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {availableLabels.map(label => (
                        <SelectItem key={label} value={label}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={handleRegisterProduction} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Registrar Producción
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Registro de Producción Diario</CardTitle>
              <CardDescription>Historial de todas las tandas de producción.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por producto..."
                  className="pl-8 w-full sm:w-[200px]"
                  value={filterProductName}
                  onChange={(e) => setFilterProductName(e.target.value)}
                  disabled={isSubmitting || isLoading}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-filter-production"
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-[260px] justify-start text-left font-normal",
                      !dateRangeFilter && "text-muted-foreground"
                    )}
                    disabled={isSubmitting || isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeFilter?.from ? (
                      dateRangeFilter.to ? (
                        <>
                          {format(dateRangeFilter.from, "LLL dd, y", { locale: es })} -{" "}
                          {format(dateRangeFilter.to, "LLL dd, y", { locale: es })}
                        </>
                      ) : (
                        format(dateRangeFilter.from, "LLL dd, y", { locale: es })
                      )
                    ) : (
                      <span>Elige un rango de fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRangeFilter?.from}
                    selected={dateRangeFilter}
                    onSelect={setDateRangeFilter}
                    numberOfMonths={2}
                    locale={es}
                    disabled={isSubmitting || isLoading}
                  />
                </PopoverContent>
              </Popover>
              <Button onClick={handleFilterApply} className="w-full sm:w-auto" disabled={isSubmitting || isLoading}>
                <Filter className="mr-2 h-4 w-4" /> Aplicar Filtros
              </Button>
              <Button onClick={handleClearFilters} variant="outline" className="w-full sm:w-auto" disabled={isSubmitting || isLoading}>Limpiar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Prod.</TableHead>
                <TableHead>Nro. Lote</TableHead>
                <TableHead>Producto/Receta</TableHead>
                <TableHead>Tamaño Tanda</TableHead>
                <TableHead className="text-right">Cant. Esperada</TableHead>
                <TableHead className="text-right">Cant. Real</TableHead>
                <TableHead className="text-right">
                  Merma (% y Costo Total USD)
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild><Button variant="ghost" size="icon" className="ml-1 h-4 w-4 p-0 align-middle -translate-y-0.5"><Info className="h-3 w-3 text-muted-foreground" /></Button></TooltipTrigger>
                      <TooltipContent className="max-w-xs"><p>Costo merma = Unidades perdidas * (Costo ingredientes + Costo operativo). NO incluye empaque.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Costo Total Tanda (USD)</TableHead>
                <TableHead className="text-right">Ingreso Venta Potencial (USD)</TableHead>
                <TableHead>Personal</TableHead>
                <TableHead>Empaque Usado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProductionLog.map((log) => {
                const ingresoPotencialUSD = log.actualQuantity * log.unitPrice;
                const unidadesMermadas = log.expectedQuantity - log.actualQuantity;
                let costoMermaUSD = 0;
                let costoTotalTandaUSD = 0;
                const activeBranch = getActiveBranchId();
                const recipesForBranch = activeBranch ? loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, activeBranch) : [];
                const recipeDetails = recipesForBranch.find(r => r.name === log.product);

                if (recipeDetails && !recipeDetails.isIntermediate) {
                  const costoIngredientesPorTanda = calculateDynamicRecipeCost(recipeDetails.id, 'highest', recipesForBranch);
                  const costoIngredientesPorUnidad = (recipeDetails.expectedYield && recipeDetails.expectedYield > 0) ? costoIngredientesPorTanda / recipeDetails.expectedYield : 0;

                  let costoOperativoPorUnidad = 0;
                  if (recipeDetails.expectedYield && recipeDetails.expectedYield > 0 && costPerSackThisWeek !== null && costPerSackThisWeek >= 0) {
                    costoOperativoPorUnidad = costPerSackThisWeek / recipeDetails.expectedYield;
                  }
                  const costoTotalPorUnidadSinEmpaque = costoIngredientesPorUnidad + costoOperativoPorUnidad;

                  if (unidadesMermadas > 0) {
                    costoMermaUSD = unidadesMermadas * costoTotalPorUnidadSinEmpaque;
                  }
                  const costoEmpaqueTanda = calculatePackagingCost(log.actualQuantity).maxCost; // Costo máximo para ser conservador
                  costoTotalTandaUSD = (log.actualQuantity * costoTotalPorUnidadSinEmpaque) + costoEmpaqueTanda;

                }
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.date && isValid(parseISO(log.date)) ? format(parseISO(log.date), "dd/MM/yy", { locale: es }) : '-'}
                      {log.timestamp && isValid(parseISO(log.timestamp)) && (
                        <span className="block text-xs text-muted-foreground">
                          (Reg: {format(parseISO(log.timestamp), "dd/MM HH:mm", { locale: es })})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{log.batchNumber || '-'}</TableCell>
                    <TableCell className="font-medium">{log.product}</TableCell>
                    <TableCell>{formatBatchSize(log.batchSizeMultiplier)}</TableCell>
                    <TableCell className="text-right">{log.expectedQuantity}</TableCell>
                    <TableCell className="text-right">{log.actualQuantity}</TableCell>
                    <TableCell className="text-right">
                      {calculateWastagePercentage(log.expectedQuantity, log.actualQuantity)}
                      {unidadesMermadas > 0 && ` (`}<FormattedNumber value={unidadesMermadas > 0 ? costoMermaUSD : undefined} prefix="$" />{unidadesMermadas > 0 && `)`}
                    </TableCell>
                    <TableCell className="text-right"><FormattedNumber value={costoTotalTandaUSD > 0 ? costoTotalTandaUSD : undefined} prefix="$" /></TableCell>
                    <TableCell className="text-right"><FormattedNumber value={ingresoPotencialUSD} prefix="$" /></TableCell>
                    <TableCell>{log.staff}</TableCell>
                    <TableCell>
                      {log.bagUsed && <div className="text-xs">B: {log.bagUsed}</div>}
                      {log.labelUsed && <div className="text-xs">E: {log.labelUsed}</div>}
                      {!log.bagUsed && !log.labelUsed && "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={isSubmitting}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditDialog(log)} disabled={isSubmitting}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenDeleteDialog(log.id)}
                            className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                            disabled={isSubmitting}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredProductionLog.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-8">
              {dateRangeFilter?.from || filterProductName ? "No hay registros de producción para los filtros seleccionados." : "No hay registros de producción."}
            </p>
          )}
        </CardContent>
      </Card >

      <Dialog open={isEditLogDialogOpen}
        onOpenChange={(isOpen) => {
          if (isSubmitting) return;
          setIsEditLogDialogOpen(isOpen);
          if (!isOpen) { setEditingLogEntry(null); setOriginalLogEntryForEdit(null); }
        }
        }>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Registro de Producción</DialogTitle>
            <DialogDescription>
              Actualiza los detalles del registro. Los cambios afectarán el inventario de producto terminado y materia prima.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="edit_product_name_select">Nombre del Producto/Receta</Label>
              <Select value={editProduct} onValueChange={setEditProduct} disabled={isSubmitting}>
                <SelectTrigger id="edit_product_name_select">
                  <SelectValue placeholder="Selecciona producto/receta" />
                </SelectTrigger>
                <SelectContent>
                  {productOptionsFromRecipes.map(option => (
                    <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>
                  ))}
                  {!productOptionsFromRecipes.find(p => p.name === editProduct) && editingLogEntry && (
                    <SelectItem value={editingLogEntry.product} disabled>
                      {editingLogEntry.product} (Original)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_batch_size">Tandas (Sacos)</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="icon" className="h-10 w-10 shrink-0"
                  onClick={() => setEditBatchSizeMultiplier(prev => Math.max(0.25, prev - 0.25))}
                  type="button"
                >
                  -
                </Button>
                <div className="relative flex-1">
                  <Input
                    id="edit_batch_size"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editBatchSizeMultiplier}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) setEditBatchSizeMultiplier(val);
                    }}
                    className="text-center font-bold"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    Sacos
                  </span>
                </div>
                <Button
                  variant="outline" size="icon" className="h-10 w-10 shrink-0"
                  onClick={() => setEditBatchSizeMultiplier(prev => prev + 0.25)}
                  type="button"
                >
                  +
                </Button>
              </div>
              <div className="flex gap-1 justify-center">
                {[0.25, 0.5, 1, 2].map(val => (
                  <Button
                    key={val}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => setEditBatchSizeMultiplier(val)}
                    type="button"
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_expected_quantity_input">Cantidad Esperada (unidades)</Label>
              <Input id="edit_expected_quantity_input" type="number" value={editExpectedQuantity} readOnly className="bg-muted/50" disabled={isSubmitting} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_actual_quantity_input">Cantidad Real Producida (unidades)</Label>
              <Input id="edit_actual_quantity_input" type="number" value={editActualQuantity} onChange={(e) => setEditActualQuantity(e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_unit_price_input">Precio Unitario Producto (USD)</Label>
              <Input
                id="edit_unit_price_input"
                type="number"
                value={editUnitPrice}
                onChange={(e) => setEditUnitPrice(e.target.value)}
                disabled={isSubmitting}
                placeholder="(Opcional para intermedios)"
                readOnly
                className="bg-muted/50"
              />
              {editUnitPrice && exchangeRate > 0 &&
                <p className="text-xs text-muted-foreground pt-1">
                  <FormattedNumber value={parseFloat(editUnitPrice) * exchangeRate} prefix="Bs. " />
                </p>
              }
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_staff_input">Personal Encargado</Label>
              <Input id="edit_staff_input" type="text" value={editStaff} onChange={(e) => setEditStaff(e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_batch_number_input">Número de Lote (Opcional)</Label>
              <Input id="edit_batch_number_input" type="text" value={editBatchNumber} onChange={(e) => setEditBatchNumber(e.target.value)} disabled={isSubmitting} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_date_picker">Fecha de Producción</Label>
              <Popover open={isEditDatePickerOpen} onOpenChange={setIsEditDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="edit_date_picker"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDate && "text-muted-foreground"
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editDate}
                    onSelect={(date) => { setEditDate(date); setIsEditDatePickerOpen(false); }}
                    initialFocus
                    locale={es}
                    disabled={isSubmitting}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_bag_select">Tipo de Bolsa (Opcional)</Label>
              <Select value={editSelectedBagName || '__NONE__'} onValueChange={(val) => setEditSelectedBagName(val === '__NONE__' ? '' : val)} disabled={isSubmitting}>
                <SelectTrigger id="edit_bag_select"><SelectValue placeholder="Selecciona bolsa" /></SelectTrigger>
                <SelectContent><SelectItem value="__NONE__">Ninguna</SelectItem>{availableBags.map(bag => <SelectItem key={bag} value={bag}>{bag}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_label_select">Tipo de Etiqueta (Opcional)</Label>
              <Select value={editSelectedLabelName || '__NONE__'} onValueChange={(val) => setEditSelectedLabelName(val === '__NONE__' ? '' : val)} disabled={isSubmitting}>
                <SelectTrigger id="edit_label_select"><SelectValue placeholder="Selecciona etiqueta" /></SelectTrigger>
                <SelectContent><SelectItem value="__NONE__">Ninguna</SelectItem>{availableLabels.map(label => <SelectItem key={label} value={label}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" onClick={() => { if (!isSubmitting) { setIsEditLogDialogOpen(false); setEditingLogEntry(null); setOriginalLogEntryForEdit(null); } }} disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button type="button" onClick={handleUpdateLogEntry} disabled={isSubmitting || productOptionsFromRecipes.length === 0}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este registro? Esta acción ajustará el stock de producto terminado y materia prima, así como las metas de producción.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild><Button variant="outline" onClick={() => { if (!isSubmitting) { setIsDeleteConfirmDialogOpen(false); setLogToDeleteId(null) } }} disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Eliminando...' : 'Eliminar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeficitAlert} onOpenChange={(open) => { if (!open) { setShowDeficitAlert(false); setIsSubmitting(false); setDeficitType(null); setBestTransferSourceInfo(null); } }}>
        <AlertDialogContent className="sm:max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deficitType === 'intermediate_missing_components_available' && "Error: Preparación Intermedia Faltante"}
              {deficitType === 'intermediate_missing_components_missing' && "Error: Faltan Componentes para Preparación Intermedia"}
              {deficitType === 'intermediate_stock_shortage' && "Error: Stock Insuficiente de Preparación Intermedia"}
              {deficitType === 'raw_material_shortage' && "Error: Materia Prima Insuficiente/Faltante"}
              {!deficitType && "Error de Materiales"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              No se puede registrar/actualizar la producción. Verifica lo siguiente:
            </AlertDialogDescription>
            <ul className="list-disc list-inside text-xs mt-2 max-h-40 overflow-y-auto">
              {deficitMaterials.map((def, i) => (
                <li key={i}>
                  '{def.name}': Necesita <FormattedNumber value={def.needed} decimalPlaces={3} /> {def.unit}.
                  {def.available !== undefined ? (
                    <> Disponible: <FormattedNumber value={def.available} decimalPlaces={3} /> {def.inventoryUnit}.</>
                  ) : (
                    ` No encontrado o unidad incompatible en inventario.`
                  )}
                </li>
              ))}
            </ul>
            {bestTransferSourceInfo && bestTransferSourceInfo.transferableItems.length > 0 && (
              <div className="my-2 p-3 border rounded-md bg-green-500/10 border-green-500/20">
                <AlertTitle className="text-green-700 dark:text-green-300">¡Transferencia Parcial Posible!</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-400">
                  La sede "{bestTransferSourceInfo.branch.name}" tiene algunos de los materiales que necesitas.
                  <ul className="list-disc list-inside mt-2 text-xs">
                    {bestTransferSourceInfo.transferableItems.map((item, i) => (
                      <li key={i}>{item.name}: Se pueden transferir hasta <FormattedNumber value={item.available} decimalPlaces={3} /> {item.unit} (necesitas <FormattedNumber value={item.needed} decimalPlaces={3} /> {item.unit}).</li>
                    ))}
                  </ul>
                </AlertDescription>
              </div>
            )}
            {(deficitType === 'raw_material_shortage' || deficitType === 'intermediate_missing_components_missing') && (
              <p className="text-sm text-muted-foreground mt-3">
                {deficitType === 'intermediate_missing_components_missing'
                  ? `Además de la preparación intermedia faltante, no tienes suficientes componentes para producirla. `
                  : ''
                }
                Puedes crear una Orden de Compra o una Transferencia Parcial si es posible.
              </p>
            )}
            {(deficitType === 'intermediate_stock_shortage' || deficitType === 'intermediate_missing_components_available') && (
              <p className="text-sm text-muted-foreground mt-3">
                La preparación intermedia requerida falta en stock. Por favor, regístrala primero en este módulo.
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeficitAlert(false);
              setDeficitMaterials([]);
              setCurrentProductionDeficitData(null);
              setDeficitType(null);
              setBestTransferSourceInfo(null);
              setIsSubmitting(false);
            }}>
              Cancelar
            </AlertDialogCancel>
            {bestTransferSourceInfo && bestTransferSourceInfo.transferableItems.length > 0 && (
              <AlertDialogAction onClick={() => handleCreateTransferFromDeficit(bestTransferSourceInfo.branch.id, bestTransferSourceInfo.transferableItems)}>
                Crear Transferencia desde {bestTransferSourceInfo.branch.name}
              </AlertDialogAction>
            )}
            {(deficitType === 'raw_material_shortage' || deficitType === 'intermediate_missing_components_missing') && (
              <AlertDialogAction onClick={handleCreatePOFromDeficit}>
                Crear OC Pendiente {bestTransferSourceInfo ? 'para el Resto' : ''}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div >
  );
}
