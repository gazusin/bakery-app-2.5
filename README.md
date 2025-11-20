# Bakery 2.5 - Sistema de Gestión de Panadería

Sistema completo de gestión empresarial para panaderías con múltiples sucursales, desarrollado con Next.js, TypeScript y Firebase.

## 🚀 Características Principales

### Gestión de Operaciones
- **Dashboard en Tiempo Real**: Métricas de ingresos, pérdidas, ganancias y alertas
- **Multi-Sucursal**: Gestión independiente de Panadería Principal y Productos Elaborados
- **Inventario Inteligente**: Stock de productos y materias primas con alertas de nivel bajo
- **Producción**: Registro de producción, recetas y cálculo dinámico de costos
- **Ventas y Créditos**: Sistema completo de ventas con soporte para créditos y pagos parciales

### Funciones Financieras
- **Multi-Moneda**: Soporte completo para USD y VES con tasas de cambio históricas
- **Cuentas por Cobrar**: Tracking de facturas vencidas y próximas a vencer
- **Reportes Semanales**: Generación automática de reportes de pérdidas y ganancias
- **Transferencias de Fondos**: Entre sucursales con registro completo

### Administración
- **Proveedores**: Gestión de proveedores con listas de precios
- **Empleados**: Administración de personal y nómina
- **Gastos**: Categorías fijas y variables con tracking detallado
- **Órdenes de Compra**: Flujo completo desde pedido hasta pago

## 📋 Requisitos Previos

- **Node.js**: v22.16.0 o superior
- **npm**: v10.x o superior
- **Java (OpenJDK)**: 21 o superior (para Firebase emulators)
- **Sistema Operativo**: Windows, macOS o Linux

## 🔧 Instalación

### 1. Clonar/Descargar el Proyecto

```bash
cd /ruta/deseada
# Si tienes git:
git clone https://tu-repositorio.git
# O descomprime el archivo ZIP
```

### 2. Instalar Dependencias

```bash
cd "Bakery 2.5"
npm install
```

### 3. Configurar Firebase (Opcional)

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

### 4. Variables de Entorno

Crea un archivo `.env.local` basado en `.env.example`:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto

# Genkit AI (Opcional)
GOOGLE_GENAI_API_KEY=tu_api_key_genkit
```

## 🚀 Ejecución

### Modo Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

### Credenciales de Acceso

```
Usuario: admin
Contraseña: pan123
```

> ⚠️ **Importante**: Cambia estas credenciales en producción editando `src/lib/data-storage.ts`

### Compilar para Producción

```bash
npm run build
npm start
```

### Otros Scripts

```bash
npm run lint          # Verificar errores de linting
npm run typecheck     # Verificar tipos TypeScript
npm run test          # Ejecutar tests (si están configurados)
npm run test:coverage # Ver cobertura de código
```

## 📁 Estructura del Proyecto

```
Bakery 2.5/
├── src/
│   ├── app/                    # Páginas y rutas de Next.js
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── login/             # Autenticación
│   │   ├── sales/             # Módulo de ventas
│   │   ├── inventory/         # Gestión de inventario
│   │   ├── production/        # Producción y recetas
│   │   ├── reports/           # Reportes y análisis
│   │   └── ...                # Otros módulos
│   ├── components/            # Componentes reutilizables
│   │   ├── ui/               # Componentes de UI (shadcn)
│   │   ├── dashboard/        # Componentes del dashboard
│   │   └── ...
│   ├── lib/                   # Utilidades y lógica de negocio
│   │   ├── data-storage.ts   # Gestión de localStorage
│   │   ├── crypto-utils.ts   # Seguridad y encriptación
│   │   └── utils.ts          # Funciones auxiliares
│   ├── hooks/                 # Custom React Hooks
│   └── ai/                    # Integración con Genkit AI
├── public/                    # Archivos estáticos
├── middleware.ts              # Middleware de Next.js
├── tailwind.config.ts         # Configuración de Tailwind
├── next.config.ts             # Configuración de Next.js
└── package.json               # Dependencias del proyecto
```

## 🔒 Seguridad

### Características Implementadas

- ✅ **Encriptación AES-256**: Datos sensibles en localStorage
- ✅ **Rate Limiting**: Protección contra fuerza bruta en login
- ✅ **Sanitización de Inputs**: Prevención de XSS
- ✅ **CSRF Protection**: Tokens de sesión
- ✅ **Validación de Datos**: Schemas de validación
- ✅ **Checksums**: Detección de manipulación de datos

### Recomendaciones para Producción

1. **No uses localStorage para producción**: Migra a una base de datos real (Firebase, PostgreSQL, etc.)
2. **Implementa autenticación real**: Firebase Auth, NextAuth.js, o similar
3. **Usa HTTPS**: Siempre en producción
4. **Configura CSP**: Content Security Policy headers
5. **Auditoría de seguridad**: Revisa regularmente con herramientas como npm audit

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm run test

# Ejecutar con UI
npm run test:ui

# Ver cobertura
npm run test:coverage
```

