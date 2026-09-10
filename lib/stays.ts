// ─── The dwellings ───────────────────────────────────────────────────────────
// The four places to sleep at House of Shakti, in the order Nancy presents
// them. /stay-with-us shows the ones on offer with the Cloudbeds door beside
// each; /host-your-retreat shows the ones a group takes over, as a shop
// window with no door at all. One record per dwelling, here, so the two pages
// can never drift apart on a bed count or a capacity line — and a dwelling
// that is not on offer for now is switched off here, once, with `hidden`,
// its record kept whole for the day it comes back.
//
// Each record is language-neutral data — slug, photographs — plus its words
// in every language under `copy`. Pages ask for a dwelling in a locale and
// get the flat `Stay` the cards render; nothing downstream knows there are
// two versions.

import type { AppLocale } from '@/i18n/routing';

export type StaySlug = 'main-house' | 'la-casita' | 'jungle-bungalow' | 'shakti-house';

/** The words of one dwelling, in one language. */
export type StayCopy = {
  /** Fact line: capacity · layout. Rendered under the title, never above it. */
  meta: string;
  title: string;
  /** Card copy — short, one breath. */
  short: string;
  /** The full story, one string per paragraph. */
  long: string[];
  /** Optional bullet list (bed configurations). Rendered after `long`. */
  facts?: { label: string; items: string[] };
  /** Optional closing capacity line. */
  capacity?: string;
};

export type StayData = StayCopy & { images: string[] };

export type Stay = StayData & { slug: StaySlug };

type StayRecord = {
  slug: StaySlug;
  images: string[];
  copy: Record<AppLocale, StayCopy>;
  /**
   * Kept out of every listing. The record stays — photographs, both
   * languages — so putting the dwelling back on offer is flipping this off.
   */
  hidden?: boolean;
};

// The photographs are 3:4 portraits, shot and cropped for the cards, named
// after the dwelling's folder: /images/stay-with-us/<slug>/<slug>-<n>.webp.
const shots = (dir: StaySlug, n: number) =>
  Array.from({ length: n }, (_, i) => `/images/stay-with-us/${dir}/${dir}-${i + 1}.webp`);

