/**
 * Utilities for exporting data to PDF and Excel (CSV) formats
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Sale, Payment, Product } from './data-storage';

/**
 * Formats a number as currency
 */
function formatCurrency(amount: number, currency: 'USD' | 'VES' = 'USD'): string {
    const symbol = currency === 'USD' ? '$' : 'Bs.';
    return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Converts data to CSV format
 */
function convertToCSV(data: any[], headers: string[]): string {
    const rows = data.map(row =>
        headers.map(header => {
            const value = row[header] ?? '';
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Downloads a file to the user's computer
 */
function downloadFile(content: string | Blob, filename: string, mimeType: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exports sales data to Excel (CSV)
 */
export function exportSalesToExcel(sales: Sale[], filename?: string) {
    const headers = [
        'ID',
        'Fecha',
        'Cliente',
        'Total (USD)',
        'Método de Pago',
        'Estado',
        'Monto Pagado'
    ];

    const data = sales.map(sale => ({
        'ID': sale.id,
        'Fecha': sale.date,
        'Cliente': sale.customerName || 'N/A',
        'Total (USD)': sale.totalAmount.toFixed(2),
        'Método de Pago': sale.paymentMethod,
        'Estado': sale.status || 'N/A',
        'Monto Pagado': sale.amountPaidUSD.toFixed(2)
    }));

    const csv = convertToCSV(data, headers);
    const defaultFilename = `ventas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadFile(csv, filename || defaultFilename, 'text/csv;charset=utf-8;');
}

/**
 * Exports products data to Excel (CSV)
 */
export function exportProductsToExcel(products: Product[], filename?: string) {
    const headers = [
        'ID',
        'Nombre',
        'Categoría',
        'Stock',
        'Precio Unitario',
        'Sucursal'
    ];

    const data = products.map(product => ({
        'ID': product.id,
        'Nombre': product.name,
        'Categoría': product.category,
        'Stock': product.stock.toString(),
        'Precio Unitario': product.unitPrice.toFixed(2),
        'Sucursal': product.sourceBranchName || 'N/A'
    }));

    const csv = convertToCSV(data, headers);
    const defaultFilename = `productos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadFile(csv, filename || defaultFilename, 'text/csv;charset=utf-8;');
}

/**
 * Exports payments data to Excel (CSV)
 */
export function exportPaymentsToExcel(payments: Payment[], filename?: string) {
    const headers = [
        'ID',
        'Cliente',
        'Fecha de Pago',
        'Monto (USD)',
        'Método',
        'Estado',
        'Referencia'
    ];

    const data = payments.map(payment => ({
        'ID': payment.id,
        'Cliente': payment.customerName,
        'Fecha de Pago': payment.paymentDate,
        'Monto (USD)': payment.amountAppliedToDebtUSD.toFixed(2),
        'Método': payment.paymentMethod,
        'Estado': payment.status,
        'Referencia': payment.referenceNumber || 'N/A'
    }));

    const csv = convertToCSV(data, headers);
    const defaultFilename = `pagos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadFile(csv, filename || defaultFilename, 'text/csv;charset=utf-8;');
}

/**
 * Exports invoice/sale to PDF
 */
export function exportInvoiceToPDF(sale: Sale) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('FACTURA', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Factura #: ${sale.id}`, 20, 35);
    doc.text(`Fecha: ${format(new Date(sale.date), 'dd/MM/yyyy', { locale: es })}`, 20, 42);
    doc.text(`Cliente: ${sale.customerName || 'N/A'}`, 20, 49);

    // Table of items
    const tableData: any[] = [];

    sale.itemsPerBranch.forEach(branchDetail => {
        // Add branch header
        tableData.push([
            { content: `Sucursal: ${branchDetail.branchName}`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
        ]);

        // Add items
        branchDetail.items.forEach(item => {
            tableData.push([
                item.productName,
                item.quantity.toString(),
                formatCurrency(item.unitPrice),
                formatCurrency(item.subtotal)
            ]);
        });
    });

    autoTable(doc, {
        startY: 60,
        head: [['Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY || 60;

    doc.setFontSize(12);
    doc.text(`Total: ${formatCurrency(sale.totalAmount)}`, 150, finalY + 15);
    doc.text(`Método de Pago: ${sale.paymentMethod}`, 20, finalY + 15);

    if (sale.paymentMethod === 'Crédito' && sale.dueDate) {
        doc.text(`Fecha de Vencimiento: ${format(new Date(sale.dueDate), 'dd/MM/yyyy', { locale: es })}`, 20, finalY + 22);
    }

    // Footer
    doc.setFontSize(8);
    doc.text('Bakery Management System 2.5', 105, 285, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 105, 290, { align: 'center' });

    // Download
    doc.save(`factura_${sale.id}.pdf`);
}

/**
 * Exports weekly report to PDF
 */
export function exportWeeklyReportToPDF(
    weekStart: Date,
    weekEnd: Date,
    revenue: number,
    expenses: number,
    profit: number,
    topProducts: Array<{ name: string; quantity: number }>
) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.text('REPORTE SEMANAL', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.text(
        `Período: ${format(weekStart, 'dd/MM/yyyy', { locale: es })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: es })}`,
        105,
        30,
        { align: 'center' }
    );

    // Summary
    doc.setFontSize(14);
    doc.text('Resumen Financiero', 20, 45);

    doc.setFontSize(11);
    const summaryY = 55;
    doc.text(`Ingresos:`, 20, summaryY);
    doc.text(formatCurrency(revenue), 70, summaryY);

    doc.text(`Gastos:`, 20, summaryY + 8);
    doc.text(formatCurrency(expenses), 70, summaryY + 8);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Ganancia Neta:`, 20, summaryY + 18);
    doc.text(formatCurrency(profit), 70, summaryY + 18);
    doc.setFont(undefined, 'normal');

    // Top products table
    doc.setFontSize(14);
    doc.text('Productos Más Vendidos', 20, summaryY + 35);

    const productTableData = topProducts.map(p => [p.name, p.quantity.toString()]);

    autoTable(doc, {
        startY: summaryY + 42,
        head: [['Producto', 'Cantidad Vendida']],
        body: productTableData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
    });

    // Footer
    doc.setFontSize(8);
    doc.text('Bakery Management System 2.5', 105, 285, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 105, 290, { align: 'center' });

    // Download
    doc.save(`reporte_semanal_${format(weekStart, 'yyyy-MM-dd')}.pdf`);
}

/**
 * Generic function to export any table data to Excel
 */
export function exportTableToExcel(
    data: any[],
    headers: string[],
    filename: string
) {
    const csv = convertToCSV(data, headers);
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Generic function to export any table data to PDF
 */
export function exportTableToPDF(
    data: any[][],
    headers: string[],
    title: string,
    filename: string
) {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(title, 105, 20, { align: 'center' });

    autoTable(doc, {
        startY: 30,
        head: [headers],
        body: data,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] },
    });

    // Footer
    doc.setFontSize(8);
    doc.text('Bakery Management System 2.5', 105, 285, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 105, 290, { align: 'center' });

    doc.save(filename);
}
