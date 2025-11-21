"use client";

import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/lib/types/user';
import { getCurrentUser, can as canAction, hasRole, canAccessBranch } from '@/lib/user-management';

/**
 * Hook para acceder al usuario actual y sus permisos
 */
export function useUser() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Cargar usuario inicial
        const user = getCurrentUser();
        setCurrentUser(user);
        setLoading(false);

        // Listener para cambios en el usuario
        const handleUserUpdate = (event: Event) => {
            const customEvent = event as CustomEvent;
            setCurrentUser(customEvent.detail || getCurrentUser());
        };

        window.addEventListener('user-updated', handleUserUpdate);
        window.addEventListener('storage', () => {
            setCurrentUser(getCurrentUser());
        });

        return () => {
            window.removeEventListener('user-updated', handleUserUpdate);
            window.removeEventListener('storage', () => {
                setCurrentUser(getCurrentUser());
            });
        };
    }, []);

    /**
     * Verifica si el usuario puede realizar una acción
     */
    const can = useCallback((action: string) => {
        return canAction(currentUser, action);
    }, [currentUser]);

    /**
     * Verifica si el usuario tiene un rol específico
     */
    const isRole = useCallback((role: UserRole) => {
        return hasRole(currentUser, role);
    }, [currentUser]);

    /**
     * Verifica si el usuario puede acceder a una sede
     */
    const canAccess = useCallback((branchId: string) => {
        return canAccessBranch(currentUser, branchId);
    }, [currentUser]);

    return {
        currentUser,
        loading,
        can,
        isRole,
        canAccess,
        isAdmin: currentUser?.role === UserRole.ADMIN,
        isManager: currentUser?.role === UserRole.MANAGER,
        isEmployee: currentUser?.role === UserRole.EMPLOYEE,
        isViewer: currentUser?.role === UserRole.VIEWER,
    };
}
