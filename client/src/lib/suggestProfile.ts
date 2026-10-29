import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Es1Profile } from '@brewlab/shared';
import { api } from './api';

/**
 * Ask the model for a starting profile for one coffee, then open it in the
 * editor. Shared by the coffee page and the profile picker so both open the
 * draft the same way.
 *
 * The suggestion opens unsaved: you review the curve before anything joins
 * your library, let alone reaches the machine.
 */
export function useSuggestProfile() {
  const navigate = useNavigate();
  // The coffee being designed for, so a list can mark the one in flight.
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function suggest(coffeeId: string) {
    setSuggesting(coffeeId);
    setError(null);
    try {
      const res = await api<{ profile: Es1Profile; rationale: string; coffeeName: string }>(
        `/ai/suggest-profile/${coffeeId}`,
        { method: 'POST', body: {} },
      );
      navigate('/profiles/new', {
        state: { draft: res.profile, rationale: res.rationale, coffeeName: res.coffeeName },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSuggesting(null);
    }
  }

  return { suggest, suggesting, error };
}
