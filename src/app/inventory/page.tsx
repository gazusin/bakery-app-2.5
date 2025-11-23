
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageTransition } from '@/components/page-transition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VirtualizedList } from '@/components/ui/virtualized-list';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, Loader2, Trash2, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { StockAlertsAI } from '@/components/ai/stock-alerts-ai';
import {
  loadAllProductsFromAllBranches,
  saveProductsDataForBranch,
  loadExchangeRate,
  KEYS,
  loadProductsForBranch,
  availableBranches,
  loadFromLocalStorageForBranch
} from '@/lib/data-storage';
import type { Product, Recipe } from '@/lib/types/db-types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { FormattedNumber } from '@/components/ui/formatted-number';

export default function StockProduccionPage() {
  const { toast } = useToast();
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);

  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [productToAdjust, setProductToAdjust] = useState<string>('');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');

  const loadPageData = useCallback(() => {
    setIsLoading(true);
    const currentProducts = loadAllProductsFromAllBranches().sort((a, b) => a.name.localeCompare(b.name));
    setProductsData(currentProducts);
    setFilteredProducts(currentProducts);

    // Cargar todas las recetas de todas las sedes
    const allRecipesData: Recipe[] = [];
    availableBranches.forEach(branch => {
      allRecipesData.push(...loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branch.id));
    });
    setAllRecipes(allRecipesData);

    const rate = loadExchangeRate();
    setExchangeRate(rate);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPageData();

    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.PRODUCTS || customEvent.detail?.key === KEYS.RECIPES) {
        loadPageData();
      }
    };

    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadPageData]);

  useEffect(() => {
    if (isAdjustDialogOpen && productsData.length > 0 && !productToAdjust) {
      setProductToAdjust(productsData[0].id);
    }
  }, [isAdjustDialogOpen, productsData, productToAdjust]);


  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filtered = productsData.filter(item =>
      item.name.toLowerCase().includes(lowercasedFilter) ||
      item.category.toLowerCase().includes(lowercasedFilter) ||
      item.sourceBranchName?.toLowerCase().includes(lowercasedFilter)
    );
    setFilteredProducts(filtered);
  }, [searchTerm, productsData]);

  const handleOpenDeleteDialog = (productId: string) => {
    setProductToDeleteId(productId);
    setIsDeleteConfirmOpen(true);
  };

  const resetAdjustForm = () => {
    setAdjustmentType('add');
    setProductToAdjust(productsData.length > 0 ? productsData[0].id : '');
    setAdjustmentQuantity('');
  };


  const handleConfirmDelete = () => {
    if (!productToDeleteId) return;
    setIsSubmitting(true);

    const productToDelete = productsData.find(p => p.id === productToDeleteId);
    if (!productToDelete || !productToDelete.sourceBranchId) {
      toast({
        title: "Error",
        description: "No se pudo encontrar el producto o su sede de origen para eliminarlo.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      setIsDeleteConfirmOpen(false);
      return;
    }

    const branchId = productToDelete.sourceBranchId;
    const productsForBranch = loadProductsForBranch(branchId);
    const updatedBranchProducts = productsForBranch.filter(p => p.id !== productToDeleteId);

    saveProductsDataForBranch(branchId, updatedBranchProducts);

    toast({
      title: "Producto Eliminado",
      description: `El producto "${productToDelete.name}" ha sido eliminado del stock de la sede ${productToDelete.sourceBranchName}.`,
    });

    setIsDeleteConfirmOpen(false);
    setProductToDeleteId(null);
    setIsSubmitting(false);
  };

  const handleSaveAdjustment = () => {
    if (!productToAdjust || !adjustmentQuantity) {
      toast({ title: "Error", description: "Producto y cantidad son obligatorios.", variant: "destructive" });
      return;
    }
    const quantityNum = parseInt(adjustmentQuantity, 10);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser un número entero positivo.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const productInfo = productsData.find(p => p.id === productToAdjust);
    if (!productInfo || !productInfo.sourceBranchId) {
      toast({ title: "Error", description: "No se pudo encontrar el producto o su sede de origen.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const branchId = productInfo.sourceBranchId;
    let branchProducts = loadProductsForBranch(branchId);
    const productIndex = branchProducts.findIndex(p => p.id === productToAdjust);

    if (productIndex === -1) {
      toast({ title: "Error de consistencia", description: "El producto no se encontró en los datos de su propia sede. Por favor, recarga.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (adjustmentType === 'subtract' && branchProducts[productIndex].stock < quantityNum) {
      toast({ title: "Error de Stock", description: `No se puede restar ${quantityNum}. Stock actual: ${branchProducts[productIndex].stock}.`, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (adjustmentType === 'add') {
      branchProducts[productIndex].stock += quantityNum;
    } else {
      branchProducts[productIndex].stock -= quantityNum;
    }

    branchProducts[productIndex].lastUpdated = new Date().toISOString().split('T')[0];
    saveProductsDataForBranch(branchId, branchProducts);

    toast({ title: "Éxito", description: `Stock de "${productInfo.name}" ajustado en la sede ${productInfo.sourceBranchName}.` });

    setIsAdjustDialogOpen(false);
    resetAdjustForm();
    setIsSubmitting(false);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando stock de producción...</p>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Stock de Producción (Global)"
        description="Rastrea los niveles de stock de tus productos terminados de todas las sedes. El stock se actualiza desde el módulo de Producción y se deduce en el módulo de Ventas."
        icon={Package}
        actions={
          <Button onClick={() => { resetAdjustForm(); setIsAdjustDialogOpen(true); }} disabled={isSubmitting}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajustar Stock
          </Button>
        }
      />

      <StockAlertsAI />

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Stock de Todos los Productos (Global)</CardTitle>
              <CardDescription>Resumen de todos los productos en tu stock de producción de todas las sedes.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar productos o sedes..."
                  className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[600px]">
            <VirtualizedList
              data={filteredProducts}
              itemHeight={70}
              header={
                <div className="grid grid-cols-[80px_minmax(200px,1fr)_120px_120px_80px_120px_120px_100px_80px] gap-4 p-4 text-sm font-medium text-muted-foreground">
                  <div>Imagen</div>
                  <div>Nombre del Producto</div>
                  <div>Sede</div>
                  <div>Categoría</div>
                  <div className="text-right">Stock</div>
                  <div className="text-right">Valor (USD)</div>
                  <div className="text-right">Valor (VES)</div>
                  <div>Actualizado</div>
                  <div className="text-right">Acciones</div>
                </div>
              }
              renderRow={(product, style) => {
                const recipe = allRecipes.find(r => r.name.toLowerCase() === product.name.toLowerCase());
                const unitPriceFromRecipe = recipe ? recipe.costPerUnit : product.unitPrice;
                const totalStockValueUSD = product.stock * unitPriceFromRecipe;

                return (
                  <div style={style} className="flex items-center border-b hover:bg-muted/50 transition-colors">
                    <div className="grid grid-cols-[80px_minmax(200px,1fr)_120px_120px_80px_120px_120px_100px_80px] gap-4 p-2 w-full items-center">
                      <div>
                        <Image
                          src={product.image || "https://placehold.co/40x40.png"}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="rounded-md object-cover"
                        />
                      </div>
                      <div className="font-medium truncate" title={product.name}>{product.name}</div>
                      <div className="truncate" title={product.sourceBranchName || 'N/A'}>{product.sourceBranchName || 'N/A'}</div>
                      <div className="truncate">{product.category}</div>
                      <div className="text-right font-mono">{product.stock}</div>
                      <div className="text-right font-mono text-green-600 dark:text-green-400">
                        <FormattedNumber value={totalStockValueUSD} prefix="$" />
                      </div>
                      <div className="text-right font-mono text-blue-600 dark:text-blue-400">
                        <FormattedNumber value={exchangeRate > 0 ? totalStockValueUSD * exchangeRate : undefined} prefix="Bs. " />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {product.lastUpdated ? format(parseISO(product.lastUpdated), "dd/MM/yy", { locale: es }) : '-'}
                      </div>
                      <div className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteDialog(product.id)}
                          disabled={isSubmitting}
                          title={`Eliminar ${product.name}`}
                          className="text-destructive hover:bg-destructive/10 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAdjustDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsAdjustDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste Manual de Stock de Producción</DialogTitle>
            <DialogDescription>Añade o resta cantidad a un producto terminado en su sede de origen.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="adjustment_type_prod">Tipo de Ajuste</Label>
              <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'add' | 'subtract')} disabled={isSubmitting}>
                <SelectTrigger id="adjustment_type_prod"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Añadir al Stock</SelectItem>
                  <SelectItem value="subtract">Restar del Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="product_to_adjust">Producto</Label>
              <Select value={productToAdjust} onValueChange={setProductToAdjust} disabled={isSubmitting || productsData.length === 0}>
                <SelectTrigger id="product_to_adjust"><SelectValue placeholder="Selecciona producto..." /></SelectTrigger>
                <SelectContent>
                  {productsData.map(prod => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.name} ({prod.sourceBranchName} - Stock: {prod.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment_quantity_prod">Cantidad a {adjustmentType === 'add' ? 'Añadir' : 'Restar'}</Label>
              <Input
                id="adjustment_quantity_prod"
                type="number"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(e.target.value)}
                placeholder="ej., 10"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose>
            <Button type="button" onClick={handleSaveAdjustment} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              {isSubmitting ? "Guardando..." : "Guardar Ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsDeleteConfirmOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar el producto "{productsData.find(p => p.id === productToDeleteId)?.name || ''}" del stock de su sede? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => { if (!isSubmitting) { setIsDeleteConfirmOpen(false); setProductToDeleteId(null) } }} disabled={isSubmitting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isSubmitting ? "Eliminando..." : "Eliminar Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
