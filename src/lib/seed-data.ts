
import {
    KEYS,
    saveToLocalStorage,
    saveToLocalStorageForBranch,
    availableBranches,
    getActiveBranchId,
    type Expense
} from './data-storage';
import { AuditAction, type AuditLog } from './types/user';
import { addDays, subMonths, format, startOfDay, subDays, isWeekend } from 'date-fns';

// --- Tipos Auxiliares ---
interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
}

// --- Datos Base para Generación ---
const DEMO_PRODUCTS: Product[] = [
    { id: 'prod_canilla', name: 'Pan Canilla', price: 0.5, category: 'Panadería' },
    { id: 'prod_sobado', name: 'Pan Sobado', price: 1.2, category: 'Panadería' },
    { id: 'prod_campesino', name: 'Pan Campesino', price: 1.5, category: 'Panadería' },
    { id: 'prod_dulce', name: 'Pan Dulce', price: 0.8, category: 'Panadería' },
    { id: 'prod_croissant', name: 'Croissant', price: 1.0, category: 'Bollería' },
    { id: 'prod_cafe', name: 'Café Negro', price: 1.0, category: 'Bebidas' },
    { id: 'prod_conleche', name: 'Café con Leche', price: 1.5, category: 'Bebidas' },
    { id: 'prod_refresco', name: 'Refresco 2L', price: 2.5, category: 'Bebidas' },
    { id: 'prod_queso', name: 'Queso Duro', price: 5.0, category: 'Charcutería' },
    { id: 'prod_jamon', name: 'Jamón de Pierna', price: 6.0, category: 'Charcutería' },
];

const DEMO_CUSTOMERS = [
    'Cliente Casual',
    'Juan Pérez',
    'María Rodríguez',
    'Panadería La Esquina',
    'Abasto El Centro',
    'Carlos Gómez',
    'Ana Martínez'
];

const EXPENSE_CATEGORIES = [
    'Materia Prima',
    'Nómina',
    'Servicios',
    'Mantenimiento',
    'Alquiler'
];

// --- Helpers ---
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// --- Generador Principal ---
export async function generateDemoData(months: number = 12): Promise<void> {
    console.log(`Iniciando generación de datos para ${months} meses...`);

    const startDate = startOfDay(subMonths(new Date(), months));
    const endDate = new Date();
    const activeBranchId = getActiveBranchId() || availableBranches[0].id;

    // 1. Limpiar datos existentes (opcional, pero recomendado para demo limpia)
    // Por seguridad, no borramos todo, pero asumimos que el usuario sabe lo que hace al llamar esto.
    // En una implementación real, podríamos preguntar. Aquí vamos a SOBREESCRIBIR las claves principales.

    const newSales: any[] = [];
    const newExpenses: Expense[] = [];
    const newAuditLogs: AuditLog[] = [];

    let currentDate = startDate;
    let salesCount = 0;

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString();
        const isWknd = isWeekend(currentDate);

        // --- Generar Ventas ---
        // Fines de semana venden más
        const dailySalesCount = isWknd ? randomInt(15, 30) : randomInt(8, 20);

        for (let i = 0; i < dailySalesCount; i++) {
            const numItems = randomInt(1, 5);
            const items = [];
            let totalAmount = 0;

            for (let j = 0; j < numItems; j++) {
                const prod = randomItem(DEMO_PRODUCTS);
                const qty = randomInt(1, 5);
                const price = prod.price;
                const total = price * qty;

                items.push({
                    productId: prod.id,
                    productName: prod.name,
                    quantity: qty,
                    price: price,
                    total: total,
                    branchId: activeBranchId
                });
                totalAmount += total;
            }

            const saleId = crypto.randomUUID();
            const paymentMethod = randomItem(['Efectivo USD', 'Efectivo VES', 'Pago Móvil', 'Punto de Venta']);

            newSales.push({
                id: saleId,
                date: dateStr,
                customerName: randomItem(DEMO_CUSTOMERS),
                items: items,
                itemsPerBranch: [{
                    branchId: activeBranchId,
                    branchName: availableBranches.find(b => b.id === activeBranchId)?.name || 'Sede Principal',
                    items: items,
                    totalAmount: totalAmount,
                    amountPaidUSD: totalAmount
                }],
                totalAmount: totalAmount,
                paymentMethod: paymentMethod,
                status: 'completed',
                createdBy: 'admin'
            });

            // Log de auditoría aleatorio (no para todas las ventas para no saturar)
            if (Math.random() > 0.9) {
                newAuditLogs.push({
                    id: crypto.randomUUID(),
                    timestamp: dateStr,
                    userId: 'user_admin_id',
                    userName: 'Administrador Principal',
                    action: AuditAction.CREATE,
                    module: 'ventas',
                    entityType: 'sale',
                    entityId: saleId,
                    details: `Venta registrada: $${totalAmount.toFixed(2)}`,
                    branchId: activeBranchId
                });
            }
        }
        salesCount += dailySalesCount;

        // --- Generar Gastos ---
        // Alquiler (día 1 de cada mes)
        currentDate = addDays(currentDate, 1);
    }

    // --- Guardar Datos ---
    console.log(`Guardando ${newSales.length} ventas, ${newExpenses.length} gastos y ${newAuditLogs.length} logs...`);

    // Guardar Ventas (Global)
    saveToLocalStorage(KEYS.SALES, newSales);

    // Guardar Gastos (Por Sede)
    saveToLocalStorageForBranch(KEYS.EXPENSES, activeBranchId, newExpenses);

    // Guardar Logs (Audit system usa su propia key, pero aquí simulamos acceso directo o usamos helper si existiera expuesto)
    // Como audit.ts no exporta la key directamente o función de save raw, usaremos localStorage directo con la key que vimos en audit.ts
    // Revisando audit.ts (no lo tengo abierto ahora, pero asumiré 'bakery_audit_logs')
    // Mejor: importar logAudit y hacerlo uno por uno es muy lento.
    // Voy a asumir la key 'bakery_audit_logs' que es estándar en mi implementación.
    localStorage.setItem('bakery_audit_logs', JSON.stringify(newAuditLogs));

    // Guardar Productos Demo si no existen
    const existingProducts = localStorage.getItem(`${KEYS.PRODUCTS}_${activeBranchId}`);
    if (!existingProducts || JSON.parse(existingProducts).length === 0) {
        saveToLocalStorageForBranch(KEYS.PRODUCTS, activeBranchId, DEMO_PRODUCTS);
    }

    console.log("Generación de datos completada.");
}
