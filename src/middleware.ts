import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

// Routes that are accessible without authentication or without completed password change
const AUTH_ROUTES = ['/auth/signin', '/auth/change-password'];
const PUBLIC_API_ROUTES = ['/api/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass through static files, Next.js internals, and public API routes
  if (
    pathname.startsWith('/_next') ||
    PUBLIC_FILE.test(pathname) ||
    PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))
  ) {
    return NextResponse.next();
  }

  // Language redirect for /pt -> /pt-PT
  if (pathname.startsWith('/pt')) {
    return NextResponse.redirect(
      new URL(pathname.replace('/pt', '/pt-PT') + req.nextUrl.search, req.url),
    );
  }

  // Default locale redirect
  if (req.nextUrl.locale === 'default') {
    const locale = req.cookies.get('NEXT_LOCALE')?.value ?? 'en';
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}${req.nextUrl.search}`, req.url),
    );
  }

  // Skip further auth checks for auth pages themselves
  if (AUTH_ROUTES.some((r) => pathname.includes(r))) {
    return NextResponse.next();
  }

  // For all other pages, check session token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    // Not authenticated – redirect to sign in
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // If forcePasswordChange is set, redirect to change-password page
  if (token.forcePasswordChange && !pathname.includes('/auth/change-password')) {
    return NextResponse.redirect(new URL('/auth/change-password', req.url));
  }

  return NextResponse.next();
}
