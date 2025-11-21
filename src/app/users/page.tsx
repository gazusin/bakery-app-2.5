"use client";

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { getAllUsers, createUser, updateUserPartial, deleteUser } from '@/lib/user-management';
import { User, UserRole, CreateUserInput } from '@/lib/types/user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Edit, Trash2, Shield, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function UsersPage() {
    const { currentUser, isAdmin } = useUser();
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>(getAllUsers());
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form states
    const [formData, setFormData] = useState<Partial<CreateUserInput>>({
        username: '',
        password: '',
        fullName: '',
        email: '',
        role: UserRole.EMPLOYEE,
        assignedBranches: ['panaderia_principal'],
    });

    const refreshUsers = () => {
        setUsers(getAllUsers());
    };

    const handleCreateUser = () => {
        try {
            if (!formData.username || !formData.password || !formData.fullName || !formData.role) {
                toast({
                    title: "Error de Validación",
                    description: "Completa todos los campos requeridos",
                    variant: "destructive",
                });
                return;
            }

            createUser(formData as CreateUserInput);

            toast({
                title: "Usuario Creado",
                description: `Usuario ${formData.username} creado exitosamente`,
            });

            setIsCreateDialogOpen(false);
            setFormData({
                username: '',
                password: '',
                fullName: '',
                email: '',
                role: UserRole.EMPLOYEE,
                assignedBranches: ['panaderia_principal'],
            });
            refreshUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleUpdateUser = () => {
        if (!editingUser) return;

        try {
            updateUserPartial({
                id: editingUser.id,
                fullName: formData.fullName,
                email: formData.email,
                role: formData.role,
                assignedBranches: formData.assignedBranches,
                isActive: editingUser.isActive,
            });

            toast({
                title: "Usuario Actualizado",
                description: `Usuario ${editingUser.username} actualizado exitosamente`,
            });

            setEditingUser(null);
            refreshUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleToggleActive = (user: User) => {
        try {
            updateUserPartial({
                id: user.id,
                isActive: !user.isActive,
            });

            toast({
                title: user.isActive ? "Usuario Desactivado" : "Usuario Activado",
                description: `Usuario ${user.username} ${user.isActive ? 'desactivado' : 'activado'} exitosamente`,
            });

            refreshUsers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const getRoleBadge = (role: UserRole) => {
        const variants: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            [UserRole.ADMIN]: { label: 'Admin', variant: 'destructive' },
            [UserRole.MANAGER]: { label: 'Gerente', variant: 'default' },
            [UserRole.EMPLOYEE]: { label: 'Empleado', variant: 'secondary' },
            [UserRole.VIEWER]: { label: 'Visor', variant: 'outline' },
        };

        const config = variants[role];
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="w-96">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <Shield className="h-5 w-5" />
                            Acceso Denegado
                        </CardTitle>
                        <CardDescription>
                            Solo los administradores pueden acceder a esta página.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-muted-foreground">
                        Administra usuarios, roles y permisos del sistema
                    </p>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Nuevo Usuario
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                            <DialogDescription>
                                Completa la información del nuevo usuario
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Nombre de Usuario *</Label>
                                <Input
                                    id="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="ej. jdoe"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Contraseña *</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fullName">Nombre Completo *</Label>
                                <Input
                                    id="fullName"
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="ej. Juan Pérez"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="ej. juan@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role">Rol *</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={UserRole.ADMIN}>Administrador</SelectItem>
                                        <SelectItem value={UserRole.MANAGER}>Gerente</SelectItem>
                                        <SelectItem value={UserRole.EMPLOYEE}>Empleado</SelectItem>
                                        <SelectItem value={UserRole.VIEWER}>Visor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleCreateUser}>Crear Usuario</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios del Sistema</CardTitle>
                    <CardDescription>
                        {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Nombre Completo</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Último Acceso</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.fullName}</TableCell>
                                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.email || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                                            {user.isActive ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('es-VE') : 'Nunca'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingUser(user);
                                                            setFormData({
                                                                fullName: user.fullName,
                                                                email: user.email,
                                                                role: user.role,
                                                                assignedBranches: user.assignedBranches,
                                                            });
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Editar Usuario</DialogTitle>
                                                        <DialogDescription>
                                                            Modifica la información de {user.username}
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="space-y-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="edit-fullName">Nombre Completo</Label>
                                                            <Input
                                                                id="edit-fullName"
                                                                value={formData.fullName}
                                                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label htmlFor="edit-email">Email</Label>
                                                            <Input
                                                                id="edit-email"
                                                                type="email"
                                                                value={formData.email}
                                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label htmlFor="edit-role">Rol</Label>
                                                            <Select
                                                                value={formData.role}
                                                                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value={UserRole.ADMIN}>Administrador</SelectItem>
                                                                    <SelectItem value={UserRole.MANAGER}>Gerente</SelectItem>
                                                                    <SelectItem value={UserRole.EMPLOYEE}>Empleado</SelectItem>
                                                                    <SelectItem value={UserRole.VIEWER}>Visor</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={() => setEditingUser(null)}>
                                                            Cancelar
                                                        </Button>
                                                        <Button onClick={handleUpdateUser}>Guardar Cambios</Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={user.isActive}
                                                    onCheckedChange={() => handleToggleActive(user)}
                                                    disabled={user.id === currentUser?.id}
                                                />
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
