import type { ReactNode } from 'react';

// ─── The door ────────────────────────────────────────────────────────────────
// One frame for every page a person meets before the panel: sign in, forgot
// password, set a password. Same mark, same card, same footer, so the three
// read as one place. Lives under the public root layout (these pages sit in
// app/[locale], like /login always has) but wears the admin's own scope —
// Arial, white card, burgundy — because this is the panel's front door, not
// a page of the site.

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
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

        {footer && <div className="mt-6 text-center font-body text-xs text-ink/50">{footer}</div>}
      </main>
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
