import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { roleOf } from '@/lib/auth/roles';

// ─── Proxy ───────────────────────────────────────────────────────────────────
// (Next 16's name for the file that was middleware.ts. Same request, same
// NextRequest/NextResponse, same matcher; the function is called `proxy`.)
//
// Two jobs on every request, composed into ONE response so neither can lose
// the other's headers:
//
//   1. Locale routing (next-intl), public site only. `/yoga` is rewritten to
//      `/en/yoga` internally and stays `/yoga` in the address bar; `/es/yoga`
//      passes straight through; a stray `/en/yoga` is redirected to `/yoga`.
//      Nothing here ever redirects by Accept-Language or cookie — detection is
//      off in i18n/routing.ts, so the URL alone decides the language.
//   2. The Supabase session refresh and the role gates, unchanged from the
//      previous middleware.ts. Only how they sit next to (1) is new.
//
// Which treatment a request gets is decided once, by pathname:
//
//   /admin/*, /instructor/*, /api/*  → auth only. They live outside
//                                       app/[locale]; there is no /es/admin.
//   everything else                  → locale routing, then the same auth pass
//                                       (the session refresh and the /login
//                                       rule apply on public pages, as before).
//
// The cookie hazard, spelled out: Supabase writes a refreshed session by
// calling `setAll`, which puts Set-Cookie headers on whatever response object
// it is handed. If that response were then thrown away for a fresh one — a
// redirect, or next-intl's rewrite built separately — the refresh would be
// lost and the reader would be logged out on the next request. So there is
// exactly one `response` per request, rebuilt only inside `setAll` (from the
// request that now carries the new cookies, so the page sees them too), and
// every redirect copies its cookies across before leaving.

const handleI18nRouting = createIntlMiddleware(routing);

const BACKOFFICE_PREFIXES = ['/admin', '/instructor', '/api'];

function isBackoffice(pathname: string): boolean {
  return BACKOFFICE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * `/es/login` → `/login`. The auth rules below are written against the
 * locale-less path, so the Spanish twin of a page is gated exactly like the
 * English one.
 */
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const backoffice = isBackoffice(pathname);

  // The one response for this request. A function, because Supabase may need
  // it rebuilt (see setAll); built from `request` so the headers it forwards
  // to the page are the request's current ones.
  const buildResponse = () =>
    backoffice ? NextResponse.next({ request }) : handleI18nRouting(request);

  let response = buildResponse();

  // Skip if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // A response snapshots the request headers when it is created, so
          // the one built above would forward the stale cookie to the page.
          // Rebuild from the updated request, then set the new cookies on it.
          response = buildResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — do not remove this. `getUser()` asks the auth server,
  // so the role read here is the one the house granted, not a claim the
  // browser could have edited.
  const { data: { user } } = await supabase.auth.getUser();
  const role = roleOf(user);

  // A redirect is a new response. The session cookies Supabase may just have
  // refreshed ride along, or the next request would arrive with the old token.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  const route = stripLocale(pathname);

  // ── /login — login del admin ───────────────────────────────────────────────
  // Si el admin ya tiene sesión activa y va al login, lo mandamos al dashboard
  if (route === '/login' && role === 'admin') {
    return redirectTo(new URL('/admin', request.url));
  }

  // ── /admin/* — panel de administración ────────────────────────────────────
  // Requiere sesión con role='admin'. Excluimos /login (ya es top-level).
  if (route.startsWith('/admin')) {
    if (!user || role !== 'admin') {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname); // opcional: volver después del login
      return redirectTo(url);
    }
  }

  // ── /instructor/* — portal de instructores ─────────────────────────────────
  // /instructor/login es pública; el resto requiere role='instructor'
  if (route.startsWith('/instructor') && route !== '/instructor/login') {
    if (!user || role !== 'instructor') {
      return redirectTo(new URL('/instructor/login', request.url));
    }
  }

  // Si el instructor ya tiene sesión y va a su login, al dashboard
  if (route === '/instructor/login' && role === 'instructor') {
    return redirectTo(new URL('/instructor', request.url));
  }

  return response;
}

export const config = {
  // Everything except Next's internals, Vercel's, and any path with a file
  // extension: images and fonts as before, and now also /sitemap.xml,
  // /robots.txt and /llms.txt, which must not be rewritten under /en.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
