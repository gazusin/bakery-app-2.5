# Guía de Instalación: Sentry Monitoring

## ¿Qué es Sentry?

Sentry es una plataforma de monitoreo de errores y rendimiento que te ayuda a detectar, diagnosticar y resolver problemas en producción en tiempo real.

## Beneficios para Bakery 2.5:
- 🐛 **Detección automática de errores** - Captura excepciones JavaScript/TypeScript
- 📊 **Performance monitoring** - Mide tiempos de carga de páginas
- 🔍 **Stack traces completos** - Ve exactamente dónde ocurrió el error
- 📧 **Alertas por email** - Notificaciones cuando hay errores críticos
- 📈 **Dashboard de métricas** - Visualiza la salud de tu aplicación

---

## Instalación Paso a Paso

### 1. Crear Cuenta en Sentry

1. Ve a [https://sentry.io](https://sentry.io)
2. Crea una cuenta gratuita (hasta 5,000 eventos/mes gratis)
3. Crea un nuevo proyecto:
   - **Platform:** Next.js
   - **Project Name:** Bakery-25 (o el nombre que prefieras)
4. Guarda tu **DSN** (Data Source Name) - lo necesitarás después

**El DSN se ve así:**
```
https://XXXXXXXXXXXXXXXXX@o1234567.ingest.sentry.io/8901234
```

---

### 2. Instalar Dependencias

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
npm install @sentry/nextjs
```

---

### 3. Ejecutar el Wizard de Configuración

```bash
npx @sentry/wizard@latest -i nextjs
```

El wizard te preguntará:
1. **Do you want to set up Sentry for error tracking?** → Yes
2. **Do you want to enable Tracing for performance monitoring?** → Yes (recomendado)
3. **Do you want to create an example page?** → No (ya tenemos la app)
4. **Sentry DSN** → Pega el DSN que copiaste en el paso 1

El wizard creará automáticamente:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Actualizará `next.config.js`

---

### 4. Configuración Manual (Alternativa)

Si prefieres configurar manualmente, crea estos archivos:

#### `sentry.client.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 1.0, // 100% de las transacciones (reduce en producción)
  
  // Session Replay
  replaysOnErrorSampleRate: 1.0, // 100% cuando hay error
  replaysSessionSampleRate: 0.1, // 10% de sesiones normales
  
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Configuración de ambiente
  environment: process.env.NODE_ENV,
  
  // Filtros de errores (opcional)
  beforeSend(event, hint) {
    // Ignora errores específicos si es necesario
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }
    return event;
  },
});
```

#### `sentry.server.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

#### `sentry.edge.config.ts`
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

---

### 5. Agregar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto (si no existe):

```env
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://XXXXXXXXXXXXXXXXX@o1234567.ingest.sentry.io/8901234
SENTRY_ORG=tu-organizacion
SENTRY_PROJECT=bakery-25

# Opcional: Para subir source maps en build
SENTRY_AUTH_TOKEN=tu-auth-token
```

> ⚠️ **IMPORTANTE:** Agrega `.env.local` a tu `.gitignore` para no subir credenciales a Git

---

### 6. Actualizar `next.config.js`

Si el wizard no lo hizo automáticamente, actualiza tu `next.config.js`:

```javascript
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tu configuración existente...
};

module.exports = withSentryConfig(
  nextConfig,
  {
    silent: true, // Suprime logs de Sentry durante build
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  {
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
  }
);
```

---

### 7. Probar Sentry

Crea una página de prueba para verificar que Sentry está funcionando:

#### `src/app/sentry-test/page.tsx`
```typescript
"use client";

import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";

export default function SentryTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Prueba de Sentry</h1>
      
      <div className="space-y-4">
        <Button
          onClick={() => {
            throw new Error("Error de prueba Sentry - Frontend");
          }}
        >
          Generar Error Frontend
        </Button>
        
        <Button
          onClick={() => {
            Sentry.captureMessage("Mensaje de prueba", "info");
          }}
        >
          Enviar Mensaje de Prueba
        </Button>
        
        <Button
          onClick={async () => {
            await fetch("/api/sentry-test");
          }}
        >
          Generar Error Backend
        </Button>
      </div>
    </div>
  );
}
```

#### `src/app/api/sentry-test/route.ts`
```typescript
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    throw new Error("Error de prueba Sentry - Backend");
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Error capturado" }, { status: 500 });
  }
}
```

---

### 8. Verificación

1. Ejecuta `npm run dev`
2. Ve a `http://localhost:3000/sentry-test`
3. Haz clic en los botones de prueba
4. Ve al dashboard de Sentry (https://sentry.io) → Issues
5. Deberías ver los errores aparecer en tiempo real

---

## Uso en Producción

### 1. Reducir Sample Rates

En producción, reduce los sample rates para no exceder tu cuota gratuita:

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% en producción
  replaysSessionSampleRate: 0.01, // 1% en producción
  // ...
});
```

### 2. Configurar Alertas

En el dashboard de Sentry:
1. Ve a **Settings** → **Alerts**
2. Crea una nueva alerta:
   - **When:** An issue is first seen
   - **Then:** Send a notification via Email
3. Configura umbrales personalizados según tu necesidad

### 3. Integrar con Release Tracking

Para trackear versiones y despliegues:

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || "bakery-2.5@1.0.0",
  // ...
});
```

---

## Mejores Prácticas

### 1. Capturar Errores Manualmente

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // Código que puede fallar
  await dangerousOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: "sales",
      action: "create-invoice"
    },
    extra: {
      customerId: "123",
      amount: 100
    }
  });
  
  // Mostrar error al usuario
  toast({ title: "Error", description: "No se pudo crear la factura" });
}
```

### 2. Agregar Contexto de Usuario

```typescript
// Al hacer login
Sentry.setUser({
  id: userProfileData.id,
  username: userProfileData.username,
  email: userProfileData.email
});

// Al hacer logout
Sentry.setUser(null);
```

### 3. Breadcrumbs Personalizados

```typescript
Sentry.addBreadcrumb({
  category: "sales",
  message: "Usuario creó una venta",
  level: "info",
  data: {
    saleId: "SALE-123",
    amount: 150.50
  }
});
```

---

## Troubleshooting

### Error: "Cannot find module '@sentry/nextjs'"
**Solución:** Asegúrate de haber ejecutado `npm install @sentry/nextjs`

### No aparecen errores en Sentry
**Solución:**
1. Verifica que el DSN esté correcto en `.env.local`
2. Asegúrate de que `.env.local` esté siendo leído (reinicia el servidor)
3. Verifica que no haya un ad-blocker bloqueando requests a Sentry

### "Invalid DSN" error
**Solución:** Verifica que el DSN tenga el formato correcto y esté entre comillas en `.env.local`

---

## Recursos

- 📚 [Documentación oficial Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- 🎥 [Video tutorial](https://www.youtube.com/watch?v=_j3pYg_LJz8)
- 💬 [Soporte Sentry](https://sentry.io/support/)

---

## Estado de Implementación

- ✅ Guía de instalación creada
- ⏳ Pendiente: Ejecutar instalación (requiere cuenta Sentry)
- ⏳ Pendiente: Configurar DSN
- ⏳ Pendiente: Probar errores

**Siguiente paso:** El usuario debe crear una cuenta en Sentry y ejecutar los comandos de instalación.
