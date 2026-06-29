import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Biarkan API routes langsung lewat
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    const token = request.cookies.get('auth_token')?.value;
    // Kalau sudah login dan buka /login → redirect ke dashboard
    if (pathname === '/login' && token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
