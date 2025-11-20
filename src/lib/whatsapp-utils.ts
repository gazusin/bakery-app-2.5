"use client";

/**
 * Utilidades para integración con WhatsApp
 * Permite enviar facturas, recordatorios y mensajes a clientes
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceData {
    invoiceNumber: string;
    customerName: string;
    date: string;
    totalAmount: number;
    items: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }>;
    payments?: Array<{
        method: string;
        amount: number;
    }>;
}

interface CustomerData {
    name: string;
    phone: string;
}

/**
 * Genera un enlace de WhatsApp con mensaje pre-rellenado
 * @param phoneNumber - Número de teléfono (con código de país, sin +)
 * @param message - Mensaje a enviar 
 * @returns URL de WhatsApp Web o App
 */
export function generateWhatsAppLink(phoneNumber: string, message: string): string {
    // Limpiar número de teléfono (quitar espacios, guiones, etc.)
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

    // Codificar mensaje para URL
    const encodedMessage = encodeURIComponent(message);

    // Generar link (usa api.whatsapp.com que funciona en desktop y móvil)
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
}

/**
 * Genera mensaje de factura formateado para WhatsApp
 */
export function generateInvoiceMessage(invoice: InvoiceData, businessName: string = 'Panadería'): string {
    const formattedDate = format(new Date(invoice.date), "dd 'de' MMMM 'de' yyyy", { locale: es });

    let message = `🧾 *Factura - ${businessName}*\n\n`;
    message += `*Factura #:* ${invoice.invoiceNumber}\n`;
    message += `*Cliente:* ${invoice.customerName}\n`;
    message += `*Fecha:* ${formattedDate}\n\n`;

    message += `📦 *PRODUCTOS:*\n`;
    message += `${'─'.repeat(35)}\n`;

    invoice.items.forEach((item, index) => {
        message += `${index + 1}. ${item.productName}\n`;
        message += `   ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${item.subtotal.toFixed(2)}\n`;
    });

    message += `${'─'.repeat(35)}\n`;
    message += `*TOTAL: $${invoice.totalAmount.toFixed(2)}*\n\n`;

    if (invoice.payments && invoice.payments.length > 0) {
        message += `💳 *PAGOS:*\n`;
        invoice.payments.forEach((payment, index) => {
            message += `${index + 1}. ${payment.method}: $${payment.amount.toFixed(2)}\n`;
        });
        message += '\n';
    }

    message += `¡Gracias por tu compra! 🙏\n`;
    message += `Para cualquier consulta, no dudes en contactarnos.`;

    return message;
}

/**
 * Genera mensaje de recordatorio de pago
 */
export function generatePaymentReminderMessage(
    customerName: string,
    invoiceNumber: string,
    amountDue: number,
    dueDate: string
): string {
    const formattedDate = format(new Date(dueDate), "dd 'de' MMMM", { locale: es });

    let message = `👋 Hola ${customerName},\n\n`;
    message += `Te recordamos que tienes un pago pendiente:\n\n`;
    message += `🧾 *Factura:* ${invoiceNumber}\n`;
    message += `💰 *Monto:* $${amountDue.toFixed(2)}\n`;
    message += `📅 *Vencimiento:* ${formattedDate}\n\n`;
    message += `Por favor, realiza tu pago a la brevedad posible.\n\n`;
    message += `Si ya realizaste el pago, por favor ignora este mensaje.\n\n`;
    message += `¡Gracias! 🙏`;

    return message;
}

/**
 * Genera mensaje de promoción o anuncio
 */
export function generatePromotionMessage(
    customerName: string,
    promotionTitle: string,
    promotionDescription: string,
    validUntil?: string
): string {
    let message = `🎉 ¡Hola ${customerName}!\n\n`;
    message += `*${promotionTitle}*\n\n`;
    message += `${promotionDescription}\n\n`;

    if (validUntil) {
        const formattedDate = format(new Date(validUntil), "dd 'de' MMMM", { locale: es });
        message += `⏰ *Válido hasta:* ${formattedDate}\n\n`;
    }

    message += `¡No te lo pierdas! 🛍️`;

    return message;
}

