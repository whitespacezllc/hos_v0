"use client";

import { useState } from "react";
import { format, isBefore, startOfToday } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";
import { dateFnsLocale } from "@/lib/dates";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter } from "@/i18n/navigation";
import { bookHref } from "@/lib/cloudbeds";

// ─── Hero "Check availability" bar ───────────────────────────────────────────
// A compact booking pill overlaid on the hero (à la RecenterLife): a date-range
// field + a "Check availability" action. On submit the reader goes to /book,
// where the Cloudbeds engine renders in the page and reads the chosen dates
// from the query string as it starts (lib/cloudbeds.ts); with no dates, to
// /book as it is.
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function CheckAvailabilityBar() {
  const t = useTranslations("home.hero.availability");
  const tButtons = useTranslations("common.buttons");
  const locale = useLocale();
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);

  // "Sep 7" in English, "7 sep" in Spanish — the pattern is part of the copy.
  const pretty = (d: Date) => format(d, t("dateFormat"), { locale: dateFnsLocale(locale) });

  // Two months side by side is what makes a stay pickable: a one-month view
  // hides the checkout the moment it falls after the 30th, and the reader has
  // to find the arrow, page over, and hold the arrival in their head. Phones
  // have no room for the pair, so they page.
  const isWide = useMediaQuery("(min-width: 768px)");

  const from = range?.from;
  const to = range?.to;

  // Range building is handled here rather than left to the picker's default.
  // Out of the box it treats the first click as a complete `from`–`to` pair on
  // the same day — a zero-night stay — and, once a pair exists, every later
  // click only drags the checkout further out. So the panel would shut after a
  // single click, and there was no way to pick a different arrival at all.
  //
  // The rule instead: a click either starts a stay or finishes one. It starts
  // one whenever there's nothing pending, a stay is already complete, or the
  // date lands on or before the pending arrival — which is also what keeps a
  // stay at one night or more, without a separate minimum to enforce.
  const handleSelect = (_selected: DateRange | undefined, clicked: Date) => {
    const startsNewStay = !range?.from || !!range.to || !isBefore(range.from, clicked);

    if (startsNewStay) {
      setRange({ from: clicked, to: undefined });
      return;
    }

    setRange({ from: range.from, to: clicked });
    setOpen(false); // the stay is complete — nothing left to pick
  };

  // Half a stay is no stay: handed only an arrival, the engine would assume
  // one night — a guess the reader never made — so it opens with nothing
  // filled in instead.
  const handleCheck = () => {
    router.push(from && to ? bookHref({ checkin: iso(from), checkout: iso(to) }) : bookHref());
  };

  // Naming the half that's still missing, rather than leaving the placeholder
  // up: after the first click the reader has picked something, and the field
  // should say what it's now waiting for.
  const dateLabel =
    from && to
      ? t("range", { from: pretty(from), to: pretty(to) })
      : from
      ? t("selectCheckout", { from: pretty(from) })
      : t("placeholder");

  // The pill reads as smoked glass over the footage. Neutral black rather than
  // `--dark` (#340000): a burgundy panel sitting on the video was part of the
  // same colour cast as the scrim behind it. Black is the darker ground, so a
  // lower alpha than the old /85 still leaves the cream type the contrast it had.
  return (
    <div className="inline-flex items-stretch overflow-hidden bg-black/75 backdrop-blur-sm shadow-lg">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-5 md:px-6 py-3.5 text-cream/90 hover:text-cream transition-colors duration-300"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="h-4 w-4 opacity-80"
            >
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v3M16 3v3" />
            </svg>
            <span className="font-body text-xs md:text-sm tracking-[0.04em] whitespace-nowrap">
              {dateLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" sideOffset={12}>
          <Calendar
            mode="range"
            locale={dateFnsLocale(locale)}
            numberOfMonths={isWide ? 2 : 1}
            selected={range}
            onSelect={handleSelect}
            // Reopening should land on the month being worked in, not back on
            // today, once the arrival is months out.
            defaultMonth={from}
            disabled={{ before: startOfToday() }}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={handleCheck}
        className="bg-cream text-ink font-body text-xs md:text-sm tracking-[0.05em] px-5 md:px-7 hover:bg-ink hover:text-cream transition-colors duration-300"
      >
        {tButtons("checkAvailability")}
      </button>
    </div>
  );
}
