import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useHotkeys } from './hooks';
import { LensBar, StagePage, TodayPanel } from './stage';

describe('useHotkeys', () => {
  it('fires on the key, not while typing, and respects modifiers', () => {
    const one = vi.fn();
    const mod = vi.fn();
    renderHook(() => useHotkeys({ '1': one, 'mod+k': mod }));
    fireEvent.keyDown(document, { key: '1' });
    expect(one).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'k' });
    expect(mod).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(mod).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '1' });
    expect(one).toHaveBeenCalledTimes(1);
    input.remove();
  });
});

describe('stage kit', () => {
  it('LensBar switches with number keys', () => {
    const onChange = vi.fn();
    render(
      <LensBar
        value="a"
        onChange={onChange}
        lenses={[
          { value: 'a', label: 'Health' },
          { value: 'b', label: 'Age' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: /Health/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(document, { key: '2' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('TodayPanel items are buttons that report the item', () => {
    const onSelect = vi.fn();
    render(<TodayPanel onSelect={onSelect} items={[{ id: 'x', title: 'Orders failed', severity: 'bad', value: 3 }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Orders failed/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'x' }));
  });

  it('StagePage list view renders the list instead of the stage', () => {
    render(
      <MemoryRouter>
        <StagePage label="Map" title="Garden" view="list" stage={<div>STAGE</div>} list={<p>LIST</p>} />
      </MemoryRouter>,
    );
    expect(screen.getByText('LIST')).toBeTruthy();
    expect(screen.queryByText('STAGE')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Garden' })).toBeTruthy();
  });
});
