'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { suggestRecipeIngredients, KEYS, loadFromLocalStorage } from '@/lib/data-storage';
import { useToast } from '@/hooks/use-toast';

interface RecipeAssistantAIProps {
    recipeName: string;
    category: string;
    onApplySuggestions: (ingredients: any[], estimatedYield: number) => void;
    disabled?: boolean;
}

export function RecipeAssistantAI({
    recipeName,
    category,
    onApplySuggestions,
    disabled
}: RecipeAssistantAIProps) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleGetSuggestions = () => {
        if (!recipeName || recipeName.length < 3) {
            toast({
                title: "Nombre requerido",
                description: "Escribe un nombre de receta para obtener sugerencias",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        const recipes = loadFromLocalStorage(KEYS.RECIPES) || [];
        const result = suggestRecipeIngredients(recipeName, category, recipes);
        setSuggestions(result);
        setLoading(false);
        setOpen(true);
    };

    const handleApply = () => {
        if (!suggestions) return;

        const ingredients = suggestions.suggestedIngredients.map((ing: any) => ({
            id: crypto.randomUUID(),
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ''
        }));

        onApplySuggestions(ingredients, suggestions.estimatedYield);
        setOpen(false);

        toast({
            title: "✨ Sugerencias aplicadas",
            description: "Revisa y ajusta las cantidades según tu experiencia"
        });
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={handleGetSuggestions}
                disabled={disabled || loading}
                className="w-full border-amber-500 text-amber-700 hover:bg-amber-50"
            >
                <Sparkles className="mr-2 h-4 w-4" />
                {loading ? 'Analizando...' : 'Obtener Sugerencias IA'}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Sugerencias IA para "{recipeName}"
                        </DialogTitle>
                        <DialogDescription>
                            {suggestions?.reasoning || 'Generando sugerencias...'}
                        </DialogDescription>
                    </DialogHeader>

                    {suggestions && (
                        <div className="space-y-4">
                            {/* Ingredientes */}
                            <div>
                                <h4 className="font-semibold mb-3 text-sm">
                                    Ingredientes Sugeridos ({suggestions.suggestedIngredients.length}):
                                </h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {suggestions.suggestedIngredients.map((ing: any, i: number) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between p-3 bg-muted rounded"
                                        >
                                            <span className="font-medium capitalize flex-1">
                                                {ing.name}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-mono">
                                                    {ing.quantity} {ing.unit}
                                                </span>
                                                <Badge variant={
                                                    ing.confidence > 80 ? 'default' :
                                                        ing.confidence > 50 ? 'secondary' : 'outline'
                                                }>
                                                    {ing.confidence}%
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Estimaciones */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-amber-50 rounded border border-amber-200">
                                <div>
                                    <p className="text-xs text-amber-700 font-medium">Costo Estimado</p>
                                    <p className="text-xl font-bold text-amber-900">
                                        ${suggestions.estimatedCost.toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-amber-700 font-medium">Rendimiento Estimado</p>
                                    <p className="text-xl font-bold text-amber-900">
                                        {suggestions.estimatedYield} unidades
                                    </p>
                                </div>
                            </div>

                            {/* Recetas similares */}
                            {suggestions.similarRecipes.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                    <strong>Basado en:</strong> {suggestions.similarRecipes.slice(0, 3).join(', ')}
                                    {suggestions.similarRecipes.length > 3 && '...'}
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground italic">
                                💡 Esta es una sugerencia inicial. Ajusta cantidades según tu experiencia.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cerrar
                        </Button>
                        <Button onClick={handleApply} disabled={!suggestions}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Usar Sugerencias
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
