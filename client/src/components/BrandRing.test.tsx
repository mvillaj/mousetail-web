import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandRing from './BrandRing';

describe('BrandRing', () => {
  it('is decoration, left to the wordmark beside it to name', () => {
    const { container } = render(<BrandRing />);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.textContent).toBe('');
  });

  it('draws the drop apart from the ring it hangs on, on the same grid, so it can travel', () => {
    const { container } = render(<BrandRing />);
    const [ring, drop] = container.querySelectorAll('svg');
    expect([...ring.children].map((p) => p.getAttribute('class'))).toEqual([
      'ring-ink',
      'ring-stream',
    ]);
    expect(drop).toHaveClass('ring-drop');
    expect(drop.getAttribute('viewBox')).toBe(ring.getAttribute('viewBox'));
  });
});
