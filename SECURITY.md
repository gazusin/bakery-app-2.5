# Guía de Seguridad - Bakery 2.5

## Resumen Ejecutivo

Esta aplicación implementa múltiples capas de seguridad para proteger datos sensibles almacenados localmente. Sin embargo, **localStorage no es una solución segura para producción**. Este documento describe las medidas implementadas y recomendaciones para un entorno de producción.

## 🔒 Medidas de Seguridad Implementadas

### 1. Encriptación de Datos (AES-256-GCM)

**¿Qué se encripta?**
- ✅ Información financiera (balances de cuentas)
- ✅ Datos de clientes sensibles
- ✅ Configuraciones críticas
- ✅ Tokens de sesión

**Implementación:**
```typescript
// Uso de secureStorage
import { secureStorage } from '@/lib/crypto-utils';

// Guardar datos encriptados
await secureStorage.setItem('sensitive_key', JSON.stringify(data));

// Recuperar y desencriptar
const data = await secureStorage.getItem('sensitive_key');
```

**Detalles Técnicos:**
- Algoritmo: AES-GCM de 256 bits
- Derivación de clave: PBKDF2 con 100,000 iteraciones
- IV aleatorio por cada operación de encriptación
- Salt único para derivación de clave

### 2. Protección contra Fuerza Bruta (Rate Limiting)

**Login Protection:**
- Máximo 5 intentos fallidos por usuario
- Ventana de bloqueo: 15 minutos
- Contador visible para el usuario
- Tiempo restante de bloqueo mostrado

**Implementación:**
```typescript
import { loginRateLimiter } from '@/lib/crypto-utils';

// Verificar antes de permitir login
if (!loginRateLimiter.isAllowed(username)) {
  const timeRemaining = loginRateLimiter.getTimeUntilReset(username);
  // Mostrar error con tiempo restante
  return;
}

// Después de login exitoso
loginRateLimiter.reset(username);
```

### 3. Sanitización de Inputs (XSS Prevention)

**Todas las entradas de usuario son sanitizadas:**

```typescript
import { sanitizeInput, sanitizeHtml } from '@/lib/crypto-utils';

// Para inputs simples
const cleanUsername = sanitizeInput(userInput);

// Para contenido HTML (si es necesario)
const cleanHtml = sanitizeHtml(htmlContent);
```

**Caracteres escapados:**
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#x27;`
- `/` → `&#x2F;`

### 4. Validación de Datos

**Validación en dos niveles:**

1. **Validación tipo TypeScript (compilación)**
2. **Validación en runtime**

```typescript
import { 
  isValidEmail, 
  isValidPhone,
  isPositiveNumber,
  isNonNegativeNumber 
} from '@/lib/crypto-utils';

// Ejemplo
if (!isValidEmail(email)) {
  throw new Error('Email inválido');
}

if (!isPositiveNumber(amount)) {
  throw new Error('El monto debe ser positivo');
}
```

### 5. Protección CSRF

**Tokens de sesión:**
```typescript
import { generateCSRFToken, validateCSRFToken } from '@/lib/crypto-utils';

// Generar token al iniciar sesión
const token = generateCSRFToken();
sessionStorage.setItem('csrf_token', token);

// Validar en operaciones críticas
if (!validateCSRFToken(submittedToken, storedToken)) {
  throw new Error('Token CSRF inválido');
}
```

### 6. Verificación de Integridad (Checksums)

**Detección de manipulación de datos:**
```typescript
import { createChecksum, verifyChecksum } from '@/lib/crypto-utils';

// Al guardar
const data = JSON.stringify(importantData);
const checksum = await createChecksum(data);
localStorage.setItem('data', data);
localStorage.setItem('data_checksum', checksum);

// Al cargar
const storedData = localStorage.getItem('data');
const storedChecksum = localStorage.getItem('data_checksum');
const isValid = await verifyChecksum(storedData, storedChecksum);

if (!isValid) {
  console.warn('⚠️ Los datos han sido manipulados');
  // Tomar acción apropiada
}
```

### 7. Protección de Rutas

**Middleware de Next.js:**
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const isPublicRoute = publicRoutes.includes(pathname);
  
  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect('/login');
  }
}
```

### 8. Sesiones Seguras

**Gestión de sesiones:**
- Timestamp de login guardado
- Expiración automática (implementable)
- Token de sesión único
- Limpieza al logout

```typescript
// Al login
localStorage.setItem('loginTimestamp', new Date().toISOString());
sessionStorage.setItem('session_csrf', generateCSRFToken());

// Al logout
localStorage.removeItem('isUserLoggedIn');
localStorage.removeItem('loginTimestamp');
sessionStorage.clear();
```

## ⚠️ Limitaciones de Seguridad Actuales

### LocalStorage NO es seguro para producción

**Problemas:**
1. **Accesible desde JavaScript**: XSS puede robar todo
2. **Sin expiración**: Datos persisten indefinidamente
3. **Sin encriptación nativa**: Depende de nuestra implementación
4. **Tamaño limitado**: ~5-10MB por dominio
5. **No sincroniza**: Entre dispositivos/navegadores

### Vectores de Ataque Posibles

1. **XSS (Cross-Site Scripting)**
   - Aunque sanitizamos inputs, siempre hay riesgo
   - Un script malicioso puede leer localStorage

2. **Inspect Element**
   - Cualquier usuario puede ver localStorage en DevTools
   - Los datos encriptados son visibles (aunque no legibles)

3. **Extension Maliciosas**
   - Extensiones del navegador pueden acceder a localStorage

4. **Computadora Compartida**
   - Si alguien más usa la misma PC, puede acceder a los datos

## 🛡️ Recomendaciones para Producción

### 1. Migrar a Base de Datos Real

**Opciones recomendadas:**

**Firebase Firestore** (Ya parcialmente integrado)
```javascript
// Ejemplo de migración
const db = getFirestore();

