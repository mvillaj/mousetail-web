import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlidingNumber } from './SlidingNumber';

const digits = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>('[data-digit]')].map((d) => d.dataset.digit);

describe('SlidingNumber', () => {
  it('shows each digit as a reel, with the point standing still', () => {
    const { container } = render(<SlidingNumber value="12.5" />);
    expect(digits(container)).toEqual(['1', '2', '5']);
    const number = container.querySelector('.sliding-number')!;
    expect(
      [...number.children].map((c) => (c as HTMLElement).dataset.digit ?? c.textContent),
    ).toEqual(['1', '2', '.', '5']);
  });

  it('is for the eye only: the number it shows lives elsewhere as text', () => {
    const { container } = render(<SlidingNumber value="7" />);
    expect(container.querySelector('.sliding-number')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keys digits by place, so 9 to 10 keeps the units reel and adds a tens one', () => {
    const { container, rerender } = render(<SlidingNumber value="9" />);
    const units = container.querySelector('[data-digit]');
    rerender(<SlidingNumber value="10" />);
    expect(digits(container)).toEqual(['1', '0']);
    // The same element, now rolled to 0, not a new one.
    expect(container.querySelectorAll('[data-digit]')[1]).toBe(units);
  });

  it('shows nothing for an empty value, and leaves anything not a digit as it is', () => {
    expect(digits(render(<SlidingNumber value="" />).container)).toEqual([]);
    const { container } = render(<SlidingNumber value="-3" />);
    expect(container.querySelector('.sliding-number')!.textContent).toMatch(/^-/);
    expect(digits(container)).toEqual(['3']);
  });
});
