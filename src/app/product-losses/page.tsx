"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, PackageX, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
    loadFromLocalStorage,
    saveToLocalStorage,
    KEYS,
    getActiveBranchId,
    loadFromLocalStorageForBranch
} from '@/lib/data-storage';
import type { Product, Recipe, ProductLoss, LossCategory } from '@/lib/types/db-types';
import { FormattedNumber } from '@/components/ui/formatted-number';

const LOSS_CATEGORIES = [
    { value: 'devolucion_no_despachable', label: 'Devolución (No Despachable)', color: 'bg-red-100 text-red-800', icon: '🔴' },
    { value: 'consumo_interno', label: 'Consumo Interno', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    { value: 'beneficio_semanal', label: 'Beneficio Semanal', color: 'bg-green-100 text-green-800', icon: '🟢' },
    { value: 'merma_operativa', label: 'Merma Operativa', color: 'bg-orange-100 text-orange-800', icon: '🟠' }
] as const;

export default function ProductLossesPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [losses, setLosses] = useState<ProductLoss[]>([]);

    // Form state
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('');
    const [category, setCategory] = useState<LossCategory>('merma_operativa');
    const [reason, setReason] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        const branchId = getActiveBranchId();
        if (!branchId) return;

        // Cargar productos de la sede actual
        const branchProducts = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId) || [];
        setProducts(branchProducts);

        // Cargar recetas
        const branchRecipes = loadFromLocalStorageForBranch<Recipe[]>(KEYS.RECIPES, branchId) || [];
        setRecipes(branchRecipes);

        // Cargar pérdidas
        const allLosses = loadFromLocalStorage<ProductLoss[]>(KEYS.PRODUCT_LOSSES) || [];
        setLosses(allLosses);
    };

    const calculateUnitCost = (productName: string): number => {
        // Buscar receta del producto
        const recipe = recipes.find(r => r.name.toLowerCase() === productName.toLowerCase());

        if (recipe && recipe.costPerUnit) {
            return recipe.costPerUnit;
        }

        // Si no hay receta, intentar sacar del precio del producto
        const product = products.find(p => p.name === productName);
        if (product && product.unitPrice) {
            // Estimar costo como 60% del precio
            return product.unitPrice * 0.6;
        }

        return 0;
    };

    const handleSave = () => {
        if (!selectedProduct) {
            toast({
                title: "Error",
                description: "Selecciona un producto",
                variant: "destructive"
            });
            return;
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            toast({
                title: "Error",
                description: "Ingresa una cantidad válida",
                variant: "destructive"
            });
            return;
        }

        if (!reason.trim()) {
            toast({
                title: "Error",
                description: "Describe el motivo de la pérdida",
                variant: "destructive"
            });
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        const branchId = getActiveBranchId();
        if (!branchId) return;

        const unitCost = calculateUnitCost(product.name);
        const totalCost = unitCost * qty;

        const newLoss: ProductLoss = {
            id: `loss-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            category,
            quantity: qty,
            unitCost,
            totalCost,
            reason: reason.trim(),
            date: format(selectedDate, 'yyyy-MM-dd'),
            branchId,
            registeredBy: 'current-user', // TODO: Get from user context
            createdAt: new Date().toISOString()
        };

        const updatedLosses = [newLoss, ...losses];
        saveToLocalStorage(KEYS.PRODUCT_LOSSES, updatedLosses);
        setLosses(updatedLosses);

        // Reset form
        setSelectedProduct('');
        setQuantity('');
        setReason('');
        setCategory('merma_operativa');

        toast({
            title: "Pérdida Registrada",
            description: `${qty} unidades de ${product.name}`
        });
    };

    const handleDelete = (lossId: string) => {
        const updatedLosses = losses.filter(l => l.id !== lossId);
        saveToLocalStorage(KEYS.PRODUCT_LOSSES, updatedLosses);
        setLosses(updatedLosses);

        toast({
            title: "Pérdida Eliminada",
            description: "El registro ha sido eliminado"
        });
    };

    const todayLosses = losses.filter(l => l.date === format(new Date(), 'yyyy-MM-dd'));
    const totalTodayCost = todayLosses.reduce((sum, l) => sum + l.totalCost, 0);

    const getCategoryInfo = (cat: LossCategory) => {
        return LOSS_CATEGORIES.find(c => c.value === cat) || LOSS_CATEGORIES[0];
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <PageHeader
                title="Registro de Pérdidas"
                description="Control de salidas y pérdidas de productos categorizadas"
                icon={PackageX}
            />

            {/* Formulario de Registro */}
            <Card>
                <CardHeader>
                    <CardTitle>Registrar Nueva Pérdida</CardTitle>
                    <CardDescription>Registra pérdidas de productos con categorización automática de costos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Fecha */}
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !selectedDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) => {
                                            setSelectedDate(date || new Date());
                                            setIsDatePickerOpen(false);
                                        }}
                                        initialFocus
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Producto */}
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar producto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Cantidad */}
                        <div className="space-y-2">
                            <Label>Cantidad</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                            />
                        </div>

                        {/* Categoría */}
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as LossCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LOSS_CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.icon} {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Motivo */}
                    <div className="space-y-2">
                        <Label>Motivo / Descripción</Label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Describe el motivo de la pérdida..."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                            {selectedProduct && quantity && (
                                <>
                                    Costo estimado: <span className="font-semibold">
                                        <FormattedNumber
                                            value={calculateUnitCost(products.find(p => p.id === selectedProduct)?.name || '') * parseFloat(quantity || '0')}
                                            prefix="$"
                                        />
                                    </span>
                                </>
                            )}
                        </div>
                        <Button onClick={handleSave}>
                            <Save className="mr-2 h-4 w-4" />
                            Registrar Pérdida
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pérdidas del Día */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Pérdidas de Hoy</CardTitle>
                            <CardDescription>
                                {todayLosses.length} registros - Costo total: <FormattedNumber value={totalTodayCost} prefix="$" />
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {todayLosses.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead className="text-right">Costo</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {todayLosses.map(loss => {
                                    const catInfo = getCategoryInfo(loss.category);
                                    return (
                                        <TableRow key={loss.id}>
                                            <TableCell className="font-medium">{loss.productName}</TableCell>
                                            <TableCell>{loss.quantity}</TableCell>
                                            <TableCell>
                                                <Badge className={catInfo.color}>
                                                    {catInfo.icon} {catInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate">{loss.reason}</TableCell>
                                            <TableCell className="text-right">
                                                <FormattedNumber value={loss.totalCost} prefix="$" />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(loss.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            No hay pérdidas registradas hoy
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
