
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { ArrowRightLeft, PlusCircle, Loader2, Trash2, AlertTriangle, Edit, MoreHorizontal } from 'lucide-react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  availableBranches,
  type Branch,
  type RawMaterialInventoryItem,
  type InventoryTransfer,
  loadRawMaterialInventoryData,
  saveRawMaterialInventoryData,
  inventoryTransfersData as initialInventoryTransfersData,
  saveInventoryTransfersData,
  commonUnitOptions,
  convertMaterialToBaseUnit,
  normalizeUnit,
} from '@/lib/data-storage';
import { FormattedNumber } from '@/components/ui/formatted-number';

interface MaterialOption {
  name: string;
  unit: string;
  availableQuantity: number;
}

interface DebtSummaryItem {
  debtorBranchId: string;
  debtorBranchName: string;
  creditorBranchId: string;
  creditorBranchName: string;
  materialName: string;
  quantityOwed: number;
  unit: string;
}


export default function InventoryTransfersPage() {
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para el diálogo de Registrar Transferencia
  const [isRegisterTransferDialogOpen, setIsRegisterTransferDialogOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState<string>('');
  const [toBranchId, setToBranchId] = useState<string>('');
  const [materialName, setMaterialName] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [transferDate, setTransferDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState<string>('');

  const [availableMaterialsFromOrigin, setAvailableMaterialsFromOrigin] = useState<MaterialOption[]>([]);

  // Estados para el diálogo de Editar Transferencia
  const [isEditTransferDialogOpen, setIsEditTransferDialogOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<InventoryTransfer | null>(null);
  const [originalTransferForEdit, setOriginalTransferForEdit] = useState<InventoryTransfer | null>(null);
  const [editFromBranchId, setEditFromBranchId] = useState<string>('');
  const [editToBranchId, setEditToBranchId] = useState<string>('');
  const [editMaterialName, setEditMaterialName] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('');
  const [editTransferDate, setEditTransferDate] = useState<Date | undefined>(undefined);
  const [editNotes, setEditNotes] = useState<string>('');
  const [availableMaterialsFromEditOrigin, setAvailableMaterialsFromEditOrigin] = useState<MaterialOption[]>([]);


  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [transferToDeleteId, setTransferToDeleteId] = useState<string | null>(null);

  const [debtSummary, setDebtSummary] = useState<DebtSummaryItem[]>([]);
  const [isTransferDatePickerOpen, setIsTransferDatePickerOpen] = useState(false);
  const [isEditTransferDatePickerOpen, setIsEditTransferDatePickerOpen] = useState(false);

  const calculateDebtSummary = useCallback((currentTransfers: InventoryTransfer[]): DebtSummaryItem[] => {
    const netTransfers: { [key: string]: number } = {};

    currentTransfers.forEach(transfer => {
      const key = `${transfer.fromBranchId}-${transfer.toBranchId}-${transfer.materialName}-${transfer.unit}`;
      netTransfers[key] = (netTransfers[key] || 0) + transfer.quantity;
    });

    const summary: DebtSummaryItem[] = [];
    const processedPairs = new Set<string>();

    availableBranches.forEach(branchA => {
      availableBranches.forEach(branchB => {
        if (branchA.id === branchB.id) return;
        const pairKey1 = `${branchA.id}-${branchB.id}`;
        const pairKey2 = `${branchB.id}-${branchA.id}`;
        if (processedPairs.has(pairKey1) || processedPairs.has(pairKey2)) return;

        const materialsTransferred: { [materialKey: string]: { name: string, unit: string, net: number } } = {};
        Object.keys(netTransfers).forEach(key => {
          const [from, to, matName, matUnit] = key.split('-');
          const quantityTransferred = netTransfers[key];
          const materialKey = `${matName}-${matUnit}`;
          if (from === branchA.id && to === branchB.id) {
            materialsTransferred[materialKey] = materialsTransferred[materialKey] || { name: matName, unit: matUnit, net: 0 };
            materialsTransferred[materialKey].net += quantityTransferred;
          } else if (from === branchB.id && to === branchA.id) {
            materialsTransferred[materialKey] = materialsTransferred[materialKey] || { name: matName, unit: matUnit, net: 0 };
            materialsTransferred[materialKey].net -= quantityTransferred;
          }
        });

        Object.values(materialsTransferred).forEach(materialData => {
          if (materialData.net > 0.0001) {
            summary.push({
              debtorBranchId: branchB.id, debtorBranchName: branchB.name,
              creditorBranchId: branchA.id, creditorBranchName: branchA.name,
              materialName: materialData.name, quantityOwed: materialData.net, unit: materialData.unit,
            });
          } else if (materialData.net < -0.0001) {
            summary.push({
              debtorBranchId: branchA.id, debtorBranchName: branchA.name,
              creditorBranchId: branchB.id, creditorBranchName: branchB.name,
              materialName: materialData.name, quantityOwed: -materialData.net, unit: materialData.unit,
            });
          }
        });
        processedPairs.add(pairKey1); processedPairs.add(pairKey2);
      });
    });
    return summary.sort((a,b) => a.debtorBranchName.localeCompare(b.debtorBranchName) || a.creditorBranchName.localeCompare(b.creditorBranchName) || a.materialName.localeCompare(b.materialName));
  }, []);


  const loadTransfersAndSummary = useCallback(() => {
    setIsLoading(true);
    const sortedTransfers = [...initialInventoryTransfersData].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    setTransfers(sortedTransfers);
    setDebtSummary(calculateDebtSummary(sortedTransfers));

    if (availableBranches.length > 0) {
      if (!fromBranchId) setFromBranchId(availableBranches[0].id);
      if (!toBranchId) {
        const initialFrom = fromBranchId || availableBranches[0].id;
        if (availableBranches.length > 1) {
          const secondBranch = availableBranches.find(b => b.id !== initialFrom);
          setToBranchId(secondBranch ? secondBranch.id : '');
        } else {
          setToBranchId('');
        }
      }
    }
    setIsLoading(false);
  }, [fromBranchId, toBranchId, calculateDebtSummary]);

  useEffect(() => {
    loadTransfersAndSummary();
  }, [loadTransfersAndSummary]);

  const updateAvailableMaterials = useCallback((branchId: string, forEditDialog: boolean = false) => {
    if (branchId) {
      const inventory = loadRawMaterialInventoryData(branchId);
      const materialOptions = inventory
        .filter(item => item.quantity > 0.0001)
        .map(item => ({
          name: item.name,
          unit: item.unit,
          availableQuantity: item.quantity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (forEditDialog) {
        setAvailableMaterialsFromEditOrigin(materialOptions);
        const currentSelectedMat = materialOptions.find(m => m.name === editMaterialName);
        if (!currentSelectedMat && materialOptions.length > 0) {
            setEditMaterialName(materialOptions[0].name);
            setEditUnit(materialOptions[0].unit);
        } else if (!currentSelectedMat) {
            setEditMaterialName('');
            setEditUnit('');
        }
      } else {
        setAvailableMaterialsFromOrigin(materialOptions);
        const currentSelectedMat = materialOptions.find(m => m.name === materialName);
         if (!currentSelectedMat && materialOptions.length > 0) {
            setMaterialName(materialOptions[0].name);
            setUnit(materialOptions[0].unit);
        } else if (!currentSelectedMat) {
            setMaterialName('');
            setUnit('');
        }
      }
    } else {
      if (forEditDialog) {
        setAvailableMaterialsFromEditOrigin([]);
        setEditMaterialName('');
        setEditUnit('');
      } else {
        setAvailableMaterialsFromOrigin([]);
        setMaterialName('');
        setUnit('');
      }
    }
  }, [materialName, editMaterialName]); // Dependencias para cada contexto

  useEffect(() => {
    if(fromBranchId) {
      updateAvailableMaterials(fromBranchId, false);
    }
  }, [fromBranchId, updateAvailableMaterials]);

  useEffect(() => {
    if(editFromBranchId) {
      updateAvailableMaterials(editFromBranchId, true);
    }
  }, [editFromBranchId, updateAvailableMaterials]);


  const resetDialogForm = () => {
    let initialFrom = ''; let initialTo = '';
    if (availableBranches.length > 0) {
      initialFrom = availableBranches[0].id;
      if (availableBranches.length > 1) {
        const secondBranch = availableBranches.find(b => b.id !== initialFrom);
        initialTo = secondBranch ? secondBranch.id : '';
      } else { initialTo = ''; }
    }
    setFromBranchId(initialFrom); setToBranchId(initialTo);
    if(initialFrom) updateAvailableMaterials(initialFrom, false);
    else setAvailableMaterialsFromOrigin([]);
    setQuantity(''); setTransferDate(new Date()); setNotes('');
  };

  const handleFromBranchChange = (newFromId: string, forEdit: boolean = false) => {
    if (forEdit) {
        setEditFromBranchId(newFromId);
        if (newFromId === editToBranchId && availableBranches.length > 1) {
            const otherBranch = availableBranches.find(b => b.id !== newFromId);
            if (otherBranch) setEditToBranchId(otherBranch.id);
        }
    } else {
        setFromBranchId(newFromId);
        if (newFromId === toBranchId && availableBranches.length > 1) {
            const otherBranch = availableBranches.find(b => b.id !== newFromId);
            if (otherBranch) setToBranchId(otherBranch.id);
        }
    }
  };

  const handleToBranchChange = (newToId: string, forEdit: boolean = false) => {
    if (forEdit) {
        setEditToBranchId(newToId);
        if (newToId === editFromBranchId && availableBranches.length > 1) {
            const otherBranch = availableBranches.find(b => b.id !== newToId);
            if (otherBranch) setEditFromBranchId(otherBranch.id);
        }
    } else {
        setToBranchId(newToId);
        if (newToId === fromBranchId && availableBranches.length > 1) {
            const otherBranch = availableBranches.find(b => b.id !== newToId);
            if (otherBranch) setFromBranchId(otherBranch.id);
        }
    }
  };


  const handleRegisterTransfer = () => {
    if (!fromBranchId || !toBranchId || !materialName || !quantity || !unit || !transferDate) {
      toast({ title: "Error", description: "Todos los campos marcados con * son obligatorios.", variant: "destructive" }); return;
    }
    if (fromBranchId === toBranchId) {
      toast({ title: "Error", description: "La sede de origen y destino no pueden ser la misma.", variant: "destructive" }); return;
    }
    const transferQtyNum = parseFloat(quantity);
    if (isNaN(transferQtyNum) || transferQtyNum <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser un número positivo.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    const originInventory = loadRawMaterialInventoryData(fromBranchId);
    const { quantity: transferQtyInBaseUnit, unit: materialBaseUnit } = convertMaterialToBaseUnit(transferQtyNum, unit, materialName);
    const materialInOrigin = originInventory.find(item => item.name.toLowerCase() === materialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(materialBaseUnit));
    if (!materialInOrigin || materialInOrigin.quantity < transferQtyInBaseUnit) {
      toast({ title: "Error de Stock", description: `Stock insuficiente de ${materialName} (${materialInOrigin?.quantity.toFixed(3)} ${materialBaseUnit} disp.) en origen.`, variant: "destructive", duration: 7000 });
      setIsSubmitting(false); return;
    }
    const updatedOriginInventory = originInventory.map(item => item.name.toLowerCase() === materialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(materialBaseUnit) ? { ...item, quantity: item.quantity - transferQtyInBaseUnit } : item).filter(item => item.quantity > 0.0001);
    saveRawMaterialInventoryData(fromBranchId, updatedOriginInventory);
    let destinationInventory = loadRawMaterialInventoryData(toBranchId);
    const materialInDestinationIndex = destinationInventory.findIndex(item => item.name.toLowerCase() === materialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(materialBaseUnit));
    if (materialInDestinationIndex !== -1) destinationInventory[materialInDestinationIndex].quantity += transferQtyInBaseUnit;
    else destinationInventory.push({ name: materialName, quantity: transferQtyInBaseUnit, unit: materialBaseUnit });
    saveRawMaterialInventoryData(toBranchId, destinationInventory);
    const fromBranch = availableBranches.find(b => b.id === fromBranchId);
    const toBranch = availableBranches.find(b => b.id === toBranchId);
    const newTransfer: InventoryTransfer = {
      id: `TRNFR-${Date.now().toString().slice(-5)}`, date: format(transferDate, "yyyy-MM-dd"),
      fromBranchId, fromBranchName: fromBranch?.name || 'Desconocida',
      toBranchId, toBranchName: toBranch?.name || 'Desconocida',
      materialName, quantity: transferQtyInBaseUnit, unit: materialBaseUnit, notes: notes.trim(),
      timestamp: new Date().toISOString(), // Added timestamp
    };
    const updatedTransfers = [newTransfer, ...transfers].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    saveInventoryTransfersData(updatedTransfers);
    setTransfers(updatedTransfers); setDebtSummary(calculateDebtSummary(updatedTransfers));
    updateAvailableMaterials(fromBranchId, false);
    toast({ title: "Transferencia Registrada", description: `Se transfirieron ${transferQtyNum} ${unit} de ${materialName}.` });
    setIsRegisterTransferDialogOpen(false); resetDialogForm(); setIsSubmitting(false);
  };

  const handleOpenEditDialog = (transfer: InventoryTransfer) => {
    setEditingTransfer(transfer);
    setOriginalTransferForEdit(JSON.parse(JSON.stringify(transfer)));
    setEditFromBranchId(transfer.fromBranchId);
    setEditToBranchId(transfer.toBranchId);
    setEditMaterialName(transfer.materialName);
    setEditQuantity(transfer.quantity.toString()); // Convertir a string para el input
    setEditUnit(transfer.unit);
    setEditTransferDate(parseISO(transfer.date));
    setEditNotes(transfer.notes || '');
    updateAvailableMaterials(transfer.fromBranchId, true); // Cargar materiales para la sede origen actual de la transferencia
    setIsEditTransferDialogOpen(true);
  };

  const handleUpdateTransfer = () => {
    if (!editingTransfer || !originalTransferForEdit || !editFromBranchId || !editToBranchId || !editMaterialName || !editQuantity || !editUnit || !editTransferDate) {
      toast({ title: "Error", description: "Todos los campos marcados con * son obligatorios.", variant: "destructive" }); return;
    }
    if (editFromBranchId === editToBranchId) {
      toast({ title: "Error", description: "La sede de origen y destino no pueden ser la misma.", variant: "destructive" }); return;
    }
    const transferQtyNum = parseFloat(editQuantity);
    if (isNaN(transferQtyNum) || transferQtyNum <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser un número positivo.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);

    // 1. Revertir la transferencia original
    let origFromInv = loadRawMaterialInventoryData(originalTransferForEdit.fromBranchId);
    let origToInv = loadRawMaterialInventoryData(originalTransferForEdit.toBranchId);
    const origMatIdxFrom = origFromInv.findIndex(i => i.name === originalTransferForEdit.materialName && normalizeUnit(i.unit) === normalizeUnit(originalTransferForEdit.unit));
    if (origMatIdxFrom !== -1) origFromInv[origMatIdxFrom].quantity += originalTransferForEdit.quantity;
    else origFromInv.push({ name: originalTransferForEdit.materialName, quantity: originalTransferForEdit.quantity, unit: originalTransferForEdit.unit });
    saveRawMaterialInventoryData(originalTransferForEdit.fromBranchId, origFromInv);
    const origMatIdxTo = origToInv.findIndex(i => i.name === originalTransferForEdit.materialName && normalizeUnit(i.unit) === normalizeUnit(originalTransferForEdit.unit));
    if (origMatIdxTo !== -1) {
        origToInv[origMatIdxTo].quantity -= originalTransferForEdit.quantity;
        if (origToInv[origMatIdxTo].quantity < 0.0001) origToInv.splice(origMatIdxTo, 1);
    }
    saveRawMaterialInventoryData(originalTransferForEdit.toBranchId, origToInv);

    // 2. Aplicar la nueva transferencia (validando stock)
    const newOriginInventory = loadRawMaterialInventoryData(editFromBranchId);
    const { quantity: newTransferQtyInBaseUnit, unit: newMaterialBaseUnit } = convertMaterialToBaseUnit(transferQtyNum, editUnit, editMaterialName);
    const materialInNewOrigin = newOriginInventory.find(item => item.name.toLowerCase() === editMaterialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(newMaterialBaseUnit));
    if (!materialInNewOrigin || materialInNewOrigin.quantity < newTransferQtyInBaseUnit) {
      // Revertir la reversión si la nueva operación falla
      saveRawMaterialInventoryData(originalTransferForEdit.fromBranchId, loadRawMaterialInventoryData(originalTransferForEdit.fromBranchId).map(i => i.name === originalTransferForEdit.materialName && normalizeUnit(i.unit) === normalizeUnit(originalTransferForEdit.unit) ? {...i, quantity: i.quantity - originalTransferForEdit.quantity} : i).filter(i => i.quantity > 0.0001) );
      saveRawMaterialInventoryData(originalTransferForEdit.toBranchId, loadRawMaterialInventoryData(originalTransferForEdit.toBranchId).map(i => i.name === originalTransferForEdit.materialName && normalizeUnit(i.unit) === normalizeUnit(originalTransferForEdit.unit) ? {...i, quantity: i.quantity + originalTransferForEdit.quantity} : i) );

      toast({ title: "Error de Stock", description: `Stock insuficiente de ${editMaterialName} en ${editFromBranchId} para la nueva cantidad. Cambios revertidos.`, variant: "destructive", duration: 7000 });
      setIsSubmitting(false); return;
    }
    const updatedNewOriginInventory = newOriginInventory.map(item => item.name.toLowerCase() === editMaterialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(newMaterialBaseUnit) ? { ...item, quantity: item.quantity - newTransferQtyInBaseUnit } : item).filter(item => item.quantity > 0.0001);
    saveRawMaterialInventoryData(editFromBranchId, updatedNewOriginInventory);
    let newDestinationInventory = loadRawMaterialInventoryData(editToBranchId);
    const materialInNewDestinationIndex = newDestinationInventory.findIndex(item => item.name.toLowerCase() === editMaterialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(newMaterialBaseUnit));
    if (materialInNewDestinationIndex !== -1) newDestinationInventory[materialInNewDestinationIndex].quantity += newTransferQtyInBaseUnit;
    else newDestinationInventory.push({ name: editMaterialName, quantity: newTransferQtyInBaseUnit, unit: newMaterialBaseUnit });
    saveRawMaterialInventoryData(editToBranchId, newDestinationInventory);

    // 3. Actualizar el registro de transferencia
    const fromBranchNew = availableBranches.find(b => b.id === editFromBranchId);
    const toBranchNew = availableBranches.find(b => b.id === editToBranchId);
    const updatedTransferData: InventoryTransfer = {
      ...editingTransfer,
      date: format(editTransferDate, "yyyy-MM-dd"),
      fromBranchId: editFromBranchId, fromBranchName: fromBranchNew?.name || 'Desconocida',
      toBranchId: editToBranchId, toBranchName: toBranchNew?.name || 'Desconocida',
      materialName: editMaterialName, quantity: newTransferQtyInBaseUnit, unit: newMaterialBaseUnit,
      notes: editNotes.trim(),
      timestamp: new Date().toISOString(), // Update timestamp on edit
    };
    const updatedTransfers = transfers.map(t => t.id === editingTransfer.id ? updatedTransferData : t).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    saveInventoryTransfersData(updatedTransfers);
    setTransfers(updatedTransfers); setDebtSummary(calculateDebtSummary(updatedTransfers));
    updateAvailableMaterials(editFromBranchId, true); // Actualizar materiales para el diálogo de edición si sigue abierto

    toast({ title: "Transferencia Actualizada", description: `La transferencia ${editingTransfer.id} ha sido actualizada.` });
    setIsEditTransferDialogOpen(false); setEditingTransfer(null); setOriginalTransferForEdit(null); setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (transferId: string) => {
    setTransferToDeleteId(transferId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteTransfer = () => {
    if (!transferToDeleteId) return;
    setIsSubmitting(true);
    const transferToDelete = transfers.find(t => t.id === transferToDeleteId);
    if (!transferToDelete) {
        toast({ title: "Error", description: "Transferencia no encontrada.", variant: "destructive" });
        setIsSubmitting(false); setIsDeleteConfirmOpen(false); return;
    }
    let originInventory = loadRawMaterialInventoryData(transferToDelete.fromBranchId);
    const materialInOriginIdx = originInventory.findIndex(item => item.name.toLowerCase() === transferToDelete.materialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(transferToDelete.unit));
    if (materialInOriginIdx !== -1) originInventory[materialInOriginIdx].quantity += transferToDelete.quantity;
    else originInventory.push({ name: transferToDelete.materialName, quantity: transferToDelete.quantity, unit: transferToDelete.unit });
    saveRawMaterialInventoryData(transferToDelete.fromBranchId, originInventory);
    let destinationInventory = loadRawMaterialInventoryData(transferToDelete.toBranchId);
    const materialInDestIdx = destinationInventory.findIndex(item => item.name.toLowerCase() === transferToDelete.materialName.toLowerCase() && normalizeUnit(item.unit) === normalizeUnit(transferToDelete.unit));
    if (materialInDestIdx !== -1) {
        destinationInventory[materialInDestIdx].quantity -= transferToDelete.quantity;
        if (destinationInventory[materialInDestIdx].quantity < 0.0001) destinationInventory.splice(materialInDestIdx, 1);
    }
    saveRawMaterialInventoryData(transferToDelete.toBranchId, destinationInventory);
    const updatedTransfers = transfers.filter(t => t.id !== transferToDeleteId);
    saveInventoryTransfersData(updatedTransfers);
    setTransfers(updatedTransfers); setDebtSummary(calculateDebtSummary(updatedTransfers));
    updateAvailableMaterials(transferToDelete.fromBranchId, false);
    toast({ title: "Transferencia Eliminada", description: "La transferencia ha sido eliminada y los inventarios ajustados."});
    setIsDeleteConfirmOpen(false); setTransferToDeleteId(null); setIsSubmitting(false);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando transferencias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferencias de Materia Prima entre Sedes"
        description="Registra y consulta el movimiento de materia prima entre tus diferentes sedes. También puedes ver un resumen de las deudas pendientes de materia prima."
        icon={ArrowRightLeft}
        actions={
          <Button onClick={() => { resetDialogForm(); setIsRegisterTransferDialogOpen(true); }} disabled={isSubmitting || availableBranches.length < 2}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Registrar Nueva Transferencia
          </Button>
        }
      />
       {availableBranches.length < 2 && (
          <Card className="border-yellow-500 border-dashed bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                <p className="text-yellow-700 dark:text-yellow-500 text-sm">
                  Debes tener al menos dos sedes configuradas para poder realizar transferencias. Actualmente solo hay {availableBranches.length} sede(s).
                </p>
              </div>
            </CardContent>
          </Card>
        )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Resumen de Deudas de Materia Prima entre Sedes</CardTitle>
          <CardDescription>
            {debtSummary.length > 0 ? "Listado de materia prima pendiente de reponer entre sedes." : "No hay deudas de materia prima pendientes entre sedes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debtSummary.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Sede Deudora</TableHead><TableHead>Sede Acreedora</TableHead><TableHead>Materia Prima</TableHead><TableHead className="text-right">Cantidad Adeudada</TableHead><TableHead>Unidad</TableHead></TableRow></TableHeader>
              <TableBody>
                {debtSummary.map((debt, index) => (
                  <TableRow key={`${debt.debtorBranchId}-${debt.creditorBranchId}-${debt.materialName}-${index}`}>
                    <TableCell className="font-medium">{debt.debtorBranchName}</TableCell><TableCell className="font-medium">{debt.creditorBranchName}</TableCell>
                    <TableCell>{debt.materialName}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">
                      <FormattedNumber value={debt.quantityOwed} decimalPlaces={3} />
                    </TableCell>
                    <TableCell>{debt.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (!isLoading && <p className="text-center text-muted-foreground py-8">No hay deudas de materia prima pendientes entre sedes.</p>)}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historial de Transferencias</CardTitle>
          <CardDescription>{transfers.length > 0 ? "Lista de todas las transferencias de materia prima realizadas." : "No hay transferencias registradas."}</CardDescription>
        </CardHeader>
        <CardContent>
          {transfers.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Sede Origen</TableHead><TableHead>Sede Destino</TableHead><TableHead>Materia Prima</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Unidad</TableHead><TableHead>Notas</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>{format(parseISO(transfer.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell>{transfer.fromBranchName}</TableCell><TableCell>{transfer.toBranchName}</TableCell>
                    <TableCell className="font-medium">{transfer.materialName}</TableCell>
                    <TableCell className="text-right">
                      <FormattedNumber value={transfer.quantity} decimalPlaces={3} />
                    </TableCell>
                    <TableCell>{transfer.unit}</TableCell><TableCell className="max-w-xs truncate" title={transfer.notes}>{transfer.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenEditDialog(transfer)} disabled={isSubmitting}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenDeleteDialog(transfer.id)} disabled={isSubmitting} className="text-destructive focus:text-destructive-foreground focus:bg-destructive/90"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (!isLoading && <p className="text-center text-muted-foreground py-8">No hay transferencias registradas.</p>)}
        </CardContent>
      </Card>

      {/* Dialogo para Registrar Transferencia */}
      <Dialog open={isRegisterTransferDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsRegisterTransferDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Registrar Nueva Transferencia</DialogTitle><DialogDescription>Completa los detalles.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="fromBranchId">Sede Origen*</Label><Select value={fromBranchId} onValueChange={(val) => handleFromBranchChange(val, false)} disabled={isSubmitting}><SelectTrigger id="fromBranchId"><SelectValue /></SelectTrigger><SelectContent>{availableBranches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="toBranchId">Sede Destino*</Label><Select value={toBranchId} onValueChange={(val) => handleToBranchChange(val, false)} disabled={isSubmitting}><SelectTrigger id="toBranchId"><SelectValue /></SelectTrigger><SelectContent>{availableBranches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label htmlFor="materialName">Materia Prima*</Label><Select value={materialName} onValueChange={(v) => {setMaterialName(v); const sm=availableMaterialsFromOrigin.find(m=>m.name===v); if(sm)setUnit(sm.unit); else setUnit('');}} disabled={isSubmitting||availableMaterialsFromOrigin.length===0}><SelectTrigger id="materialName"><SelectValue/></SelectTrigger>
              <SelectContent>{availableMaterialsFromOrigin.map(m=>(<SelectItem key={m.name} value={m.name}>{m.name} (Disp: <FormattedNumber value={m.availableQuantity} decimalPlaces={3} /> {m.unit})</SelectItem>))}</SelectContent>
            </Select>{availableMaterialsFromOrigin.length===0&&fromBranchId&&<p className="text-xs text-muted-foreground pt-1">No hay stock en origen.</p>}</div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="quantity">Cantidad*</Label><Input id="quantity" type="number" value={quantity} onChange={(e)=>setQuantity(e.target.value)} disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="unit">Unidad*</Label><Input id="unit" value={unit} readOnly disabled className="bg-muted/50"/></div>
            </div>
            <div className="space-y-1"><Label htmlFor="transferDate">Fecha*</Label><Popover open={isTransferDatePickerOpen} onOpenChange={setIsTransferDatePickerOpen}><PopoverTrigger asChild><Button id="transferDate" variant="outline" className={cn("w-full justify-start text-left font-normal",!transferDate&&"text-muted-foreground")} disabled={isSubmitting}><CalendarIcon className="mr-2 h-4 w-4"/>{transferDate?format(transferDate,"PPP",{locale:es}):<span>Elige</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={transferDate} onSelect={(date) => {setTransferDate(date); setIsTransferDatePickerOpen(false);}} initialFocus locale={es} disabled={isSubmitting}/></PopoverContent></Popover></div>
            <div className="space-y-1"><Label htmlFor="notes">Notas</Label><Textarea id="notes" value={notes} onChange={(e)=>setNotes(e.target.value)} disabled={isSubmitting}/></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button onClick={handleRegisterTransfer} disabled={isSubmitting||fromBranchId===toBranchId||availableBranches.length<2}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:"Registrar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Dialogo para Editar Transferencia */}
       <Dialog open={isEditTransferDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsEditTransferDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Editar Transferencia</DialogTitle><DialogDescription>Modifica los detalles de la transferencia.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="editFromBranchId">Sede Origen*</Label><Select value={editFromBranchId} onValueChange={(val) => handleFromBranchChange(val, true)} disabled={isSubmitting}><SelectTrigger id="editFromBranchId"><SelectValue /></SelectTrigger><SelectContent>{availableBranches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="editToBranchId">Sede Destino*</Label><Select value={editToBranchId} onValueChange={(val) => handleToBranchChange(val, true)} disabled={isSubmitting}><SelectTrigger id="editToBranchId"><SelectValue /></SelectTrigger><SelectContent>{availableBranches.map(b => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label htmlFor="editMaterialName">Materia Prima*</Label><Select value={editMaterialName} onValueChange={(v) => {setEditMaterialName(v); const sm=availableMaterialsFromEditOrigin.find(m=>m.name===v); if(sm)setEditUnit(sm.unit); else setEditUnit('');}} disabled={isSubmitting||availableMaterialsFromEditOrigin.length===0}><SelectTrigger id="editMaterialName"><SelectValue/></SelectTrigger>
              <SelectContent>{availableMaterialsFromEditOrigin.map(m=>(<SelectItem key={m.name} value={m.name}>{m.name} (Disp: <FormattedNumber value={m.availableQuantity} decimalPlaces={3} /> {m.unit})</SelectItem>))}</SelectContent>
            </Select>{availableMaterialsFromEditOrigin.length===0&&editFromBranchId&&<p className="text-xs text-muted-foreground pt-1">No hay stock en origen.</p>}</div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="editQuantity">Cantidad*</Label><Input id="editQuantity" type="number" value={editQuantity} onChange={(e)=>setEditQuantity(e.target.value)} disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="editUnit">Unidad*</Label><Input id="editUnit" value={editUnit} readOnly disabled className="bg-muted/50"/></div>
            </div>
            <div className="space-y-1"><Label htmlFor="editTransferDate">Fecha*</Label><Popover open={isEditTransferDatePickerOpen} onOpenChange={setIsEditTransferDatePickerOpen}><PopoverTrigger asChild><Button id="editTransferDate" variant="outline" className={cn("w-full justify-start text-left font-normal",!editTransferDate&&"text-muted-foreground")} disabled={isSubmitting}><CalendarIcon className="mr-2 h-4 w-4"/>{editTransferDate?format(editTransferDate,"PPP",{locale:es}):<span>Elige</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editTransferDate} onSelect={(date) => {setEditTransferDate(date); setIsEditTransferDatePickerOpen(false);}} initialFocus locale={es} disabled={isSubmitting}/></PopoverContent></Popover></div>
            <div className="space-y-1"><Label htmlFor="editNotes">Notas</Label><Textarea id="editNotes" value={editNotes} onChange={(e)=>setEditNotes(e.target.value)} disabled={isSubmitting}/></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button onClick={handleUpdateTransfer} disabled={isSubmitting||editFromBranchId===editToBranchId||availableBranches.length<2}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:"Guardar Cambios"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

       <Dialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsDeleteConfirmOpen(isOpen); }}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Eliminar esta transferencia? Se revertirán los cambios en inventarios. No se puede deshacer.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDeleteTransfer} disabled={isSubmitting}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:"Sí, Eliminar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
