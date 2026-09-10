import type { MetadataRoute } from 'next';
import { BUSINESS } from '@/lib/business';

// The web app manifest: the name and icon a phone uses when the site is
// added to a home screen, and one more place the brand is spelled the same.
// `browser` display, not standalone — this is a website, not an app, and a
// guest who saves it should get back the browser they know.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BUSINESS.name,
    short_name: BUSINESS.name,
    description: BUSINESS.description,
    start_url: '/',
    display: 'browser',
    background_color: '#f2ebe7',
    theme_color: '#340000',
    icons: [
      { src: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
