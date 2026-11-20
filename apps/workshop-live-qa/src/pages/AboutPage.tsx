import { Bubbles, ListChecks, Presentation, ScrollText } from 'lucide-react';

import { AppLogo } from '@x10/shared/runtime';

import { rules } from '../config';
import { limits } from '../model';

const TOOLS = [
  { icon: <Bubbles />, name: 'Board', text: 'The rising column. Votes inflate a bubble and push it up; answered ones drop onto the shelf; pinned ones dock at the top.' },
  { icon: <ListChecks />, name: 'Host deck', text: 'The moderation queue, keyboard first: answer, pin, park, hide or reword without leaving the keys.' },
  { icon: <Presentation />, name: 'Big screen', text: `The projector view: the top ${rules.bigScreenTop} questions in huge type, the join code and a QR code.` },
  { icon: <ScrollText />, name: 'Wrap-up', text: 'What was answered and what was not, as a snapshot and as Markdown to share with the cohort.' },
];

/** About: what the app is for, its tools, its rules and thresholds, and the privacy and audience notes. */
export function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <AppLogo size={40} />
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">About Workshop Live Q&A</h1>
          <p className="m-0 text-sm text-muted">A live question board for training sessions.</p>
        </div>
      </div>

      <p className="m-0 mt-6 text-base leading-7 text-fg">
        Attendees join with a short code, ask (anonymously if the host allows it) and upvote each other's questions. Each question is a
        bubble in a column: the more votes, the bigger it gets and the higher it rises, so the host and the room see at a glance what to
        answer next. Built for virtual cohorts of 15 to 20 people; it works for any session.
      </p>

      <h2 className="mt-10 mb-0 text-lg font-semibold">Tools</h2>
      <ul className="m-0 mt-3 grid list-none gap-x-8 gap-y-5 p-0 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.name} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-3 text-accent-11 [&_svg]:size-4" aria-hidden="true">
              {t.icon}
            </span>
            <div>
              <h3 className="m-0 text-sm font-semibold">{t.name}</h3>
              <p className="m-0 mt-0.5 text-sm text-muted">{t.text}</p>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-0 text-lg font-semibold">Rules</h2>
      <dl className="m-0 mt-3 divide-y divide-[var(--line)] border-y border-line text-sm">
        {[
          ['Unanswered questions per attendee', `${rules.maxOpenQuestionsPerAttendee}, re-checked against the database just before a question is saved`],
          ['A vote', 'A toggle. A score is the number of people who upvoted, counted when the board loads'],
          ['Board order', 'Pinned first, then most votes, then oldest. Answered questions rest on the shelf'],
          ['Live updates', `Every ${rules.pollMs / 1000} seconds. New questions wait behind a pill so lists never jump while you read`],
          ['Big screen', `The top ${rules.bigScreenTop} unanswered questions with their scores`],
          ['Lengths', `Questions ${limits.questionText.min}–${limits.questionText.max} characters, titles ${limits.sessionTitle.min}–${limits.sessionTitle.max}, codes ${rules.codeLength} letters or digits`],
          ['Moderation', 'Only the host. Hidden questions disappear for attendees. A closed session is read-only'],
          ['Drafts', 'Your draft lives only on the page: reloading clears it'],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
            <dt className="font-medium text-fg">{k}</dt>
            <dd className="m-0 text-muted">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 mb-0 text-lg font-semibold">Privacy and audience</h2>
      <ul className="m-0 mt-3 list-none space-y-2.5 p-0 text-sm text-muted">
        {[
          'Anonymous questions show "Anonymous" to other attendees, on the big screen and in the Markdown export. The host sees the real name, by design, so they can follow up.',
          'Anonymous means anonymous to the room, not to the system: the database stores who asked every question.',
          'Everyone signs in with Microsoft Fabric (Microsoft Entra ID). Attendees need access to this app item, so people outside your organisation must be added as guests or workspace members first.',
          'Hosts are app admins. Whoever deployed the app makes someone an admin with one SQL statement (see the README).',
        ].map((t) => (
          <li key={t} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-9" />
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-xs text-faint">Built by Datachain Consulting for AI @Work. Runs on Microsoft Fabric Apps.</p>
    </article>
  );
}