// Guardar venta
await setDoc(doc(db, 'sales', saleId), {
  ...saleData,
  createdAt: serverTimestamp()
});

// Leer ventas
const salesSnapshot = await getDocs(collection(db, 'sales'));
```

**PostgreSQL con Prisma**
```typescript
// Schema
model Sale {
  id        String   @id @default(uuid())
  date      DateTime
  amount    Decimal
  customerId String
  // ...
}

// Query
const sales = await prisma.sale.findMany({
  where: { date: { gte: startDate } }
});
```

**Supabase** (PostgreSQL + Real-time)
```typescript
const { data, error } = await supabase
  .from('sales')
  .select('*')
  .gte('date', startDate);
```

### 2. Implementar Autenticación Real

**Firebase Authentication**
```typescript
import { signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(
  auth,
  email,
  password
);
```

**NextAuth.js**
```typescript
// pages/api/auth/[...nextauth].ts
export default NextAuth({
  providers: [
    CredentialsProvider({
      // Configuración
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 días
  }
});
```

### 3. HTTPS Obligatorio

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Redirigir HTTP a HTTPS
    if ($scheme != "https") {
        return 301 https://$server_name$request_uri;
    }
}
```

### 4. Content Security Policy (CSP)

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://firestore.googleapis.com;
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 5. Auditorías Regulares

```bash
# Verificar vulnerabilidades en dependencias
npm audit

# Fix automático
npm audit fix

# Actualizar dependencias
npm update

# Verificar licencias
npx license-checker
```

### 6. Variables de Entorno Seguras

**NUNCA commits:**
- API keys
- Secrets
- Passwords
- Tokens

```bash
# .env.local (en .gitignore)
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=super-secret-key
GOOGLE_AI_API_KEY=...

# Usar en código
process.env.DATABASE_URL
```

### 7. Logging y Monitoreo

```typescript
// lib/logger.ts
export function logSecurityEvent(event: string, details: any) {
  // En producción, enviar a servicio como Sentry
  console.error('[SECURITY]', event, details);
  
  // Ejemplo con Sentry
  // Sentry.captureException(new Error(event), {
  //   extra: details
  // });
}

// Uso
logSecurityEvent('Failed login attempt', {
  username,
  ip: request.ip,
  timestamp: new Date()
});
```

### 8. Backup y Recuperación

```typescript
// Implementar backups automáticos
async function backupData() {
  const backup = {
    timestamp: new Date().toISOString(),
    data: {
      sales: loadFromLocalStorage(KEYS.SALES),
      products: loadFromLocalStorage(KEYS.PRODUCTS),
      // ... más datos
    }
  };
  
  // En producción, enviar a storage seguro
  await uploadToSecureStorage(backup);
}

// Ejecutar diariamente
setInterval(backupData, 24 * 60 * 60 * 1000);
```

## 📋 Checklist de Seguridad para Producción

- [ ] Migrar de localStorage a base de datos real
- [ ] Implementar autenticación robusta (OAuth, JWT)
- [ ] Configurar HTTPS con certificado válido
- [ ] Implementar CSP headers
- [ ] Configurar rate limiting a nivel de servidor
- [ ] Implementar logging y monitoreo
- [ ] Configurar backups automáticos
- [ ] Auditar dependencias regularmente
- [ ] Implementar 2FA (autenticación de dos factores)
- [ ] Encriptar datos en tránsito y en reposo
- [ ] Configurar firewall de aplicación web (WAF)
- [ ] Implementar detección de intrusos
- [ ] Establecer política de retención de datos
- [ ] Cumplir con regulaciones (GDPR, LOPD, etc.)
- [ ] Hacer pentesting regularmente

## 🚨 Respuesta a Incidentes

### Si se detecta una brecha de seguridad:

1. **Aislar el sistema**
   - Poner la app en modo mantenimiento
   - Detener acceso a datos

2. **Analizar el alcance**
   - ¿Qué datos fueron accedidos?
   - ¿Cuándo ocurrió?
   - ¿Cómo ocurrió?

3. **Notificar**
   - Usuarios afectados
   - Autoridades si es requerido
   - Equipo de TI

4. **Remediar**
   - Parchear vulnerabilidad
   - Cambiar todos los secretos
   - Restablecer desde backup limpio

5. **Prevenir**
   - Actualizar procedimientos
   - Implementar controles adicionales
   - Capacitar al equipo

## 📚 Recursos Adicionales

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

## Contacto de Seguridad

Para reportar vulnerabilidades de seguridad:
- Email: security@tuempresa.com
- Bug Bounty: (si aplica)

---

**Última actualización**: Noviembre 2024  
**Estado**: En desarrollo (NO USAR EN PRODUCCIÓN CON DATOS REALES)