/**
 * Genera mensaje de bienvenida para nuevos clientes
 */
export function generateWelcomeMessage(customerName: string, businessName: string = 'Panadería'): string {
    let message = `¡Bienvenido/a ${customerName}! 👋\n\n`;
    message += `Gracias por elegir *${businessName}*. `;
    message += `Estamos encantados de tenerte como cliente.\n\n`;
    message += `Si tienes alguna pregunta o necesitas ayuda, `;
    message += `no dudes en contactarnos por este medio.\n\n`;
    message += `¡Esperamos verte pronto! 😊`;

    return message;
}

/**
 * Abre WhatsApp en una nueva ventana/tab
 * @param phoneNumber - Número de teléfono
 * @param message - Mensaje pre-rellenado
 */
export function openWhatsApp(phoneNumber: string, message: string): void {
    const link = generateWhatsAppLink(phoneNumber, message);
    window.open(link, '_blank', 'noopener,noreferrer');
}

/**
 * Valida formato de número de teléfono
 * @param phoneNumber - Número a validar
 * @returns true si el formato es válido
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
    // Limpiar número
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

    // Debe tener entre 10 y 15 dígitos (formato internacional)
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
}

/**
 * Formatea número de teléfono para mostrar
 * Ejemplo: 584121234567 -> +58 412 123-4567
 */
export function formatPhoneNumber(phoneNumber: string): string {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

    if (!cleanPhone) return '';

    // Formato venezolano (ejemplo)
    if (cleanPhone.startsWith('58') && cleanPhone.length === 12) {
        return `+${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2, 5)} ${cleanPhone.slice(5, 8)}-${cleanPhone.slice(8)}`;
    }

    // Formato genérico
    if (cleanPhone.length > 10) {
        return `+${cleanPhone.slice(0, -10)} ${cleanPhone.slice(-10, -7)} ${cleanPhone.slice(-7, -4)}-${cleanPhone.slice(-4)}`;
    }

    return `+${cleanPhone}`;
}

/**
 * Hook para usar WhatsApp en componentes React
 */
export function useWhatsApp() {
    const sendInvoice = (phoneNumber: string, invoice: InvoiceData, businessName?: string) => {
        if (!isValidPhoneNumber(phoneNumber)) {
            throw new Error('Número de teléfono inválido');
        }
        const message = generateInvoiceMessage(invoice, businessName);
        openWhatsApp(phoneNumber, message);
    };

    const sendReminder = (phoneNumber: string, customerName: string, invoiceNumber: string, amountDue: number, dueDate: string) => {
        if (!isValidPhoneNumber(phoneNumber)) {
            throw new Error('Número de teléfono inválido');
        }
        const message = generatePaymentReminderMessage(customerName, invoiceNumber, amountDue, dueDate);
        openWhatsApp(phoneNumber, message);
    };

    const sendPromotion = (phoneNumber: string, customerName: string, title: string, description: string, validUntil?: string) => {
        if (!isValidPhoneNumber(phoneNumber)) {
            throw new Error('Número de teléfono inválido');
        }
        const message = generatePromotionMessage(customerName, title, description, validUntil);
        openWhatsApp(phoneNumber, message);
    };

    const sendWelcome = (phoneNumber: string, customerName: string, businessName?: string) => {
        if (!isValidPhoneNumber(phoneNumber)) {
            throw new Error('Número de teléfono inválido');
        }
        const message = generateWelcomeMessage(customerName, businessName);
        openWhatsApp(phoneNumber, message);
    };

    const sendCustomMessage = (phoneNumber: string, message: string) => {
        if (!isValidPhoneNumber(phoneNumber)) {
            throw new Error('Número de teléfono inválido');
        }
        openWhatsApp(phoneNumber, message);
    };

    return {
        sendInvoice,
        sendReminder,
        sendPromotion,
        sendWelcome,
        sendCustomMessage,
        formatPhoneNumber,
        isValidPhoneNumber,
    };
}
