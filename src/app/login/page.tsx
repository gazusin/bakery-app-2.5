
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { LogIn, KeyRound, AlertCircle } from 'lucide-react';
import { SIMULATED_ADMIN_USERNAME, SIMULATED_USER_PASSWORD } from '@/lib/data-storage';
import {
  sanitizeInput,
  loginRateLimiter,
  generateCSRFToken,
  hashPassword
} from '@/lib/crypto-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    // Check if already logged in
    if (typeof window !== 'undefined' && localStorage.getItem('isUserLoggedIn') === 'true') {
      router.replace('/');
    }

    // Generate CSRF token
    const token = generateCSRFToken();
    setCsrfToken(token);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('csrf_token', token);
    }
  }, [router]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    // Reset rate limit error
    setRateLimitError(null);

    // Sanitize inputs
    const sanitizedUsername = sanitizeInput(username.trim());
    const sanitizedPassword = password; // Don't sanitize password as it may contain special chars

    // Validate inputs
    if (!sanitizedUsername || !sanitizedPassword) {
      toast({
        title: "Error de Validación",
        description: "Por favor, completa todos los campos.",
        variant: "destructive",
      });
      return;
    }

    // Check rate limiting
    const identifier = `login_${sanitizedUsername}`;
    if (!loginRateLimiter.isAllowed(identifier)) {
      const timeRemaining = loginRateLimiter.getTimeUntilReset(identifier);
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;

      setRateLimitError(
        `Demasiados intentos fallidos. Por favor, intenta de nuevo en ${minutes}m ${seconds}s.`
      );

      toast({
        title: "Acceso Bloqueado Temporalmente",
        description: `Por seguridad, espera ${minutes} minutos y ${seconds} segundos antes de intentar de nuevo.`,
        variant: "destructive",
        duration: 10000,
      });
      return;
    }

    setIsLoading(true);

    // Simulate network delay for more realistic UX
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify CSRF token
    const storedToken = typeof window !== 'undefined' ? sessionStorage.getItem('csrf_token') : '';
    if (csrfToken !== storedToken) {
      toast({
        title: "Error de Seguridad",
        description: "Token de sesión inválido. Por favor, recarga la página.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Import authentication function dynamically
    const { authenticateUser, initializeUsers } = await import('@/lib/user-management');

    // Initialize users if needed
    initializeUsers();

    // Authenticate with new system
    const user = authenticateUser(sanitizedUsername, sanitizedPassword);

    if (user) {
      // Successful login - reset rate limiter
      loginRateLimiter.reset(identifier);

      toast({
        title: "Inicio de Sesión Exitoso",
        description: `¡Bienvenido de nuevo, ${user.fullName}!`,
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('isUserLoggedIn', 'true');
        localStorage.setItem('loginTimestamp', new Date().toISOString());

        // Generate new CSRF token for the session
        const sessionToken = generateCSRFToken();
        sessionStorage.setItem('session_csrf', sessionToken);
      }

      router.push('/');
    } else {
      // Failed login
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      toast({
        title: "Error de Inicio de Sesión",
        description: `Nombre de usuario o contraseña incorrectos. Intento ${newAttemptCount}/5.`,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales de administrador.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {rateLimitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{rateLimitError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                maxLength={50}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                maxLength={100}
                autoComplete="current-password"
              />
            </div>

            {attemptCount > 0 && attemptCount < 5 && (
              <p className="text-sm text-muted-foreground">
                Intentos fallidos: {attemptCount}/5
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || rateLimitError !== null}
            >
              {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <KeyRound className="inline-block h-3 w-3 mr-1" />
              Inicio de sesión protegido con rate limiting.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
