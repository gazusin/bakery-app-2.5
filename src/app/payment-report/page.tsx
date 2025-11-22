"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Copy, FileDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FormattedNumber } from '@/components/ui/formatted-number';
import {
  getPaymentsWithReferenceByDate
} from '@/lib/data-storage';
import type { Payment } from '@/lib/types/db-types';

interface PaymentSummary {
  method: string;
  count: number;
  totalUSD: number;
  payments: Payment[];
}

export default function PaymentReportPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summaryByMethod, setSummaryByMethod] = useState<PaymentSummary[]>([]);

  useEffect(() => {
    loadPayments();
  }, [selectedDate]);

  const loadPayments = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayPayments = getPaymentsWithReferenceByDate(dateStr);

    const sortedPayments = [...dayPayments].sort((a, b) => {
      const timeA = new Date(a.creationTimestamp || a.paymentDate).getTime();
      const timeB = new Date(b.creationTimestamp || b.paymentDate).getTime();
      return timeB - timeA;
    });

    setPayments(sortedPayments);

    const methodMap = new Map<string, PaymentSummary>();

    sortedPayments.forEach(payment => {
      const method = payment.paymentMethod;

      if (!methodMap.has(method)) {
        methodMap.set(method, {
          method,
          count: 0,
          totalUSD: 0,
          payments: []
        });
      }

      const summary = methodMap.get(method)!;
      summary.count++;
      summary.totalUSD += payment.amountAppliedToDebtUSD;
      summary.payments.push(payment);
    });

    setSummaryByMethod(Array.from(methodMap.values()));
  };

  const generateWhatsAppText = () => {
    const dateStr = format(selectedDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
    const lines: string[] = [];

    lines.push(`CIERRE DE COBRANZA - ${dateStr.toUpperCase()}`);
    lines.push('================================');
    lines.push('');

    let grandTotal = 0;
    let totalCount = 0;

    summaryByMethod.forEach(summary => {
      lines.push(`${summary.method}: $${summary.totalUSD.toFixed(2)} (${summary.count} pagos)`);

      summary.payments.forEach(payment => {
        lines.push(`  Ref: ${payment.referenceNumber} - $${payment.amountAppliedToDebtUSD.toFixed(2)}`);
        if (payment.customerName) {
          lines.push(`    (${payment.customerName})`);
        }
      });
      lines.push('');

      grandTotal += summary.totalUSD;
      totalCount += summary.count;
    });

    if (summaryByMethod.length === 0) {
      lines.push('No se registraron pagos bancarios en esta fecha.');
    } else {
      lines.push('================================');
      lines.push(`TOTAL: $${grandTotal.toFixed(2)} (${totalCount} pagos)`);
    }

    return lines.join('\n');
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado al portapapeles",
      description: "El reporte esta listo para enviar por WhatsApp"
    });
  };

  const handleExportPDF = () => {
    const printContent = document.getElementById('print-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dateStr = format(selectedDate, "d 'de' MMMM, yyyy", { locale: es });

    printWindow.document.write(`
      <html>
        <head>
          <title>Reporte de Cierre de Cobranza - ${dateStr}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #e7f3ff; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Reporte de Cierre de Cobranza</h1>
          <p><strong>Fecha:</strong> ${dateStr}</p>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    toast({
      title: "Generando PDF",
      description: "Se abrira la ventana de impresion"
    });
  };

  const totalAmount = summaryByMethod.reduce((sum, s) => sum + s.totalUSD, 0);
  const totalPayments = summaryByMethod.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Reporte de Cierre de Cobranza"
        description="Reporte diario de pagos bancarios para validacion y contabilidad"
        icon={DollarSign}
      />

      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Fecha</CardTitle>
          <CardDescription>Elige la fecha para generar el reporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date || new Date());
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={loadPayments} variant="secondary">
              Actualizar
            </Button>

            <div className="ml-auto flex gap-2">
              <Button
                onClick={handleCopyWhatsApp}
                disabled={payments.length === 0}
                variant="outline"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar para WhatsApp
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={payments.length === 0}
                variant="outline"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen del Dia</CardTitle>
          <CardDescription>
            {payments.length > 0
              ? `${totalPayments} pagos registrados por un total de $${totalAmount.toFixed(2)}`
              : 'No hay pagos registrados para esta fecha'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaryByMethod.length > 0 ? (
            <div className="space-y-4">
              {summaryByMethod.map(summary => (
                <div key={summary.method} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{summary.method}</Badge>
                      <span className="text-sm text-gray-600">
                        {summary.count} {summary.count === 1 ? 'pago' : 'pagos'}
                      </span>
                    </div>
                    <div className="text-lg font-semibold">
                      <FormattedNumber value={summary.totalUSD} prefix="$" />
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t-2 pt-4">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span>
                    <FormattedNumber value={totalAmount} prefix="$" />
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No se encontraron pagos bancarios para esta fecha
            </div>
          )}
        </CardContent>
      </Card>

      <div id="print-content">
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Monto (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(payment => {
                    const time = payment.creationTimestamp || payment.paymentDate;
                    const timeStr = time ? format(new Date(time), 'HH:mm') : '-';

                    return (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono">{timeStr}</TableCell>
                        <TableCell>{payment.customerName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {payment.referenceNumber}
                        </TableCell>
                        <TableCell className="text-right">
                          <FormattedNumber value={payment.amountAppliedToDebtUSD} prefix="$" />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  <TableRow className="summary">
                    <TableCell colSpan={4} className="text-right font-semibold">
                      TOTAL:
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <FormattedNumber value={totalAmount} prefix="$" />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay pagos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
