import type { Metadata } from 'next';

// Not for the index. A sign-in form, a password screen, a booking flow and a
// payment receipt have nothing to offer a search result, and a crawler that
// lands on one should leave without keeping it. robots.txt already keeps
// crawlers out of these paths; this covers the ones that arrive by a link.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children;
}
