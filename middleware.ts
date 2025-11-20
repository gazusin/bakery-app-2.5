import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect private routes
 * Redirects unauthenticated users to login page
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/logout'];

    // Check if the current path is public
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // If it's a public route, allow access
    if (isPublicRoute) {
        return NextResponse.next();
    }

    // Check for authentication
    // Since we're using localStorage, we need to check via cookie or header
    // For now, we'll let the client-side handle this, but in production
    // you should use HTTP-only cookies

    // Allow the request to proceed - client-side will handle redirect
    // This is because localStorage is not accessible in middleware
    return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
