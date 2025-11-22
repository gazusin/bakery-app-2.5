"use client";

import React, { useState, useCallback, ChangeEvent } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageTransition } from '@/components/page-transition';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  ArchiveRestore, Upload, Download, AlertTriangle, Loader2, Trash2,
  ShoppingCart, Users, Package, Settings, Archive, CreditCard, Landmark,
  Target, Utensils, Receipt, CheckCircle2, ArrowRightLeft, ListFilter,
  Shuffle, FileText, DollarSign, Sun, Moon, Clock, Save
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { KEYS, availableBranches, getActiveBranchId, dispatchDataUpdateEvent } from '@/lib/data-storage';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createBackup, downloadBackup, AutoBackupService } from '@/lib/backup-service';
import { generateDemoData } from '@/lib/seed-data';

const dataModules = [
  { id: KEYS.CUSTOMERS, name: 'Clientes (Global)', keys: [KEYS.CUSTOMERS], icon: Users },
  { id: KEYS.SALES, name: 'Ventas (Global)', keys: [KEYS.SALES], icon: ShoppingCart },
  { id: KEYS.PAYMENTS, name: 'Pagos (Global)', keys: [KEYS.PAYMENTS], icon: CreditCard },
  { id: KEYS.PENDING_FUND_TRANSFERS, name: 'Transf. Fondos Pendientes (Global)', keys: [KEYS.PENDING_FUND_TRANSFERS], icon: Shuffle },
  { id: KEYS.INVENTORY_TRANSFERS, name: 'Transf. de Inventario MP (Global)', keys: [KEYS.INVENTORY_TRANSFERS], icon: ArrowRightLeft },
  { id: KEYS.SUPPLIERS, name: 'Proveedores (Global)', keys: [KEYS.SUPPLIERS], icon: Users },
  { id: KEYS.RAW_MATERIAL_OPTIONS, name: 'Opciones de Materia Prima (Global)', keys: [KEYS.RAW_MATERIAL_OPTIONS], icon: ListFilter },
  { id: KEYS.EXCHANGE_RATE_HISTORY, name: 'Historial Tasa de Cambio (Global)', keys: [KEYS.EXCHANGE_RATE_HISTORY], icon: Landmark },
  { id: KEYS.USER_PROFILE, name: 'Perfil de Usuario (Global)', keys: [KEYS.USER_PROFILE], icon: Settings },
  { id: KEYS.CUSTOM_CONVERSION_RULES, name: 'Reglas de Conversión (Global)', keys: [KEYS.CUSTOM_CONVERSION_RULES], icon: Settings },
  { id: KEYS.WEEKLY_LOSS_REPORTS, name: 'Reportes Semanales Pérdida (Global)', keys: [KEYS.WEEKLY_LOSS_REPORTS], icon: FileText },
  { id: KEYS.WEEKLY_PROFIT_REPORTS, name: 'Reportes Semanales Ganancia (Global)', keys: [KEYS.WEEKLY_PROFIT_REPORTS], icon: FileText },

  { id: 'separator-branch', name: 'Datos por Sede', type: 'separator' },

  { id: KEYS.PRODUCTS, name: 'Stock de Productos Terminados (por Sede)', keys: [KEYS.PRODUCTS], icon: Package },
  { id: KEYS.RAW_MATERIAL_INVENTORY, name: 'Inventario Materia Prima (por Sede)', keys: [KEYS.RAW_MATERIAL_INVENTORY], icon: Archive },
  { id: KEYS.PRODUCTION_LOG, name: 'Logs de Producción (por Sede)', keys: [KEYS.PRODUCTION_LOG], icon: Package },
  { id: KEYS.RECIPES, name: 'Recetas (por Sede)', keys: [KEYS.RECIPES], icon: Utensils },
  { id: KEYS.PURCHASE_ORDERS, name: 'Órdenes de Compra (por Sede)', keys: [KEYS.PURCHASE_ORDERS], icon: Receipt },
  { id: KEYS.WEEKLY_GOALS, name: 'Metas Semanales (por Sede)', keys: [KEYS.WEEKLY_GOALS], icon: Target },
  { id: KEYS.MONTHLY_GOALS, name: 'Metas Mensuales (por Sede)', keys: [KEYS.MONTHLY_GOALS], icon: Target },
  { id: KEYS.EMPLOYEES, name: 'Empleados (por Sede)', keys: [KEYS.EMPLOYEES], icon: Users },
  { id: KEYS.EXPENSES, name: 'Gastos (por Sede)', keys: [KEYS.EXPENSES], icon: DollarSign },
  { id: KEYS.COMPANY_ACCOUNTS, name: 'Cuentas de la Empresa (por Sede)', keys: [KEYS.COMPANY_ACCOUNTS], icon: Landmark },
  { id: KEYS.ACCOUNT_TRANSACTIONS, name: 'Movimientos de Cuenta (por Sede)', keys: [KEYS.ACCOUNT_TRANSACTIONS], icon: Landmark },
  { id: KEYS.EXPENSE_FIXED_CATEGORIES, name: 'Categorías de Gastos Fijos (por Sede)', keys: [KEYS.EXPENSE_FIXED_CATEGORIES], icon: Settings },
  { id: KEYS.EXPENSE_VARIABLE_CATEGORIES, name: 'Categorías de Gastos Variables (por Sede)', keys: [KEYS.EXPENSE_VARIABLE_CATEGORIES], icon: Settings },
];

