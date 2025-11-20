

"use client";

import { useState, useEffect, useCallback } from 'react';
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
import { Users, PlusCircle, MoreHorizontal, Briefcase, Edit, Trash2, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { saveEmployeesData, type Employee, KEYS, loadFromLocalStorageForBranch, getActiveBranchId, availableBranches } from '@/lib/data-storage';
import { FormattedNumber } from '@/components/ui/formatted-number';

export default function EmployeesPage() {
  const { toast } = useToast();
  const [currentEmployees, setCurrentEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeBranchName, setActiveBranchName] = useState<string>('');

  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeeContact, setNewEmployeeContact] = useState('');
  const [newEmployeeHireDate, setNewEmployeeHireDate] = useState<Date | undefined>(undefined);
  const [newEmployeeSalary, setNewEmployeeSalary] = useState('');

  const [isEditEmployeeDialogOpen, setIsEditEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeRole, setEditEmployeeRole] = useState('');
  const [editEmployeeContact, setEditEmployeeContact] = useState('');
  const [editEmployeeHireDate, setEditEmployeeHireDate] = useState<Date | undefined>(undefined);
  const [editEmployeeSalary, setEditEmployeeSalary] = useState('');

  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = useState(false);
  const [employeeToDeleteId, setEmployeeToDeleteId] = useState<string | null>(null);
  const [isAddHireDatePickerOpen, setIsAddHireDatePickerOpen] = useState(false);
  const [isEditHireDatePickerOpen, setIsEditHireDatePickerOpen] = useState(false);

  const loadPageData = useCallback(() => {
    setIsLoading(true);
    const currentActiveBranchId = getActiveBranchId();
    const branchInfo = availableBranches.find(b => b.id === currentActiveBranchId);
    setActiveBranchName(branchInfo ? branchInfo.name : 'Desconocida');

    if (currentActiveBranchId) {
      setCurrentEmployees([...loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, currentActiveBranchId)]);
    } else {
      setCurrentEmployees([]);
      toast({ title: "Error de Sede", description: "No se pudo determinar la sede activa para cargar los empleados.", variant: "destructive" });
    }
    setNewEmployeeHireDate(new Date());
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadPageData();
    const handleDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.key === KEYS.EMPLOYEES || customEvent.detail?.key === KEYS.ACTIVE_BRANCH_ID) {
        loadPageData();
      }
    };
    window.addEventListener('data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [loadPageData]);

  const resetAddForm = () => {
    setNewEmployeeName('');
    setNewEmployeeRole('');
    setNewEmployeeContact('');
    setNewEmployeeHireDate(new Date());
    setNewEmployeeSalary('');
  };

  const handleAddEmployee = () => {
    setIsSubmitting(true);
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Sede", description: "No se puede añadir empleado sin sede activa.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    if (!newEmployeeName || !newEmployeeRole || !newEmployeeContact || !newEmployeeHireDate || !newEmployeeSalary) {
      toast({ title: "Error", description: "Todos los campos son obligatorios.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    const salaryNum = parseFloat(newEmployeeSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
        toast({ title: "Error", description: "El salario debe ser un número positivo.", variant: "destructive" });
        setIsSubmitting(false); return;
    }

    const newEmployee: Employee = {
      id: `EMP${Date.now().toString().slice(-4)}${Math.floor(Math.random()*100)}`,
      name: newEmployeeName,
      role: newEmployeeRole,
      contact: newEmployeeContact,
      hireDate: format(newEmployeeHireDate, "yyyy-MM-dd"),
      status: 'Activo',
      salary: salaryNum,
    };
    const branchEmployees = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchId);
    const updatedEmployees = [newEmployee, ...branchEmployees];
    saveEmployeesData(activeBranchId, updatedEmployees);
    setCurrentEmployees(updatedEmployees); // Actualizar estado local para UI
    toast({ title: "Éxito", description: `Empleado añadido a sede ${activeBranchName}.` });
    setIsAddEmployeeDialogOpen(false);
    resetAddForm();
    setIsSubmitting(false);
  };

  const handleOpenEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditEmployeeName(employee.name);
    setEditEmployeeRole(employee.role);
    setEditEmployeeContact(employee.contact);
    setEditEmployeeHireDate(parseISO(employee.hireDate));
    setEditEmployeeSalary(employee.salary?.toString() || '');
    setIsEditEmployeeDialogOpen(true);
  };

  const handleUpdateEmployee = () => {
    setIsSubmitting(true);
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Sede", description: "No se puede actualizar empleado sin sede activa.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    if (!editingEmployee || !editEmployeeName || !editEmployeeRole || !editEmployeeContact || !editEmployeeHireDate || !editEmployeeSalary) {
      toast({ title: "Error", description: "Todos los campos son obligatorios.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    const salaryNum = parseFloat(editEmployeeSalary);
    if (isNaN(salaryNum) || salaryNum <= 0) {
        toast({ title: "Error", description: "El salario debe ser un número positivo.", variant: "destructive" });
        setIsSubmitting(false); return;
    }
    const branchEmployees = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchId);
    const updatedEmployees = branchEmployees.map(e =>
      e.id === editingEmployee.id
      ? {
          ...e,
          name: editEmployeeName,
          role: editEmployeeRole,
          contact: editEmployeeContact,
          hireDate: format(editEmployeeHireDate, "yyyy-MM-dd"),
          salary: salaryNum,
        }
      : e
    );
    saveEmployeesData(activeBranchId, updatedEmployees);
    setCurrentEmployees(updatedEmployees);
    toast({ title: "Éxito", description: `Empleado actualizado en sede ${activeBranchName}.` });
    setIsEditEmployeeDialogOpen(false);
    setEditingEmployee(null);
    setIsSubmitting(false);
  };

  const handleOpenDeleteDialog = (employeeId: string) => {
    setEmployeeToDeleteId(employeeId);
    setIsDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    setIsSubmitting(true);
    const activeBranchId = getActiveBranchId();
    if (!activeBranchId) {
      toast({ title: "Error de Sede", description: "No se puede eliminar empleado sin sede activa.", variant: "destructive" });
      setIsSubmitting(false); return;
    }
    if (employeeToDeleteId) {
      const branchEmployees = loadFromLocalStorageForBranch<Employee[]>(KEYS.EMPLOYEES, activeBranchId);
      const updatedEmployees = branchEmployees.filter(e => e.id !== employeeToDeleteId);
      saveEmployeesData(activeBranchId, updatedEmployees);
      setCurrentEmployees(updatedEmployees);
      toast({ title: "Éxito", description: `Empleado eliminado de sede ${activeBranchName}.` });
      setIsDeleteConfirmDialogOpen(false);
      setEmployeeToDeleteId(null);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Cargando empleados de la sede {activeBranchName}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Gestión de Empleados (Sede: ${activeBranchName})`}
        description="Gestiona la información de tu personal, roles y asistencia para la sede activa."
        icon={Users}
        actions={
          <Button onClick={() => { resetAddForm(); setIsAddEmployeeDialogOpen(true); }} disabled={isSubmitting || isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Empleado (Sede Actual)
          </Button>
        }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Lista de Personal (Sede: {activeBranchName})</CardTitle>
          <CardDescription>Detalles de todos los empleados de la sede activa.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Fecha de Contratación</TableHead>
                <TableHead>Salario Semanal ($)</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      {employee.role}
                    </div>
                  </TableCell>
                  <TableCell>{employee.contact}</TableCell>
                  <TableCell>{format(parseISO(employee.hireDate), "dd/MM/yyyy", { locale: es })}</TableCell>
                  <TableCell><FormattedNumber value={employee.salary} prefix="$" /></TableCell>
                  <TableCell>{employee.status}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isSubmitting}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(employee)} disabled={isSubmitting}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleOpenDeleteDialog(employee.id)}
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
          {currentEmployees.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-8">No hay empleados registrados para la sede {activeBranchName}.</p>}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={isAddEmployeeDialogOpen} onOpenChange={(isOpen) => {if(!isSubmitting) setIsAddEmployeeDialogOpen(isOpen)}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Empleado (Sede: {activeBranchName})</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del nuevo miembro del personal para la sede actual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="add_employee_name">Nombre Completo</Label>
              <Input id="add_employee_name" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} placeholder="ej., Ana López" disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add_role">Rol</Label>
              <Input id="add_role" value={newEmployeeRole} onChange={(e) => setNewEmployeeRole(e.target.value)} placeholder="ej., Jefa de Panadería" disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add_contact">Número de Contacto</Label>
              <Input id="add_contact" type="tel" value={newEmployeeContact} onChange={(e) => setNewEmployeeContact(e.target.value)} placeholder="ej., 555-0101" disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add_hire_date">Fecha de Contratación</Label>
              <Popover open={isAddHireDatePickerOpen} onOpenChange={setIsAddHireDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button id="add_hire_date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !newEmployeeHireDate && "text-muted-foreground")} disabled={isSubmitting}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newEmployeeHireDate ? format(newEmployeeHireDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={newEmployeeHireDate} onSelect={(date) => { setNewEmployeeHireDate(date); setIsAddHireDatePickerOpen(false); }} initialFocus locale={es} disabled={isSubmitting}/>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add_salary">Salario Semanal ($)</Label>
              <Input id="add_salary" type="number" value={newEmployeeSalary} onChange={(e) => setNewEmployeeSalary(e.target.value)} placeholder="ej., 3000" disabled={isSubmitting}/>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {if(!isSubmitting) setIsAddEmployeeDialogOpen(false)}} disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleAddEmployee} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Guardando..." : "Guardar Empleado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={isEditEmployeeDialogOpen} onOpenChange={(isOpen) => {if(!isSubmitting) setIsEditEmployeeDialogOpen(isOpen)}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Empleado (Sede: {activeBranchName})</DialogTitle>
            <DialogDescription>
              Actualiza los detalles del miembro del personal para la sede actual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="edit_employee_name">Nombre Completo</Label>
              <Input id="edit_employee_name" value={editEmployeeName} onChange={(e) => setEditEmployeeName(e.target.value)} disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_role">Rol</Label>
              <Input id="edit_role" value={editEmployeeRole} onChange={(e) => setEditEmployeeRole(e.target.value)} disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_contact">Número de Contacto</Label>
              <Input id="edit_contact" type="tel" value={editEmployeeContact} onChange={(e) => setEditEmployeeContact(e.target.value)} disabled={isSubmitting}/>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_hire_date">Fecha de Contratación</Label>
                <Popover open={isEditHireDatePickerOpen} onOpenChange={setIsEditHireDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button id="edit_hire_date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !editEmployeeHireDate && "text-muted-foreground")} disabled={isSubmitting}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editEmployeeHireDate ? format(editEmployeeHireDate, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={editEmployeeHireDate} onSelect={(date) => { setEditEmployeeHireDate(date); setIsEditHireDatePickerOpen(false); }} initialFocus locale={es} disabled={isSubmitting}/>
                  </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_salary">Salario Semanal ($)</Label>
              <Input id="edit_salary" type="number" value={editEmployeeSalary} onChange={(e) => setEditEmployeeSalary(e.target.value)} disabled={isSubmitting}/>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {if(!isSubmitting){setIsEditEmployeeDialogOpen(false); setEditingEmployee(null);}}} disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button type="button" onClick={handleUpdateEmployee} disabled={isSubmitting}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={(isOpen) => {if(!isSubmitting) setIsDeleteConfirmDialogOpen(isOpen)}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar a este empleado de la sede {activeBranchName}? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => {if(!isSubmitting){setIsDeleteConfirmDialogOpen(false); setEmployeeToDeleteId(null)}}} disabled={isSubmitting}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isSubmitting ? "Eliminando..." : "Eliminar Empleado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    
