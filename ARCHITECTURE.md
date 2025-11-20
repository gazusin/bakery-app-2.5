# Arquitectura del Sistema - Bakery 2.5

## Visión General

Bakery 2.5 es una aplicación web de gestión empresarial construida con arquitectura de componentes moderna, utilizando Next.js como framework principal y localStorage como capa de persistencia temporal.

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│         (Next.js App Router + React Components)             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                        │
│              (Custom Hooks + Utilities)                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Dashboard   │  │  Inventory   │  │  Production  │     │
│  │    Hooks     │  │    Hooks     │  │    Hooks     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  DATA LAYER                                 │
│           (data-storage.ts + crypto-utils.ts)               │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Encryption  │  │  Validation  │  │ Sanitization │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               PERSISTENCE LAYER                             │
│           (Browser localStorage + sessionStorage)           │
└─────────────────────────────────────────────────────────────┘
```

## Estructura de Componentes

### 1. Capa de Presentación (UI)

**Páginas Principales (App Router)**
- `/` - Dashboard global
- `/login` - Autenticación
- `/sales` - Gestión de ventas
- `/inventory` - Control de inventario
- `/production` - Registro de producción
- `/reports` - Reportes y análisis
- Más de 25 módulos adicionales

**Componentes Reutilizables**
```
components/
├── ui/                      # Componentes base (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── dashboard/               # Componentes específicos del dashboard
│   ├── DashboardStats.tsx
│   ├── ActivityFeed.tsx
│   ├── ExchangeRateManager.tsx
│   └── ProductSalesChart.tsx
├── page-header.tsx          # Header reutilizable
└── ErrorBoundary.tsx        # Manejo de errores
```

### 2. Capa de Lógica de Negocio

**Custom Hooks**
- `useDashboardData`: Cálculos de métricas y estadísticas
- `useExchangeRate`: Gestión de tasas de cambio
- `useToast`: Notificaciones al usuario
- Hooks específicos por módulo

**Utilidades**
```
lib/
├── data-storage.ts          # Gestión de datos y localStorage
│   ├── CRUD operations
│   ├── Data conversion
│   ├── Cost calculations
│   └── Business logic
├── crypto-utils.ts          # Seguridad
│   ├── Encryption/Decryption (AES-256)
│   ├── Input sanitization
│   ├── Validation
│   └── Rate limiting
└── utils.ts                 # Helpers generales
```

### 3. Capa de Datos

**Modelo de Datos**

El sistema maneja 35+ interfaces TypeScript para garantizar type-safety:

```typescript
// Ejemplo de interfaces principales
interface Sale {
  id: string;
  date: string;
  itemsPerBranch: SaleBranchDetail[];
  totalAmount: number;
  paymentMethod: 'Pagado' | 'Crédito';
  customerId?: string;
  // ... más campos
}

interface Product {
  id: string;
  name: string;
  stock: number;
  unitPrice: number;
  sourceBranchId: string;
  // ... más campos
}

interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredientItem[];
  costPerUnit: number;
  expectedYield: number;
  // ... más campos
}
```

**Persistencia**

Actualmente usando localStorage con las siguientes características:
- **Keys con prefijo**: Evita colisiones
- **Por sucursal**: Datos separados cuando es necesario
- **Globales**: Datos compartidos (clientes, proveedores)
- **Encriptación**: Datos sensibles encriptados
- **Checksums**: Verificación de integridad

```typescript
// Estructura de keys
const KEYS = {
  // Globales
  SALES: 'bakery_sales_data',
  CUSTOMERS: 'bakery_customers_data',
  
  // Por sucursal (se añade sufijo _branchId)
  PRODUCTS: 'bakery_products_data',        // → bakery_products_data_panaderia_principal
  PRODUCTION_LOG: 'bakery_production_log_data',
  RECIPES: 'bakery_recipes_data',
};
```

## Flujo de Datos

### Ejemplo: Registro de Venta

```
1. Usuario → SalesPage
   ↓
2. Formulario React Hook Form + Zod validation
   ↓
3. onSubmit → sanitizeInputs()
   ↓
4. Business logic:
   - Calcular totales
   - Validar stock
   - Procesar payment splits
   ↓
5. saveToLocalStorage() → encryptData()
   ↓
6. localStorage.setItem()
   ↓
7. dispatchDataUpdateEvent()
   ↓
8. Componentes suscritos se actualizan
   ↓
9. Toast notification → Usuario
```

### Ejemplo: Cálculo de Dashboard Stats

```
1. useEffect en DashboardPage
   ↓
2. calculateDashboardStats()
   ↓
3. Cargar datos de múltiples fuentes:
   - salesData
   - paymentsData
   - productionLogData
   - expensesData
   ↓
4. Filtrar por período (semana actual)
   ↓
5. Calcular métricas:
   - Revenue por sucursal
   - Pérdidas (mermas, cambios, muestras)
   - Ganancias netas
   - Créditos vencidos
   ↓
6. Actualizar estado de componentes
   ↓
7. Re-render con nuevos valores
```

## Patrones de Diseño Utilizados

### 1. **Compound Components**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
```

### 2. **Custom Hooks Pattern**
Encapsular lógica reutilizable:
```tsx
const { data, loading, error } = useDashboardData();
```

### 3. **Provider Pattern**
Para contexto global (Toasts, Theme):
```tsx
<ToastProvider>
  <App />
</ToastProvider>
```

