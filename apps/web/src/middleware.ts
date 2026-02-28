import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public routes — accessible without auth
const isPublicRoute = createRouteMatcher([
  '/',
  '/search(.*)',
  '/calculator(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health(.*)',
  '/api/perdiem(.*)',
  '/api/waitlist(.*)',
  '/offline(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files (including .json, .txt, .xml for PWA/SEO)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
