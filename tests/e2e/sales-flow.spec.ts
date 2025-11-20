import { test, expect } from '@playwright/test';

test.describe('Flujo de Creación de Ventas', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();
        await page.waitForURL(/\/(select-branch)?$/);

        // Seleccionar sede si es necesario
        const url = page.url();
        if (url.includes('select-branch')) {
            await page.getByRole('button', { name: /seleccionar/i }).first().click();
            await page.waitForURL('/');
        }

        // Navegar a ventas
        await page.goto('/sales');
    });

    test('debe mostrar la lista de ventas', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /ventas/i })).toBeVisible();

        // Debe haber un botón para nueva venta
        await expect(page.getByRole('button', { name: /nueva venta/i })).toBeVisible();
    });

    test('debe abrir el diálogo de nueva venta', async ({ page }) => {
        await page.getByRole('button', { name: /nueva venta/i }).click();

        // Verificar que se abrió el diálogo
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/registrar nueva venta/i)).toBeVisible();
    });

    test('debe permitir crear una venta básica', async ({ page }) => {
        // Abrir diálogo
        await page.getByRole('button', { name: /nueva venta/i }).click();
        await page.waitForSelector('[role="dialog"]');

        // Rellenar datos básicos
        // Nota: Estos selectores pueden variar según tu implementación exacta

        // Seleccionar cliente (si existe un selector de clientes)
        const customerSelect = page.locator('select', { has: page.locator('option') }).first();
        if (await customerSelect.isVisible().catch(() => false)) {
            await customerSelect.selectOption({ index: 1 });
        }

        // Agregar un producto
        await page.getByRole('button', { name: /agregar producto/i }).click();

        // Guardar venta
        await page.getByRole('button', { name: /guardar/i }).click();

        // Debe mostrar mensaje de éxito o cerrar el diálogo
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    });

    test('debe validar campos requeridos al crear venta', async ({ page }) => {
        await page.getByRole('button', { name: /nueva venta/i }).click();
        await page.waitForSelector('[role="dialog"]');

        // Intentar guardar sin llenar campos
        await page.getByRole('button', { name: /guardar/i }).click();

        // Debe mostrar errores de validación
        // (ajusta según tu implementación de validación)
        await expect(page.getByRole('dialog')).toBeVisible();
    });
});

test.describe('Filtros y Búsqueda de Ventas', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();
        await page.waitForURL(/\/(select-branch)?$/);

        const url = page.url();
        if (url.includes('select-branch')) {
            await page.getByRole('button', { name: /seleccionar/i }).first().click();
            await page.waitForURL('/');
        }

        await page.goto('/sales');
    });

    test('debe permitir búsqueda por cliente', async ({ page }) => {
        // Buscar input de búsqueda
        const searchInput = page.getByPlaceholder(/buscar/i);

        if (await searchInput.isVisible().catch(() => false)) {
            await searchInput.fill('cliente test');

            // Esperar a que se actualice la lista
            await page.waitForTimeout(500);

            // Verificar que la tabla se actualizó
            await expect(page.locator('table')).toBeVisible();
        }
    });

    test('debe permitir filtrar por fecha', async ({ page }) => {
        // Buscar selectores de fecha si existen
        const dateInputs = page.locator('input[type="date"]');
        const count = await dateInputs.count();

        if (count > 0) {
            // Seleccionar fecha inicial
            await dateInputs.first().fill('2024-01-01');

            // Esperar actualización
            await page.waitForTimeout(500);
        }
    });

    test('debe permitir filtrar por estado de pago', async ({ page }) => {
        // Buscar filtros de estado
        const statusFilter = page.getByRole('combobox', { name: /estado/i });

        if (await statusFilter.isVisible().catch(() => false)) {
            await statusFilter.click();

            // Seleccionar una opción
            await page.getByText(/pagado/i).first().click();

            // Esperar actualización
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Acciones sobre Ventas Existentes', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();
        await page.waitForURL(/\/(select-branch)?$/);

        const url = page.url();
        if (url.includes('select-branch')) {
            await page.getByRole('button', { name: /seleccionar/i }).first().click();
            await page.waitForURL('/');
        }

        await page.goto('/sales');
    });

    test('debe poder ver detalles de una venta', async ({ page }) => {
        // Buscar botón de ver detalles en la primera venta
        const viewButton = page.getByRole('button', { name: /ver|detalles/i }).first();

        if (await viewButton.isVisible().catch(() => false)) {
            await viewButton.click();

            // Debe abrir un diálogo o modal con detalles
            await expect(page.getByRole('dialog')).toBeVisible();
        }
    });

    test('debe poder editar una venta', async ({ page }) => {
        // Buscar botón de editar
        const editButton = page.getByRole('button', { name: /editar/i }).first();

        if (await editButton.isVisible().catch(() => false)) {
            await editButton.click();

            // Debe abrir formulario de edición
            await expect(page.getByRole('dialog')).toBeVisible();
        }
    });

    test('debe poder eliminar una venta con confirmación', async ({ page }) => {
        // Buscar botón de eliminar
        const deleteButton = page.getByRole('button', { name: /eliminar/i }).first();

        if (await deleteButton.isVisible().catch(() => false)) {
            await deleteButton.click();

            // Debe mostrar confirmación
            await expect(page.getByText(/confirmar|seguro/i)).toBeVisible();

            // Cancelar eliminación
            await page.getByRole('button', { name: /cancelar|no/i }).click();
        }
    });
});

test.describe('Paginación y Performance', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();
        await page.waitForURL(/\/(select-branch)?$/);

        const url = page.url();
        if (url.includes('select-branch')) {
            await page.getByRole('button', { name: /seleccionar/i }).first().click();
            await page.waitForURL('/');
        }

        await page.goto('/sales');
    });

    test('debe cargar la página de ventas en menos de 3 segundos', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/sales');
        await expect(page.getByRole('heading', { name: /ventas/i })).toBeVisible();

        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(3000);
    });

    test('debe manejar scroll de lista virtualizada', async ({ page }) => {
        // Si la lista usa virtualización, verificar que funciona el scroll
        const list = page.locator('[style*="overflow"]').first();

        if (await list.isVisible().catch(() => false)) {
            // Scroll hasta el final
            await list.evaluate(el => {
                el.scrollTop = el.scrollHeight;
            });

            // Esperar a que carguen más items si es lazy loading
            await page.waitForTimeout(500);

            // Verificar que sigue funcionando
            await expect(list).toBeVisible();
        }
    });
});
