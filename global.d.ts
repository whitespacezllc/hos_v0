import * as React from 'react'

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        // Cloudbeds' Immersive Experience 2.0: the booking engine as a web
        // component, defined by the script named in lib/cloudbeds.ts and
        // mounted by components/booking-engine/CloudbedsImmersive.tsx. The
        // attributes are the documented ones. The yes/no switches are strings,
        // not booleans, because the element reads them as HTML attributes.
        // Only `property-code` is required.
        'cb-immersive-experience': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
          'property-code': string;
          /** `standard` (the default) renders in the page; `popup` is for a fixed-height container. */
          mode?: 'standard' | 'popup';
          /** ISO 639-1 code, or `auto-detect` for the browser's. Falls back to <html lang>. */
          lang?: string;
          /** ISO 4217, lowercase. The property's default when omitted. */
          currency?: string;
          'hide-custom-header'?: 'yes' | 'no';
          'hide-custom-footer'?: 'yes' | 'no';
          'hide-property-info'?: 'yes' | 'no';
          /** `yes` stops the engine reading checkin, checkout, adults… from the page's query string. */
          'ignore-search-params'?: 'yes' | 'no';
          'disable-css-title-reset'?: 'yes' | 'no';
        };
      }
    }
  }
}
