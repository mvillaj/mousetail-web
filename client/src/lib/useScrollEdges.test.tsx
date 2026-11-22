import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useScrollEdges } from './useScrollEdges';

function Scroller({ rows = 1 }: { rows?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { above, below } = useScrollEdges(ref);
  // jsdom lays nothing out: 100px of view, 100px a row.
  return (
    <div
      data-testid="box"
      data-edges={`${above ? 'above' : ''} ${below ? 'below' : ''}`.trim()}
      ref={(el) => {
        ref.current = el;
        if (!el) return;
        Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
        Object.defineProperty(el, 'scrollHeight', {
          get: () => el.children.length * 100,
          configurable: true,
        });
      }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <p key={i}>{i}</p>
      ))}
    </div>
  );
}
const box = () => screen.getByTestId('box');
const scrollTo = (top: number) => {
  box().scrollTop = top;
  fireEvent.scroll(box());
};

describe('useScrollEdges', () => {
  it('has nothing to say when it all fits', () => {
    render(<Scroller />);
    expect(box()).toHaveAttribute('data-edges', '');
  });

  it('says which way there is more, and that there is none at the end', () => {
    render(<Scroller rows={3} />);
    expect(box()).toHaveAttribute('data-edges', 'below');
    scrollTo(100);
    expect(box()).toHaveAttribute('data-edges', 'above below');
    // A fraction short of the end, as zoomed browsers stop, is the end.
    scrollTo(199);
    expect(box()).toHaveAttribute('data-edges', 'above');
  });

  it('notices rows coming and going', async () => {
    const { rerender } = render(<Scroller />);
    rerender(<Scroller rows={2} />);
    await act(async () => {});
    expect(box()).toHaveAttribute('data-edges', 'below');
    rerender(<Scroller />);
    await act(async () => {});
    expect(box()).toHaveAttribute('data-edges', '');
  });
});