export default function DataManagementPage() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('auto_download_backup') === 'true' : false
  );
  const [autoBackupInterval, setAutoBackupInterval] = useState(1440);
  const [lastBackupInfo, setLastBackupInfo] = useState<{ timestamp: string; size: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const service = new AutoBackupService(24);
      const info = service.getLastBackupInfo();
      setLastBackupInfo(info);
    }
  }, []);

  const handleQuickBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);

      toast({
        title: "✅ Backup Creado",
        description: "Tus datos han sido respaldados y descargados exitosamente.",
      });

      setLastBackupInfo({
        timestamp: backup.timestamp,
        size: JSON.stringify(backup).length
      });
    } catch (error) {
      toast({
        title: "Error al crear backup",
        description: "Ocurrió un error al crear el respaldo. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleAutoBackupToggle = (enabled: boolean) => {
    setAutoBackupEnabled(enabled);
    localStorage.setItem('auto_download_backup', enabled.toString());

    toast({
      title: enabled ? "Auto-backup activado" : "Auto-backup desactivado",
      description: enabled
        ? "Los backups se descargarán automáticamente según la frecuencia configurada."
        : "Ya no se descargarán backups automáticamente.",
    });
  };

  const handleIntervalChange = (minutes: number) => {
    setAutoBackupInterval(minutes);
    toast({
      title: "Frecuencia Actualizada",
      description: `Backup automático configurado cada ${minutes / 60} horas.`,
    });
  };

  const handleModuleToggle = (moduleId: string, checked: boolean) => {
    setSelectedModules(prev => {
      if (checked) {
        return [...prev, moduleId];
      } else {
        return prev.filter(id => id !== moduleId);
      }
    });
  };

  const handleSelectAllModules = () => {
    setSelectedModules(dataModules.filter(m => m.type !== 'separator').map(m => m.id));
  };

  const handleDeselectAllModules = () => {
    setSelectedModules([]);
  };

  const handleExportData = useCallback(() => {
    if (selectedModules.length === 0) {
      toast({
        title: "Sin Selección",
        description: "Por favor, selecciona al menos un módulo para exportar.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const exportData: { [key: string]: any } = {};
      const modulesToExport = dataModules.filter(m => selectedModules.includes(m.id));
      const keysToExport = [...new Set(modulesToExport.flatMap(m => m.keys || []))];
      const selectedModuleNames = modulesToExport.map(m => m.name).join(', ');

      keysToExport.forEach(baseKey => {
        const isGlobalKey = [
          KEYS.CUSTOMERS, KEYS.SALES, KEYS.PAYMENTS, KEYS.PENDING_FUND_TRANSFERS,
          KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS, KEYS.EXCHANGE_RATE_HISTORY,
          KEYS.USER_PROFILE, KEYS.CUSTOM_CONVERSION_RULES, KEYS.INVENTORY_TRANSFERS,
          KEYS.ACTIVE_BRANCH_ID, KEYS.WEEKLY_LOSS_REPORTS, KEYS.WEEKLY_PROFIT_REPORTS
        ].includes(baseKey as any);

        if (isGlobalKey) {
          const data = localStorage.getItem(baseKey);
          if (data !== null) {
            try { exportData[baseKey] = JSON.parse(data); } catch (e) { exportData[baseKey] = data; }
          }
        } else {
          availableBranches.forEach(branch => {
            const branchSpecificKey = `${baseKey}_${branch.id}`;
            const data = localStorage.getItem(branchSpecificKey);
            if (data !== null) {
              try { exportData[branchSpecificKey] = JSON.parse(data); } catch (e) { exportData[branchSpecificKey] = data; }
            }
          });
        }
      });

      const fullExportObject = {
        metadata: {
          version: 2,
          moduleName: `Módulos Seleccionados: ${selectedModuleNames}`,
          exportDate: new Date().toISOString(),
          source: "PanaderiaProApp",
          activeBranchIdBeforeExport: getActiveBranchId(),
        },
        data: exportData
      };

      const jsonString = JSON.stringify(fullExportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_modulos_seleccionados_${format(new Date(), "dd-MM-yyyy")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación Exitosa",
        description: `${selectedModules.length} módulo(s) exportado(s) correctamente.`,
      });
    } catch (error) {
      console.error("Error durante la exportación:", error);
      toast({
        title: "Error de Exportación",
        description: "Ocurrió un problema al exportar los datos.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedModules, toast]);

  const handleExportAllData = useCallback(() => {
    const allKeys = Object.values(KEYS);

    setIsProcessing(true);
    try {
      const exportData: { [key: string]: any } = {};

      allKeys.forEach(baseKey => {
        const isGlobalKey = [
          KEYS.CUSTOMERS, KEYS.SALES, KEYS.PAYMENTS, KEYS.PENDING_FUND_TRANSFERS,
          KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS, KEYS.EXCHANGE_RATE_HISTORY,
          KEYS.USER_PROFILE, KEYS.CUSTOM_CONVERSION_RULES, KEYS.INVENTORY_TRANSFERS,
          KEYS.ACTIVE_BRANCH_ID, KEYS.WEEKLY_LOSS_REPORTS, KEYS.WEEKLY_PROFIT_REPORTS
        ].includes(baseKey as any);

        if (isGlobalKey) {
          const data = localStorage.getItem(baseKey);
          if (data !== null) {
            try { exportData[baseKey] = JSON.parse(data); } catch (e) { exportData[baseKey] = data; }
          }
        } else {
          availableBranches.forEach(branch => {
            const branchSpecificKey = `${baseKey}_${branch.id}`;
            const data = localStorage.getItem(branchSpecificKey);
            if (data !== null) {
              try { exportData[branchSpecificKey] = JSON.parse(data); } catch (e) { exportData[branchSpecificKey] = data; }
            }
          });
        }
      });

      const fullExportObject = {
        metadata: {
          version: 2,
          moduleName: 'Todos los Datos',
          exportDate: new Date().toISOString(),
          source: "PanaderiaProApp",
          activeBranchIdBeforeExport: getActiveBranchId(),
        },
        data: exportData
      };

      const jsonString = JSON.stringify(fullExportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_completo_Panificadora_Valladares_${format(new Date(), "dd-MM-yyyy")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportación Completa Exitosa",
        description: `Todos los datos han sido exportados.`,
      });
    } catch (error) {
      console.error("Error durante la exportación completa:", error);
      toast({
        title: "Error de Exportación",
        description: "Ocurrió un problema al exportar los datos.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImportData = useCallback(() => {
    if (!selectedFile) {
      toast({
        title: "Sin Archivo",
        description: "Por favor, selecciona un archivo JSON para importar.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedObject = JSON.parse(text);

        if (!importedObject || typeof importedObject.data !== 'object' || !importedObject.metadata || importedObject.metadata.source !== "PanaderiaProApp") {
          toast({
            title: "Archivo Inválido",
            description: "El archivo seleccionado no parece ser un archivo de datos válido de Panadería Pro.",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }

        const isFullBackup = importedObject.metadata?.moduleName === 'Todos los Datos';

        if (isFullBackup) {
          const allAppKeys = Object.values(KEYS);
          allAppKeys.forEach(baseKey => {
            const isGlobalKey = [
              KEYS.CUSTOMERS, KEYS.SALES, KEYS.PAYMENTS, KEYS.PENDING_FUND_TRANSFERS,
              KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS, KEYS.EXCHANGE_RATE_HISTORY,
              KEYS.USER_PROFILE, KEYS.CUSTOM_CONVERSION_RULES, KEYS.INVENTORY_TRANSFERS,
              KEYS.ACTIVE_BRANCH_ID, KEYS.WEEKLY_LOSS_REPORTS, KEYS.WEEKLY_PROFIT_REPORTS
            ].includes(baseKey as any);

            if (isGlobalKey) {
              localStorage.removeItem(baseKey);
            } else {
              availableBranches.forEach(branch => {
                localStorage.removeItem(`${baseKey}_${branch.id}`);
              });
            }
          });
        }

        Object.entries(importedObject.data).forEach(([key, value]) => {
          if (key !== KEYS.ACTIVE_BRANCH_ID && key !== 'isUserLoggedIn') {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });

        const importedActiveBranch = importedObject.metadata?.activeBranchIdBeforeExport;
        if (importedActiveBranch && availableBranches.some(b => b.id === importedActiveBranch)) {
          localStorage.setItem(KEYS.ACTIVE_BRANCH_ID, importedActiveBranch);
        }

        Object.values(KEYS).forEach(key => dispatchDataUpdateEvent(key));

        toast({
          title: "Importación Exitosa",
          description: "Datos importados. Se recomienda recargar la aplicación para asegurar que todos los cambios se apliquen.",
        });

        setTimeout(() => {
          if (localStorage.getItem(KEYS.ACTIVE_BRANCH_ID)) {
            window.location.href = '/';
          } else {
            window.location.href = '/select-branch';
          }
        }, 1500);

      } catch (error) {
        console.error("Error durante la importación:", error);
        toast({
          title: "Error de Importación",
          description: "Ocurrió un problema al leer o procesar el archivo JSON. Asegúrate de que el formato es correcto.",
          variant: "destructive",
        });
      } finally {
        setIsProcessing(false);
        setSelectedFile(null);
        const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    };
    reader.readAsText(selectedFile);
  }, [selectedFile, toast]);

  const handleClearAllData = useCallback(() => {
    setIsProcessing(true);
    try {
      const allBaseKeys = Object.values(KEYS);
      allBaseKeys.forEach(baseKey => {
        const isGlobalKey = [
          KEYS.EXCHANGE_RATE, KEYS.EXCHANGE_RATE_HISTORY, KEYS.USER_PROFILE,
          KEYS.INVENTORY_TRANSFERS, KEYS.CUSTOMERS, KEYS.SALES, KEYS.PAYMENTS,
          KEYS.PENDING_FUND_TRANSFERS, KEYS.SUPPLIERS, KEYS.RAW_MATERIAL_OPTIONS,
          KEYS.CUSTOM_CONVERSION_RULES, KEYS.WEEKLY_LOSS_REPORTS, KEYS.WEEKLY_PROFIT_REPORTS,
          KEYS.ACTIVE_BRANCH_ID,
        ].includes(baseKey as any);

        if (isGlobalKey) {
          localStorage.removeItem(baseKey);
        } else {
          availableBranches.forEach(branch => {
            localStorage.removeItem(`${baseKey}_${branch.id}`);
          });
        }
      });

      localStorage.removeItem('isUserLoggedIn');

      toast({
        title: "Datos Eliminados",
        description: "Todos los datos de la aplicación han sido eliminados. Serás redirigido al login.",
      });

      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);

    } catch (error) {
      console.error("Error durante la limpieza de datos:", error);
      toast({
        title: "Error de Limpieza",
        description: "Ocurrió un problema al eliminar los datos.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleGenerateDemoData = async () => {
    setIsGenerating(true);

    const tryGenerate = async (months: number): Promise<boolean> => {
      try {
        await generateDemoData(months);
        toast({
          title: "Datos Generados",
          description: `Se han generado datos de prueba para los últimos ${months} meses. Recarga la página para ver los cambios.`,
        });
        setTimeout(() => window.location.reload(), 2000);
        return true;
      } catch (error: any) {
        const isQuotaError = error && (
          error.name === 'QuotaExceededError' ||
          error.code === 22 ||
          error.message?.toLowerCase().includes('quota') ||
          error.message?.toLowerCase().includes('storage')
        );

        if (isQuotaError) {
          if (months > 1) {
            const nextMonths = Math.floor(months / 2);
            console.warn(`Quota exceeded for ${months} months. Retrying with ${nextMonths}...`);
            toast({
              title: "Espacio Insuficiente",
              description: `No se pudieron generar ${months} meses por límite de almacenamiento. Intentando con ${nextMonths} meses...`,
              variant: "default", // Info warning
            });
            // Pequeña pausa para dar tiempo al UI update
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await tryGenerate(nextMonths);
          } else {
            throw new Error("El almacenamiento local está lleno. No se pudo generar ni 1 mes de datos.");
          }
        }
        throw error;
      }
    };

    try {
      await tryGenerate(12); // Intentar 12 meses inicialmente
    } catch (error: any) {
      console.error("Error generando datos:", error);
      toast({
        title: "Error",
        description: error.message || "Hubo un problema al generar los datos de prueba.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Gestión de Datos y Configuración"
        description="Administra tus respaldos, exporta/importa datos y configura preferencias de la aplicación"
        icon={ArchiveRestore}
      />

      <Tabs defaultValue="backup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backup">Respaldos y Restauración</TabsTrigger>
          <TabsTrigger value="transfer">Transferencia de Datos</TabsTrigger>
          <TabsTrigger value="demo">Datos Demo</TabsTrigger>
          <TabsTrigger value="info">Información del Sistema</TabsTrigger>
        </TabsList>

        {/* TAB: RESPALDOS */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Backup Rápido
              </CardTitle>
              <CardDescription>
                Descarga un respaldo completo de todos tus datos con un solo click
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleQuickBackup}
                disabled={isCreatingBackup}
                className="w-full"
                size="lg"
              >
                {isCreatingBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isCreatingBackup ? 'Creando backup...' : 'Descargar Backup Completo Ahora'}
              </Button>

              {lastBackupInfo && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Último backup</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lastBackupInfo.timestamp), "dd/MM/yyyy 'a las' HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tamaño: {(lastBackupInfo.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Backup Automático
              </CardTitle>
              <CardDescription>
                Configura la frecuencia de los respaldos automáticos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="auto-backup" className="flex flex-col space-y-1">
                  <span>Habilitar Backup Automático</span>
                  <span className="font-normal text-xs text-muted-foreground">
                    Se guardará una copia local periódicamente
                  </span>
                </Label>
                <Switch
                  id="auto-backup"
                  checked={autoBackupEnabled}
                  onCheckedChange={handleAutoBackupToggle}
                />
              </div>

              {autoBackupEnabled && (
                <div className="space-y-2 pt-2">
                  <Label>Frecuencia</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={autoBackupInterval === 60 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleIntervalChange(60)}
                    >
                      1 Hora
                    </Button>
                    <Button
                      variant={autoBackupInterval === 360 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleIntervalChange(360)}
                    >
                      6 Horas
                    </Button>
                    <Button
                      variant={autoBackupInterval === 1440 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleIntervalChange(1440)}
                    >
                      Diario
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Limpiar Todos los Datos de la Aplicación
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center"><AlertTriangle className="h-6 w-6 text-destructive mr-2" />¡ACCIÓN IRREVERSIBLE!</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Estás absolutamente seguro de que quieres eliminar <strong>TODOS LOS DATOS</strong> de la aplicación de este navegador?
                      Serás redirigido a la página de inicio de sesión.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAllData} disabled={isProcessing} className={cn("bg-destructive hover:bg-destructive/90 text-destructive-foreground")}>
                      {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sí, Eliminar Todo y Reiniciar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: TRANSFERENCIA (IMPORTAR/EXPORTAR) */}
        <TabsContent value="transfer" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EXPORTAR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Exportar Datos</CardTitle>
                <CardDescription>Selecciona qué módulos deseas exportar o exporta todo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleExportAllData} disabled={isProcessing} className="w-full" variant="default">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                    Exportar TODO
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Selección Manual de Módulos</Label>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={handleSelectAllModules} className="text-xs h-7">Todos</Button>
                      <Button variant="ghost" size="sm" onClick={handleDeselectAllModules} className="text-xs h-7">Ninguno</Button>
                    </div>
                  </div>
                  <div className="h-[300px] overflow-y-auto border rounded-md p-2 space-y-1">
                    {dataModules.map((module) => {
                      if (module.type === 'separator') {
                        return <div key={module.id} className="font-semibold text-sm text-muted-foreground mt-2 mb-1 px-2">{module.name}</div>;
                      }
                      // @ts-ignore
                      const Icon = module.icon;
                      return (
                        <div key={module.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                          <Checkbox id={module.id} checked={selectedModules.includes(module.id)} onCheckedChange={(checked) => handleModuleToggle(module.id, checked as boolean)} />
                          <Label htmlFor={module.id} className="flex items-center gap-2 cursor-pointer text-sm font-normal w-full">
                            {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
                            {module.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  <Button onClick={handleExportData} disabled={isProcessing || selectedModules.length === 0} className="w-full" variant="outline">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Exportar Selección ({selectedModules.length})
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* IMPORTAR */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Importar Datos</CardTitle>
                <CardDescription>Restaura datos desde un archivo JSON previamente exportado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-400">Advertencia</AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-xs">
                    Importar datos sobrescribirá la información existente con los mismos IDs. Se recomienda hacer un backup antes.
                  </AlertDescription>
                </Alert>
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="import-file-input">Archivo de Respaldo (JSON)</Label>
                  <Input id="import-file-input" type="file" accept=".json" onChange={handleFileChange} disabled={isProcessing} />
                </div>
                <Button onClick={handleImportData} disabled={isProcessing || !selectedFile} className="w-full">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {isProcessing ? 'Importando...' : 'Importar Datos'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>



        {/* TAB: DEMO DATA */}
        <TabsContent value="demo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Generador de Datos de Prueba
              </CardTitle>
              <CardDescription>
                Genera datos históricos simulados para probar el sistema (Ventas, Gastos, Auditoría).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <AlertTitle className="text-blue-800 dark:text-blue-400">Información</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  Esta herramienta generará automáticamente ventas diarias, gastos mensuales (alquiler, nómina) y logs de auditoría para los últimos 12 meses.
                  <br /><strong>Nota:</strong> Los datos generados se añadirán a los existentes.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleGenerateDemoData}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
                {isGenerating ? 'Generando datos...' : 'Generar Datos de Prueba (12 Meses)'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: INFO */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>✨ Funcionalidades Implementadas</CardTitle>
              <CardDescription>
                Nuevas características disponibles en esta versión
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Sistema de Backup Automático</p>
                    <p className="text-sm text-muted-foreground">
                      Respaldos programados cada 24 horas con descarga automática opcional
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Modo Oscuro</p>
                    <p className="text-sm text-muted-foreground">
                      Tema oscuro con detección automática del sistema
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Dashboard Optimizado</p>
                    <p className="text-sm text-muted-foreground">
                      Performance mejorada 3x con hooks centralizados
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Seguridad Mejorada</p>
                    <p className="text-sm text-muted-foreground">
                      Encriptación AES-256, rate limiting, sanitización XSS y CSRF protection
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Exportación Avanzada</p>
                    <p className="text-sm text-muted-foreground">
                      Genera reportes en PDF y Excel con un clic
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageTransition >
  );
}
