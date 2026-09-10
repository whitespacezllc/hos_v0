"use client";

import { useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Brand splash ────────────────────────────────────────────────────────────
// The celestial mark, briefly, before the page. It is pure ceremony — the page
// behind it is static and fast, so the veil masks no loading — which means its
// entire cost is perceived time, and on cold traffic perceived time is bounce.
// It earns a moment, not three seconds (the treatment built for the YTT
// landing, carried over): 900ms of the mark breathing, then a 500ms fade, and
// only on the first view of a session. Reduced motion skips it entirely — a
// splash is only animation, and a visitor who asked for less of it shouldn't
// be made to sit through the brand's.
//
// WHO DECIDES: not this component. A tiny inline script at the top of <body>
// (app/layout.tsx) runs before the first paint, checks sessionStorage and
// prefers-reduced-motion, and stamps `data-splash="play"` on <html> only when
// the splash should run; a CSS gate in globals.css keeps this overlay at
// `display: none` unless that stamp is present. Three problems dissolve at
// once:
//
//   · The server HTML always carries this overlay (client components SSR),
//     so without the gate a returning visitor stared at a blank cream veil
//     from first paint until hydration — the exact perceived-time cost the
//     session rule exists to remove.
//   · With JS disabled or a failed bundle, an ungated overlay would cover the
//     site forever. Gated, no stamp ever appears and the page is simply a
//     page.
//   · The old version wrote the seen-key inside its own effect, which React
//     StrictMode runs twice in dev — the second run read the first run's
//     write and skipped, so the splash could never be QA'd in development.
//     The inline script runs exactly once per load; this effect only reads.
const HOLD_MS = 900;

type Phase = "hold" | "leave" | "skip";

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("hold");

  useLayoutEffect(() => {
    // The pre-paint script already made the call; reading it is idempotent,
    // so StrictMode's double-invoke changes nothing.
    const play = document.documentElement.dataset.splash === "play";

    if (!play) {
      setPhase("skip");
      return;
    }

    const timer = setTimeout(() => setPhase("leave"), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (phase === "skip") return null;

  return (
    <AnimatePresence>
      {phase === "hold" && (
        <motion.div
          key="hos-splash"
          data-hos-splash
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] items-center justify-center bg-warm-white"
          aria-hidden
        >
          {/* The mark's own animation finishes inside the hold, so the fade
              never interrupts it mid-breath. */}
          <motion.img
            src="/logos/crescent-sun-rays.png"
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: [0, 1, 1], scale: [0.94, 1, 0.99] }}
            transition={{ duration: 0.8, ease: "easeOut", times: [0, 0.55, 1] }}
            className="h-[104px] w-auto select-none md:h-[124px]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
