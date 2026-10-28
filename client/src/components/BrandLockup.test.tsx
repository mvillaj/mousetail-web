import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BrandLockup from './BrandLockup';

describe('BrandLockup', () => {
  it('names the drawn wordmark in text and hides the drawing', () => {
    const { container } = render(<BrandLockup />);
    expect(screen.getByText('mousetail')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the word and the drop as separate shapes', () => {
    const { container } = render(<BrandLockup />);
    const svg = container.querySelector('svg.brand-mark');
    expect(svg?.querySelector('.brand-word')).toHaveAttribute('fill-rule', 'evenodd');
    // The drop sits under the word, so the tail's end overlaps it.
    expect(svg?.firstElementChild).toHaveClass('brand-drop');
  });

  it('only plays the pour when asked', () => {
    const { container, rerender } = render(<BrandLockup />);
    expect(container.firstChild).not.toHaveClass('brand-pour');
    rerender(<BrandLockup pour />);
    expect(container.firstChild).toHaveClass('brand-lockup', 'brand-pour');
  });

  it('is the page heading when asked', () => {
    render(<BrandLockup heading />);
    expect(screen.getByRole('heading', { level: 1, name: 'mousetail' })).toBeInTheDocument();
  });
});
