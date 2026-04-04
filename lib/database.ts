import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('manjaro_diet.db');

export interface UserProfile {
  id?: number;
  name: string;
  gender: 'M' | 'F';
  birth_year: number;
  height_cm: number;
  weight_kg: number;
  activity_factor: number;
  goal: '維持' | '減量' | '増量';
  use_manjaro: boolean;
  start_date: string;
  created_at?: string;
}

export interface WeightLog {
  id?: number;
  date: string;
  weight_kg: number;
  notes?: string;
  created_at?: string;
}

export interface InjectionLog {
  id?: number;
  date: string;
  dose_mg: number;
  injection_site: string;
  notes?: string;
  side_effects?: string;
  created_at?: string;
}

export interface MealLog {
  id?: number;
  date: string;
  meal_type: '朝食' | '昼食' | '夕食' | '間食';
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  created_at?: string;
}

export interface ExerciseLog {
  id?: number;
  date: string;
  exercise_type: '筋トレ' | '有酸素' | 'ストレッチ';
  name: string;
  sets?: number;
  reps?: number;
  duration_min?: number;
  notes?: string;
  created_at?: string;
}

export interface StepMessageSent {
  id?: number;
  week_number: number;
  sent_at: string;
}

export function initDatabase(): void {
  db.runSync(`CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT 'M',
    birth_year INTEGER NOT NULL DEFAULT 1980,
    height_cm REAL NOT NULL DEFAULT 170,
    weight_kg REAL NOT NULL DEFAULT 70,
    activity_factor REAL NOT NULL DEFAULT 1.55,
    goal TEXT NOT NULL DEFAULT '維持',
    use_manjaro INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.runSync(`CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.runSync(`CREATE TABLE IF NOT EXISTS injection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    dose_mg REAL NOT NULL,
    injection_site TEXT NOT NULL,
    notes TEXT,
    side_effects TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.runSync(`CREATE TABLE IF NOT EXISTS meal_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    name TEXT NOT NULL,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.runSync(`CREATE TABLE IF NOT EXISTS exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    name TEXT NOT NULL,
    sets INTEGER,
    reps INTEGER,
    duration_min REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.runSync(`CREATE TABLE IF NOT EXISTS step_messages_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_number INTEGER NOT NULL UNIQUE,
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const result = await db.getFirstAsync<UserProfile>(
    'SELECT * FROM user_profile ORDER BY id DESC LIMIT 1'
  );
  if (result) {
    result.use_manjaro = (result.use_manjaro as unknown as number) === 1;
  }
  return result ?? null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const existing = await getUserProfile();
  const useManjaroInt = profile.use_manjaro ? 1 : 0;
  if (existing) {
    await db.runAsync(
      `UPDATE user_profile SET
        name = ?, gender = ?, birth_year = ?, height_cm = ?,
        weight_kg = ?, activity_factor = ?, goal = ?,
        use_manjaro = ?, start_date = ?
       WHERE id = ?`,
      [
        profile.name,
        profile.gender,
        profile.birth_year,
        profile.height_cm,
        profile.weight_kg,
        profile.activity_factor,
        profile.goal,
        useManjaroInt,
        profile.start_date,
        existing.id!,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO user_profile
        (name, gender, birth_year, height_cm, weight_kg, activity_factor, goal, use_manjaro, start_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.name,
        profile.gender,
        profile.birth_year,
        profile.height_cm,
        profile.weight_kg,
        profile.activity_factor,
        profile.goal,
        useManjaroInt,
        profile.start_date,
      ]
    );
  }
}

export async function getWeightLogs(limit = 30): Promise<WeightLog[]> {
  return db.getAllAsync<WeightLog>(
    'SELECT * FROM weight_logs ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

export async function addWeightLog(log: Omit<WeightLog, 'id' | 'created_at'>): Promise<void> {
  await db.runAsync(
    'INSERT INTO weight_logs (date, weight_kg, notes) VALUES (?, ?, ?)',
    [log.date, log.weight_kg, log.notes ?? null]
  );
}

export async function deleteWeightLog(id: number): Promise<void> {
  await db.runAsync('DELETE FROM weight_logs WHERE id = ?', [id]);
}

export async function getInjectionLogs(limit = 50): Promise<InjectionLog[]> {
  return db.getAllAsync<InjectionLog>(
    'SELECT * FROM injection_logs ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

export async function addInjectionLog(
  log: Omit<InjectionLog, 'id' | 'created_at'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO injection_logs
      (date, dose_mg, injection_site, notes, side_effects)
     VALUES (?, ?, ?, ?, ?)`,
    [
      log.date,
      log.dose_mg,
      log.injection_site,
      log.notes ?? null,
      log.side_effects ?? null,
    ]
  );
}

export async function deleteInjectionLog(id: number): Promise<void> {
  await db.runAsync('DELETE FROM injection_logs WHERE id = ?', [id]);
}

export async function getMealLogs(date: string): Promise<MealLog[]> {
  return db.getAllAsync<MealLog>(
    'SELECT * FROM meal_logs WHERE date = ? ORDER BY created_at ASC',
    [date]
  );
}

export async function getMealLogsByDateRange(
  startDate: string,
  endDate: string
): Promise<MealLog[]> {
  return db.getAllAsync<MealLog>(
    'SELECT * FROM meal_logs WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
}

export async function addMealLog(log: Omit<MealLog, 'id' | 'created_at'>): Promise<void> {
  await db.runAsync(
    `INSERT INTO meal_logs
      (date, meal_type, name, calories, protein_g, fat_g, carbs_g)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      log.date,
      log.meal_type,
      log.name,
      log.calories,
      log.protein_g,
      log.fat_g,
      log.carbs_g,
    ]
  );
}

export async function deleteMealLog(id: number): Promise<void> {
  await db.runAsync('DELETE FROM meal_logs WHERE id = ?', [id]);
}

export async function getExerciseLogs(date?: string): Promise<ExerciseLog[]> {
  if (date) {
    return db.getAllAsync<ExerciseLog>(
      'SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at ASC',
      [date]
    );
  }
  return db.getAllAsync<ExerciseLog>(
    'SELECT * FROM exercise_logs ORDER BY date DESC, created_at DESC LIMIT 50'
  );
}

export async function addExerciseLog(
  log: Omit<ExerciseLog, 'id' | 'created_at'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO exercise_logs
      (date, exercise_type, name, sets, reps, duration_min, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      log.date,
      log.exercise_type,
      log.name,
      log.sets ?? null,
      log.reps ?? null,
      log.duration_min ?? null,
      log.notes ?? null,
    ]
  );
}

export async function deleteExerciseLog(id: number): Promise<void> {
  await db.runAsync('DELETE FROM exercise_logs WHERE id = ?', [id]);
}

export async function getStepMessagesSent(): Promise<StepMessageSent[]> {
  return db.getAllAsync<StepMessageSent>(
    'SELECT * FROM step_messages_sent ORDER BY week_number ASC'
  );
}

export async function markStepMessageSent(weekNumber: number): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO step_messages_sent (week_number, sent_at)
     VALUES (?, datetime('now'))`,
    [weekNumber]
  );
}
