import { UserProfile } from './database';

export interface PFCResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein: number;
  fat: number;
  carbs: number;
  perMeal: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
}

export function calculateAge(birthYear: number): number {
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

export function calculatePFC(profile: UserProfile): PFCResult {
  const age = calculateAge(profile.birth_year);
  const { weight_kg: weight, height_cm: height, gender, activity_factor, goal, use_manjaro } = profile;

  // BMR calculation (Mifflin-St Jeor)
  let bmr: number;
  if (gender === 'M') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // TDEE
  const tdee = bmr * activity_factor;

  // Goal adjustment
  let goalMultiplier = 1.0;
  if (goal === '減量') goalMultiplier = 0.9;
  else if (goal === '増量') goalMultiplier = 1.1;

  let adjustedCalories = tdee * goalMultiplier;

  // Manjaro minimum: prevent too low calories when using Manjaro
  if (use_manjaro) {
    const minFactor = Math.max(1.2, activity_factor - 0.1);
    const manjaroMin = bmr * minFactor;
    adjustedCalories = Math.max(adjustedCalories, manjaroMin);
  }

  const targetCalories = Math.round(adjustedCalories);

  // Protein calculation (g/kg/day)
  let proteinPerKg: number;
  if (goal === '増量') {
    proteinPerKg = 1.8;
  } else if (use_manjaro) {
    proteinPerKg = 1.8;
  } else if (goal === '減量') {
    proteinPerKg = 1.6;
  } else {
    proteinPerKg = 1.4;
  }
  const protein = Math.round(proteinPerKg * weight);

  // Fat calculation
  const fatRatio = use_manjaro ? 0.22 : 0.25;
  const fatFromCalories = (targetCalories * fatRatio) / 9;
  const fatFromWeight = 0.6 * weight;
  const fat = Math.round(Math.max(fatFromCalories, fatFromWeight));

  // Carbs (remaining calories)
  const remainingCalories = targetCalories - protein * 4 - fat * 9;
  const carbs = Math.round(Math.max(0, remainingCalories / 4));

  // Per meal (3 meals)
  const meals = 3;
  const perMeal = {
    calories: Math.round(targetCalories / meals),
    protein: Math.round(protein / meals),
    fat: Math.round(fat / meals),
    carbs: Math.round(carbs / meals),
  };

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    protein,
    fat,
    carbs,
    perMeal,
  };
}

export function getActivityFactorLabel(factor: number): string {
  if (factor <= 1.2) return '座りがち（ほぼ運動なし）';
  if (factor <= 1.375) return '軽い活動（週1〜3回の運動）';
  if (factor <= 1.55) return '適度な活動（週3〜5回の運動）';
  if (factor <= 1.725) return '活発（週6〜7回の運動）';
  return '非常に活発（激しい運動・肉体労働）';
}

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: '座りがち（ほぼ運動なし）' },
  { value: 1.375, label: '軽い活動（週1〜3回）' },
  { value: 1.55, label: '適度な活動（週3〜5回）' },
  { value: 1.725, label: '活発（週6〜7回）' },
  { value: 1.9, label: '非常に活発（激しい運動）' },
];
