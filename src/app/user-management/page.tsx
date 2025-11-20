
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
// import { Button } from '@/components/ui/button'; // No se usa el botón de añadir
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Checkbox } from '@/components/ui/checkbox';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCog } from 'lucide-react'; // Solo se usa UserCog
// import { useToast } from "@/hooks/use-toast";
// import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
// import { Separator } from '@/components/ui/separator';
// import { 
//   type ManagedUser, 
//   type UserPermissions, 
//   availableModulesForPermissions,
// } from '@/lib/data-storage'; // Ya no se gestionan múltiples usuarios aquí


export default function UserManagementPage() {
  // const { toast } = useToast(); // No se usa
  // const [users, setUsers] = useState<ManagedUser[]>([]); // No se usa

  // // Diálogos y estados relacionados eliminados ya que no hay gestión de usuarios múltiples

  // useEffect(() => {
  //   // No se cargan usuarios múltiples
  // }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Usuarios"
        description="Este módulo está deshabilitado en la configuración actual de usuario único (admin)."
        icon={UserCog} 
        // actions={ // Botón de añadir eliminado
        //   <Button onClick={() => { resetAddForm(); setIsAddUserDialogOpen(true); }}>
        //     <PlusCircle className="mr-2 h-4 w-4" />
        //     Añadir Nuevo Usuario
        //   </Button>
        // }
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Información</CardTitle>
          <CardDescription>La gestión de múltiples usuarios y roles no está activa.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            La aplicación está configurada para un único usuario administrador con acceso completo.
            Para gestionar múltiples usuarios, roles y permisos detallados, se requeriría una
            configuración de backend y autenticación más avanzada.
          </p>
        </CardContent>
      </Card>

      {/* Diálogos de Añadir, Editar y Eliminar usuario eliminados */}
    </div>
  );
}
    