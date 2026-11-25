import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ShotGlass, { QualityLegend, shotQuality } from './ShotGlass';

describe('shotQuality', () => {
  it('grades the taste in three steps by how far it is from balanced', () => {
    expect(shotQuality(0)).toBe('excellent');
    expect(shotQuality(-1)).toBe('fair');
    expect(shotQuality(1)).toBe('fair');
    expect(shotQuality(-2)).toBe('bad');
    expect(shotQuality(2)).toBe('bad');
  });

  it('never grades a shot nobody tasted', () => {
    expect(shotQuality(null)).toBe('untasted');
    expect(shotQuality(undefined)).toBe('untasted');
  });
});

describe('ShotGlass', () => {
  it('draws the cup for the shot’s quality', () => {
    for (const [taste, quality] of [
      [0, 'excellent'],
      [1, 'fair'],
      [-2, 'bad'],
      [null, 'untasted'],
    ] as const) {
      const { container, unmount } = render(<ShotGlass yieldG={36} taste={taste} />);
      expect(container.querySelector('svg')?.dataset.quality).toBe(quality);
      unmount();
    }
  });

  it('pours crema only on a tasted shot', () => {
    const tasted = render(<ShotGlass yieldG={36} taste={-1} />);
    expect(tasted.container.querySelector('.crema')).not.toBeNull();
    tasted.unmount();
    const untasted = render(<ShotGlass yieldG={36} taste={null} />);
    expect(untasted.container.querySelector('.crema')).toBeNull();
  });

  it('draws an empty cup when nothing has been poured', () => {
    const { container } = render(<ShotGlass yieldG={0} taste={0} />);
    expect(container.querySelector('svg')?.dataset.quality).toBe('empty');
    expect(container.querySelector('.liquid')).toBeNull();
    expect(container.querySelector('.well')).not.toBeNull();
  });

  it('keeps gradient ids unique when several cups share a page', () => {
    const { container } = render(
      <>
        <ShotGlass yieldG={36} taste={0} />
        <ShotGlass yieldG={36} taste={2} />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seats the cup on a saucer only when asked, keeping the cup the same size', () => {
    const plain = render(<ShotGlass yieldG={36} taste={0} />);
    expect(plain.container.querySelector('.saucer')).toBeNull();
    expect(plain.container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 116 100');
    plain.unmount();

    const { container } = render(<ShotGlass yieldG={36} taste={0} saucer />);
    const svg = container.querySelector('svg');
    expect(container.querySelector('.saucer')).not.toBeNull();
    expect(svg?.classList.contains('has-saucer')).toBe(true);
    // The saucer gets room round the cup rather than being cropped.
    expect(svg?.getAttribute('viewBox')).toBe('-8 -8 132 116');
  });

  it('shadows the cup with an SVG filter only on a saucer', () => {
    const plain = render(<ShotGlass yieldG={36} taste={0} />);
    expect(plain.container.querySelector('filter')).toBeNull();
    expect(plain.container.querySelector('.cup')?.getAttribute('filter')).toBeNull();
    plain.unmount();

    const { container } = render(<ShotGlass yieldG={36} taste={0} saucer />);
    const filter = container.querySelector('filter');
    expect(filter?.querySelector('feDropShadow')).not.toBeNull();
    expect(container.querySelector('.cup')?.getAttribute('filter')).toBe(`url(#${filter?.id})`);
  });

  it('names itself only when given a label', () => {
    const labelled = render(<ShotGlass yieldG={36} label="36 g" />);
    expect(labelled.getByRole('img', { name: '36 g' })).toBeTruthy();
    labelled.unmount();
    const { container } = render(<ShotGlass yieldG={36} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('QualityLegend', () => {
  it('keys each of the three cups', () => {
    const { container, getByText } = render(<QualityLegend />);
    const cups = [...container.querySelectorAll('svg')].map((svg) => svg.dataset.quality);
    expect(cups).toEqual(['excellent', 'fair', 'bad']);
    expect(getByText('Balanced')).toBeTruthy();
    expect(getByText('Sour or bitter')).toBeTruthy();
  });
});
