import { test, expect } from '@playwright/test';

test.describe('Flujo de Login', () => {
    test('debe mostrar la página de login', async ({ page }) => {
        await page.goto('/login');

        await expect(page).toHaveTitle(/Login/i);
        await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
    });

    test('debe permitir login exitoso', async ({ page }) => {
        await page.goto('/login');

        // Rellenar formulario
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');

        // Hacer click en login
        await page.getByRole('button', { name: /iniciar sesión/i }).click();

        // Debe redirigir al dashboard o selección de sede
        await expect(page).toHaveURL(/\/(select-branch)?$/);
    });

    test('debe mostrar error con credenciales inválidas', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder(/nombre de usuario/i).fill('wrong');
        await page.getByPlaceholder(/contraseña/i).fill('wrong');

        await page.getByRole('button', { name: /iniciar sesión/i }).click();

        // Debe mostrar mensaje de error
        await expect(page.getByText(/credenciales incorrectas/i)).toBeVisible();
    });

    test('debe validar campos requeridos', async ({ page }) => {
        await page.goto('/login');

        // Intentar login sin rellenar
        await page.getByRole('button', { name: /iniciar sesión/i }).click();

        // HTML5 validation debe prevenir el submit
        const usernameInput = page.getByPlaceholder(/nombre de usuario/i);
        const isInvalid = await usernameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isInvalid).toBeTruthy();
    });
});

test.describe('Navegación Principal', () => {
    test.beforeEach(async ({ page }) => {
        // Login antes de cada test
        await page.goto('/login');
        await page.getByPlaceholder(/nombre de usuario/i).fill('admin');
        await page.getByPlaceholder(/contraseña/i).fill('admin123');
        await page.getByRole('button', { name: /iniciar sesión/i }).click();
        await page.waitForURL(/\/(select-branch)?$/);

        // Si estamos en select-branch, seleccionar una sede
        if (page.url().includes('select-branch')) {
            await page.getByRole('button', { name: /seleccionar/i }).first().click();
            await page.waitForURL('/');
        }
    });

    test('debe navegar al dashboard', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /panel principal/i })).toBeVisible();
    });

    test('debe navegar a Insights', async ({ page }) => {
        await page.goto('/');

        // Click en Insights en el menú
        await page.getByRole('link', { name: /insights/i }).click();

        await expect(page).toHaveURL('/insights');
        await expect(page.getByRole('heading', { name: /insights del negocio/i })).toBeVisible();
    });

    test('debe navegar a Ventas', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('link', { name: /ventas/i }).click();

        await expect(page).toHaveURL('/sales');
        await expect(page.getByRole('heading', { name: /ventas/i })).toBeVisible();
    });

    test('debe navegar a Inventario', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('link', { name: /inventario/i }).click();

        await expect(page).toHaveURL('/inventory');
        await expect(page.getByRole('heading', { name: /inventario/i })).toBeVisible();
    });
});

test.describe('Theme Toggle', () => {
    test('debe cambiar entre modos claro y oscuro', async ({ page }) => {
        await page.goto('/');

        // Buscar el botón de tema
        const themeButton = page.locator('[role="button"]', { has: page.locator('svg') }).first();
        await themeButton.click();

        // Seleccionar modo oscuro
        await page.getByRole('menuitem', { name: /oscuro/i }).click();

        // Verificar que se aplicó el tema oscuro
        const html = page.locator('html');
        await expect(html).toHaveClass(/dark/);

        // Cambiar a modo claro
        await themeButton.click();
        await page.getByRole('menuitem', { name: /claro/i }).click();

        await expect(html).not.toHaveClass(/dark/);
    });
});
