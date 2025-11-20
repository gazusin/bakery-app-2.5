"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error to console in development
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // In production, you would send this to an error tracking service
        // Example: Sentry.captureException(error, { extra: errorInfo });

        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex items-center justify-center min-h-screen bg-background p-4">
                    <Card className="w-full max-w-2xl">
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                                <CardTitle>Algo salió mal</CardTitle>
                            </div>
                            <CardDescription>
                                Ha ocurrido un error inesperado en la aplicación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="rounded-lg bg-muted p-4">
                                    <p className="font-mono text-sm text-destructive font-semibold">
                                        {this.state.error.toString()}
                                    </p>
                                    {this.state.errorInfo && (
                                        <details className="mt-4">
                                            <summary className="cursor-pointer text-sm font-medium">
                                                Stack Trace
                                            </summary>
                                            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                                Por favor, intenta recargar la página. Si el problema persiste, contacta al
                                administrador del sistema.
                            </p>
                        </CardContent>
                        <CardFooter className="flex space-x-2">
                            <Button onClick={this.handleReset} variant="default">
                                Intentar de Nuevo
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/'}
                                variant="outline"
                            >
                                Ir al Inicio
                            </Button>
                            <Button
                                onClick={() => window.location.reload()}
                                variant="secondary"
                            >
                                Recargar Página
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * HOC to wrap components with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
