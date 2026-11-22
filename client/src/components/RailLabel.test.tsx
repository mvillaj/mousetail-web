import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import RailLabel from './RailLabel';

function Rail() {
  const ref = useRef<HTMLElement>(null);
  return (
    <aside ref={ref}>
      <button title="Grinders">1</button>
      <button>No name to show</button>
      <div className="settings-pop">
        <button title="Dark">2</button>
      </div>
      <RailLabel sidebar={ref} />
    </aside>
  );
}
const label = () => document.querySelector('.rail-label');
const focus = (name: string) => act(() => screen.getByRole('button', { name }).focus());

describe('RailLabel', () => {
  it('names what has keyboard focus, until it goes', () => {
    render(<Rail />);
    expect(label()).toBeNull();
    focus('1');
    expect(label()).toHaveTextContent('Grinders');
    // Every row has its name already; this is for the eye.
    expect(label()).toHaveAttribute('aria-hidden', 'true');
    focus('No name to show');
    expect(label()).toBeNull();
  });

  it('leaves the popover to its own labels', () => {
    render(<Rail />);
    focus('2');
    expect(label()).toBeNull();
  });

  it('goes on Escape', () => {
    render(<Rail />);
    focus('1');
    fireEvent.keyDown(screen.getByRole('button', { name: '1' }), { key: 'Escape' });
    expect(label()).toBeNull();
  });
});
