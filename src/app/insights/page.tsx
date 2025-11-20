"use client";

import React, { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PageTransition } from '@/components/page-transition';
import { BusinessInsightsPanel } from '@/components/dashboard/business-insights';
import { useBusinessInsights, type Insight } from '@/hooks/useBusinessInsights';
import { salesData, KEYS, loadFromLocalStorage, loadAllProductsFromAllBranches, customersData } from '@/lib/data-storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
    Lightbulb,
    TrendingUp,
    Package,
    DollarSign,
    Users,
    BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function InsightsPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('all');

    const sales = salesData;
    const products = loadAllProductsFromAllBranches();
    const customers = customersData;
    const expenses: any[] = loadFromLocalStorage(KEYS.EXPENSES) || [];

    const { insights, highPriorityCount, actionableCount } = useBusinessInsights(
        sales,
        products,
        customers,
        expenses
    );

    const handleActionClick = (insight: Insight) => {
        toast({
            title: "Acción registrada",
            description: `Navegando a: ${insight.actionLabel}`,
        });
        // Aquí puedes agregar navegación o acciones específicas
    };

    const filterInsightsByCategory = (category: string) => {
        if (category === 'all') return insights;
        return insights.filter(i => i.category === category);
    };

    const categoryStats = {
        trending: insights.filter(i => i.category === 'trending').length,
        inventory: insights.filter(i => i.category === 'inventory').length,
        finance: insights.filter(i => i.category === 'finance').length,
        customer: insights.filter(i => i.category === 'customer').length,
        forecast: insights.filter(i => i.category === 'forecast').length,
    };

    return (
        <PageTransition className="space-y-6">
            <PageHeader
                title="Insights del Negocio"
                description="Recomendaciones automáticas y análisis inteligente de tu panadería"
                icon={Lightbulb}
            />

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                                <Lightbulb className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Insights</p>
                                <p className="text-2xl font-bold">{insights.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                                <TrendingUp className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Alta Prioridad</p>
                                <p className="text-2xl font-bold">{highPriorityCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                                <BarChart3 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Accionables</p>
                                <p className="text-2xl font-bold">{actionableCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Inventario</p>
                                <p className="text-2xl font-bold">{categoryStats.inventory}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                                <Users className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Clientes</p>
                                <p className="text-2xl font-bold">{categoryStats.customer}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs con categorías */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="all">
                        Todos ({insights.length})
                    </TabsTrigger>
                    <TabsTrigger value="trending">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Tendencias ({categoryStats.trending})
                    </TabsTrigger>
                    <TabsTrigger value="inventory">
                        <Package className="h-4 w-4 mr-1" />
                        Inventario ({categoryStats.inventory})
                    </TabsTrigger>
                    <TabsTrigger value="finance">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Finanzas ({categoryStats.finance})
                    </TabsTrigger>
                    <TabsTrigger value="customer">
                        <Users className="h-4 w-4 mr-1" />
                        Clientes ({categoryStats.customer})
                    </TabsTrigger>
                    <TabsTrigger value="forecast">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Pronósticos ({categoryStats.forecast})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-6">
                    <BusinessInsightsPanel
                        insights={insights}
                        highPriorityCount={highPriorityCount}
                        actionableCount={actionableCount}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>

                <TabsContent value="trending" className="mt-6">
                    <BusinessInsightsPanel
                        insights={filterInsightsByCategory('trending')}
                        highPriorityCount={filterInsightsByCategory('trending').filter(i => i.priority === 'high').length}
                        actionableCount={filterInsightsByCategory('trending').filter(i => i.actionable).length}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>

                <TabsContent value="inventory" className="mt-6">
                    <BusinessInsightsPanel
                        insights={filterInsightsByCategory('inventory')}
                        highPriorityCount={filterInsightsByCategory('inventory').filter(i => i.priority === 'high').length}
                        actionableCount={filterInsightsByCategory('inventory').filter(i => i.actionable).length}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>

                <TabsContent value="finance" className="mt-6">
                    <BusinessInsightsPanel
                        insights={filterInsightsByCategory('finance')}
                        highPriorityCount={filterInsightsByCategory('finance').filter(i => i.priority === 'high').length}
                        actionableCount={filterInsightsByCategory('finance').filter(i => i.actionable).length}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>

                <TabsContent value="customer" className="mt-6">
                    <BusinessInsightsPanel
                        insights={filterInsightsByCategory('customer')}
                        highPriorityCount={filterInsightsByCategory('customer').filter(i => i.priority === 'high').length}
                        actionableCount={filterInsightsByCategory('customer').filter(i => i.actionable).length}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>

                <TabsContent value="forecast" className="mt-6">
                    <BusinessInsightsPanel
                        insights={filterInsightsByCategory('forecast')}
                        highPriorityCount={filterInsightsByCategory('forecast').filter(i => i.priority === 'high').length}
                        actionableCount={filterInsightsByCategory('forecast').filter(i => i.actionable).length}
                        onActionClick={handleActionClick}
                    />
                </TabsContent>
            </Tabs>
        </PageTransition>
    );
}
