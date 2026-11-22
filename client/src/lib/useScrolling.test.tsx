import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLLING_MS, useScrolling } from './useScrolling';

function Scroller({ placed = null }: { placed?: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const placedAt = useRef<number | null>(placed);
  return <div data-testid="box" data-scrolling={useScrolling(ref, placedAt)} ref={ref} />;
}
const box = () => screen.getByTestId('box');
const scrollTo = (top: number) => {
  box().scrollTop = top;
  fireEvent.scroll(box());
};
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useScrolling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is true from the first movement until it has been still a while', () => {
    render(<Scroller />);
    expect(box()).toHaveAttribute('data-scrolling', 'false');
    scrollTo(20);
    expect(box()).toHaveAttribute('data-scrolling', 'true');
    wait(SCROLLING_MS - 1);
    scrollTo(40);
    wait(SCROLLING_MS - 1);
    expect(box()).toHaveAttribute('data-scrolling', 'true');
    wait(1);
    expect(box()).toHaveAttribute('data-scrolling', 'false');
  });

  it('leaves out where the page put it, and only that', () => {
    render(<Scroller placed={60} />);
    scrollTo(60);
    expect(box()).toHaveAttribute('data-scrolling', 'false');
    scrollTo(61);
    expect(box()).toHaveAttribute('data-scrolling', 'true');
  });

  it('stops its clock when it goes', () => {
    const { unmount } = render(<Scroller />);
    scrollTo(20);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
