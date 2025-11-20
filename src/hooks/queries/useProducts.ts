import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    loadAllProductsFromAllBranches,
    loadFromLocalStorageForBranch,
    type Product,
    KEYS
} from '@/lib/data-storage';

// Query Keys
export const productsKeys = {
    all: ['products'] as const,
    lists: () => [...productsKeys.all, 'list'] as const,
    list: (branchId?: string) => [...productsKeys.lists(), { branchId }] as const,
    details: () => [...productsKeys.all, 'detail'] as const,
    detail: (id: string, branchId?: string) => [...productsKeys.details(), id, branchId] as const,
};

/**
 * Hook to fetch all products from all branches
 */
export function useProducts(branchId?: string) {
    return useQuery({
        queryKey: productsKeys.list(branchId),
        queryFn: () => {
            if (branchId) {
                return loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId);
            }
            return loadAllProductsFromAllBranches();
        },
        staleTime: 3 * 60 * 1000, // 3 minutes
    });
}

/**
 * Hook to fetch a single product
 */
export function useProduct(productId: string, branchId?: string) {
    return useQuery({
        queryKey: productsKeys.detail(productId, branchId),
        queryFn: () => {
            const products = branchId
                ? loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId)
                : loadAllProductsFromAllBranches();

            return products.find(p => p.id === productId);
        },
        enabled: !!productId,
    });
}

/**
 * Hook to update product stock with optimistic updates
 */
export function useUpdateProductStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            productId,
            branchId,
            newStock
        }: {
            productId: string;
            branchId: string;
            newStock: number
        }) => {
            const products = loadFromLocalStorageForBranch<Product[]>(KEYS.PRODUCTS, branchId);
            const index = products.findIndex(p => p.id === productId);

            if (index !== -1) {
                products[index].stock = newStock;
                localStorage.setItem(`${KEYS.PRODUCTS}_${branchId}`, JSON.stringify(products));
                window.dispatchEvent(new CustomEvent('data-updated', { detail: { key: KEYS.PRODUCTS } }));
            }

            return products[index];
        },
        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: productsKeys.list(variables.branchId) });

            // Snapshot previous value
            const previousProducts = queryClient.getQueryData(productsKeys.list(variables.branchId));

            // Optimistically update
            queryClient.setQueryData(productsKeys.list(variables.branchId), (old: Product[] | undefined) => {
                if (!old) return old;
                return old.map(p =>
                    p.id === variables.productId
                        ? { ...p, stock: variables.newStock }
                        : p
                );
            });

            return { previousProducts };
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousProducts) {
                queryClient.setQueryData(
                    productsKeys.list(variables.branchId),
                    context.previousProducts
                );
            }
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({ queryKey: productsKeys.list(variables.branchId) });
            queryClient.invalidateQueries({ queryKey: productsKeys.all });
        },
    });
}
