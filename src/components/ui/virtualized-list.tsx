"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VirtualizedListProps<T> {
    data: T[];
    height?: number | string;
    itemHeight?: number;
    renderRow: (item: T, style: React.CSSProperties) => React.ReactNode;
    header?: React.ReactNode;
    emptyMessage?: string;
    className?: string;
}

/**
 * Simplified list component without virtualization
 * TODO: Re-enable virtualization when react-window issues are resolved
 */
export function VirtualizedList<T>({
    data,
    height = 500,
    itemHeight = 60,
    renderRow,
    header,
    emptyMessage = "No hay datos disponibles",
    className
}: VirtualizedListProps<T>) {

    if (data.length === 0) {
        return (
            <div className="w-full border rounded-md">
                {header && <div className="bg-muted/50 border-b">{header}</div>}
                <div className="p-8 text-center text-muted-foreground">
                    {emptyMessage}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full border rounded-md bg-background", className)}>
            {header && <div className="bg-muted/50 border-b sticky top-0 z-10">{header}</div>}
            <ScrollArea style={{ height: typeof height === 'number' ? `${height}px` : height }}>
                <div className="w-full">
                    {data.map((item, index) => (
                        <div key={index}>
                            {renderRow(item, {})}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