// The dwellings' names — Main House, La Casita, Jungle Bungalow, Shakti House
// — are the house's own and stay as they are in both languages.
const RECORDS: StayRecord[] = [
  {
    slug: 'main-house',
    images: shots('main-house', 6),
    copy: {
      en: {
        meta: 'Up to 10 guests · Four suites, each with a private bathroom',
        title: 'Main House Suite',
        short:
          'Four spacious suites gathered around a shared heart, each with its own private bathroom — an elegant, serene base in a refined natural setting. It is possible to reserve the entire Main House exclusively for your group, with accommodation for up to 10 people.',
        long: [
          'The Main House offers an elegant and serene experience, thoughtfully designed to provide both comfort and privacy within a refined natural setting. It features four spacious suites, each with its own private bathroom.',
          'Fully equipped with air conditioning in every suite and high-speed Wi-Fi throughout, the Main House blends modern comfort with a peaceful atmosphere — the right environment for rest and connection.',
        ],
        facts: {
          label: 'Room configurations may include',
          items: [
            'Triple rooms — 3 single beds',
            'Double rooms — 2 single beds',
            'Private rooms for single occupancy or couples — 1 king-size bed each',
          ],
        },
        // The house's own wording. The four suites book one at a time or all
        // together, and this is the line that says so, last, before the door.
        capacity:
          'It is possible to reserve the entire Main House exclusively for your group, with accommodation for up to 10 people.',
      },
      es: {
        meta: 'Hasta 10 huéspedes · Cuatro suites, cada una con baño privado',
        title: 'Main House Suite',
        short:
          'Cuatro amplias suites reunidas en torno a un corazón compartido, cada una con su propio baño privado: una base elegante y serena en un entorno natural refinado. Es posible reservar la Main House completa en exclusiva para tu grupo, con alojamiento para hasta 10 personas.',
        long: [
          'La Main House ofrece una experiencia elegante y serena, pensada para brindar comodidad y privacidad en un entorno natural refinado. Cuenta con cuatro amplias suites, cada una con su propio baño privado.',
          'Con aire acondicionado en todas las suites y wifi de alta velocidad en toda la casa, la Main House combina el confort moderno con una atmósfera apacible: el entorno justo para el descanso y la conexión.',
        ],
        facts: {
          label: 'Las configuraciones de habitación pueden incluir',
          items: [
            'Habitaciones triples — 3 camas individuales',
            'Habitaciones dobles — 2 camas individuales',
            'Habitaciones privadas para una persona o parejas — 1 cama king cada una',
          ],
        },
        capacity:
          'Es posible reservar la Main House completa en exclusiva para tu grupo, con alojamiento para hasta 10 personas.',
      },
    },
  },
  {
    slug: 'la-casita',
    images: shots('la-casita', 8),
    copy: {
      en: {
        meta: 'Up to 3 guests · One bedroom, kitchen and terrace',
        title: 'La Casita',
        short:
          'A one-bedroom home nestled in the tropical greenery — queen bed, full kitchen, and a terrace that opens onto the jungle. Built for slow mornings and unhurried work.',
        long: [
          'A charming and intimate home nestled within lush tropical greenery, offering a peaceful and private escape immersed in nature. Thoughtfully designed for comfort and simplicity, it provides a warm, home-like atmosphere ideal for rest, creativity, and slow living.',
          'The space features one bedroom with a queen-size bed, equipped with air conditioning and ceiling fans for year-round comfort. An additional single bed can be arranged in the living area, allowing for flexible accommodation.',
          'La Casita includes a fully equipped kitchen, a cozy living and workspace, and a beautiful terrace overlooking the jungle — perfect for slow mornings, quiet reflection, or inspired moments of work and creativity.',
        ],
        capacity:
          'Capacity: up to 2 guests without bed sharing, or up to 3 guests with shared accommodation.',
      },
      es: {
        meta: 'Hasta 3 huéspedes · Un dormitorio, cocina y terraza',
        title: 'La Casita',
        short:
          'Una casa de un dormitorio en medio del verde tropical: cama queen, cocina completa y una terraza que se abre a la selva. Hecha para mañanas lentas y trabajo sin prisa.',
        long: [
          'Una casa encantadora e íntima en medio de una exuberante vegetación tropical, que ofrece un refugio apacible y privado inmerso en la naturaleza. Pensada para la comodidad y la sencillez, tiene una atmósfera cálida y hogareña, ideal para el descanso, la creatividad y la vida sin prisa.',
          'El espacio cuenta con un dormitorio con cama queen, aire acondicionado y ventiladores de techo para estar cómodo todo el año. Puede sumarse una cama individual en la sala de estar, para un alojamiento flexible.',
          'La Casita incluye una cocina totalmente equipada, un acogedor espacio de estar y de trabajo, y una hermosa terraza con vista a la selva: perfecta para mañanas lentas, reflexión tranquila o momentos inspirados de trabajo y creatividad.',
        ],
        capacity:
          'Capacidad: hasta 2 huéspedes sin compartir cama, o hasta 3 huéspedes compartiendo alojamiento.',
      },
    },
  },
  {
    slug: 'jungle-bungalow',
    images: shots('jungle-bungalow', 8),
    copy: {
      en: {
        meta: 'Up to 2 guests · One bedroom, private bathroom',
        title: 'Jungle Bungalow',
        short:
          'A single room in the heart of the jungle. Queen bed, private bathroom, and a ceiling fan turning through naturally cool air — secluded, simple, and quiet.',
        long: [
          'An intimate and secluded bungalow nestled in the heart of the jungle, offering a simple yet deeply grounding experience surrounded by nature.',
          'The bungalow features a queen-size bed, a ceiling fan for gentle natural airflow, and a private bathroom — a comfortable space that keeps a close connection with the surrounding landscape.',
        ],
        capacity:
          'Capacity: 1 guest without bed sharing, or up to 2 guests sharing a queen-size bed.',
      },
      es: {
        meta: 'Hasta 2 huéspedes · Un dormitorio, baño privado',
        title: 'Jungle Bungalow',
        short:
          'Una sola habitación en el corazón de la selva. Cama queen, baño privado y un ventilador de techo girando en un aire naturalmente fresco: apartado, sencillo y silencioso.',
        long: [
          'Un bungalow íntimo y apartado en el corazón de la selva, que ofrece una experiencia sencilla y profundamente arraigada, rodeada de naturaleza.',
          'El bungalow cuenta con una cama queen, un ventilador de techo para una brisa natural suave y un baño privado: un espacio cómodo que mantiene una conexión cercana con el paisaje que lo rodea.',
        ],
        capacity:
          'Capacidad: 1 huésped sin compartir cama, o hasta 2 huéspedes compartiendo una cama queen.',
      },
    },
  },
  {
    slug: 'shakti-house',
    images: shots('shakti-house', 10),
    // Not on offer at launch (2026-09-10), on the owners' call. Hidden rather
    // than deleted: the house may open again.
    hidden: true,
    copy: {
      en: {
        meta: 'Up to 4 guests · Two bedrooms, two bathrooms',
        title: 'Shakti House',
        short:
          'Two queen bedrooms, two full bathrooms, and a kitchen that makes it a real home. The expansive deck opens onto jungle and ocean views at once.',
        long: [
          'A beautifully designed private home that blends comfort, spaciousness, and breathtaking natural surroundings. Perfect for guests seeking a more independent stay while remaining fully connected to the retreat experience.',
          'The house features two peaceful bedrooms with queen-size beds, each equipped with air conditioning and ceiling fans. Two full bathrooms provide additional comfort and privacy.',
          'A fully equipped kitchen and welcoming living area create a true sense of home, while the expansive deck opens to stunning jungle and ocean views — an ideal setting for relaxation, connection, or simply enjoying the beauty of the landscape.',
        ],
        capacity:
          'Capacity: up to 2 guests without bed sharing, or up to 4 guests with shared accommodation.',
      },
      es: {
        meta: 'Hasta 4 huéspedes · Dos dormitorios, dos baños',
        title: 'Shakti House',
        short:
          'Dos dormitorios con cama queen, dos baños completos y una cocina que la convierten en un verdadero hogar. La amplia terraza se abre a la vez a la selva y al mar.',
        long: [
          'Una casa privada de hermoso diseño que combina comodidad, amplitud y un entorno natural impresionante. Perfecta para quienes buscan una estadía más independiente sin dejar de estar plenamente conectados con la experiencia del retiro.',
          'La casa cuenta con dos dormitorios apacibles con camas queen, cada uno con aire acondicionado y ventiladores de techo. Dos baños completos brindan comodidad y privacidad adicionales.',
          'Una cocina totalmente equipada y una sala de estar acogedora crean una verdadera sensación de hogar, mientras que la amplia terraza se abre a vistas imponentes de la selva y el mar: el escenario ideal para relajarse, conectar o simplemente disfrutar de la belleza del paisaje.',
        ],
        capacity:
          'Capacidad: hasta 2 huéspedes sin compartir cama, o hasta 4 huéspedes compartiendo alojamiento.',
      },
    },
  },
];

function toStay(record: StayRecord, locale: AppLocale): Stay {
  return { slug: record.slug, images: record.images, ...record.copy[locale] };
}

/** The dwellings on offer, in the order named, in one language. */
export function getStays(locale: AppLocale): Stay[] {
  return RECORDS.filter((record) => !record.hidden).map((record) => toStay(record, locale));
}

/**
 * The dwellings named, in the order named — for a page that shows a subset.
 * A hidden dwelling is left out even when asked for by name, so switching one
 * off in RECORDS takes it off every page at once.
 */
export function pickStays(slugs: StaySlug[], locale: AppLocale): Stay[] {
  return slugs.flatMap((slug) => {
    const record = RECORDS.find((r) => r.slug === slug);
    if (!record) throw new Error(`Unknown stay: ${slug}`);
    return record.hidden ? [] : [toStay(record, locale)];
  });
}
