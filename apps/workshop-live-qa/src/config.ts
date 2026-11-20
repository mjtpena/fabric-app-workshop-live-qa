/**
 * Product rules and thresholds. Shown on the About page; used by the domain functions and the live screens.
 * No React imports (the seed exporter loads the domain in Node).
 */
export const rules = {
  /** Unanswered (new or parked) questions one attendee may have open in one session. */
  maxOpenQuestionsPerAttendee: 5,
  /** Live screens (attendee board, host console, big screen) refetch this often. */
  pollMs: 5000,
  /** Questions shown on the big screen. */
  bigScreenTop: 5,
  /** Join code length and alphabet (no 0/O or 1/I, so codes read cleanly off a projector). */
  codeLength: 6,
  codeAlphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
} as const;
