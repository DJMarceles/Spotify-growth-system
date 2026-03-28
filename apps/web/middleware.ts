export { auth as middleware } from '@/lib/auth';

export const config = {
  // Protect all routes under /dashboard, /campaigns, /playlists, /artists
  // but allow public routes: /, /login, /api/auth/*
  matcher: ['/dashboard/:path*', '/campaigns/:path*', '/playlists/:path*', '/artists/:path*'],
};
