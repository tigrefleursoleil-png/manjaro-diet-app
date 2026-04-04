import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import useProfile from '../../hooks/useProfile';
import useStepMessages from '../../hooks/useStepMessages';
import StepMessageCard from '../../components/StepMessageCard';
import WeightChart from '../../components/WeightChart';
import PFCProgressBar from '../../components/PFCProgressBar';
import { calculatePFC } from '../../lib/pfc';
import {
  getWeightLogsByDays,
  getMealLogs,
  getInjectionLogs,
  addWeightLog,
  updateWeightLog,
  deleteWeightLog,
  WeightLog,
  MealLog,
  InjectionLog,
} from '../../lib/database';

type ChartRange = '7d' | '1m' | '3m' | '6m' | '1y';
const RANGE_OPTIONS: { key: ChartRange; label: string; days: number }[] = [
  { key: '7d',  label: '7日',   days: 7   },
  { key: '1m',  label: '1ヶ月', days: 30  },
  { key: '3m',  label: '3ヶ月', days: 90  },
  { key: '6m',  label: '6ヶ月', days: 180 },
  { key: '1y',  label: '1年',   days: 365 },
];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'おはようございます';
  if (hour < 17) return 'こんにちは';
  return 'こんばんは';
}

function getJapaneseDateString(date: Date): string {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}月${d}日（${w}）`;
}

export default function DashboardScreen() {
  const today = formatDate(new Date());
  const router = useRouter();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile();
  const { currentWeek, currentMessage } = useStepMessages(profile);

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [todayMeals, setTodayMeals] = useState<MealLog[]>([]);
  const [injectionLogs, setInjectionLogs] = useState<InjectionLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>('7d');

  // Weight modal
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDateInput, setWeightDateInput] = useState(today);
  const [editingWeight, setEditingWeight] = useState<WeightLog | null>(null);

  const loadData = useCallback(async () => {
    try {
      const days = RANGE_OPTIONS.find(r => r.key === chartRange)?.days ?? 7;
      const [weights, meals, injections] = await Promise.all([
        getWeightLogsByDays(days),
        getMealLogs(today),
        getInjectionLogs(1),
      ]);
      setWeightLogs(weights);
      setTodayMeals(meals);
      setInjectionLogs(injections);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [today, chartRange]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshProfile();
    loadData();
    setRefreshing(false);
  }, [refreshProfile, loadData]);

  const openAddWeight = () => {
    setEditingWeight(null);
    setWeightInput('');
    setWeightDateInput(today);
    setWeightModalVisible(true);
  };

  const openEditWeight = (log: WeightLog) => {
    setEditingWeight(log);
    setWeightInput(String(log.weight_kg));
    setWeightDateInput(log.date);
    setWeightModalVisible(true);
  };

  const handleSaveWeight = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val < 20 || val > 300) {
      Alert.alert('入力エラー', '正しい体重を入力してください（20〜300kg）');
      return;
    }
    setWeightModalVisible(false);
    try {
      if (editingWeight) {
        await updateWeightLog(editingWeight.id!, val, weightDateInput);
      } else {
        await addWeightLog({ date: weightDateInput, weight_kg: val });
      }
      setEditingWeight(null);
      setWeightInput('');
      loadData();
    } catch (error) {
      Alert.alert('エラー', '体重の保存に失敗しました');
    }
  };

  const handleDeleteWeight = (log: WeightLog) => {
    Alert.alert('削除確認', `${log.date} の体重記録を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive',
        onPress: async () => { await deleteWeightLog(log.id!); loadData(); },
      },
    ]);
  };

  // PFC calculations
  const pfcTarget = profile ? calculatePFC(profile) : null;
  const todayCalories = todayMeals.reduce((s, m) => s + m.calories, 0);
  const todayProtein = todayMeals.reduce((s, m) => s + m.protein_g, 0);
  const todayFat = todayMeals.reduce((s, m) => s + m.fat_g, 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + m.carbs_g, 0);

  // Next injection
  const lastInjection = injectionLogs[0];
  const nextInjectionDays = lastInjection
    ? (() => {
        const last = new Date(lastInjection.date);
        const next = new Date(last);
        next.setDate(next.getDate() + 7);
        const diff = Math.ceil(
          (next.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
        );
        return diff;
      })()
    : null;

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            {profile?.name ? (
              <Text style={styles.userName}>{profile.name} さん</Text>
            ) : null}
            <Text style={styles.dateText}>{getJapaneseDateString(new Date())}</Text>
          </View>
          <View style={styles.headerRight}>
            {profile?.use_manjaro && (
              <View style={styles.manjaroBadge}>
                <Text style={styles.manjaroBadgeText}>マンジャロ使用中</Text>
              </View>
            )}
          </View>
        </View>

        {/* Week Progress */}
        {profile?.start_date && (
          <View style={styles.weekProgressCard}>
            <Text style={styles.weekProgressLabel}>
              Week {currentWeek} / 24
            </Text>
            <View style={styles.weekProgressBarBg}>
              <View
                style={[
                  styles.weekProgressBarFill,
                  { width: `${Math.round((currentWeek / 24) * 100)}%` as any },
                ]}
              />
            </View>
          </View>
        )}

        {/* Today's PFC Summary */}
        {pfcTarget ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>今日の栄養摂取</Text>
            <View style={styles.calorieRow}>
              <Text style={styles.calorieValue}>{Math.round(todayCalories)}</Text>
              <Text style={styles.calorieUnit}>kcal</Text>
              <Text style={styles.calorieTarget}>/ {pfcTarget.targetCalories} kcal</Text>
            </View>
            <PFCProgressBar
              label="カロリー"
              current={todayCalories}
              target={pfcTarget.targetCalories}
              unit="kcal"
              color={Colors.accent}
            />
            <PFCProgressBar
              label="タンパク質"
              current={todayProtein}
              target={pfcTarget.protein}
              color={Colors.protein}
            />
            <PFCProgressBar
              label="脂質"
              current={todayFat}
              target={pfcTarget.fat}
              color={Colors.fat}
            />
            <PFCProgressBar
              label="炭水化物"
              current={todayCarbs}
              target={pfcTarget.carbs}
              color={Colors.carbs}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>今日の栄養摂取</Text>
            <Text style={styles.emptyText}>
              設定タブでプロフィールを入力するとPFC目標が表示されます
            </Text>
          </View>
        )}

        {/* Weight Chart */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>体重推移</Text>
            <TouchableOpacity style={styles.addSmallButton} onPress={openAddWeight}>
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addSmallButtonText}>記録</Text>
            </TouchableOpacity>
          </View>
          {/* Range selector */}
          <View style={styles.rangeSelector}>
            {RANGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.rangeButton, chartRange === opt.key && styles.rangeButtonActive]}
                onPress={() => setChartRange(opt.key)}
              >
                <Text style={[styles.rangeButtonText, chartRange === opt.key && styles.rangeButtonTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <WeightChart logs={weightLogs} />
          {weightLogs.length > 0 && (
            <>
              <Text style={styles.latestWeight}>
                最新: {[...weightLogs].sort((a,b) => b.date.localeCompare(a.date))[0]?.weight_kg} kg
                {weightLogs.length >= 2 && (() => {
                  const sorted = [...weightLogs].sort((a,b) => b.date.localeCompare(a.date));
                  const diff = sorted[0].weight_kg - sorted[1].weight_kg;
                  return (
                    <Text style={[styles.weightDiff, { color: diff <= 0 ? Colors.secondary : Colors.danger }]}>
                      {' '}({diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg)
                    </Text>
                  );
                })()}
              </Text>
              <View style={styles.weightLogDivider} />
              {[...weightLogs]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10)
                .map((log) => (
                  <View key={log.id} style={styles.weightLogRow}>
                    <Text style={styles.weightLogDate}>{log.date}</Text>
                    <Text style={styles.weightLogValue}>{log.weight_kg} kg</Text>
                    <TouchableOpacity onPress={() => openEditWeight(log)} style={styles.weightLogEditButton}>
                      <Ionicons name="pencil" size={13} color="#fff" />
                      <Text style={styles.weightLogEditText}>編集</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteWeight(log)} style={styles.weightLogAction}>
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
            </>
          )}
        </View>

        {/* Next Injection Card */}
        <View style={[styles.card, styles.injectionCard]}>
          <View style={styles.injectionCardLeft}>
            <Ionicons name="medical" size={24} color={Colors.primary} />
            <View style={styles.injectionCardText}>
              <Text style={styles.cardTitle}>次回投与</Text>
              {lastInjection ? (
                <>
                  <Text style={styles.injectionDose}>
                    前回: {lastInjection.dose_mg}mg ({lastInjection.date})
                  </Text>
                  <Text style={[
                    styles.nextInjectionDays,
                    { color: nextInjectionDays !== null && nextInjectionDays <= 0 ? Colors.danger : nextInjectionDays !== null && nextInjectionDays <= 2 ? Colors.warning : Colors.text }
                  ]}>
                    {nextInjectionDays !== null && nextInjectionDays <= 0
                      ? '今日が投与日です'
                      : nextInjectionDays !== null
                      ? `あと ${nextInjectionDays} 日`
                      : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.emptyText}>投与記録がありません</Text>
              )}
            </View>
          </View>
        </View>

        {/* Step Message Card */}
        {currentMessage && (
          <StepMessageCard
            message={currentMessage}
            currentWeek={currentWeek}
          />
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>クイックアクション</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => setWeightModalVisible(true)}
          >
            <Ionicons name="scale" size={24} color={Colors.primary} />
            <Text style={styles.quickActionText}>体重記録</Text>
          </TouchableOpacity>
          <Link href="/nutrition" asChild>
            <TouchableOpacity style={styles.quickActionButton}>
              <Ionicons name="restaurant" size={24} color={Colors.secondary} />
              <Text style={styles.quickActionText}>食事記録</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/injection" asChild>
            <TouchableOpacity style={styles.quickActionButton}>
              <Ionicons name="medical" size={24} color={Colors.accent} />
              <Text style={styles.quickActionText}>投与記録</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Weight Modal (add / edit) */}
      <Modal
        visible={weightModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingWeight ? '体重を修正' : '体重を記録'}</Text>
            <TextInput
              style={styles.dateInput}
              value={weightDateInput}
              onChangeText={setWeightDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <TextInput
              style={styles.weightInput}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="例: 68.5"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.weightInputUnit}>kg</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => { setWeightModalVisible(false); setEditingWeight(null); setWeightInput(''); }}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveWeight}
              >
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  manjaroBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  manjaroBadgeText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '600',
  },
  weekProgressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  weekProgressLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  weekProgressBarBg: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weekProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
  },
  calorieUnit: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  calorieTarget: {
    fontSize: 14,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  injectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  injectionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  injectionCardText: {
    marginLeft: 12,
    flex: 1,
  },
  injectionDose: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 0,
  },
  nextInjectionDays: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
    gap: 4,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  rangeButtonActive: {
    backgroundColor: Colors.primary,
  },
  rangeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  rangeButtonTextActive: {
    color: Colors.textOnPrimary,
  },
  latestWeight: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  weightDiff: {
    fontWeight: '600',
  },
  weightLogDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 12,
    marginBottom: 8,
  },
  weightLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  weightLogDate: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  weightLogValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 12,
  },
  weightLogEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  weightLogEditText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
    marginLeft: 4,
  },
  weightLogAction: {
    padding: 6,
  },
  dateInput: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 6,
    marginBottom: 16,
    width: 160,
  },
  addSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addSmallButtonText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 2,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 6,
  },
  bottomSpacer: {
    height: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  weightInput: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 8,
    width: 160,
  },
  weightInputUnit: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
});