### 4. **Factory Pattern**
Para generación de IDs y estructuras:
```typescript
function generateSaleId(): string {
  return `SALE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### 5. **Observer Pattern**
Para actualizaciones de datos:
```typescript
window.addEventListener('data-updated', handleUpdate);
```

## Estrategia de Optimización

### Performance

1. **Memoización**
```tsx
const expensiveCalculation = useMemo(() => {
  return calculateComplexMetrics(data);
}, [data]);

const handleClick = useCallback(() => {
  doSomething();
}, [dependencies]);
```

2. **Lazy Loading**
```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

3. **Code Splitting**
Next.js hace esto automáticamente por ruta.

4. **Virtualization**
Para listas largas (productos, ventas, etc.)

### Estado y Re-renders

- **Levantamiento de estado mínimo**: Solo lo necesario
- **Composición sobre herencia**: Componentes pequeños y focalizados
- **React.memo** para componentes puros
- **Keys estables** en listas

## Seguridad

Ver [SECURITY.md](./SECURITY.md) para detalles completos.

**Capas de Seguridad**:
1. Input Sanitization
2. Data Validation (Zod schemas)
3. Encryption (AES-256-GCM)
4. Rate Limiting
5. CSRF Protection
6. Data Integrity (Checksums)

## Escalabilidad

### Actual (localStorage)
- ✅ Rápido para prototipo
- ✅ Sin costos de servidor
- ⚠️ Limitado a ~10MB
- ⚠️ Solo cliente, no multi-usuario

### Migración Futura

```
localStorage → Firestore/PostgreSQL
├── Mantener misma arquitectura de componentes
├── Cambiar solo la capa de datos
├── Agregar API layer (tRPC/GraphQL)
└── Implementar sync real-time
```

## Testing Strategy

```
tests/
├── unit/                    # Tests unitarios
│   ├── utils.test.ts
│   ├── crypto-utils.test.ts
│   └── data-storage.test.ts
├── integration/             # Tests de integración
│   └── sales-flow.test.tsx
└── e2e/                     # Tests end-to-end (futuro)
    └── critical-flows.spec.ts
```

## Decisiones de Diseño

### ¿Por qué Next.js App Router?

- ✅ Server Components para mejor performance
- ✅ Streaming y Suspense out-of-the-box
- ✅ Layouts anidados
- ✅ Preparado para SSR cuando se migre

### ¿Por qué localStorage ahora?

- ✅ Desarrollo rápido
- ✅ Sin necesidad de backend
- ✅ Funciona offline
- ⚠️ Temporal, se migrará a base de datos

### ¿Por qué shadcn/ui?

- ✅ Componentes copiables, no npm package
- ✅ Basado en Radix (accesibilidad)
- ✅ Totalmente personalizable
- ✅ TypeScript nativo

### ¿Por qué sin Redux/Zustand?

- React Context + Hooks es suficiente actualmente
- Menos complejidad
- Cuando se migre a DB, se usará React Query/SWR

## Diagramas

### Flujo de Autenticación

```
┌──────┐     login()     ┌─────────┐
│ User │ ──────────────> │  Login  │
└──────┘                 │  Page   │
                         └────┬────┘
                              │
                              ├─> sanitizeInput()
                              │
                              ├─> checkRateLimit()
                              │
                              ├─> validateCredentials()
                              │
                              ├─> generateCSRFToken()
                              │
                              ▼
                         localStorage
                       'isUserLoggedIn'
                              │
                              ▼
                        router.push('/')
```

### Flujo de Datos de Dashboard

```
┌────────────┐
│ Dashboard  │
│   Page     │
└─────┬──────┘
      │
      ├─> loadSalesData()
      ├─> loadPaymentsData()
      ├─> loadProductionData()
      ├─> loadExpensesData()
      │
      ▼
┌─────────────────┐
│ Calculate Stats │
│                 │
│ - Revenue       │
│ - Losses        │
│ - Profits       │
│ - Low Stock     │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│  Update State    │
│  - useState      │
│  - useMemo       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Render UI       │
│  - Stats Cards   │
│  - Charts        │
│  - Activity Feed │
└──────────────────┘
```

## Convenciones de Código

### Nomenclatura
- **Componentes**: PascalCase (`DashboardStats.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useDashboardData.ts`)
- **Utilidades**: camelCase (`formatCurrency`)
- **Constantes**: UPPER_SNAKE_CASE (`KEYS.SALES_DATA`)
- **Tipos**: PascalCase (`Sale`, `Product`)

### Estructura de Archivos
```tsx
// Imports agrupados
import React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import { formatCurrency } from '@/lib/utils';
import type { Sale } from '@/lib/data-storage';

// Tipos locales
interface Props {
  // ...
}

// Componente
export function MyComponent({ }: Props) {
  // Hooks
  const [state, setState] = useState();
  
  // Handlers
  const handleClick = () => {};
  
  // Render
  return <div>...</div>;
}
```

## Conclusión

Esta arquitectura está diseñada para ser:
- **Mantenible**: Código organizado y tipado
- **Escalable**: Fácil migración a backend real
- **Testeable**: Lógica separada de UI
- **Performante**: Optimizaciones en lugares críticos

Para contribuir, sigue las convenciones establecidas y asegúrate de que todo esté tipado con TypeScript.
