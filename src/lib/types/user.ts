// Types for User Management and Audit System

export interface User {
    id: string;
    username: string;
    passwordHash: string;
    fullName: string;
    email?: string;
    role: UserRole;
    assignedBranches: string[];
    isActive: boolean;
    createdAt: string;
    createdBy: string;
    lastLogin?: string;
    photoUrl?: string;
}

export enum UserRole {
    ADMIN = 'admin',           // Acceso completo
    MANAGER = 'manager',       // Ver todo, editar operaciones
    EMPLOYEE = 'employee',     // Solo operaciones básicas
    VIEWER = 'viewer',         // Solo lectura
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    action: AuditAction;
    module: string;
    entityType: string;
    entityId?: string;
    changes?: {
        before: any;
        after: any;
    };
    details?: string;
    branchId?: string;
}

export enum AuditAction {
    CREATE = 'crear',
    UPDATE = 'editar',
    DELETE = 'eliminar',
    EXPORT = 'exportar',
    VIEW = 'ver',
    LOGIN = 'login',
    LOGOUT = 'logout',
}

export interface CreateUserInput {
    username: string;
    password: string;
    fullName: string;
    email?: string;
    role: UserRole;
    assignedBranches: string[];
}

export interface UpdateUserInput {
    id: string;
    fullName?: string;
    email?: string;
    role?: UserRole;
    assignedBranches?: string[];
    isActive?: boolean;
}
