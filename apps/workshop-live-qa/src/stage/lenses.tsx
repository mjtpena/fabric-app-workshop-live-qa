import type { LegendItem, LensOption } from '@x10/shared/ui';

import type { Lens } from './arrange';

export const LENS_OPTIONS: LensOption<Lens>[] = [
  { value: 'top', label: 'Top', swatch: 'var(--accent-9)', description: 'Most votes rise to the top' },
  { value: 'newest', label: 'Newest', swatch: 'var(--blue-9)', description: 'The freshest questions rise to the top' },
  { value: 'answered', label: 'Answered', swatch: 'var(--green-9)', description: 'Answered questions fill the column' },
  {
    value: 'pinned',
    label: 'Pinned',
    swatch: 'linear-gradient(90deg, var(--accent-10) 50%, var(--amber-7) 50%)',
    description: 'What the host pinned or parked',
  },
];

export const LENS_LABEL: Record<Lens, string> = { top: 'Top', newest: 'Newest', answered: 'Answered', pinned: 'Pinned' };

export interface LegendCounts {
  open: number;
  answered: number;
  pinned: number;
  parked: number;
  maxVotes: number;
}

/** The key for each lens: what colour and size mean in the column. */
export function legendFor(lens: Lens, c: LegendCounts): LegendItem[] {
  const size: LegendItem = { label: 'Size = votes', shape: 'ring', color: 'var(--accent-9)' };
  if (lens === 'top')
    return [
      { label: `${c.maxVotes}+ votes`, color: 'var(--accent-10)' },
      { label: 'A few votes', color: 'var(--accent-7)' },
      { label: 'No votes yet', color: 'var(--accent-5)' },
      { label: 'Parked', color: 'var(--gray-6)', shape: 'ring' },
      { label: 'Answered (shelf)', color: 'var(--green-8)', value: c.answered },
      size,
    ];
  if (lens === 'newest')
    return [
      { label: 'Last 10 min', color: 'var(--blue-9)' },
      { label: '10–20 min', color: 'var(--blue-7)' },
      { label: '20–35 min', color: 'var(--blue-5)' },
      { label: 'Older', color: 'var(--gray-5)' },
      size,
    ];
  if (lens === 'answered')
    return [
      { label: 'Answered < 10 min', color: 'var(--green-9)' },
      { label: 'Answered earlier', color: 'var(--green-7)' },
      { label: 'Still open (shelf)', color: 'var(--accent-7)', value: c.open },
      size,
    ];
  return [
    { label: 'Pinned', color: 'var(--accent-10)', value: c.pinned },
    { label: 'Parked', color: 'var(--amber-7)', value: c.parked },
    { label: 'Everything else', color: 'var(--gray-5)' },
  ];
}
