"use client";

import React from 'react';
import { PageHeader } from '@/components/page-header';
import { PageTransition } from '@/components/page-transition';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DollarSign,
  Home,
  Package,
  AlertTriangle,
  BarChart as BarChartIcon,
  TrendingUp,
  TrendingDown,
  Archive,
  CreditCard as CreditCardIcon,
  ShoppingCart,
  CheckCircle2,
  Utensils,
  Receipt,
  Shuffle,
  ArrowRightLeft,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { useSmartAlerts } from '@/hooks/useSmartAlerts';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { RevenueVsExpensesChart, TopProductsPieChart, TrendChart, ChartInsight } from '@/components/dashboard/advanced-charts';
import { CardSkeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Save, Trash2 } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { salesData, KEYS, loadFromLocalStorage, type Expense } from '@/lib/data-storage';
import { DailySummary } from '@/components/dashboard/daily-summary';

const mainBakeryId = 'panaderia_principal';
const processedProductsId = 'productos_elaborados';

// StatCard Component
interface StatCardProps {
  title: string;
  value: number;
  currency?: 'USD' | 'VES';
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  description?: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

function StatCard({ title, value, currency = 'USD', icon: Icon, trend, description, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'border-border',
    success: 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
    danger: 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20',
    warning: 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-600 dark:text-green-400',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card className={cn('transition-all hover:shadow-md', variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconStyles[variant])} />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">
            {currency === 'USD' ? '$' : 'Bs.'}{value.toFixed(2)}
          </div>
          {TrendIcon && (
            <TrendIcon className={cn('h-4 w-4', trend === 'up' ? 'text-green-600' : 'text-red-600')} />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ExchangeRateManager Component
function ExchangeRateManager() {
  const { toast } = useToast();
  const {
    currentRate,
    rateInput,
    setRateInput,
    rateHistory,
    pastDate,
    setPastDate,
    pastRateInput,
    setPastRateInput,
    isPastDatePickerOpen,
    setIsPastDatePickerOpen,
    saveCurrentRate,
    savePastRate,
    deleteRate,
  } = useExchangeRate();

  const handleSaveCurrentRate = async () => {
    const result = await saveCurrentRate();
    toast({
      title: result.success ? 'Éxito' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const handleSavePastRate = async () => {
    const result = await savePastRate();
    toast({
      title: result.success ? 'Éxito' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  const handleDeleteRate = async (entry: any) => {
    const result = await deleteRate(entry);
    toast({
      title: result.success ? 'Tasa eliminada' : 'Error',
      description: result.message,
      variant: result.success ? 'default' : 'destructive',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasa de Cambio USD/VES</CardTitle>
        <CardDescription>
          Tasa actual: ${currentRate > 0 ? currentRate.toFixed(4) : 'No definida'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Rate */}
        <div className="space-y-2">
          <Label htmlFor="current-rate">Tasa del día (hoy)</Label>
          <div className="flex gap-2">
            <Input
              id="current-rate"
              type="number"
              placeholder="Ej: 45.50"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              step="0.0001"
            />
            <Button onClick={handleSaveCurrentRate}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>

        {/* Past Rate */}
        <div className="space-y-2">
          <Label>Tasa de un día pasado</Label>
          <div className="flex gap-2">
            <Popover open={isPastDatePickerOpen} onOpenChange={setIsPastDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {pastDate ? formatDate(pastDate, 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={pastDate}
                  onSelect={(date) => {
                    setPastDate(date);
                    setIsPastDatePickerOpen(false);
                  }}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="number"
              placeholder="Tasa"
              value={pastRateInput}
              onChange={(e) => setPastRateInput(e.target.value)}
              step="0.0001"
              className="w-32"
            />
            <Button onClick={handleSavePastRate} disabled={!pastDate}>
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* History */}
        {rateHistory.length > 0 && (
          <div className="space-y-2">
            <Label>Historial (últimas 7)</Label>
            <ScrollArea className="h-[150px] rounded-md border p-2">
              <div className="space-y-1">
                {rateHistory.map((entry) => (
                  <div key={entry.date} className="flex items-center justify-between text-sm p-2 hover:bg-muted rounded">
                    <div>
                      <span className="font-medium">{formatDate(parseISO(entry.date), 'dd/MM/yyyy', { locale: es })}</span>
                      <span className="ml-2 text-muted-foreground">${entry.rate.toFixed(4)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRate(entry)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ProductSalesChart Component
function ProductSalesChart({ data }: { data: Array<{ name: string; quantity: number }> }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChartIcon className="h-5 w-5" />
            Top 10 Productos Más Vendidos
          </CardTitle>
          <CardDescription>Últimos 7 días</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No hay datos de ventas disponibles</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChartIcon className="h-5 w-5" />
          Top 10 Productos Más Vendidos
        </CardTitle>
        <CardDescription>Últimos 7 días</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="quantity" fill="hsl(var(--primary))" name="Cantidad Vendida" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ActivityFeed Component
function ActivityFeed({ activities }: { activities: Array<any> }) {
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'ShoppingCart': return ShoppingCart;
      case 'CheckCircle2': return CheckCircle2;
      case 'Utensils': return Utensils;
      case 'DollarSign': return DollarSign;
      case 'Receipt': return Receipt;
      case 'Shuffle': return Shuffle;
      case 'ArrowRightLeft': return ArrowRightLeft;
      default: return ShoppingCart;
    }
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimas 5 transacciones</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No hay actividad reciente</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
        <CardDescription>Últimas 5 transacciones</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {activities.map((activity) => {
              const IconComponent = activity.icon || getIcon(activity.iconType);
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <IconComponent className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.type}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activity.displayTime}</span>
                      {activity.branchName && <span>• {activity.branchName}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Main Dashboard
export default function DashboardPage() {
  const {
    branch1Stats,
    branch2Stats,
    overdueCreditsAmountUSD,
    creditsDueSoonAmountUSD,
    productSalesChartData,
    recentActivities,
    isLoading,
  } = useDashboardData();

  // Load data for advanced analytics
  const sales = salesData;
  const expenses: any[] = loadFromLocalStorage(KEYS.EXPENSES) || [];
  const { currentRate } = useExchangeRate();

  const {
    revenueVsExpensesData,
    topProductsData,
    trendData,
    insights
  } = useAdvancedAnalytics(sales, expenses, currentRate);

  // Activate smart alerts
  useSmartAlerts(
    branch1Stats.lowStockItemsCount + branch2Stats.lowStockItemsCount,
    overdueCreditsAmountUSD,
    0, // monthlyRevenue - puede agregarse después
    0, // monthlyGoal - puede agregarse después
    branch1Stats.lowRawMaterialStockItemsCount + branch2Stats.lowRawMaterialStockItemsCount
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Panel Principal"
          description="Visión general del rendimiento de tu panadería en tiempo real."
          icon={Home}
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} className="h-[120px]" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <CardSkeleton className="col-span-4 h-[400px]" />
          <CardSkeleton className="col-span-3 h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Panel Principal"
        description="Visión general del rendimiento de tu panadería en tiempo real."
        icon={Home}
      />

      {/* Daily AI Summary */}
      <DailySummary />

      {/* Exchange Rate */}
      <ExchangeRateManager />

      {/* Panadería Principal Stats */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Panadería Principal</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos Semana"
            value={branch1Stats.weeklyRevenue}
            icon={DollarSign}
            trend={branch1Stats.weeklyRevenue > 0 ? 'up' : 'neutral'}
            variant="success"
            description="Ingresos de esta semana"
          />
          <StatCard
            title="Pérdidas Semana"
            value={branch1Stats.estimatedWeeklyLoss}
            icon={AlertTriangle}
            trend="down"
            variant="danger"
            description="Mermas y cambios"
          />
          <StatCard
            title="Ganancia Neta"
            value={branch1Stats.estimatedWeeklyProfit}
            icon={TrendingUp}
            trend={branch1Stats.estimatedWeeklyProfit > 0 ? 'up' : 'down'}
            variant={branch1Stats.estimatedWeeklyProfit > 0 ? 'success' : 'danger'}
            description="Ingresos - Pérdidas"
          />
          <StatCard
            title="Productos en Stock"
            value={branch1Stats.productsWithStockCount}
            icon={Package}
            variant="default"
            description={branch1Stats.descriptionStock as any}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Stock Bajo"
            value={branch1Stats.lowStockItemsCount}
            icon={AlertTriangle}
            variant={branch1Stats.lowStockItemsCount > 0 ? 'warning' : 'default'}
            description={branch1Stats.descriptionLowStock as any}
          />
          <StatCard
            title="MP Stock Bajo"
            value={branch1Stats.lowRawMaterialStockItemsCount}
            icon={Archive}
            variant={branch1Stats.lowRawMaterialStockItemsCount > 0 ? 'warning' : 'default'}
            description={branch1Stats.descriptionLowRaw as any}
          />
          <StatCard
            title="Órdenes Pendientes"
            value={branch1Stats.pendingOrders}
            icon={ShoppingCart}
            variant={branch1Stats.pendingOrders > 0 ? 'warning' : 'default'}
            description={branch1Stats.descriptionPendingOrders as any}
          />
        </div>
      </div>

      {/* Productos Elaborados Stats */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Productos Elaborados</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ingresos Semana"
            value={branch2Stats.weeklyRevenue}
            icon={DollarSign}
            trend={branch2Stats.weeklyRevenue > 0 ? 'up' : 'neutral'}
            variant="success"
            description="Ingresos de esta semana"
          />
          <StatCard
            title="Pérdidas Semana"
            value={branch2Stats.estimatedWeeklyLoss}
            icon={AlertTriangle}
            trend="down"
            variant="danger"
            description="Mermas y cambios"
          />
          <StatCard
            title="Ganancia Neta"
            value={branch2Stats.estimatedWeeklyProfit}
            icon={TrendingUp}
            trend={branch2Stats.estimatedWeeklyProfit > 0 ? 'up' : 'down'}
            variant={branch2Stats.estimatedWeeklyProfit > 0 ? 'success' : 'danger'}
            description="Ingresos - Pérdidas"
          />
          <StatCard
            title="Productos en Stock"
            value={branch2Stats.productsWithStockCount}
            icon={Package}
            variant="default"
            description={branch2Stats.descriptionStock as any}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Stock Bajo"
            value={branch2Stats.lowStockItemsCount}
            icon={AlertTriangle}
            variant={branch2Stats.lowStockItemsCount > 0 ? 'warning' : 'default'}
            description={branch2Stats.descriptionLowStock as any}
          />
          <StatCard
            title="MP Stock Bajo"
            value={branch2Stats.lowRawMaterialStockItemsCount}
            icon={Archive}
            variant={branch2Stats.lowRawMaterialStockItemsCount > 0 ? 'warning' : 'default'}
            description={branch2Stats.descriptionLowRaw as any}
          />
          <StatCard
            title="Órdenes Pendientes"
            value={branch2Stats.pendingOrders}
            icon={ShoppingCart}
            variant={branch2Stats.pendingOrders > 0 ? 'warning' : 'default'}
            description={branch2Stats.descriptionPendingOrders as any}
          />
        </div>
      </div>

      {/* Credits Alert */}
      {(overdueCreditsAmountUSD > 0 || creditsDueSoonAmountUSD > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {overdueCreditsAmountUSD > 0 && (
            <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <CreditCardIcon className="h-5 w-5" />
                  Créditos Vencidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                  ${overdueCreditsAmountUSD.toFixed(2)}
                </p>
                <Link href="/accounts-receivable">
                  <Button variant="outline" className="mt-2" size="sm">
                    Ver Detalles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {creditsDueSoonAmountUSD > 0 && (
            <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                  <CreditCardIcon className="h-5 w-5" />
                  Créditos por Vencer (3 días)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  ${creditsDueSoonAmountUSD.toFixed(2)}
                </p>
                <Link href="/accounts-receivable">
                  <Button variant="outline" className="mt-2" size="sm">
                    Ver Detalles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Analytics Insights */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Analytics e Insights</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ChartInsight
            title="Crecimiento de Ingresos"
            value={`${insights.revenueGrowth > 0 ? '+' : ''}${insights.revenueGrowth}%`}
            trend={insights.revenueGrowth > 0 ? 'up' : insights.revenueGrowth < 0 ? 'down' : 'neutral'}
            trendValue={`vs mes anterior`}
            icon={TrendingUp}
          />
          <ChartInsight
            title="Margen de Ganancia"
            value={`${insights.profitMargin.toFixed(1)}%`}
            trend={insights.profitMargin > 30 ? 'up' : insights.profitMargin < 15 ? 'down' : 'neutral'}
            trendValue={`del total de ventas`}
            icon={DollarSign}
          />
          <ChartInsight
            title="Ingreso Promedio Diario"
            value={`$${insights.averageDailyRevenue.toFixed(2)}`}
            trend="neutral"
            trendValue={`últimos 30 días`}
            icon={BarChartIcon}
          />
        </div>
      </div>

      {/* Advanced Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueVsExpensesChart data={revenueVsExpensesData} />
        <TopProductsPieChart data={topProductsData} />
      </div>

      <TrendChart data={trendData} />

      {/* Original Charts and Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProductSalesChart data={productSalesChartData} />
        <ActivityFeed activities={recentActivities} />
      </div>
    </PageTransition>
  );
}
