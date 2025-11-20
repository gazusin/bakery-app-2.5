
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  type CustomConversionRule,
  loadCustomConversionRules,
  saveCustomConversionRules,
  VALID_BASE_UNITS,
  KEYS,
} from '@/lib/data-storage';

interface ManageConversionsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConversionsUpdated?: () => void;
}

const baseUnitOptions = VALID_BASE_UNITS.map(u => ({label: u.toUpperCase(), value: u}));

export function ManageConversionsDialog({ isOpen, onOpenChange, onConversionsUpdated }: ManageConversionsDialogProps) {
  const { toast } = useToast();
  const [customRules, setCustomRules] = useState<CustomConversionRule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newPurchaseUnit, setNewPurchaseUnit] = useState('');
  const [newMaterialMatcher, setNewMaterialMatcher] = useState('');
  const [newBaseUnit, setNewBaseUnit] = useState<'kg' | 'g' | 'l' | 'ml' | 'unidad'>(VALID_BASE_UNITS[0] as 'kg' | 'g' | 'l' | 'ml' | 'unidad');
  const [newFactor, setNewFactor] = useState('');

  const refreshRules = useCallback(() => {
    setCustomRules(loadCustomConversionRules());
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshRules();
    }
  }, [isOpen, refreshRules]);

  const handleAddRule = () => {
    if (!newPurchaseUnit.trim() || !newBaseUnit || !newFactor.trim()) {
      toast({ title: "Error", description: "Unidad de compra, unidad base y factor son obligatorios.", variant: "destructive"});
      return;
    }
    const factorNum = parseFloat(newFactor);
    if (isNaN(factorNum) || factorNum <= 0) {
      toast({ title: "Error", description: "El factor debe ser un número positivo.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);
    const newRule: CustomConversionRule = {
      id: `ccr-${Date.now()}`,
      purchaseUnit: newPurchaseUnit.trim(),
      materialNameMatcher: newMaterialMatcher.trim().toLowerCase() || undefined,
      baseUnit: newBaseUnit,
      factor: factorNum,
    };
    const updatedRules = [...customRules, newRule];
    saveCustomConversionRules(updatedRules);
    setCustomRules(updatedRules);
    if (onConversionsUpdated) onConversionsUpdated();
    window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.CUSTOM_CONVERSION_RULES } }));
    toast({ title: "Regla Añadida", description: `Nueva regla de conversión global guardada.` });
    setNewPurchaseUnit(''); setNewMaterialMatcher(''); setNewBaseUnit(VALID_BASE_UNITS[0] as 'kg' | 'g' | 'l' | 'ml' | 'unidad'); setNewFactor('');
    setIsSubmitting(false);
  };

  const handleRemoveRule = (ruleId: string) => {
    setIsSubmitting(true);
    const updatedRules = customRules.filter(rule => rule.id !== ruleId);
    saveCustomConversionRules(updatedRules);
    setCustomRules(updatedRules);
    if (onConversionsUpdated) onConversionsUpdated();
    window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.CUSTOM_CONVERSION_RULES } }));
    toast({ title: "Regla Eliminada", description: `Regla de conversión global eliminada.` });
    setIsSubmitting(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Gestionar Reglas de Conversión de Unidades (Globales)</DialogTitle>
          <DialogDescription>
            Define cómo las unidades de compra se convierten a unidades base para el inventario.
            Ej: 1 "saco azul" de "Harina Pan" = 20 "kg".
            Para "Material (Opcional)", puedes poner una palabra clave (ej: "harina") o varias separadas por coma (ej: "manteca,mantequilla") para que la regla aplique si el nombre del producto en la OC contiene alguna de ellas. Si lo dejas vacío, la regla aplicará a cualquier material con esa "Unidad de Compra".
            Estas reglas se aplican globalmente al procesar Órdenes de Compra.
          </DialogDescription>
        </DialogHeader>
        {/* Contenedor principal del contenido que será scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid gap-6 py-4"> {/* Padding interno para el contenido scrollable */}
            <Card>
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base">Añadir Nueva Regla Global</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                    <Label htmlFor="new_purchase_unit">Unidad de Compra*</Label>
                    <Input id="new_purchase_unit" value={newPurchaseUnit} onChange={e => setNewPurchaseUnit(e.target.value)} placeholder="ej., Saco Azul, Caja 15unid" disabled={isSubmitting}/>
                    </div>
                    <div className="space-y-1">
                    <Label htmlFor="new_material_matcher">Para Material (Opcional)</Label>
                    <Input id="new_material_matcher" value={newMaterialMatcher} onChange={e => setNewMaterialMatcher(e.target.value)} placeholder="ej., Harina Pan, o manteca,mantequilla" disabled={isSubmitting}/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                    <Label htmlFor="new_factor">1 [Unidad Compra] = Factor*</Label>
                    <Input id="new_factor" type="number" value={newFactor} onChange={e => setNewFactor(e.target.value)} placeholder="ej. 20" disabled={isSubmitting}/>
                    </div>
                    <div className="space-y-1">
                    <Label htmlFor="new_base_unit">Unidad Base Resultante*</Label>
                    <Select value={newBaseUnit} onValueChange={(val) => setNewBaseUnit(val as any)} disabled={isSubmitting}>
                        <SelectTrigger id="new_base_unit"><SelectValue /></SelectTrigger>
                        <SelectContent>{baseUnitOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    </div>
                    <Button onClick={handleAddRule} disabled={isSubmitting} className="w-full md:w-auto">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>} Añadir Regla
                    </Button>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3 pt-4 px-4"><CardTitle className="text-base">Reglas Globales Existentes</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                {customRules.length > 0 ? (
                    <Table>
                    <TableHeader><TableRow><TableHead>Unidad Compra</TableHead><TableHead>Material (Si aplica)</TableHead><TableHead className="text-right">Factor</TableHead><TableHead>Unidad Base</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {customRules.map(rule => (
                        <TableRow key={rule.id}>
                            <TableCell>{rule.purchaseUnit}</TableCell>
                            <TableCell>{rule.materialNameMatcher || 'Cualquiera'}</TableCell>
                            <TableCell className="text-right">{rule.factor}</TableCell>
                            <TableCell>{rule.baseUnit.toUpperCase()}</TableCell>
                            <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRule(rule.id)} disabled={isSubmitting}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                ) : (
                    <p className="p-4 text-center text-sm text-muted-foreground">No hay reglas de conversión globales definidas.</p>
                )}
                </CardContent>
            </Card>
            </div>
        </div>
        <DialogFooter className="pt-4 border-t flex-shrink-0"> 
          <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cerrar</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

