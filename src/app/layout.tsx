
"use client";

import { migrateDataToIndexedDB } from '@/lib/db-migration';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import Image from 'next/image';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Home,
  Package,
  ShoppingCart,
  DollarSign,
  Users,


  FileText,
  Utensils,
  Layers,
  Target,
  Receipt,
  LogOut,
  UserCircle,
  Archive,
  Building,
  CreditCard,
  Landmark,
  CheckCircle2,
  ListFilter,
  ArrowRightLeft,
  Shuffle,
  TrendingUp,
  Globe,
  Store,
  PanelLeft,
  ArchiveRestore,
  Settings,
  Lightbulb,
  Shield,
  Clock,
  PackageX
} from 'lucide-react';
import Link from 'next/link';
import { getActiveBranchId, availableBranches, userProfileData } from '@/lib/data-storage';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QueryProvider } from '@/providers/query-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const HeaderSidebarToggle = () => {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 hidden md:flex"
      onClick={toggleSidebar}
      title="Colapsar/Expandir barra lateral"
    >
      <PanelLeft />
      <span className="sr-only">Colapsar/Expandir barra lateral</span>
    </Button>
  );
};


const allNavItems = [
  { href: "/", label: "Panel Principal", icon: Home, scope: 'global' },
  { href: "/insights", label: "Insights del Negocio", icon: Lightbulb, scope: 'global' },
  { href: "/accounts-receivable", label: "Cuentas por Cobrar", icon: CreditCard, scope: 'global' },
  { href: "/customers", label: "Clientes", icon: Users, scope: 'global' },
  { href: "/users", label: "Usuarios", icon: Shield, scope: 'global' },
  { href: "/audit-logs", label: "Logs de Auditoría", icon: Clock, scope: 'global' },
  // { href: "/data-management", label: "Gestión de Datos", icon: ArchiveRestore, scope: 'global' }, // Movido al footer
  { href: "/inventory", label: "Stock de producción", icon: Package, scope: 'global' },
  { href: "/inventory-transfers", label: "Transferencias MP", icon: ArrowRightLeft, scope: 'global' },
  { href: "/payment-verification", label: "Verificación de Pagos", icon: CheckCircle2, scope: 'global' },
  { href: "/payment-report", label: "Cierre de Cobranza", icon: DollarSign, scope: 'global' },
  { href: "/pending-fund-transfers", label: "Transferencias Fondos", icon: Shuffle, scope: 'global' },
  { href: "/price-comparison", label: "Simulador de costos de recetas", icon: ListFilter, scope: 'global' },
  { href: "/product-losses", label: "Registro de Pérdidas", icon: PackageX, scope: 'branch' },
  { href: "/profit-loss", label: "Estado de Resultados (P&L)", icon: TrendingUp, scope: 'global' },
  { href: "/reports", label: "Reportes", icon: FileText, scope: 'global' },
  { href: "/sales", label: "Ventas", icon: ShoppingCart, scope: 'global' },
  { href: "/suppliers", label: "Proveedores", icon: Building, scope: 'global' },
  { href: "/account-movements", label: "Movimientos de Cuenta", icon: Landmark, scope: 'branch' },
  { href: "/employees", label: "Empleados", icon: Users, scope: 'branch' },
  { href: "/expenses", label: "Gastos", icon: DollarSign, scope: 'branch' },
  { href: "/goals", label: "Metas de Producción", icon: Target, scope: 'branch' },
  { href: "/orders", label: "Órdenes de Compra", icon: Receipt, scope: 'branch' },
  { href: "/production", label: "Producción", icon: Layers, scope: 'branch' },
  { href: "/production-planner", label: "Planificador Inteligente", icon: TrendingUp, scope: 'global' },
  { href: "/raw-material-inventory", label: "Inventario Materia Prima", icon: Archive, scope: 'branch' },
  { href: "/recipes", label: "Recetas", icon: Utensils, scope: 'branch' },
] as const;

