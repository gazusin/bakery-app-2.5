import React, { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash } from 'lucide-react';
import { FormattedNumber } from '@/components/ui/formatted-number';
import { SaleItem, Product, Sale } from '@/lib/data-storage';

interface SaleItemRowProps {
    item: SaleItem;
    index: number;
    formType: 'new' | 'edit';
    itemType: 'items' | 'changes' | 'samples';
    availableProducts: Product[];
    onValueChange: (index: number, field: keyof Omit<SaleItem, 'subtotal'>, value: string | number, formType: 'new' | 'edit', itemType: 'items' | 'changes' | 'samples') => void;
    onRemove: (index: number, formType: 'new' | 'edit', itemType: 'items' | 'changes' | 'samples') => void;
    isSubmitting: boolean;
    editingSale?: Sale | null;
}

export const SaleItemRow = memo(({
    item,
    index,
    formType,
    itemType,
    availableProducts,
    onValueChange,
    onRemove,
    isSubmitting,
    editingSale
}: SaleItemRowProps) => {

    const handleProductChange = (value: string) => {
        onValueChange(index, 'productId', value, formType, itemType);
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange(index, 'quantity', e.target.value, formType, itemType);
    };

    const handleUnitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onValueChange(index, 'unitPrice', e.target.value, formType, itemType);
    };

    const isItem = itemType === 'items';
    const isChange = itemType === 'changes';
    const isSample = itemType === 'samples';

    return (
        <div className="grid grid-cols-12 gap-2 items-end border-b pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
            <div className={`col-span-12 ${isSample ? 'sm:col-span-7' : 'sm:col-span-5'} space-y-1`}>
                {index === 0 && <Label className="text-xs">
                    {isItem ? 'Producto (Sede)' : isChange ? 'Producto Devuelto (Sede)' : 'Producto Muestra (Sede)'}
                </Label>}
                <Select value={item.productId || undefined} onValueChange={handleProductChange} disabled={isSubmitting}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Producto" /></SelectTrigger>
                    <SelectContent>
                        {availableProducts.map(p => (
                            <SelectItem
                                key={p.id}
                                value={p.id}
                                disabled={p.stock <= 0 && !(formType === 'edit' && editingSale?.itemsPerBranch.flatMap(bd => bd.items).find(i => i.productId === p.id))}
                            >
                                {p.name} ({p.sourceBranchName} - Stock: {p.stock})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className={`${isSample ? 'col-span-5 sm:col-span-4' : 'col-span-4 sm:col-span-2'} space-y-1`}>
                {index === 0 && <Label className="text-xs">{isChange ? 'Cant. Dev.' : 'Cant.'}</Label>}
                <Input
                    type="number"
                    placeholder="Cant."
                    value={item.quantity}
                    onChange={handleQuantityChange}
                    disabled={isSubmitting || !item.productId}
                    min="0"
                    className="h-9"
                />
            </div>

            {!isSample && (
                <>
                    <div className="col-span-8 sm:col-span-2 space-y-1">
                        {index === 0 && <Label className="text-xs">{isChange ? 'P. Unit. Dev. (USD)' : 'P. Unit. (USD)'}</Label>}
                        <Input
                            type="number"
                            placeholder="Precio"
                            value={item.unitPrice}
                            onChange={handleUnitPriceChange}
                            disabled={isSubmitting || !item.productId}
                            min="0"
                            className="h-9"
                        />
                    </div>
                    <div className="col-span-8 sm:col-span-2 space-y-1">
                        {index === 0 && <Label className="text-xs">{isChange ? 'Subtotal Dev. (USD)' : 'Subtotal (USD)'}</Label>}
                        <div className="h-9 rounded-md bg-muted/50 px-3 flex items-center justify-end">
                            <FormattedNumber value={item.subtotal} prefix="$" />
                        </div>
                    </div>
                </>
            )}

            <div className={`${isSample ? 'col-span-1' : 'col-span-4 sm:col-span-1'} flex items-end justify-end`}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index, formType, itemType)}
                    disabled={isSubmitting}
                    className="h-9 w-9 text-destructive hover:bg-destructive/10"
                >
                    <Trash className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
});

SaleItemRow.displayName = 'SaleItemRow';
