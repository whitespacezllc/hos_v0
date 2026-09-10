export type YogaClass = {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructor: string;
  instructorId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  spotsRemaining: number;
  priceUsd: number;
  location: string;
  isActive: boolean;
  color?: string;
  imageUrl?: string | null;
};

export type RecurringSlot = {
  id: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Dom, 1=Lun...
  timeStart: string; // "HH:mm"
  capacity: number;
  priceUsd: number;
  isActive: boolean;
};

export type Booking = {
  id: string;
  classId: string;
  className: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  persons: number;
  upsells: string[];
  paymentStatus: 'pending' | 'paid' | 'free' | 'cancelled' | 'no-show';
  paymentMethod: 'card' | 'cash' | 'venmo';
  bookingReference: string;
  referralCode?: string;
  createdAt: Date;
};

export type Upsell = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  isActive: boolean;
};

export type ReferralCode = {
  id: string;
  code: string;
  partnerName: string;
  description: string;
  benefitType: 'percentage' | 'fixed' | 'free_upsell';
  discountPercent?: number;   // used when benefitType === 'percentage'
  discountFixed?: number;     // used when benefitType === 'fixed'
  freeUpsellId?: string;      // used when benefitType === 'free_upsell'
  isActive: boolean;
  usageLimit?: number;        // undefined = unlimited
  usageCount: number;
  validFrom?: Date;
  validUntil?: Date;
  minPurchaseUsd: number;
  createdAt: Date;
};

export type Instructor = {
  id: string;
  name: string;
  email: string | null;
  bio: string | null;
  photo_url: string | null;
  created_at: string;
};

export type ClassTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  instructor_id: string | null;
  day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  time_start: string;
  duration_minutes: number;
  capacity: number;
  price_dropin_usd: number;
  location: string;
  color: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  // Present when the row is fetched with the instructors join.
  instructors?: { id: string; name: string } | null;
};

export type ClassPack = {
  id: string;
  name: string;
  classes_count: number;
  price_usd: number;
  is_active: boolean;
};

// Payload to create/edit a single dated class session (not a recurring
// template). Shared between the calendar modal and the server actions.
export type ClassInstancePayload = {
  name: string;
  description: string | null;
  instructor_id: string | null;
  starts_at: string; // ISO instant
  duration_minutes: number;
  capacity: number;
  price_dropin_usd: number;
  location: string;
  image_url: string | null;
  is_active: boolean;
};

// A class booking still awaiting confirmation that was purchased together with a
// pack (cash/Venmo). Surfaced to remind the admin to confirm it too.
export type LinkedPendingBooking = { id: string; reference: string; className: string };

// Shown after confirming a pack payment: reminds the admin to cross-check the
// Bookings section against this customer so pack usage stays accurate. If the
// pack was bought together with a class booking, that booking is included so it
// can be confirmed in one click.
export type PackConfirmationReminder = {
  customer: { firstName: string; lastName: string; email: string };
  linkedBooking: LinkedPendingBooking | null;
};

// One retreat on /upcoming-retreats, as the panel edits it and the page
// reads it. Dates are plain YYYY-MM-DD strings: they name days in Costa Rica,
// not instants, and a Date object would drag a timezone into a day.
export type RetreatListing = {
  id: string;
  title: string;
  label: string;
  instructors: string;
  startsOn: string;
  endsOn: string;
  description: string;
  url: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageAltEs: string | null;
  labelEs: string | null;
  descriptionEs: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RetreatSubmission = {
  id: string;
  retreat_name: string;
  retreat_slug: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  selected_date: string | null;
  participants: number;
  message: string | null;
  created_at: string;
};

// DB booking status (differs from legacy frontend Booking.paymentStatus)
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no-show';

// Shape returned by Supabase for a class row joined with instructor
export type DbClass = {
  id: string;
  template_id: string | null;
  instructor_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  starts_at: string; // ISO 8601 UTC
  duration_minutes: number;
  capacity: number;
  spots_remaining: number;
  price_dropin_usd: number;
  location: string;
  color: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  instructors: { id: string; name: string } | null;
};

// DbClass mapped to the legacy YogaClass shape used by UI components
export function dbClassToYogaClass(row: DbClass): YogaClass {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? '',
    instructor: row.instructors?.name ?? '',
    instructorId: row.instructor_id ?? null,
    startsAt: new Date(row.starts_at),
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    spotsRemaining: row.spots_remaining,
    priceUsd: Number(row.price_dropin_usd),
    location: row.location,
    isActive: row.is_active,
    color: row.color ?? undefined,
    imageUrl: row.image_url ?? null,
  };
}
