
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, PlusCircle, Edit, Trash2, MoreHorizontal, Calendar as CalendarIcon, Loader2, Filter, PackageSearch, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  weeklyGoalsData as initialWeeklyGoalsData, 
  monthlyGoalsData as initialMonthlyGoalsData, 
  saveWeeklyGoalsData, 
  saveMonthlyGoalsData, 
  type ProductionGoal,
  recipesData as allRecipesFromStorage,
  calculateGoalStatus,
  calculateTotalIngredientsAndCostForGoal,
  type GoalIngredientsAndCost,
  loadExchangeRate,
} from '@/lib/data-storage';
import { FormattedNumber } from '@/components/ui/formatted-number';


export default function GoalsPage() {
  const { toast } = useToast();
  const [allWeeklyGoals, setAllWeeklyGoals] = useState<ProductionGoal[]>([]);
  const [allMonthlyGoals, setAllMonthlyGoals] = useState<ProductionGoal[]>([]);
  const [filteredWeeklyGoals, setFilteredWeeklyGoals] = useState<ProductionGoal[]>([]);
  const [filteredMonthlyGoals, setFilteredMonthlyGoals] = useState<ProductionGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const productOptionsFromRecipes = useMemo(() => {
    return allRecipesFromStorage
      .filter(recipe => !recipe.isIntermediate) 
      .map(recipe => ({ id: recipe.id, name: recipe.name }));
  }, []); 

  const [isSetGoalDialogOpen, setIsSetGoalDialogOpen] = useState(false);
  const [newGoalProduct, setNewGoalProduct] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalPeriod, setNewGoalPeriod] = useState<'weekly' | 'monthly' | ''>('');
  const [newGoalStartDate, setNewGoalStartDate] = useState<Date | undefined>(undefined);
  const [newGoalAchieved, setNewGoalAchieved] = useState('0'); 


  const [isEditGoalDialogOpen, setIsEditGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ProductionGoal | null>(null);
  const [editGoalProduct, setEditGoalProduct] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [editGoalPeriod, setEditGoalPeriod] = useState<'weekly' | 'monthly' | ''>('');
  const [editGoalStartDate, setEditGoalStartDate] = useState<Date | undefined>(undefined);
  const [editGoalAchieved, setEditGoalAchieved] = useState('');


  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; period: 'weekly' | 'monthly' } | null>(null);

  const [dateRangeFilterWeekly, setDateRangeFilterWeekly] = useState<DateRange | undefined>(undefined);
  const [dateRangeFilterMonthly, setDateRangeFilterMonthly] = useState<DateRange | undefined>(undefined);
  
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedGoalForDetails, setSelectedGoalForDetails] = useState<ProductionGoal | null>(null);
  const [goalDetailsData, setGoalDetailsData] = useState<GoalIngredientsAndCost | null>(null);
  const [isCalculatingDetails, setIsCalculatingDetails] = useState(false);
  const [isGoalDatePickerOpen, setIsGoalDatePickerOpen] = useState(false);


  const loadGoals = useCallback(() => {
    setIsLoading(true);
    const weekly = [...initialWeeklyGoalsData].sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
    const monthly = [...initialMonthlyGoalsData].sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
    setAllWeeklyGoals(weekly);
    setFilteredWeeklyGoals(weekly);
    setAllMonthlyGoals(monthly);
    setFilteredMonthlyGoals(monthly);
    setExchangeRate(loadExchangeRate());
    
    if (productOptionsFromRecipes.length > 0) {
      setNewGoalProduct(productOptionsFromRecipes[0].name);
    } else {
      setNewGoalProduct('');
    }

    setIsLoading(false);
  }, [productOptionsFromRecipes]);

  useEffect(() => {
    loadGoals();
    setNewGoalStartDate(new Date());
  }, [loadGoals]);
  
  useEffect(() => {
    if (productOptionsFromRecipes.length > 0) {
      const currentProductStillValid = productOptionsFromRecipes.some(p => p.name === newGoalProduct);
      if (!currentProductStillValid || !newGoalProduct) { 
        setNewGoalProduct(productOptionsFromRecipes[0].name);
      }
    } else {
      setNewGoalProduct('');
    }
  }, [productOptionsFromRecipes, newGoalProduct]);


  const resetAddForm = () => {
    setNewGoalProduct(productOptionsFromRecipes.length > 0 ? productOptionsFromRecipes[0].name : '');
    setNewGoalTarget('');
    setNewGoalPeriod('');
    setNewGoalStartDate(new Date());
    setNewGoalAchieved('0');
  };

  const applyFilters = useCallback((period: 'weekly' | 'monthly') => {
    if (period === 'weekly') {
      let filtered = [...allWeeklyGoals];
      if (dateRangeFilterWeekly?.from) {
        const toDate = dateRangeFilterWeekly.to ? endOfDay(dateRangeFilterWeekly.to) : endOfDay(dateRangeFilterWeekly.from);
        filtered = filtered.filter(goal => goal.startDate && isWithinInterval(parseISO(goal.startDate), { start: startOfDay(dateRangeFilterWeekly.from!), end: toDate }));
      }
      setFilteredWeeklyGoals(filtered);
    } else {
      let filtered = [...allMonthlyGoals];
      if (dateRangeFilterMonthly?.from) {
        const toDate = dateRangeFilterMonthly.to ? endOfDay(dateRangeFilterMonthly.to) : endOfDay(dateRangeFilterMonthly.from);
        filtered = filtered.filter(goal => goal.startDate && isWithinInterval(parseISO(goal.startDate), { start: startOfDay(dateRangeFilterMonthly.from!), end: toDate }));
      }
      setFilteredMonthlyGoals(filtered);
    }
  }, [allWeeklyGoals, dateRangeFilterWeekly, allMonthlyGoals, dateRangeFilterMonthly]);
  
  const handleApplyFilters = (period: 'weekly' | 'monthly') => {
    applyFilters(period);
  };
  
  const handleClearFilters = (period: 'weekly' | 'monthly') => {
    if (period === 'weekly') {
      setDateRangeFilterWeekly(undefined);
    } else {
      setDateRangeFilterMonthly(undefined);
    }
  };

  useEffect(() => {
    applyFilters('weekly');
  }, [dateRangeFilterWeekly, allWeeklyGoals, applyFilters]);

  useEffect(() => {
    applyFilters('monthly');
  }, [dateRangeFilterMonthly, allMonthlyGoals, applyFilters]);


  const handleAddGoal = () => {
    if (!newGoalProduct || !newGoalTarget || !newGoalPeriod || !newGoalStartDate) {
      toast({ title: "Error", description: "Producto, objetivo, periodo y fecha de inicio son obligatorios.", variant: "destructive" });
      return;
    }
    const targetNum = parseInt(newGoalTarget, 10);
    const achievedNum = parseInt(newGoalAchieved, 10);

    if (isNaN(targetNum) || targetNum <= 0) {
       toast({ title: "Error", description: "La cantidad objetivo debe ser un número positivo.", variant: "destructive" });
       return;
    }
    if (isNaN(achievedNum) || achievedNum < 0) {
        toast({ title: "Error", description: "Las unidades logradas deben ser un número no negativo.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const newGoal: ProductionGoal = {
      id: `${newGoalPeriod.toUpperCase()}${Date.now().toString().slice(-3)}${Math.floor(Math.random()*100)}`,
      product: newGoalProduct,
      target: targetNum,
      achieved: achievedNum,
      status: calculateGoalStatus(targetNum, achievedNum),
      period: newGoalPeriod as 'weekly' | 'monthly',
      startDate: format(newGoalStartDate, "yyyy-MM-dd"),
    };

    if (newGoal.period === 'weekly') {
      const updatedGoals = [newGoal, ...allWeeklyGoals].sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveWeeklyGoalsData(updatedGoals);
      setAllWeeklyGoals(updatedGoals);
    } else {
      const updatedGoals = [newGoal, ...allMonthlyGoals].sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveMonthlyGoalsData(updatedGoals);
      setAllMonthlyGoals(updatedGoals);
    }
    toast({ title: "Éxito", description: "Meta de producción añadida correctamente." });
    setIsSetGoalDialogOpen(false);
    resetAddForm();
    setIsSubmitting(false);
  };

  const handleOpenEditDialog = (goal: ProductionGoal) => {
    setEditingGoal(goal);
    setEditGoalProduct(goal.product);
    setEditGoalTarget(goal.target.toString());
    setEditGoalAchieved(goal.achieved.toString());
    setEditGoalPeriod(goal.period);
    setEditGoalStartDate(goal.startDate ? parseISO(goal.startDate) : undefined);
    setIsEditGoalDialogOpen(true);
  };

  const handleUpdateGoal = () => {
    if (!editingGoal || !editGoalProduct || !editGoalTarget || !editGoalPeriod || !editGoalStartDate) {
      toast({ title: "Error", description: "Todos los campos son obligatorios.", variant: "destructive" });
      return;
    }
    const targetNum = parseInt(editGoalTarget, 10);
    const achievedNum = parseInt(editGoalAchieved, 10);

    if (isNaN(targetNum) || targetNum <= 0) {
       toast({ title: "Error", description: "La cantidad objetivo debe ser un número positivo.", variant: "destructive" });
       return;
    }
     if (isNaN(achievedNum) || achievedNum < 0) {
        toast({ title: "Error", description: "Las unidades logradas deben ser un número no negativo.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const updatedGoalData: ProductionGoal = {
      ...editingGoal,
      product: editGoalProduct,
      target: targetNum,
      achieved: achievedNum,
      status: calculateGoalStatus(targetNum, achievedNum),
      period: editGoalPeriod as 'weekly' | 'monthly',
      startDate: format(editGoalStartDate, "yyyy-MM-dd"),
    };

    if (updatedGoalData.period === 'weekly') {
      const updatedGoals = allWeeklyGoals.map(g => g.id === updatedGoalData.id ? updatedGoalData : g).sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveWeeklyGoalsData(updatedGoals);
      setAllWeeklyGoals(updatedGoals);
    } else {
      const updatedGoals = allMonthlyGoals.map(g => g.id === updatedGoalData.id ? updatedGoalData : g).sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveMonthlyGoalsData(updatedGoals);
      setAllMonthlyGoals(updatedGoals);
    }
    toast({ title: "Éxito", description: "Meta actualizada correctamente." });
    setIsEditGoalDialogOpen(false);
    setEditingGoal(null);
    setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (goalId: string, period: 'weekly' | 'monthly') => {
    setGoalToDelete({ id: goalId, period });
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!goalToDelete) return;
    setIsSubmitting(true);
      
    if (goalToDelete.period === 'weekly') {
      const updatedGoals = allWeeklyGoals.filter(g => g.id !== goalToDelete.id).sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveWeeklyGoalsData(updatedGoals);
      setAllWeeklyGoals(updatedGoals);
    } else {
      const updatedGoals = allMonthlyGoals.filter(g => g.id !== goalToDelete.id).sort((a,b) => (b.startDate && a.startDate) ? parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime() : 0);
      saveMonthlyGoalsData(updatedGoals);
      setAllMonthlyGoals(updatedGoals);
    }
    toast({ title: "Éxito", description: "Meta eliminada correctamente." });
    setIsDeleteConfirmDialogOpen(false);
    setGoalToDelete(null);
    setIsSubmitting(false);
  };

  const handleOpenDetailsDialog = async (goal: ProductionGoal) => {
    setSelectedGoalForDetails(goal);
    setIsCalculatingDetails(true);
    setGoalDetailsData(null);
    setIsDetailsDialogOpen(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const details = calculateTotalIngredientsAndCostForGoal(
        goal,
        allRecipesFromStorage
      );
      setGoalDetailsData(details);
    } catch (error) {
      console.error("Error calculating goal details:", error);
      toast({ title: "Error", description: "No se pudieron calcular los detalles de la meta.", variant: "destructive" });
      setIsDetailsDialogOpen(false);
    } finally {
      setIsCalculatingDetails(false);
    }
  };

  const renderGoalsTable = (goals: ProductionGoal[], periodType: 'weekly' | 'monthly') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Objetivo</TableHead>
          <TableHead className="text-right">Logrado</TableHead>
          <TableHead className="w-[150px] sm:w-[200px]">Progreso</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha de Inicio</TableHead>
          <TableHead className="text-center">Detalles</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {goals.map((goal) => (
          <TableRow key={goal.id}>
            <TableCell className="font-medium">{goal.product}</TableCell>
            <TableCell className="text-right">{goal.target}</TableCell>
            <TableCell className="text-right">{goal.achieved}</TableCell>
            <TableCell>
              <Progress value={(goal.target > 0 ? (goal.achieved / goal.target) * 100 : 0)} className="w-full h-3" />
            </TableCell>
            <TableCell>{goal.status}</TableCell>
            <TableCell>{goal.startDate ? format(parseISO(goal.startDate), "dd/MM/yyyy", { locale: es }) : '-'}</TableCell>
            <TableCell className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenDetailsDialog(goal)}
                disabled={isSubmitting || isCalculatingDetails}
                title="Ver ingredientes y costos"
                className="px-2 py-1 h-auto"
              >
                <PackageSearch className="mr-0 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Detalles</span>
              </Button>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isSubmitting}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenEditDialog(goal)} disabled={isSubmitting}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleOpenDeleteDialog(goal.id, periodType)}
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
        ))}
      </TableBody>
    </Table>
  );

  const renderFilterSection = (period: 'weekly' | 'monthly') => {
    const dateRange = period === 'weekly' ? dateRangeFilterWeekly : dateRangeFilterMonthly;
    const setDateRange = period === 'weekly' ? setDateRangeFilterWeekly : setDateRangeFilterMonthly;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto mb-4">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id={`date-filter-goals-${period}`}
                    variant={"outline"}
                    className={cn(
                    "w-full sm:w-[260px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                    )}
                    disabled={isSubmitting}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                    dateRange.to ? (
                        <>
                        {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                        {format(dateRange.to, "LLL dd, y", { locale: es })}
                        </>
                    ) : (
                        format(dateRange.from, "LLL dd, y", { locale: es })
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
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={es}
                />
                </PopoverContent>
            </Popover>
            <Button onClick={() => handleApplyFilters(period)} className="w-full sm:w-auto" disabled={isSubmitting}>
                <Filter className="mr-2 h-4 w-4" /> Aplicar Filtro
            </Button>
            <Button onClick={() => handleClearFilters(period)} variant="outline" className="w-full sm:w-auto" disabled={isSubmitting}>Limpiar</Button>
        </div>
    );
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg">Cargando metas de producción...</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas de Producción"
        description="Establece, rastrea y gestiona los objetivos de producción de tu panadería. Las metas se actualizan automáticamente con los registros del módulo de Producción."
        icon={Target}
        actions={
          <Button onClick={() => { resetAddForm(); setIsSetGoalDialogOpen(true); }} disabled={isSubmitting || productOptionsFromRecipes.length === 0}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Establecer Nueva Meta
          </Button>
        }
      />

      <Tabs defaultValue="weekly">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
          <TabsTrigger value="weekly">Metas Semanales</TabsTrigger>
          <TabsTrigger value="monthly">Metas Mensuales</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Objetivos de Producción Semanales</CardTitle>
                  <CardDescription>Monitorea tu progreso hacia las metas semanales.</CardDescription>
                </div>
              </div>
              {renderFilterSection('weekly')}
            </CardHeader>
            <CardContent>
              {renderGoalsTable(filteredWeeklyGoals, 'weekly')}
              {filteredWeeklyGoals.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-8">{dateRangeFilterWeekly?.from ? "No hay metas semanales para el rango seleccionado." : "No hay metas semanales establecidas."}</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="monthly">
          <Card className="shadow-lg">
            <CardHeader>
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Objetivos de Producción Mensuales</CardTitle>
                    <CardDescription>Rastrea los logros de tus objetivos mensuales.</CardDescription>
                  </div>
                </div>
                {renderFilterSection('monthly')}
            </CardHeader>
            <CardContent>
              {renderGoalsTable(filteredMonthlyGoals, 'monthly')}
              {filteredMonthlyGoals.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-8">{dateRangeFilterMonthly?.from ? "No hay metas mensuales para el rango seleccionado." : "No hay metas mensuales establecidas."}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isSetGoalDialogOpen || isEditGoalDialogOpen} onOpenChange={isEditGoalDialogOpen ? (isOpen) => {if(!isSubmitting) setIsEditGoalDialogOpen(isOpen)} : (isOpen) => {if(!isSubmitting) setIsSetGoalDialogOpen(isOpen)}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditGoalDialogOpen ? "Editar Meta de Producción" : "Establecer Nueva Meta de Producción"}</DialogTitle>
            <DialogDescription>
              {isEditGoalDialogOpen ? "Actualiza los detalles de la meta." : "Define un nuevo objetivo de producción para un producto."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="product">Producto</Label>
               <Select 
                 value={isEditGoalDialogOpen ? editGoalProduct : newGoalProduct} 
                 onValueChange={(value) => {
                    if (isEditGoalDialogOpen) {
                        setEditGoalProduct(value);
                    } else {
                        setNewGoalProduct(value);
                    }
                 }}
                 disabled={isSubmitting || productOptionsFromRecipes.length === 0}
               >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Selecciona producto" />
                </SelectTrigger>
                <SelectContent>
                  {productOptionsFromRecipes.length > 0 ? (
                    productOptionsFromRecipes.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)
                  ) : (
                    <SelectItem value="no-options" disabled>No hay recetas (productos finales) definidas</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {productOptionsFromRecipes.length === 0 && (
                 <p className="text-xs text-destructive">Define recetas (que no sean intermedias) en el módulo de Recetas para poder establecer metas.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="target_quantity">Cantidad Objetivo</Label>
              <Input id="target_quantity" type="number" placeholder="ej., 500" 
                value={isEditGoalDialogOpen ? editGoalTarget : newGoalTarget}
                onChange={(e) => isEditGoalDialogOpen ? setEditGoalTarget(e.target.value) : setNewGoalTarget(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
             <div className="space-y-1">
              <Label htmlFor="achieved_quantity">Unidades Logradas</Label>
              <Input id="achieved_quantity" type="number" placeholder="ej., 50" 
                value={isEditGoalDialogOpen ? editGoalAchieved : newGoalAchieved}
                onChange={(e) => isEditGoalDialogOpen ? setEditGoalAchieved(e.target.value) : setNewGoalAchieved(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="period">Periodo</Label>
              <Select
                value={isEditGoalDialogOpen ? editGoalPeriod : newGoalPeriod}
                onValueChange={(value) => isEditGoalDialogOpen ? setEditGoalPeriod(value as 'weekly' | 'monthly') : setNewGoalPeriod(value as 'weekly' | 'monthly')}
                disabled={isSubmitting}
              >
                <SelectTrigger id="period">
                  <SelectValue placeholder="Selecciona periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-1">
              <Label htmlFor="start_date">Fecha de Inicio</Label>
              <Popover open={isGoalDatePickerOpen} onOpenChange={setIsGoalDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="start_date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !(isEditGoalDialogOpen ? editGoalStartDate : newGoalStartDate) && "text-muted-foreground"
                    )}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {(isEditGoalDialogOpen ? editGoalStartDate : newGoalStartDate) ? format((isEditGoalDialogOpen ? editGoalStartDate : newGoalStartDate)!, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={isEditGoalDialogOpen ? editGoalStartDate : newGoalStartDate}
                    onSelect={(date) => {
                      if (isEditGoalDialogOpen) {
                        setEditGoalStartDate(date);
                      } else {
                        setNewGoalStartDate(date);
                      }
                      setIsGoalDatePickerOpen(false);
                    }}
                    initialFocus
                    locale={es}
                    disabled={isSubmitting}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {
                if(!isSubmitting){
                  if (isEditGoalDialogOpen) {
                    setIsEditGoalDialogOpen(false);
                    setEditingGoal(null);
                  } else {
                    setIsSetGoalDialogOpen(false);
                    resetAddForm();
                  }
                }
              }} disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={isEditGoalDialogOpen ? handleUpdateGoal : handleAddGoal} disabled={isSubmitting || productOptionsFromRecipes.length === 0}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditGoalDialogOpen ? <Edit className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
              {isSubmitting ? "Guardando..." : (isEditGoalDialogOpen ? "Guardar Cambios" : "Guardar Meta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => {if(!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen)}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar esta meta de producción? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {if(!isSubmitting){setIsDeleteConfirmDialogOpen(false); setGoalToDelete(null)}}} disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Eliminando..." : "Eliminar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsDialogOpen} onOpenChange={(isOpen) => { if (!isCalculatingDetails) setIsDetailsDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalles para Meta: {selectedGoalForDetails?.product}</DialogTitle>
            <DialogDescription>
              Ingredientes y costos estimados para alcanzar {selectedGoalForDetails?.target} unidades.
            </DialogDescription>
          </DialogHeader>
          {isCalculatingDetails ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3">Calculando detalles...</p>
            </div>
          ) : goalDetailsData ? (
            <ScrollArea className="max-h-[60vh] p-1 pr-3">
              <div className="space-y-4 py-4">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground">Ingredientes Requeridos Totales:</h4>
                  {goalDetailsData.ingredientsList.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {goalDetailsData.ingredientsList.map(ing => (
                        <li key={ing.name}>{ing.name}: <FormattedNumber value={ing.quantity} decimalPlaces={3} /> {ing.unit}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No se pudieron determinar los ingredientes. Verifica la receta y asegúrate que no sea una preparación intermedia sin desglose, o que tenga ingredientes definidos.</p>
                  )}
                </div>
                {goalDetailsData.missingPriceInfoForMaterials.length > 0 && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-md">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        <strong>Atención:</strong> No se encontró información de precios para los siguientes materiales: {goalDetailsData.missingPriceInfoForMaterials.join(", ")}. El costo estimado podría ser impreciso.
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold mb-1 text-foreground">Costo Total Estimado (USD):</h4>
                  <p className="text-base text-primary">
                    <FormattedNumber value={goalDetailsData.totalCostMinUSD} prefix="$" /> - <FormattedNumber value={goalDetailsData.totalCostMaxUSD} prefix="$" />
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-foreground">Costo Total Estimado (VES):</h4>
                  <p className="text-base text-muted-foreground">
                    <FormattedNumber value={exchangeRate > 0 ? goalDetailsData.totalCostMinUSD * exchangeRate : undefined} prefix="Bs. " /> - <FormattedNumber value={exchangeRate > 0 ? goalDetailsData.totalCostMaxUSD * exchangeRate : undefined} prefix="Bs. " />
                  </p>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <p className="text-center text-muted-foreground py-10">No se pudieron cargar los detalles de la meta.</p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isCalculatingDetails}>Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

