import { db } from './db';
import { Sale, Product, Customer, Payment, Expense } from './types/db-types';
import { KEYS, availableBranches } from './data-storage';
import { AuditLog } from './types/user';

const MIGRATION_FLAG_KEY = 'bakery_db_migration_completed';

export async function migrateDataToIndexedDB() {
    if (typeof window === 'undefined') return;

    const isMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (isMigrated === 'true') {
        console.log('Migration already completed.');
        return;
    }

    console.log('Starting migration to IndexedDB...');

    try {
        await db.transaction('rw', [db.sales, db.products, db.customers, db.expenses, db.auditLogs], async () => {

            // 1. Migrate Sales (Global)
            const salesJson = localStorage.getItem(KEYS.SALES);
            if (salesJson) {
                const sales: Sale[] = JSON.parse(salesJson);
                // Ensure branchId is present (default to first branch if missing)
                const salesWithBranch = sales.map(s => ({
                    ...s,
                    branchId: s.branchId || availableBranches[0].id
                }));
                await db.sales.bulkPut(salesWithBranch);
                console.log(`Migrated ${sales.length} sales.`);
            }

            // 2. Migrate Products (Per Branch)
            for (const branch of availableBranches) {
                const productsKey = `${KEYS.PRODUCTS}_${branch.id}`;
                const productsJson = localStorage.getItem(productsKey);
                if (productsJson) {
                    const products: Product[] = JSON.parse(productsJson);
                    const productsWithBranch = products.map(p => ({
                        ...p,
                        branchId: branch.id
                    }));
                    await db.products.bulkPut(productsWithBranch);
                    console.log(`Migrated ${products.length} products for branch ${branch.name}.`);
                }
            }

            // 3. Migrate Expenses (Per Branch)
            for (const branch of availableBranches) {
                const expensesKey = `${KEYS.EXPENSES}_${branch.id}`;
                const expensesJson = localStorage.getItem(expensesKey);
                if (expensesJson) {
                    const expenses: Expense[] = JSON.parse(expensesJson);
                    const expensesWithBranch = expenses.map(e => ({
                        ...e,
                        branchId: branch.id
                    }));
                    await db.expenses.bulkPut(expensesWithBranch);
                    console.log(`Migrated ${expenses.length} expenses for branch ${branch.name}.`);
                }
            }

            // 4. Migrate Audit Logs (Global/Legacy)
            // Assuming 'bakery_audit_logs' as seen in seed-data or KEYS if it existed there
            const auditLogsJson = localStorage.getItem('bakery_audit_logs');
            if (auditLogsJson) {
                const logs: AuditLog[] = JSON.parse(auditLogsJson);
                await db.auditLogs.bulkPut(logs);
                console.log(`Migrated ${logs.length} audit logs.`);
            }

            // 5. Migrate Customers (Global)
            const customersJson = localStorage.getItem(KEYS.CUSTOMERS);
            if (customersJson) {
                // Customers might be just strings in legacy, need to convert to objects if so
                // But based on seed-data, they are strings in the sales, but maybe stored as objects?
                // Let's assume they might be objects or strings.
                // If strings, we create objects.
                const rawCustomers = JSON.parse(customersJson);
                if (Array.isArray(rawCustomers)) {
                    const customersToSave: Customer[] = rawCustomers.map((c: any) => {
                        if (typeof c === 'string') {
                            return { id: crypto.randomUUID(), name: c, totalDebt: 0 };
                        }
                        return c;
                    });
                    await db.customers.bulkPut(customersToSave);
                    console.log(`Migrated ${customersToSave.length} customers.`);
                }
            }
        });

        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        console.log('Migration completed successfully.');

        // Optional: Clear migrated data from localStorage to free up space
        // localStorage.removeItem(KEYS.SALES);
        // ... (be careful with this, maybe keep for safety for now)

    } catch (error) {
        console.error('Migration failed:', error);
    }
}
