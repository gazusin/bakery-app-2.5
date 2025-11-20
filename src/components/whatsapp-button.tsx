"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send } from 'lucide-react';
import { useWhatsApp } from '@/lib/whatsapp-utils';
import { useToast } from '@/hooks/use-toast';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WhatsAppButtonProps {
    phoneNumber: string;
    message: string;
    customerName?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    showIcon?: boolean;
    className?: string;
    children?: React.ReactNode;
}

/**
 * Botón genérico para enviar mensajes por WhatsApp
 */
export function WhatsAppButton({
    phoneNumber,
    message,
    customerName,
    variant = 'outline',
    size = 'sm',
    showIcon = true,
    className,
    children
}: WhatsAppButtonProps) {
    const { sendCustomMessage, isValidPhoneNumber } = useWhatsApp();
    const { toast } = useToast();

    const handleClick = () => {
        try {
            if (!phoneNumber) {
                toast({
                    title: "Teléfono no disponible",
                    description: "El cliente no tiene un número de teléfono registrado.",
                    variant: "destructive"
                });
                return;
            }

            if (!isValidPhoneNumber(phoneNumber)) {
                toast({
                    title: "Número inválido",
                    description: "El número de teléfono no tiene un formato válido.",
                    variant: "destructive"
                });
                return;
            }

            sendCustomMessage(phoneNumber, message);

            toast({
                title: "WhatsApp abierto",
                description: `Mensaje para ${customerName || 'cliente'} preparado.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo abrir WhatsApp. Verifica el número de teléfono.",
                variant: "destructive"
            });
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={handleClick}
                        className={className}
                    >
                        {showIcon && <MessageCircle className="h-4 w-4 mr-2" />}
                        {children || 'Enviar por WhatsApp'}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Enviar mensaje a {customerName || 'cliente'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface SendInvoiceButtonProps {
    phoneNumber: string;
    invoiceData: {
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
    };
    businessName?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

/**
 * Botón especializado para enviar facturas por WhatsApp
 */
export function SendInvoiceButton({
    phoneNumber,
    invoiceData,
    businessName = 'Panadería',
    variant = 'outline',
    size = 'sm',
    className
}: SendInvoiceButtonProps) {
    const { sendInvoice } = useWhatsApp();
    const { toast } = useToast();

    const handleSendInvoice = () => {
        try {
            if (!phoneNumber) {
                toast({
                    title: "Teléfono no disponible",
                    description: "El cliente no tiene un número de teléfono registrado.",
                    variant: "destructive"
                });
                return;
            }

            sendInvoice(phoneNumber, invoiceData, businessName);

            toast({
                title: "Factura enviada",
                description: `Factura #${invoiceData.invoiceNumber} lista para enviar a ${invoiceData.customerName}.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: (error as Error).message || "No se pudo enviar la factura.",
                variant: "destructive"
            });
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={handleSendInvoice}
                        className={className}
                    >
                        <Send className={cn("h-4 w-4", size !== 'icon' && "mr-2")} />
                        {size !== 'icon' && "Enviar Factura"}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Enviar factura #{invoiceData.invoiceNumber} por WhatsApp</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface SendReminderButtonProps {
    phoneNumber: string;
    customerName: string;
    invoiceNumber: string;
    amountDue: number;
    dueDate: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

/**
 * Botón para enviar recordatorios de pago por WhatsApp
 */
export function SendReminderButton({
    phoneNumber,
    customerName,
    invoiceNumber,
    amountDue,
    dueDate,
    variant = 'outline',
    size = 'sm',
    className
}: SendReminderButtonProps) {
    const { sendReminder } = useWhatsApp();
    const { toast } = useToast();

    const handleSendReminder = () => {
        try {
            if (!phoneNumber) {
                toast({
                    title: "Teléfono no disponible",
                    description: "El cliente no tiene un número de teléfono registrado.",
                    variant: "destructive"
                });
                return;
            }

            sendReminder(phoneNumber, customerName, invoiceNumber, amountDue, dueDate);

            toast({
                title: "Recordatorio enviado",
                description: `Recordatorio de pago enviado a ${customerName}.`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: (error as Error).message || "No se pudo enviar el recordatorio.",
                variant: "destructive"
            });
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={variant}
                        size={size}
                        onClick={handleSendReminder}
                        className={className}
                    >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Recordar Pago
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Enviar recordatorio de pago a {customerName}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
