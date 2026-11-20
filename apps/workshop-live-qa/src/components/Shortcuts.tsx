import { Keyboard } from 'lucide-react';

import { Dialog, IconButton, Kbd } from '@x10/shared/ui';

export interface ShortcutGroup {
  title: string;
  keys: { keys: string[]; label: string }[];
}

/** The "?" cheat sheet: every shortcut of the screen, grouped. */
export function ShortcutsDialog({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: ShortcutGroup[] }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="grid gap-5 sm:grid-cols-2" data-testid="shortcuts">
        {groups.map((g) => (
          <section key={g.title}>
            <h3 className="x-legend-label m-0 mb-2 text-muted">{g.title}</h3>
            <dl className="m-0 grid gap-1.5">
              {g.keys.map((k) => (
                <div key={k.label} className="flex items-center justify-between gap-3">
                  <dt className="text-sm text-fg">{k.label}</dt>
                  <dd className="m-0 flex shrink-0 items-center gap-1">
                    {k.keys.map((key, i) => (
                      <Kbd key={i}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

export function ShortcutsButton({ onClick, glass }: { onClick: () => void; glass?: boolean }) {
  return (
    <IconButton
      label="Keyboard shortcuts (?)"
      icon={<Keyboard />}
      variant={glass ? 'secondary' : 'ghost'}
      className={glass ? 'x-glass rounded-full! ring-0' : undefined}
      onClick={onClick}
    />
  );
}
