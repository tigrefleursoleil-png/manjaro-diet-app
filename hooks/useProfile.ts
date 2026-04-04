import { useState, useEffect, useCallback } from 'react';
import { getUserProfile, saveUserProfile, UserProfile } from '../lib/database';

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
}

export default function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (newProfile: UserProfile) => {
    try {
      await saveUserProfile(newProfile);
      setProfile(newProfile);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh, updateProfile };
}
