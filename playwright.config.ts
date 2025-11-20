import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests E2E
 * Ver https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests/e2e',

    /* Tiempo máximo por test */
    timeout: 30 * 1000,

    /* Configuración de expect */
    expect: {
        timeout: 5000
    },

    /* Ejecutar tests en paralelo */
    fullyParallel: true,

    /* Fallar el build si dejas test.only en el CI */
    forbidOnly: !!process.env.CI,

    /* Reintentos en CI */
    retries: process.env.CI ? 2 : 0,

    /* Workers para paralelización */
    workers: process.env.CI ? 1 : undefined,

    /* Reporter: HTML en desarrollo, GitHub Actions en CI */
    reporter: process.env.CI ? 'github' : 'html',

    /* Configuración compartida para todos los proyectos */
    use: {
        /* URL base para usar en navegación */
        baseURL: 'http://localhost:3000',

        /* Captura de pantalla solo en fallos */
        screenshot: 'only-on-failure',

        /* Video solo en fallos */
        video: 'retain-on-failure',

        /* Traza en primer intento fallido */
        trace: 'on-first-retry',
    },

    /* Configurar proyectos para diferentes navegadores */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        // Descomentar si quieres probar en más navegadores
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },

        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },

        /* Tests en móvil */
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] },
        // },
    ],

    /* Ejecutar servidor de desarrollo antes de los tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
