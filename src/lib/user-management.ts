import bcrypt from 'bcryptjs';
import { User, UserRole, CreateUserInput, UpdateUserInput, AuditAction } from './types/user';
import { logAudit } from './audit';

const USERS_KEY = 'bakery_users';
const CURRENT_USER_KEY = 'bakery_current_user';

// Usuarios por defecto
const defaultUsers: User[] = [
    {
        id: 'user_admin_001',
        username: 'admin',
        passwordHash: bcrypt.hashSync('admin123', 10),
        fullName: 'Administrador Principal',
        role: UserRole.ADMIN,
        assignedBranches: ['panaderia_principal', 'panaderia_norte'],
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system',
    },
    {
        id: 'user_manager_001',
        username: 'gerente',
        passwordHash: bcrypt.hashSync('gerente123', 10),
        fullName: 'Gerente de Operaciones',
        role: UserRole.MANAGER,
        assignedBranches: ['panaderia_principal'],
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system',
    },
    {
        id: 'user_employee_001',
        username: 'empleado',
        passwordHash: bcrypt.hashSync('empleado123', 10),
        fullName: 'Empleado General',
        role: UserRole.EMPLOYEE,
        assignedBranches: ['panaderia_principal'],
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system',
    },
];

export function initializeUsers() {
    if (typeof window === 'undefined') return;

    const users = localStorage.getItem(USERS_KEY);
    if (!users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    }
}

export function getAllUsers(): User[] {
    if (typeof window === 'undefined') return [];

    const usersJson = localStorage.getItem(USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : defaultUsers;
}

export function getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;

    const userJson = localStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
}

export function setCurrentUser(user: User | null) {
    if (typeof window === 'undefined') return;

    if (user) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: user }));
    } else {
        localStorage.removeItem(CURRENT_USER_KEY);
        window.dispatchEvent(new Event('user-updated'));
    }
}

export function authenticateUser(username: string, password: string): User | null {
    const users = getAllUsers();
    const user = users.find(u =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.isActive &&
        bcrypt.compareSync(password, u.passwordHash)
    );

    if (user) {
        user.lastLogin = new Date().toISOString();
        updateUser(user);
        setCurrentUser(user);

        logAudit({
            userId: user.id,
            userName: user.fullName,
            action: AuditAction.LOGIN,
            module: 'auth',
            entityType: 'session',
            details: 'Inicio de sesión exitoso',
        });
    }

    return user;
}

export function logout() {
    const currentUser = getCurrentUser();

    if (currentUser) {
        logAudit({
            userId: currentUser.id,
            userName: currentUser.fullName,
            action: AuditAction.LOGOUT,
            module: 'auth',
            entityType: 'session',
            details: 'Cierre de sesión',
        });
    }

    setCurrentUser(null);
    localStorage.removeItem('isUserLoggedIn');
}

export function updateUser(user: User) {
    if (typeof window === 'undefined') return;

    const users = getAllUsers();
    const index = users.findIndex(u => u.id === user.id);

    if (index !== -1) {
        users[index] = user;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));

        const currentUser = getCurrentUser();
        if (currentUser?.id === user.id) {
            setCurrentUser(user);
        }
    }
}

export function createUser(input: CreateUserInput): User {
    const currentUser = getCurrentUser();
    const users = getAllUsers();

    if (users.some(u => u.username.toLowerCase() === input.username.toLowerCase())) {
        throw new Error(`El usuario "${input.username}" ya existe`);
    }

    const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        username: input.username,
        passwordHash: bcrypt.hashSync(input.password, 10),
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        assignedBranches: input.assignedBranches,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id || 'system',
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    logAudit({
        userId: currentUser?.id || 'system',
        userName: currentUser?.fullName || 'Sistema',
        action: AuditAction.CREATE,
        module: 'users',
        entityType: 'user',
        entityId: newUser.id,
        details: `Usuario creado: ${newUser.username} (${newUser.fullName})`,
    });

    return newUser;
}

export function updateUserPartial(input: UpdateUserInput) {
    const currentUser = getCurrentUser();
    const users = getAllUsers();
    const userIndex = users.findIndex(u => u.id === input.id);

    if (userIndex === -1) {
        throw new Error('Usuario no encontrado');
    }

    const user = users[userIndex];
    const before = { ...user };

    if (input.fullName !== undefined) user.fullName = input.fullName;
    if (input.email !== undefined) user.email = input.email;
    if (input.role !== undefined) user.role = input.role;
    if (input.assignedBranches !== undefined) user.assignedBranches = input.assignedBranches;
    if (input.isActive !== undefined) user.isActive = input.isActive;

    users[userIndex] = user;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    if (getCurrentUser()?.id === user.id) {
        setCurrentUser(user);
    }

    logAudit({
        userId: currentUser?.id || 'system',
        userName: currentUser?.fullName || 'Sistema',
        action: AuditAction.UPDATE,
        module: 'users',
        entityType: 'user',
        entityId: user.id,
        changes: { before, after: user },
        details: `Usuario actualizado: ${user.username}`,
    });

    return user;
}

export function changePassword(userId: string, newPassword: string) {
    const currentUser = getCurrentUser();
    const users = getAllUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        throw new Error('Usuario no encontrado');
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    updateUser(user);

    logAudit({
        userId: currentUser?.id || userId,
        userName: currentUser?.fullName || user.fullName,
        action: AuditAction.UPDATE,
        module: 'users',
        entityType: 'user',
        entityId: userId,
        details: 'Contraseña actualizada',
    });
}

export function deleteUser(userId: string) {
    const currentUser = getCurrentUser();

    if (currentUser?.id === userId) {
        throw new Error('No puedes eliminar tu propio usuario');
    }

    updateUserPartial({ id: userId, isActive: false });

    logAudit({
        userId: currentUser?.id || 'system',
        userName: currentUser?.fullName || 'Sistema',
        action: AuditAction.DELETE,
        module: 'users',
        entityType: 'user',
        entityId: userId,
        details: 'Usuario desactivado',
    });
}

export function hasRole(user: User | null, role: UserRole): boolean {
    if (!user) return false;
    return user.role === role;
}

export function canAccessBranch(user: User | null, branchId: string): boolean {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    return user.assignedBranches.includes(branchId);
}

export function can(user: User | null, action: string): boolean {
    if (!user) return false;

    if (user.role === UserRole.ADMIN) return true;

    if (user.role === UserRole.MANAGER) {
        return ['ver', 'crear', 'editar', 'exportar'].includes(action);
    }

    if (user.role === UserRole.EMPLOYEE) {
        return ['ver', 'crear'].includes(action);
    }

    if (user.role === UserRole.VIEWER) {
        return action === 'ver';
    }

    return false;
}
