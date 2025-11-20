import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesData as initialSalesDataGlobal, type Sale, KEYS } from '@/lib/data-storage';

// Query Keys
export const salesKeys = {
    all: ['sales'] as const,
    lists: () => [...salesKeys.all, 'list'] as const,
    list: (filters?: any) => [...salesKeys.lists(), { filters }] as const,
    details: () => [...salesKeys.all, 'detail'] as const,
    detail: (id: string) => [...salesKeys.details(), id] as const,
};

/**
 * Hook to fetch all sales with caching
 */
export function useSales() {
    return useQuery({
        queryKey: salesKeys.lists(),
        queryFn: () => {
            // Load from localStorage
            const data = localStorage.getItem(KEYS.SALES);
            return data ? JSON.parse(data) : initialSalesDataGlobal;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Hook to fetch a single sale by ID
 */
export function useSale(saleId: string) {
    return useQuery({
        queryKey: salesKeys.detail(saleId),
        queryFn: () => {
            const data = localStorage.getItem(KEYS.SALES);
            const sales: Sale[] = data ? JSON.parse(data) : initialSalesDataGlobal;
            return sales.find(s => s.id === saleId);
        },
        enabled: !!saleId,
    });
}

/**
 * Hook to add a new sale with optimistic updates
 */
export function useAddSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newSale: Sale) => {
            const data = localStorage.getItem(KEYS.SALES);
            const sales: Sale[] = data ? JSON.parse(data) : [];
            sales.push(newSale);
            localStorage.setItem(KEYS.SALES, JSON.stringify(sales));

            // Dispatch update event
            window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.SALES } }));

            return newSale;
        },
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: salesKeys.all });
        },
    });
}

/**
 * Hook to update an existing sale
 */
export function useUpdateSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Sale> }) => {
            const salesData = localStorage.getItem(KEYS.SALES);
            const sales: Sale[] = salesData ? JSON.parse(salesData) : [];
            const index = sales.findIndex(s => s.id === id);

            if (index !== -1) {
                sales[index] = { ...sales[index], ...data };
                localStorage.setItem(KEYS.SALES, JSON.stringify(sales));
                window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.SALES } }));
            }

            return sales[index];
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: salesKeys.all });
            queryClient.invalidateQueries({ queryKey: salesKeys.detail(variables.id) });
        },
    });
}

/**
 * Hook to delete a sale
 */
export function useDeleteSale() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (saleId: string) => {
            const data = localStorage.getItem(KEYS.SALES);
            const sales: Sale[] = data ? JSON.parse(data) : [];
            const filtered = sales.filter(s => s.id !== saleId);
            localStorage.setItem(KEYS.SALES, JSON.stringify(filtered));
            window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.SALES } }));
            return saleId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesKeys.all });
        },
    });
}
