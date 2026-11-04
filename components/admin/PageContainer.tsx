import type { ReactNode } from 'react';

// PageContainer — the one frame every admin page sits in. One width and one
// gutter for all of them, so a page's title doesn't shift sideways when moving
// between sections, and a phone keeps its 16px margin.
export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 lg:py-8 xl:py-10">
      {children}
    </div>
  );
}
