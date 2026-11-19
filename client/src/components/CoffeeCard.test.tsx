import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Coffee } from '@brewlab/shared';
import CoffeeCard from './CoffeeCard';

const coffee = (over: Partial<Coffee>): Coffee => ({
  id: 'cof_1',
  ownerId: 'usr_1',
  ownerName: 'Sam',
  name: 'Ethiopia Guji',
  roaster: 'Roastery',
  origin: null,
  region: null,
  producer: null,
  varietal: null,
  process: null,
  roastLevel: null,
  altitudeMasl: null,
  roastDate: null,
  tastingNotes: [],
  url: null,
  notes: null,
  isPublic: false,
  clonedFromId: null,
  createdAt: '2026-10-11T00:00:00Z',
  ...over,
});

const show = (c: Coffee) =>
  render(
    <MemoryRouter>
      <CoffeeCard coffee={c} />
    </MemoryRouter>,
  );

describe('CoffeeCard dialed-in stamp', () => {
  it('shows once three shots have been rated four stars or better', () => {
    show(coffee({ shotCount: 5, wellRatedShotCount: 3 }));
    expect(screen.getByText('Dialed in')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('3 shots rated 4 stars or more');
  });

  it('stays off with fewer than three', () => {
    show(coffee({ shotCount: 5, wellRatedShotCount: 2 }));
    expect(screen.queryByText('Dialed in')).not.toBeInTheDocument();
  });

  it('stays off when the count is unknown', () => {
    show(coffee({ shotCount: 5 }));
    expect(screen.queryByText('Dialed in')).not.toBeInTheDocument();
  });
});
