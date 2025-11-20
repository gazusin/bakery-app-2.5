

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, PlusCircle, MoreHorizontal, Edit, Trash2, Trash, ListPlus, Loader2, Eye, CalendarDays } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  suppliersData as initialSuppliersData, 
  saveSuppliersData, 
  type Supplier, 
  type SupplierPriceListItem,
  type PriceHistoryEntry, 
  getCurrentPriceFromHistory, 
  getCurrentRawMaterialOptions, 
  commonUnitOptions,
  KEYS
} from '@/lib/data-storage';
import { format, parseISO, compareDesc, isValid, formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FormattedNumber } from '@/components/ui/formatted-number';


export default function SuppliersPage() {
  const { toast } = useToast();
  const [currentSuppliers, setCurrentSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableRawMaterials, setAvailableRawMaterials] = useState<string[]>([]);

  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPriceList, setNewPriceList] = useState<SupplierPriceListItem[]>([]);
  const [newPriceListUSDCash, setNewPriceListUSDCash] = useState<SupplierPriceListItem[]>([]);


  const [isEditSupplierDialogOpen, setIsEditSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPriceList, setEditPriceList] = useState<SupplierPriceListItem[]>([]);
  const [editPriceListUSDCash, setEditPriceListUSDCash] = useState<SupplierPriceListItem[]>([]);

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [supplierToDeleteId, setSupplierToDeleteId] = useState<string | null>(null);

  const [isViewPriceListDialogOpen, setIsViewPriceListDialogOpen] = useState(false);
  const [supplierForPriceListView, setSupplierForPriceListView] = useState<Supplier | null>(null);
  const [activePriceListTab, setActivePriceListTab] = useState<'default' | 'usdCash'>('default');
  
  const [editingPriceHistoryFor, setEditingPriceHistoryFor] = useState<{ supplierId: string; itemId: string; materialName: string; unit: string; listType: 'default' | 'usdCash' } | null>(null);
  const [currentPriceHistory, setCurrentPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [newPriceHistoryEntry, setNewPriceHistoryEntry] = useState<{ date: Date | undefined; price: string }>({ date: new Date(), price: '' });


  const loadData = useCallback(() => {
    setIsLoading(true);
    setCurrentSuppliers([...initialSuppliersData]);
    setAvailableRawMaterials(getCurrentRawMaterialOptions());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.SUPPLIERS || customEvent.detail?.key === KEYS.RAW_MATERIAL_OPTIONS) {
        loadData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, [loadData]);

  const resetAddForm = () => {
    setNewSupplierName(''); setNewContactPerson(''); setNewPhone(''); setNewEmail(''); setNewAddress(''); 
    setNewPriceList([]);
    setNewPriceListUSDCash([]);
  };

  const handleAddPriceListItem = (listType: 'default' | 'usdCash', formType: 'new' | 'edit') => {
    const newItem: SupplierPriceListItem = {
      id: `pli-${Date.now()}-${listType}`,
      rawMaterialName: availableRawMaterials[0] || '',
      unit: commonUnitOptions[0] || '',
      priceHistory: [{ price: 0, date: format(new Date(), "yyyy-MM-dd") }]
    };
    if (formType === 'new') {
      if (listType === 'default') setNewPriceList(prev => [...prev, newItem]);
      else setNewPriceListUSDCash(prev => [...prev, newItem]);
    } else { // formType === 'edit'
      if (listType === 'default') setEditPriceList(prev => [...prev, newItem]);
      else setEditPriceListUSDCash(prev => [...prev, newItem]);
    }
  };

  const handleRemovePriceListItem = (index: number, listType: 'default' | 'usdCash', formType: 'new' | 'edit') => {
    const listSetter = formType === 'new' 
      ? (listType === 'default' ? setNewPriceList : setNewPriceListUSDCash)
      : (listType === 'default' ? setEditPriceList : setEditPriceListUSDCash);
    
    listSetter(prevList => prevList.filter((_, i) => i !== index));
  };


  const handlePriceListItemChange = (
    index: number,
    field: 'rawMaterialName' | 'unit' | 'currentPrice',
    value: string,
    listType: 'default' | 'usdCash',
    formType: 'new' | 'edit'
  ) => {
    const list = formType === 'new' 
      ? (listType === 'default' ? newPriceList : newPriceListUSDCash)
      : (listType === 'default' ? editPriceList : editPriceListUSDCash);
    
    const setter = formType === 'new'
      ? (listType === 'default' ? setNewPriceList : setNewPriceListUSDCash)
      : (listType === 'default' ? setEditPriceList : setEditPriceListUSDCash);

    const updatedList = [...list];
    const itemToUpdate = { ...updatedList[index] };
    itemToUpdate.priceHistory = itemToUpdate.priceHistory ? [...itemToUpdate.priceHistory] : [];

    if (field === 'rawMaterialName' || field === 'unit') {
      (itemToUpdate as any)[field] = value;
    } else if (field === 'currentPrice') {
      const newPrice = parseFloat(value) || 0;
      const today = format(new Date(), "yyyy-MM-dd");
      const existingEntryIndex = itemToUpdate.priceHistory.findIndex(ph => ph.date === today);
      if (existingEntryIndex !== -1) {
        itemToUpdate.priceHistory[existingEntryIndex].price = newPrice;
      } else {
        itemToUpdate.priceHistory.push({ price: newPrice, date: today });
      }
      itemToUpdate.priceHistory.sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)));
    }
    updatedList[index] = itemToUpdate;
    setter(updatedList);
  };

  const handleAddSupplier = () => {
    if (!newSupplierName) {
      toast({ title: "Error", description: "El nombre es obligatorio.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    const newSupplier: Supplier = {
      id: `SUP${Date.now().toString().slice(-4)}${Math.floor(Math.random()*100)}`,
      name: newSupplierName, contactPerson: newContactPerson, phone: newPhone, email: newEmail, address: newAddress,
      priceList: newPriceList.filter(item => item.rawMaterialName && item.priceHistory.length > 0 && item.unit),
      priceListUSDCash: newPriceListUSDCash.filter(item => item.rawMaterialName && item.priceHistory.length > 0 && item.unit)
    };
    saveSuppliersData([newSupplier, ...initialSuppliersData]);
    toast({ title: "Éxito", description: "Proveedor añadido." });
    setIsAddSupplierDialogOpen(false); resetAddForm(); setIsSubmitting(false);
  };

  const handleOpenEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setEditSupplierName(supplier.name); setEditContactPerson(supplier.contactPerson || '');
    setEditPhone(supplier.phone || ''); setEditEmail(supplier.email || ''); setEditAddress(supplier.address || '');
    setEditPriceList(supplier.priceList && supplier.priceList.length > 0 ? JSON.parse(JSON.stringify(supplier.priceList)) : []);
    setEditPriceListUSDCash(supplier.priceListUSDCash && supplier.priceListUSDCash.length > 0 ? JSON.parse(JSON.stringify(supplier.priceListUSDCash)) : []);
    setIsEditSupplierDialogOpen(true);
  };

  const handleUpdateSupplier = () => {
    if (!editingSupplier || !editSupplierName) {
      toast({ title: "Error", description: "El nombre es obligatorio.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    const updatedSuppliers = initialSuppliersData.map(s => 
      s.id === editingSupplier.id 
      ? { ...s, name: editSupplierName, contactPerson: editContactPerson, phone: editPhone, email: editEmail, address: editAddress,
          priceList: editPriceList.filter(item => item.rawMaterialName && item.priceHistory.length > 0 && item.unit),
          priceListUSDCash: editPriceListUSDCash.filter(item => item.rawMaterialName && item.priceHistory.length > 0 && item.unit)
        }
      : s
    );
    saveSuppliersData(updatedSuppliers);
    toast({ title: "Éxito", description: "Proveedor actualizado." });
    setIsEditSupplierDialogOpen(false); setEditingSupplier(null); setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (supplierId: string) => { setSupplierToDeleteId(supplierId); setIsDeleteConfirmDialogOpen(true); };
  const handleConfirmDelete = () => {
    if (supplierToDeleteId) {
      setIsSubmitting(true);
      saveSuppliersData(initialSuppliersData.filter(s => s.id !== supplierToDeleteId));
      toast({ title: "Éxito", description: "Proveedor eliminado." });
      setIsDeleteConfirmDialogOpen(false); setSupplierToDeleteId(null); setIsSubmitting(false);
    }
  };

  const handleOpenViewPriceListDialog = (supplier: Supplier) => {
    setSupplierForPriceListView(supplier);
    setEditingPriceHistoryFor(null);
    setActivePriceListTab('default'); // Reset to default tab
    setIsViewPriceListDialogOpen(true);
  };
  
  const handleOpenEditPriceHistoryDialog = (supplierId: string, itemId: string, materialName: string, unit: string, history: PriceHistoryEntry[], listType: 'default' | 'usdCash') => {
    setEditingPriceHistoryFor({ supplierId, itemId, materialName, unit, listType });
    const historyToSet = Array.isArray(history) ? history : [];
    setCurrentPriceHistory(JSON.parse(JSON.stringify(historyToSet.sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date))))));
    setNewPriceHistoryEntry({ date: new Date(), price: '' });
  };

  const handleSavePriceHistoryChange = () => {
    if (!editingPriceHistoryFor || !supplierForPriceListView) return;
    setIsSubmitting(true);
    const updatedSuppliers = currentSuppliers.map(s => {
      if (s.id === supplierForPriceListView.id) {
        const listNameToUpdate = editingPriceHistoryFor.listType === 'usdCash' ? 'priceListUSDCash' : 'priceList';
        const currentList = s[listNameToUpdate] || [];
        const updatedPriceList = currentList.map(item => {
          if (item.id === editingPriceHistoryFor.itemId) {
            return { ...item, priceHistory: currentPriceHistory.sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date))) };
          }
          return item;
        });
        return { ...s, [listNameToUpdate]: updatedPriceList };
      }
      return s;
    });
    saveSuppliersData(updatedSuppliers);
    setSupplierForPriceListView(updatedSuppliers.find(s => s.id === supplierForPriceListView.id) || null); // Refresh view data
    toast({ title: "Éxito", description: "Historial de precios actualizado." });
    setIsSubmitting(false);
    // No cerrar el sub-dialogo de historial aquí, permitir más ediciones.
  };
  
  const handleAddNewPriceToHistory = () => {
    if (!newPriceHistoryEntry.date || !newPriceHistoryEntry.price || !isValid(newPriceHistoryEntry.date)) {
      toast({ title: "Error", description: "Fecha válida y precio son requeridos.", variant: "destructive"});
      return;
    }
    const price = parseFloat(newPriceHistoryEntry.price);
    if (isNaN(price) || price < 0) {
      toast({ title: "Error", description: "Precio inválido.", variant: "destructive"});
      return;
    }
    const newEntry: PriceHistoryEntry = { date: format(newPriceHistoryEntry.date, "yyyy-MM-dd"), price };
    const updatedHistory = [...currentPriceHistory, newEntry].sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date)));
    setCurrentPriceHistory(updatedHistory);
    setNewPriceHistoryEntry({ date: new Date(), price: '' }); 
  };

  const handleRemovePriceFromHistory = (dateToRemove: string) => {
    setCurrentPriceHistory(prev => prev.filter(ph => ph.date !== dateToRemove).sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date))));
  };

  const renderPriceListSection = (
    priceList: SupplierPriceListItem[], 
    listType: 'default' | 'usdCash',
    formType: 'new' | 'edit'
  ) => (
    <div className="space-y-3 border p-3 rounded-md">
      <Label className="text-base font-medium">
        {listType === 'default' ? 'Lista de Precios Estándar' : 'Lista de Precios (USD Efectivo)'}
      </Label>
      {priceList.map((item, index) => {
        const currentPriceEntry = getCurrentPriceFromHistory(item.priceHistory);
        const displayPrice = currentPriceEntry ? parseFloat(currentPriceEntry.price.toFixed(4)).toString() : '';
        return (
        <div key={item.id || `item-${listType}-${formType}-${index}`} className="grid grid-cols-12 gap-2 items-end border-b pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
          <div className="col-span-12 sm:col-span-4 space-y-1">
            {index === 0 && <Label htmlFor={`pl_material_${listType}_${formType}_${index}`} className="text-xs">Materia Prima</Label>}
            <Select 
              value={item.rawMaterialName} 
              onValueChange={(value) => handlePriceListItemChange(index, 'rawMaterialName', value, listType, formType)} 
              disabled={isSubmitting || availableRawMaterials.length === 0}
            >
              <SelectTrigger id={`pl_material_${listType}_${formType}_${index}`} className="h-9"><SelectValue placeholder="Material" /></SelectTrigger>
              <SelectContent>
                {availableRawMaterials.length > 0 ?
                  availableRawMaterials.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>) :
                  <SelectItem value="no-options" disabled>No hay materias primas</SelectItem>
                }
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-1">
            {index === 0 && <Label htmlFor={`pl_price_${listType}_${formType}_${index}`} className="text-xs">Precio Actual (USD)</Label>}
            <Input 
              id={`pl_price_${listType}_${formType}_${index}`} 
              type="number" 
              placeholder="Precio" 
              value={displayPrice} 
              onChange={(e) => handlePriceListItemChange(index, 'currentPrice', e.target.value, listType, formType)} 
              disabled={isSubmitting}
              className="h-9" min="0" step="0.0001"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-1">
            {index === 0 && <Label htmlFor={`pl_unit_${listType}_${formType}_${index}`} className="text-xs">Unidad</Label>}
            <Select 
              value={item.unit} 
              onValueChange={(value) => handlePriceListItemChange(index, 'unit', value, listType, formType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id={`pl_unit_${listType}_${formType}_${index}`} className="h-9"><SelectValue placeholder="Unidad" /></SelectTrigger>
              <SelectContent>{commonUnitOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-2 flex items-end justify-end">
            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePriceListItem(index, listType, formType)} className="h-9 w-9 text-destructive hover:bg-destructive/10" disabled={isSubmitting}>
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )})}
      <Button type="button" variant="outline" size="sm" onClick={() => handleAddPriceListItem(listType, formType)} className="mt-2" disabled={isSubmitting || availableRawMaterials.length === 0}>
        <ListPlus className="mr-2 h-4 w-4" /> Añadir Artículo
      </Button>
      {availableRawMaterials.length === 0 && <p className="text-xs text-destructive pt-1">Añada materias primas en Órdenes de Compra.</p>}
    </div>
  );

  if (isLoading) return (<div className="flex items-center justify-center min-h-[calc(100vh-10rem)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Cargando...</p></div>);

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión de Proveedores" description="Administra información y listas de precios estándar y para pagos en USD Efectivo." icon={Building}
        actions={<Button onClick={() => { resetAddForm(); setIsAddSupplierDialogOpen(true); }} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4" />Añadir Proveedor</Button>}
      />
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Lista de Proveedores</CardTitle><CardDescription>Contacto y precios.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>Contacto</TableHead><TableHead>Teléfono</TableHead><TableHead>Email</TableHead><TableHead>Dirección</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {currentSuppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.contactPerson||'-'}</TableCell><TableCell>{s.phone||'-'}</TableCell><TableCell>{s.email||'-'}</TableCell><TableCell>{s.address||'-'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={()=>handleOpenViewPriceListDialog(s)} disabled={isSubmitting}><Eye className="mr-2 h-4 w-4"/>Ver Listas Precios</DropdownMenuItem>
                        <DropdownMenuItem onClick={()=>handleOpenEditDialog(s)} disabled={isSubmitting}><Edit className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={()=>handleOpenDeleteDialog(s.id)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive" disabled={isSubmitting}><Trash2 className="mr-2 h-4 w-4"/>Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {currentSuppliers.length===0 && !isLoading && <p className="text-center text-muted-foreground py-8">No hay proveedores.</p>}
        </CardContent>
      </Card>

      <Dialog open={isAddSupplierDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsAddSupplierDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Añadir Proveedor</DialogTitle><DialogDescription>Detalles y listas de precios.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-220px)] p-1 pr-3">
            <div className="grid gap-4 py-4">
              <div className="space-y-1"><Label htmlFor="new_supplier_name">Nombre</Label><Input id="new_supplier_name" value={newSupplierName} onChange={(e)=>setNewSupplierName(e.target.value)} placeholder="Harinas S.A." disabled={isSubmitting}/></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="new_contact_person">Contacto</Label><Input id="new_contact_person" value={newContactPerson} onChange={(e)=>setNewContactPerson(e.target.value)} placeholder="Ana R." disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="new_phone">Teléfono</Label><Input id="new_phone" type="tel" value={newPhone} onChange={(e)=>setNewPhone(e.target.value)} placeholder="555-1234" disabled={isSubmitting}/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="new_email">Email</Label><Input id="new_email" type="email" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} placeholder="contacto@a.com" disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="new_address">Dirección</Label><Input id="new_address" value={newAddress} onChange={(e)=>setNewAddress(e.target.value)} placeholder="Av. Principal" disabled={isSubmitting}/></div>
              </div>
              <Tabs defaultValue="defaultPrices" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="defaultPrices">Precios Estándar</TabsTrigger>
                  <TabsTrigger value="usdCashPrices">Precios USD Efectivo</TabsTrigger>
                </TabsList>
                <TabsContent value="defaultPrices" className="mt-2">{renderPriceListSection(newPriceList, 'default', 'new')}</TabsContent>
                <TabsContent value="usdCashPrices" className="mt-2">{renderPriceListSection(newPriceListUSDCash, 'usdCash', 'new')}</TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t"><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button onClick={handleAddSupplier} disabled={isSubmitting}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<PlusCircle className="mr-2 h-4 w-4"/>}{isSubmitting?'Guardando...':'Guardar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditSupplierDialogOpen} onOpenChange={(isOpen) => { if(!isSubmitting) setIsEditSupplierDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Editar Proveedor</DialogTitle><DialogDescription>Actualizar detalles y listas de precios.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-220px)] p-1 pr-3">
            <div className="grid gap-4 py-4">
              <div className="space-y-1"><Label htmlFor="edit_supplier_name">Nombre</Label><Input id="edit_supplier_name" value={editSupplierName} onChange={(e)=>setEditSupplierName(e.target.value)} disabled={isSubmitting}/></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="edit_contact_person">Contacto</Label><Input id="edit_contact_person" value={editContactPerson} onChange={(e)=>setEditContactPerson(e.target.value)} disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="edit_phone">Teléfono</Label><Input id="edit_phone" type="tel" value={editPhone} onChange={(e)=>setEditPhone(e.target.value)} disabled={isSubmitting}/></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label htmlFor="edit_email">Email</Label><Input id="edit_email" type="email" value={editEmail} onChange={(e)=>setEditEmail(e.target.value)} disabled={isSubmitting}/></div>
                <div className="space-y-1"><Label htmlFor="edit_address">Dirección</Label><Input id="edit_address" value={editAddress} onChange={(e)=>setEditAddress(e.target.value)} disabled={isSubmitting}/></div>
              </div>
              <Tabs defaultValue="defaultPrices" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="defaultPrices">Precios Estándar</TabsTrigger>
                  <TabsTrigger value="usdCashPrices">Precios USD Efectivo</TabsTrigger>
                </TabsList>
                <TabsContent value="defaultPrices" className="mt-2">{renderPriceListSection(editPriceList, 'default', 'edit')}</TabsContent>
                <TabsContent value="usdCashPrices" className="mt-2">{renderPriceListSection(editPriceListUSDCash, 'usdCash', 'edit')}</TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t"><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button onClick={handleUpdateSupplier} disabled={isSubmitting}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Edit className="mr-2 h-4 w-4"/>}{isSubmitting?'Guardando...':'Guardar Cambios'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen)=>{if(!isSubmitting)setIsDeleteConfirmDialogOpen(isOpen)}}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Confirmar Eliminación</DialogTitle><DialogDescription>¿Eliminar este proveedor?</DialogDescription></DialogHeader><DialogFooter className="sm:justify-end"><DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancelar</Button></DialogClose><Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>{isSubmitting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Trash2 className="mr-2 h-4 w-4"/>}{isSubmitting?'Eliminando...':'Eliminar'}</Button></DialogFooter></DialogContent></Dialog>
      
      <Dialog open={isViewPriceListDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) { setIsViewPriceListDialogOpen(isOpen); if (!isOpen) setEditingPriceHistoryFor(null); } }}>
        <DialogContent className="sm:max-w-3xl flex flex-col max-h-[85vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Listas de Precios de: {supplierForPriceListView?.name}</DialogTitle>
          </DialogHeader>
          <Tabs value={activePriceListTab} onValueChange={(value) => setActivePriceListTab(value as 'default' | 'usdCash')} className="w-full mt-2 flex flex-col flex-1 min-h-0">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="default">Precios Estándar</TabsTrigger>
              <TabsTrigger value="usdCash">Precios USD Efectivo</TabsTrigger>
            </TabsList>
            <TabsContent value="default" className="flex-1 overflow-y-auto p-4">
                {renderPriceHistoryList(supplierForPriceListView?.priceList || [], 'default')}
            </TabsContent>
            <TabsContent value="usdCash" className="flex-1 overflow-y-auto p-4">
                {renderPriceHistoryList(supplierForPriceListView?.priceListUSDCash || [], 'usdCash')}
            </TabsContent>
          </Tabs>
          <DialogFooter className="pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => { if(!isSubmitting) { setIsViewPriceListDialogOpen(false); setEditingPriceHistoryFor(null); } }} disabled={isSubmitting}>
              {editingPriceHistoryFor ? "Cerrar Edición de Historial" : "Cerrar Vista de Precios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderPriceHistoryList(priceList: SupplierPriceListItem[], listType: 'default' | 'usdCash') {
    return priceList.length > 0 ? (
      priceList.map(item => (
        <Card key={item.id} className="mb-3">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">{item.rawMaterialName} <span className="text-sm text-muted-foreground">({item.unit})</span></CardTitle>
              <Button variant="ghost" size="sm" onClick={() => handleOpenEditPriceHistoryDialog(supplierForPriceListView!.id, item.id, item.rawMaterialName, item.unit, item.priceHistory, listType)} disabled={isSubmitting || editingPriceHistoryFor?.itemId === item.id && editingPriceHistoryFor?.listType === listType}>
                 <Edit className="mr-1 h-3 w-3"/> {editingPriceHistoryFor?.itemId === item.id && editingPriceHistoryFor?.listType === listType ? "Editando..." : "Historial"}
              </Button>
            </div>
            <CardDescription>
                Precio Actual: <strong><FormattedNumber value={getCurrentPriceFromHistory(item.priceHistory)?.price} prefix="$" decimalPlaces={4}/></strong> (Actualizado: {getCurrentPriceFromHistory(item.priceHistory)?.date ? format(parseISO(getCurrentPriceFromHistory(item.priceHistory)!.date), "dd/MM/yy", {locale: es}) : 'N/A'})
            </CardDescription>
          </CardHeader>
          {editingPriceHistoryFor?.itemId === item.id && editingPriceHistoryFor?.listType === listType && (
          <CardContent className="px-4 pb-3 pt-1">
            <Label className="text-xs font-semibold">Historial de Precios:</Label>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 mt-1 text-xs space-y-1">
                {currentPriceHistory.length > 0 ? currentPriceHistory.map((entry, index) => {
                    let comparisonText = null;
                    if (index < currentPriceHistory.length - 1) {
                      const previousEntry = currentPriceHistory[index + 1];
                      const priceDiff = entry.price - previousEntry.price;
                      const percentageDiff = previousEntry.price !== 0 ? (priceDiff / previousEntry.price) * 100 : (entry.price > 0 ? 100 : 0);
                      const timeDiffStr = formatDistanceStrict(parseISO(entry.date), parseISO(previousEntry.date), { locale: es, addSuffix: false });
                      const diffColor = priceDiff > 0 ? "text-red-500 dark:text-red-400" : priceDiff < 0 ? "text-green-500 dark:text-green-400" : "text-muted-foreground";
                      comparisonText = (
                        <span className={cn("text-[0.7rem] ml-1", diffColor)}>
                          (<FormattedNumber value={priceDiff} prefix={priceDiff > 0 ? '+' : ''} decimalPlaces={4} />
                          {` / ${priceDiff > 0 ? '+' : ''}${percentageDiff.toFixed(1)}% tras ${timeDiffStr}`})
                        </span>
                      );
                    }
                    return (
                      <div key={`${entry.date}-${index}`} className="flex justify-between items-center hover:bg-muted/50 p-0.5 rounded-sm">
                        <div>
                          <span className="font-medium">{format(parseISO(entry.date), "dd/MM/yy", {locale: es})}: <FormattedNumber value={entry.price} prefix="$" decimalPlaces={4}/></span>
                          {comparisonText}
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/70 hover:bg-destructive/10" onClick={() => handleRemovePriceFromHistory(entry.date)} disabled={isSubmitting}><Trash className="h-3 w-3"/></Button>
                      </div>
                    );
                }) : <p className="text-muted-foreground text-center text-xs py-1">Sin historial para este ítem.</p>}
            </div>
            <div className="mt-2 flex items-end space-x-2">
                <div className="flex-grow space-y-0.5">
                    <Label htmlFor="new_ph_date_view" className="text-xs">Fecha</Label>
                    <Popover><PopoverTrigger asChild><Button id="new_ph_date_view" variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs" disabled={isSubmitting}><CalendarIcon className="mr-1 h-3 w-3"/>{newPriceHistoryEntry.date ? format(newPriceHistoryEntry.date,"dd/MM/yy", {locale: es}) : "Elige"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newPriceHistoryEntry.date} onSelect={d => setNewPriceHistoryEntry(p=>({...p, date:d}))} initialFocus locale={es} disabled={isSubmitting}/></PopoverContent></Popover>
                </div>
                <div className="space-y-0.5">
                    <Label htmlFor="new_ph_price_view" className="text-xs">Precio (USD)</Label>
                    <Input id="new_ph_price_view" type="number" value={newPriceHistoryEntry.price} onChange={e=>setNewPriceHistoryEntry(p=>({...p,price:e.target.value}))} className="h-8 text-xs" placeholder="Ej: 10.50" disabled={isSubmitting} step="0.0001"/>
                </div>
                <Button size="sm" onClick={handleAddNewPriceToHistory} className="h-8 text-xs" disabled={isSubmitting}><PlusCircle className="mr-1 h-3 w-3"/>Añadir</Button>
            </div>
            <Button size="sm" onClick={handleSavePriceHistoryChange} className="w-full mt-3 h-8 text-xs" disabled={isSubmitting}>{isSubmitting?<Loader2 className="mr-1 h-3 w-3 animate-spin"/>:"Guardar Cambios al Historial"}</Button>
          </CardContent>
          )}
        </Card>
      ))
    ) : (<p className="text-muted-foreground py-4 text-center">No hay precios en esta lista para {supplierForPriceListView?.name}.</p>);
  }
}
