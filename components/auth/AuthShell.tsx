'use client';

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname, usePathname } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';

// ─── The door ────────────────────────────────────────────────────────────────
// One frame for every page a person meets before the panel: sign in, forgot
// password, set a password. Same mark, same card, same footer, so the three
// read as one place. Lives under the public root layout (these pages sit in
// app/[locale], like /login always has) but wears the admin's own scope —
// Arial, white card, burgundy — because this is the panel's front door, not
// a page of the site.
//
// The footer carries a discreet EN | ES switch: the same page in the other
// language, so a link that landed on /set-password can be read in Spanish.

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const t = useTranslations('auth.shell');
  return (
    <div className="admin-scope font-body min-h-screen bg-neutral-50 flex items-center justify-center p-4 text-ink">
      <main className="w-full max-w-sm" id="main-content">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo-hos-negro.webp"
            alt="House of Shakti"
            className="h-12 w-auto mx-auto mb-6"
            decoding="async"
          />
          <h1 className="font-body text-2xl font-normal text-black leading-tight">{title}</h1>
          {subtitle && <p className="font-body text-sm text-ink/50 mt-2">{subtitle}</p>}
        </div>

        <div className="bg-white border border-ink/10 p-6">{children}</div>

        <div className="mt-6 text-center font-body text-xs text-ink/50">
          <div>{t('footer')}</div>
          <LanguageSwitch />
        </div>
      </main>
    </div>
  );
}

// Two links to this same page, one per language. `getPathname` names the
// English page without a prefix (`/login`, never `/en/login`), so the switch
// never goes through the proxy's redirect — the same reason the site's own
// toggle builds its hrefs this way. Query and hash travel along: the sign-in
// page's `?redirect=` and a set-password link's token must survive the switch.
function LanguageSwitch() {
  const t = useTranslations('auth.shell');
  const locale = useLocale();
  const pathname = usePathname();
  // Next's own router, as in the site's toggle: next-intl's would name the
  // English page `/en/login` when switching to it explicitly.
  const router = useRouter();

  const option = (code: AppLocale) => (
    <NextLink
      href={getPathname({ href: pathname, locale: code })}
      hrefLang={code}
      aria-current={locale === code ? 'true' : undefined}
      onClick={(e) => {
        // Let the browser handle modified clicks (new tab, etc.) via the href.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (code === locale) return;
        const target = getPathname({ href: pathname, locale: code });
        router.replace(`${target}${window.location.search}${window.location.hash}`, { scroll: false });
      }}
      className={`font-body text-xs transition-colors ${
        locale === code ? 'text-ink underline underline-offset-4 decoration-[0.5px]' : 'text-ink/50 hover:text-ink'
      }`}
    >
      {code.toUpperCase()}
    </NextLink>
  );

  return (
    <div role="group" aria-label={t('language')} className="mt-2 flex items-center justify-center gap-2">
      {routing.locales.map((code, i) => (
        <span key={code} className="contents">
          {i > 0 && (
            <span aria-hidden className="text-ink/30">
              |
            </span>
          )}
          {option(code)}
        </span>
      ))}
    </div>
  );
}

/** The one line every form uses for what went wrong. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="bg-burgundy/5 border border-burgundy/20 px-3 py-2.5 text-xs text-burgundy leading-relaxed">
      {children}
    </p>
  );
}

export const FIELD_LABEL = 'font-body text-[10px] font-medium text-ink/50 uppercase tracking-[0.15em]';
export const FIELD_INPUT =
  'h-10 rounded-none bg-white border-ink/20 text-ink placeholder:text-ink/30 focus:border-burgundy focus-visible:ring-0';
export const SUBMIT_BUTTON = 'w-full h-10 rounded-none bg-burgundy text-cream text-sm hover:bg-dark disabled:opacity-60';
