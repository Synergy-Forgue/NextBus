import React from 'react';

/**
 * Marks a panel whose figures are illustrative rather than measured.
 *
 * Several analytics views were written against backend endpoints that do not
 * exist (`/api/routes/profitability`, `/api/analytics/dead-km`,
 * `/api/analytics/punctuality`) and silently fell back to hardcoded arrays, so
 * operations staff saw invented revenue and punctuality figures with no way to
 * tell them from real ones. The underlying data model has no fare, cost,
 * schedule or depot tables, so these cannot be computed yet — until it does,
 * the provenance has to be stated on screen.
 */
export default function DemoDataNotice({ needs }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3">
      <span className="text-lg leading-none">⚠️</span>
      <div>
        <p className="text-sm font-bold text-amber-300">
          Illustrative data — not measured from the fleet
        </p>
        <p className="mt-1 text-xs text-amber-200/70">
          These figures are placeholders for layout and demo purposes. Real numbers require{' '}
          {needs} , which the platform does not yet capture. Do not use for reporting or decisions.
        </p>
      </div>
    </div>
  );
}

/** Compact inline variant for headline stat tiles. */
export function DemoBadge({ title }) {
  return (
    <span
      title={title || 'Illustrative placeholder, not measured data'}
      className="ml-2 rounded border border-amber-500/40 bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300"
    >
      demo
    </span>
  );
}
