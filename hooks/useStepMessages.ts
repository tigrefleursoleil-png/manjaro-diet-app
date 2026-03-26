import { useMemo } from 'react';
import STEP_MESSAGES, { StepMessage } from '../constants/stepMessages';
import { UserProfile } from '../lib/database';

interface UseStepMessagesReturn {
  currentWeek: number;
  currentMessage: StepMessage | null;
  totalWeeks: number;
  progressPercent: number;
  daysElapsed: number;
}

export default function useStepMessages(
  profile: UserProfile | null
): UseStepMessagesReturn {
  const totalWeeks = STEP_MESSAGES.length;

  return useMemo(() => {
    if (!profile || !profile.start_date) {
      return {
        currentWeek: 1,
        currentMessage: STEP_MESSAGES[0] ?? null,
        totalWeeks,
        progressPercent: 0,
        daysElapsed: 0,
      };
    }

    const startDate = new Date(profile.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - startDate.getTime();
    const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // Week 1 = days 0-6, Week 2 = days 7-13, etc.
    const weekIndex = Math.min(
      Math.floor(daysElapsed / 7),
      totalWeeks - 1
    );
    const currentWeek = weekIndex + 1;

    const currentMessage = STEP_MESSAGES[weekIndex] ?? null;
    const progressPercent = Math.round((currentWeek / totalWeeks) * 100);

    return {
      currentWeek,
      currentMessage,
      totalWeeks,
      progressPercent,
      daysElapsed,
    };
  }, [profile, totalWeeks]);
}
