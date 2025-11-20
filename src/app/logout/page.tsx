
"use client";

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isUserLoggedIn'); // Eliminar indicador de login
    }
    toast({
      title: "Sesión Cerrada",
      description: "Has cerrado sesión correctamente. Serás redirigido.",
    });
    setTimeout(() => {
      router.push('/login'); // Redirigir a la página de login
    }, 1500);
  };

  // Opcional: Si el usuario llega aquí y no está "logueado", redirigir a login inmediatamente.
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('isUserLoggedIn')) {
      router.replace('/login');
    }
  }, [router]);


  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-[calc(100vh-15rem)]">
      <PageHeader
        title="Cerrar Sesión"
        description="¿Estás seguro de que quieres cerrar sesión en tu cuenta?"
        icon={LogOut}
      />

      <Card className="shadow-lg w-full max-w-md">
        <CardHeader className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle>Confirmar Cierre de Sesión</CardTitle>
            <CardDescription>Serás redirigido a la página de inicio de sesión.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            Sí, Cerrar Sesión
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/">Cancelar y Volver al Panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