// Memorizar para evitar recalcular en cada render
const navItems = (() => {
  const globalNavItems = allNavItems
    .filter(item => item.scope === 'global')
    .sort((a, b) => a.label.localeCompare(b.label));

  const branchNavItems = allNavItems
    .filter(item => item.scope === 'branch')
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...globalNavItems, ...branchNavItems];
})();

const allFooterNavItems = [
  { href: "/select-branch", label: "Cambiar Sede", icon: Building, scope: 'global' },
  { href: "/data-management", label: "Gestión de Datos", icon: ArchiveRestore, scope: 'global' },
  { href: "/logout", label: "Cerrar Sesión", icon: LogOut, scope: 'global' },
  { href: "/profile", label: "Perfil de Usuario", icon: UserCircle, scope: 'global' },
] as const;

const footerNavItems = (() => {
  const globalFooterNavItems = allFooterNavItems
    .filter(item => item.scope === 'global')
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...globalFooterNavItems];
})();


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Run DB Migration
  useEffect(() => {
    const initDB = async () => {
      await migrateDataToIndexedDB();
      const { initializeDataFromDB } = await import('@/lib/data-storage');
      await initializeDataFromDB();
    };
    initDB();
  }, []);

  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Optimizar con useCallback para evitar recrear función
  const checkAuthAndBranch = useCallback(() => {
    const loggedIn = localStorage.getItem('isUserLoggedIn') === 'true';
    const currentBranch = getActiveBranchId();
    setIsAuthenticated(loggedIn);
    setActiveBranchIdState(currentBranch);
    if (loggedIn && userProfileData) {
      setUserName(userProfileData.fullName);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isClient) {
      checkAuthAndBranch();

      // Listen for user updates
      const handleUserUpdate = () => checkAuthAndBranch();
      window.addEventListener('user-updated', handleUserUpdate);

      // Listen for storage events (cross-tab)
      window.addEventListener('storage', handleUserUpdate);

      return () => {
        window.removeEventListener('user-updated', handleUserUpdate);
        window.removeEventListener('storage', handleUserUpdate);
      };
    }
  }, [isClient, checkAuthAndBranch]);

  // Re-check auth when pathname changes to catch login transitions
  useEffect(() => {
    checkAuthAndBranch();
  }, [pathname, checkAuthAndBranch]);

  useEffect(() => {
    if (!loading) {
      // Double check auth state directly from storage to avoid stale state race conditions
      const currentAuth = localStorage.getItem('isUserLoggedIn') === 'true';

      if (!currentAuth && pathname !== '/login') {
        router.replace('/login');
      } else if (currentAuth && !activeBranchId && pathname !== '/login' && pathname !== '/select-branch' && !navItems.find(item => item.href === pathname && item.scope === 'global') && !footerNavItems.find(item => item.href === pathname && item.scope === 'global')) {
        router.replace('/select-branch');
      }
    }
  }, [loading, isAuthenticated, activeBranchId, pathname, router]);

  const activeBranchName = availableBranches.find(b => b.id === activeBranchId)?.name;
  const branchThemeClass = activeBranchId === 'panaderia_principal' ? 'theme-panaderia' : '';


  if (loading) {
    return (
      <html lang="es" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
            Cargando...
          </div>
        </body>
      </html>
    );
  }

  const isGlobalPage = navItems.some(item => item.href === pathname && item.scope === 'global') || footerNavItems.some(item => item.href === pathname && item.scope === 'global');
  const shouldDisplaySidebar = isAuthenticated && (activeBranchId || isGlobalPage) && pathname !== '/login' && pathname !== '/select-branch';


  if (!isAuthenticated && pathname !== '/login') {
    return (
      <html lang="es" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
            Redirigiendo...
          </div>
          <Toaster />
        </body>
      </html>
    );
  }
  if (isAuthenticated && !activeBranchId && pathname !== '/login' && pathname !== '/select-branch' && !isGlobalPage) {
    return (
      <html lang="es" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
            Redirigiendo a selección de sede...
          </div>
          <Toaster />
        </body>
      </html>
    );
  }


  return (
    <html lang="es" suppressHydrationWarning className={cn(branchThemeClass)}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <QueryProvider>
          <ThemeProvider defaultTheme="system" storageKey="bakery-ui-theme">
            <ErrorBoundary>
              {shouldDisplaySidebar ? (
                <SidebarProvider defaultOpen={true}>
                  <div className="flex min-h-screen w-full bg-background">
                    <Sidebar
                      collapsible="icon"
                      className="border-r border-sidebar-border shadow-md"
                      variant="sidebar"
                    >
                      <SidebarHeader className="relative border-b border-sidebar-border w-full h-64 group-data-[collapsible=icon]:h-auto p-0">
                        <SidebarMenuButton
                          asChild
                          tooltip={{ children: "Panificadora Valladares", side: "right", className: "bg-primary text-primary-foreground" }}
                          className="flex items-center justify-center w-full h-full p-0 data-[active=true]:bg-transparent hover:bg-sidebar-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                          isActive={pathname === "/"}
                        >
                          <Link href="/" className="relative w-full h-full flex items-center justify-center">
                            <Image
                              src="/panificadora_valladares_logo.png"
                              alt="Panificadora Valladares Logo"
                              layout="fill"
                              objectFit="contain"
                              className="rounded-md group-data-[collapsible=icon]:hidden p-2"
                              priority
                            />
                            <Store className="h-10 w-10 hidden group-data-[collapsible=icon]:block" />
                          </Link>
                        </SidebarMenuButton>
                      </SidebarHeader>
                      <SidebarContent className="flex-1 px-2 py-2">
                        <SidebarMenu className="space-y-1">
                          {navItems.map((item) => (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton
                                asChild
                                tooltip={{ children: item.label + (item.scope === 'global' ? ' (Global)' : ''), side: "right", className: "bg-primary text-primary-foreground" }}
                                className="justify-start text-sm"
                                isActive={pathname === item.href}
                              >
                                <Link href={item.href} prefetch={true} className="flex items-center w-full">
                                  <item.icon className="h-5 w-5 mr-3 group-data-[collapsible=icon]:mr-0 flex-shrink-0" />
                                  <span className="group-data-[collapsible=icon]:hidden flex-grow truncate">{item.label}</span>
                                  {item.scope === 'global' && (
                                    <Globe className="h-3.5 w-3.5 ml-2 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden flex-shrink-0" />
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarContent>
                      <SidebarFooter className="p-2 border-t border-sidebar-border">
                        <SidebarMenu className="space-y-1">
                          {footerNavItems.map((item) => (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton
                                asChild
                                tooltip={{ children: item.label + (item.scope === 'global' ? ' (Global)' : ''), side: "right", className: "bg-primary text-primary-foreground" }}
                                className="justify-start text-sm"
                                isActive={pathname === item.href}
                              >
                                <Link href={item.href} prefetch={true} className="flex items-center w-full">
                                  <item.icon className="h-5 w-5 mr-3 group-data-[collapsible=icon]:mr-0 flex-shrink-0" />
                                  <span className="group-data-[collapsible=icon]:hidden flex-grow truncate">{item.label}</span>
                                  {item.scope === 'global' && (
                                    <Globe className="h-3.5 w-3.5 ml-2 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden flex-shrink-0" />
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarFooter>
                    </Sidebar>
                    <SidebarInset className="flex-1 flex flex-col overflow-hidden">
                      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:px-6">
                        <div className="flex items-center gap-2">
                          <SidebarTrigger className="md:hidden" />
                          <div className="flex flex-col">
                            {activeBranchName && <span className="text-sm font-medium text-muted-foreground">Sede Activa: {activeBranchName}</span>}
                            {!activeBranchName && isGlobalPage && <span className="text-sm font-medium text-muted-foreground">Vista Global (Sin sede activa)</span>}
                            {isAuthenticated && userName && <span className="text-xs text-muted-foreground/80">Usuario: {userName}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ThemeToggle />
                          <HeaderSidebarToggle />
                        </div>
                      </header>
                      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                        {children}
                      </main>
                    </SidebarInset>
                  </div>
                </SidebarProvider>
              ) : (
                <>
                  {children}
                </>
              )}
              <Toaster />
            </ErrorBoundary>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
