import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_MACHINES,
  GRINDERS_BY_ID,
  type BrewProfileRecord,
  type Grinder,
  type Machine,
} from '@brewlab/shared';
import ShotForm from './ShotForm';

const apiMock = vi.fn();
vi.mock('../lib/api', () => ({ api: (...args: unknown[]) => apiMock(...args) }));

const es1Spec = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
const genericSpec = BUILT_IN_MACHINES.find((m) => m.id === 'generic-espresso')!;

function machine(spec: typeof es1Spec): Machine {
  return {
    id: `mch_${spec.id}`,
    userId: 'usr_1',
    builtInId: spec.id,
    name: `${spec.brand} ${spec.model}`,
    capabilities: spec.capabilities,
    limits: spec.limits,
    isDefault: true,
    notes: null,
    createdAt: '2026-10-11T00:00:00Z',
  };
}

let current: Machine;
vi.mock('../lib/machines', () => ({
  useMachines: () => ({
    machines: [current],
    active: current,
    capabilities: current.capabilities,
  }),
}));

const opus = GRINDERS_BY_ID['fellow-opus-2'];
const grinder: Grinder = {
  id: 'grd_1',
  userId: 'usr_1',
  builtInId: 'fellow-opus-2',
  name: 'Fellow Opus 2',
  burrType: opus.burrType,
  scale: opus.scale,
  calibration: opus.calibration,
  isDefault: true,
  notes: null,
  createdAt: '2026-10-11T00:00:00Z',
};

const profile = (id: string, name: string): BrewProfileRecord =>
  ({
    id,
    userId: 'usr_1',
    name,
    description: null,
    isPublic: false,
    syncState: 'local',
    fellowProfileId: null,
    lastPushedAt: null,
    origin: 'local',
    sourceDeviceId: null,
    createdAt: '2026-10-11T00:00:00Z',
    updatedAt: '2026-10-11T00:00:00Z',
    profile: {
      id,
      name,
      doseG: 18,
      ratio: 2,
      brewTempC: 93,
      stages: [
        {
          id: 's1',
          kind: 'preinfusion',
          durationS: 6,
          pressureBar: 3,
          endPressureBar: 3,
          flowLimitMlS: 3,
        },
        {
          id: 's2',
          kind: 'infusion',
          durationS: 24,
          pressureBar: 8,
          endPressureBar: 8,
          flowLimitMlS: 3,
        },
      ],
    },
  }) as BrewProfileRecord;

function renderForm(profiles = [profile('p1', 'Classic'), profile('p2', 'Gentle')]) {
  const onSaved = vi.fn();
  render(
    <MemoryRouter>
      <ShotForm coffees={[]} grinders={[grinder]} profiles={profiles} onSaved={onSaved} />
    </MemoryRouter>,
  );
  return onSaved;
}

beforeEach(() => {
  apiMock.mockReset();
  localStorage.clear();
  current = machine(es1Spec);
});

describe('simple shot form', () => {
  it('is the default for a machine that runs profiles', () => {
    renderForm();
    expect(screen.getByRole('radiogroup', { name: /which profile/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Dose/)).not.toBeInTheDocument();
  });

  it('is not offered on a machine without profiles', () => {
    current = machine(genericSpec);
    renderForm();
    expect(screen.getByLabelText(/^Dose/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simple' })).not.toBeInTheDocument();
  });

  it('switches to the detailed form and remembers the choice', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(screen.getByLabelText(/^Dose/)).toBeInTheDocument();
    expect(localStorage.getItem('brewlab.shotFormMode')).toBe('detailed');
  });

  it('opens on the detailed form for someone who chose it before', () => {
    localStorage.setItem('brewlab.shotFormMode', 'detailed');
    renderForm();
    expect(screen.getByLabelText(/^Dose/)).toBeInTheDocument();
  });

  it('logs the numbers from the chosen profile', async () => {
    apiMock.mockResolvedValue({ shot: { id: 'sht_1' }, suggestion: {} });
    const onSaved = renderForm();

    await userEvent.click(screen.getByRole('radio', { name: /Gentle/ }));
    await userEvent.type(screen.getByLabelText(/where was the grinder set/i), '3');
    await userEvent.click(screen.getByRole('radio', { name: /Sour/ }));
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    await userEvent.click(screen.getByRole('button', { name: 'Log this shot' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [path, init] = apiMock.mock.calls[0];
    expect(path).toBe('/shots');
    expect(init.body).toMatchObject({
      machineId: current.id,
      profileId: 'p2',
      grindSetting: 3,
      doseG: 18,
      yieldG: 36,
      shotTimeS: 30,
      preInfusionS: 6,
      brewTempC: 93,
      tasteBalance: -2,
      rating: 4,
    });
  });

  it('blocks a grind setting past the end of the dial', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText(/where was the grinder set/i), '12');
    expect(screen.getByText('Fellow Opus 2 goes from 0 to 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log this shot' })).toBeDisabled();
  });

  it('nudges and slides the grind setting', async () => {
    renderForm();
    const input = screen.getByLabelText(/where was the grinder set/i);
    await userEvent.click(screen.getByRole('button', { name: 'Raise the setting' }));
    expect(input).toHaveValue(5);
    await userEvent.click(screen.getByRole('button', { name: 'Raise the setting' }));
    expect(input).toHaveValue(5.1);
    // Over the input, the same number as rolling digits.
    const rolling = document.querySelector('.grind-dial-rolling')!;
    expect(rolling).toHaveAttribute('aria-hidden', 'true');
    expect(
      [...rolling.querySelectorAll<HTMLElement>('[data-digit]')].map((d) => d.dataset.digit),
    ).toEqual(['5', '1']);
    await userEvent.click(screen.getByRole('button', { name: 'Lower the setting' }));
    expect(input).toHaveValue(5);

    fireEvent.change(screen.getByRole('slider', { name: /finer and coarser/i }), {
      target: { value: '2' },
    });
    expect(input).toHaveValue(2);
    expect(screen.getByText(/About \d+ µm/)).toBeInTheDocument();
  });

  it('points to profiles when there are none', () => {
    renderForm([]);
    expect(screen.getByRole('link', { name: /make or import a profile/i })).toHaveAttribute(
      'href',
      '/profiles',
    );
    expect(screen.queryByRole('button', { name: 'Log this shot' })).not.toBeInTheDocument();
  });
});
