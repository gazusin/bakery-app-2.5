'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { suggestExpenseCategory, KEYS, loadFromLocalStorage } from '@/lib/data-storage';

interface ExpenseCategoryAIProps {
    description: string;
    onSuggestionAccept: (category: string) => void;
}

export function ExpenseCategoryAI({ description, onSuggestionAccept }: ExpenseCategoryAIProps) {
    const [suggestion, setSuggestion] = useState<any>(null);

    useEffect(() => {
        if (!description || description.length < 3) {
            setSuggestion(null);
            return;
        }

        const expenses = loadFromLocalStorage(KEYS.EXPENSES) || [];
        const result = suggestExpenseCategory(description, expenses);

        if (result.confidence > 60) {
            setSuggestion(result);
        } else {
            setSuggestion(null);
        }
    }, [description]);

    if (!suggestion) return null;

    return (
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200 animate-in fade-in slide-in-from-top-2 duration-300">
            <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm">
                    <strong className="text-amber-900">IA sugiere:</strong>{' '}
                    <span className="font-semibold text-amber-800">{suggestion.category}</span>
                    <span className="text-amber-600 ml-2">
                        ({suggestion.confidence}% confianza)
                    </span>
                </p>
                {suggestion.alternatives.length > 0 && (
                    <p className="text-xs text-amber-700 mt-1">
                        Alternativas: {suggestion.alternatives.map((a: any) => a.category).join(', ')}
                    </p>
                )}
            </div>
            <Button
                size="sm"
                variant="default"
                onClick={() => {
                    onSuggestionAccept(suggestion.category);
                    setSuggestion(null);
                }}
                className="flex-shrink-0"
            >
                Usar
            </Button>
        </div>
    );
}