## 📊 Módulos Principales

### 1. Dashboard
- Métricas en tiempo real
- Gráficos de ventas
- Alertas y notificaciones
- Actividad reciente

### 2. Inventario
- Stock de productos terminados
- Materia prima
- Transferencias entre sucursales
- Alertas de stock bajo

### 3. Producción
- Registro de producción
- Recetas con cálculo de costos
- Metas de producción
- Análisis de mermas

### 4. Ventas
- Facturas y créditos
- Gestión de clientes
- Pagos y verificaciones
- Notas de crédito

### 5. Compras
- Órdenes de compra
- Gestión de proveedores
- Comparación de precios
- Reorden inteligente

### 6. Finanzas
- Movimientos de cuenta
- Cuentas por cobrar
- Control de gastos
- Reportes semanales

## 🎨 Tecnologías Utilizadas

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: Tailwind CSS, Radix UI, shadcn/ui
- **Gráficos**: Recharts
- **Formularios**: React Hook Form, Zod
- **Fechas**: date-fns
- **State**: React Hooks, Tanstack Query
- **AI**: Genkit AI, Google AI
- **Backend**: Firebase (opcional)
- **PDF**: jsPDF, jsPDF-AutoTable
- **Testing**: Vitest, Testing Library

## 🔄 Flujos de Trabajo Comunes

### Registrar una Venta

1. Ir a **Ventas** → **Nueva Venta**
2. Seleccionar cliente
3. Agregar productos (pueden ser de diferentes sucursales)
4. Elegir método de pago (Pagado o Crédito)
5. Confirmar venta

### Registrar Producción

1. Ir a **Producción** → **Registrar Producción**
2. Seleccionar receta
3. Ingresar cantidad de tandas
4. Registrar cantidad real producida
5. El stock se actualiza automáticamente

### Crear Orden de Compra

1. Ir a **Órdenes de Compra** → **Nueva Orden**
2. Seleccionar proveedor
3. Agregar materias primas
4. Confirmar orden
5. Marcar como recibida cuando llegue
6. Registrar pago

## 🐛 Solución de Problemas

### El servidor no inicia

```bash
# Limpiar caché y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Errores de TypeScript

```bash
npm run typecheck
```

### Datos corruptos en localStorage

Abre la consola del navegador:
```javascript
localStorage.clear();
location.reload();
```

### Puerto 3000 en uso

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

## 📝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -m 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y propietario.

## 👥 Soporte

Para soporte y preguntas:
- Email: soporte@tuempresa.com
- Documentación: Ver carpeta `/INSTRUCCIONES`

## 🔮 Próximas Características

- [ ] Modo offline con sincronización
- [ ] App móvil con React Native
- [ ] Dashboard de análisis avanzado
- [ ] Integración con sistemas contables
- [ ] Backup automático en la nube
- [ ] Multi-tenant para múltiples negocios
- [ ] API REST para integraciones

---

**Versión:** 2.5  
**Última Actualización:** Noviembre 2024  
**Desarrollado con ❤️ para simplificar la gestión de panaderías**
