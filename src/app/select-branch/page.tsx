
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, CheckCircle } from 'lucide-react';
import { availableBranches, setActiveBranchId, getActiveBranchId, type Branch } from '@/lib/data-storage';
import { useToast } from '@/hooks/use-toast';

export default function SelectBranchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBranchId(getActiveBranchId());
  }, []);

  const handleSelectBranch = (branchId: string) => {
    setActiveBranchId(branchId);
    setCurrentBranchId(branchId);
    toast({
      title: "Sede Seleccionada",
      description: `Has seleccionado la sede: ${availableBranches.find(b => b.id === branchId)?.name}. Recargando...`,
    });
    // Forzar una recarga completa para asegurar que todos los datos se cargan para la nueva sede
    // y que data-storage.ts se reinicializa con el nuevo activeBranchId
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  // Si ya hay una sede seleccionada y el usuario llega aquí (ej. por URL directa),
  // podría ser útil redirigirlo de vuelta al dashboard, o permitirle cambiar.
  // Por ahora, se permite el cambio.

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <PageHeader
        title="Seleccionar Sede"
        description="Elige la sede de la panadería a la que deseas acceder."
        icon={Building}
      />
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Sedes Disponibles</CardTitle>
          <CardDescription>
            {currentBranchId 
              ? `Sede actual: ${availableBranches.find(b => b.id === currentBranchId)?.name || 'Desconocida'}. Selecciona otra si deseas cambiar.`
              : "Por favor, selecciona una sede para continuar."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableBranches.map((branch: Branch) => (
            <Button
              key={branch.id}
              variant={currentBranchId === branch.id ? "default" : "outline"}
              className="w-full justify-start text-lg py-6"
              onClick={() => handleSelectBranch(branch.id)}
            >
              {currentBranchId === branch.id && <CheckCircle className="mr-3 h-5 w-5 text-green-400" />}
              {branch.name}
            </Button>
          ))}
          {availableBranches.length === 0 && (
            <p className="text-muted-foreground text-center">No hay sedes configuradas.</p>
          )}
        </CardContent>
      </Card>
      {currentBranchId && (
        <Button variant="link" onClick={() => router.push('/')} className="mt-6">
            Volver al Panel ({availableBranches.find(b => b.id === currentBranchId)?.name})
        </Button>
      )}
    </div>
  );
}
