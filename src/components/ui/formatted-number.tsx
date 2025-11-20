
import React from 'react';
import { cn } from '@/lib/utils';

interface FormattedNumberProps {
  value: number | undefined | null;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimalClassName?: string;
  decimalPlaces?: number;
}

export function FormattedNumber({
  value,
  prefix = '',
  suffix = '',
  className,
  decimalClassName = 'opacity-70',
  decimalPlaces = 2,
}: FormattedNumberProps) {
  if (typeof value !== 'number' || isNaN(value)) {
    return <span className={cn('text-base', className)}>{prefix}--{suffix}</span>;
  }

  const formattedValue = value.toFixed(decimalPlaces);
  const [integerPart, decimalPart] = formattedValue.split('.');

  if (decimalPlaces === 0 || !decimalPart) {
    return (
      <span className={cn('text-base', className)}>
        {prefix}{integerPart}{suffix}
      </span>
    );
  }

  return (
    <span className={cn('text-base', className)}>
      {prefix}{integerPart}<span className={cn('text-sm', decimalClassName)}>.{decimalPart}</span>{suffix}
    </span>
  );
}
