
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle, Edit3 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { 
  userProfileData, 
  saveUserProfileData,
  type UserProfile
} from '@/lib/data-storage';

export default function ProfilePage() {
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Los campos de contraseña se eliminan ya que las credenciales son fijas.
  
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    if (userProfileData) {
      setFullName(userProfileData.fullName || "");
      setEmail(userProfileData.email || "");
      setPhone(userProfileData.phone || "");
    }
    setIsDataLoaded(true);
  }, []);


  const handleUpdateProfile = () => {
    if (!fullName || !email) {
        toast({
            title: "Error",
            description: "Nombre completo y correo electrónico son obligatorios.",
            variant: "destructive",
        });
        return;
    }
    
    const updatedProfile: Partial<UserProfile> = { // Partial porque no cambiamos email
      fullName,
      // email: email, // Email del admin no debería ser editable
      phone,
    };

    // Conservar el email y moduleAccess existentes, actualizar el resto
    const currentProfile = userProfileData;
    const profileToSave: UserProfile = {
        ...currentProfile,
        fullName: updatedProfile.fullName || currentProfile.fullName,
        phone: updatedProfile.phone || currentProfile.phone,
    };

    saveUserProfileData(profileToSave); 
    
    toast({
      title: "Perfil Actualizado",
      description: "Tu información de perfil ha sido actualizada.",
    });
  };

  if (!isDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-lg">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil de Usuario"
        description="Gestiona la información de tu cuenta de administrador."
        icon={UserCircle}
      />

      <Card className="shadow-lg max-w-3xl mx-auto">
        <CardHeader className="text-center">
            <Avatar className="mx-auto h-24 w-24 mb-4 ring-2 ring-primary ring-offset-2 ring-offset-background">
                <AvatarImage src="https://placehold.co/100x100.png" alt="Avatar de Administrador" data-ai-hint="person portrait" />
                <AvatarFallback>{(fullName || "AD").split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
            </Avatar>
          <CardTitle className="text-2xl">{fullName || "Administrador"}</CardTitle>
          <CardDescription>{email || "admin@panaderiapro.com"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Información Personal</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input id="fullName" value={fullName || ""} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Correo Electrónico (No editable)</Label>
                <Input id="email" type="email" value={email || ""} disabled />
              </div>
              <div>
                <Label htmlFor="phone">Número de Teléfono</Label>
                <Input id="phone" type="tel" value={phone || ""} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sección de cambio de contraseña eliminada */}
          {/* Sección de permisos de módulo eliminada */}

        </CardContent>
        <CardFooter>
           <Button className="w-full" onClick={handleUpdateProfile}>
            <Edit3 className="mr-2 h-4 w-4" /> Actualizar Perfil
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    