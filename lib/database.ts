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
  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_profile (
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
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS injection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      dose_mg REAL NOT NULL,
      injection_site TEXT NOT NULL,
      notes TEXT,
      side_effects TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      name TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein_g REAL NOT NULL DEFAULT 0,
      fat_g REAL NOT NULL DEFAULT 0,
      carbs_g REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER,
      reps INTEGER,
      duration_min REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS step_messages_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_number INTEGER NOT NULL UNIQUE,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function getUserProfile(): UserProfile | null {
  const result = db.getFirstSync<UserProfile>(
    'SELECT * FROM user_profile ORDER BY id DESC LIMIT 1'
  );
  if (result) {
    result.use_manjaro = (result.use_manjaro as unknown as number) === 1;
  }
  return result;
}

export function saveUserProfile(profile: UserProfile): void {
  const existing = getUserProfile();
  const useManjaroInt = profile.use_manjaro ? 1 : 0;
  if (existing) {
    db.runSync(
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
    db.runSync(
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

export function getWeightLogs(limit = 30): WeightLog[] {
  return db.getAllSync<WeightLog>(
    'SELECT * FROM weight_logs ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

export function addWeightLog(log: Omit<WeightLog, 'id' | 'created_at'>): void {
  db.runSync(
    'INSERT INTO weight_logs (date, weight_kg, notes) VALUES (?, ?, ?)',
    [log.date, log.weight_kg, log.notes ?? null]
  );
}

export function deleteWeightLog(id: number): void {
  db.runSync('DELETE FROM weight_logs WHERE id = ?', [id]);
}

export function getInjectionLogs(limit = 50): InjectionLog[] {
  return db.getAllSync<InjectionLog>(
    'SELECT * FROM injection_logs ORDER BY date DESC LIMIT ?',
    [limit]
  );
}

export function addInjectionLog(
  log: Omit<InjectionLog, 'id' | 'created_at'>
): void {
  db.runSync(
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

export function deleteInjectionLog(id: number): void {
  db.runSync('DELETE FROM injection_logs WHERE id = ?', [id]);
}

export function getMealLogs(date: string): MealLog[] {
  return db.getAllSync<MealLog>(
    'SELECT * FROM meal_logs WHERE date = ? ORDER BY created_at ASC',
    [date]
  );
}

export function getMealLogsByDateRange(
  startDate: string,
  endDate: string
): MealLog[] {
  return db.getAllSync<MealLog>(
    'SELECT * FROM meal_logs WHERE date BETWEEN ? AND ? ORDER BY date ASC, created_at ASC',
    [startDate, endDate]
  );
}

export function addMealLog(log: Omit<MealLog, 'id' | 'created_at'>): void {
  db.runSync(
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

export function deleteMealLog(id: number): void {
  db.runSync('DELETE FROM meal_logs WHERE id = ?', [id]);
}

export function getExerciseLogs(date?: string): ExerciseLog[] {
  if (date) {
    return db.getAllSync<ExerciseLog>(
      'SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at ASC',
      [date]
    );
  }
  return db.getAllSync<ExerciseLog>(
    'SELECT * FROM exercise_logs ORDER BY date DESC, created_at DESC LIMIT 50'
  );
}

export function addExerciseLog(
  log: Omit<ExerciseLog, 'id' | 'created_at'>
): void {
  db.runSync(
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

export function deleteExerciseLog(id: number): void {
  db.runSync('DELETE FROM exercise_logs WHERE id = ?', [id]);
}

export function getStepMessagesSent(): StepMessageSent[] {
  return db.getAllSync<StepMessageSent>(
    'SELECT * FROM step_messages_sent ORDER BY week_number ASC'
  );
}

export function markStepMessageSent(weekNumber: number): void {
  db.runSync(
    `INSERT OR REPLACE INTO step_messages_sent (week_number, sent_at)
     VALUES (?, datetime('now'))`,
    [weekNumber]
  );
}
