import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export type FeatureFlags = Record<string, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  sports_event_layer: false,
  event_boosts: false,
  event_watch_parties: false,
  event_profile_badges: false,
  event_credit_prompts: false,
};

class FeatureFlagsService {
  async getFlags(): Promise<FeatureFlags> {
    try {
      const res = await axios.get<FeatureFlags>(`${API_BASE_URL}/api/feature-flags`);
      return { ...DEFAULT_FLAGS, ...(res.data || {}) };
    } catch {
      return { ...DEFAULT_FLAGS };
    }
  }

  isFeatureEnabled(flags: FeatureFlags | null | undefined, key: keyof typeof DEFAULT_FLAGS): boolean {
    if (!flags) return false;
    return flags[key] === true;
  }
}

export const featureFlagsService = new FeatureFlagsService();
