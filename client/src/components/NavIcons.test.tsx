import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as NavIcons from './NavIcons';

const motionPref = vi.hoisted(() => ({ reduce: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => motionPref.reduce,
}));

afterEach(() => {
  motionPref.reduce = false;
});

const icons = Object.entries(NavIcons).filter(
  (e): e is [string, NavIcons.NavIcon] => typeof e[1] === 'function',
);

describe('NavIcons', () => {
  it.each(icons)('%s is drawn on lucide’s frame, for the eye only', (_, Icon) => {
    const { container } = render(<Icon animate={false} className="nav-icon" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass('nav-icon');
    expect(svg.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
  });

  it.each(icons)('%s says when it’s playing its move', (_, Icon) => {
    const { container, rerender } = render(<Icon animate={false} />);
    const svg = () => container.querySelector('svg')!;
    expect(svg()).not.toHaveAttribute('data-animating');
    rerender(<Icon animate />);
    expect(svg()).toHaveAttribute('data-animating', 'true');
    rerender(<Icon animate={false} />);
    expect(svg()).not.toHaveAttribute('data-animating');
  });

  it.each(icons)('%s stays at rest for anyone who asked for reduced motion', (_, Icon) => {
    motionPref.reduce = true;
    const { container } = render(<Icon animate />);
    expect(container.querySelector('svg')).not.toHaveAttribute('data-animating');
  });
});
