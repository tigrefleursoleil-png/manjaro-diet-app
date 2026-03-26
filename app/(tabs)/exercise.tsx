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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import {
  getExerciseLogs,
  addExerciseLog,
  deleteExerciseLog,
  ExerciseLog,
} from '../../lib/database';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type ExerciseType = '筋トレ' | '有酸素' | 'ストレッチ';

const EXERCISE_TYPES: ExerciseType[] = ['筋トレ', '有酸素', 'ストレッチ'];

const EXERCISE_TYPE_COLORS: Record<ExerciseType, string> = {
  筋トレ: Colors.primary,
  有酸素: Colors.secondary,
  ストレッチ: Colors.accent,
};

const QUICK_EXERCISES: { name: string; type: ExerciseType; sets?: number; reps?: number; duration?: number }[] = [
  { name: 'スクワット', type: '筋トレ', sets: 3, reps: 10 },
  { name: 'プランク', type: 'ストレッチ', duration: 1 },
  { name: 'ウォーキング', type: '有酸素', duration: 30 },
  { name: '腕立て伏せ', type: '筋トレ', sets: 3, reps: 10 },
  { name: 'ランニング', type: '有酸素', duration: 20 },
  { name: 'ストレッチ', type: 'ストレッチ', duration: 10 },
];

export default function ExerciseScreen() {
  const today = formatDate(new Date());
  const [todayLogs, setTodayLogs] = useState<ExerciseLog[]>([]);
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  const [formType, setFormType] = useState<ExerciseType>('筋トレ');
  const [formName, setFormName] = useState('');
  const [formSets, setFormSets] = useState('');
  const [formReps, setFormReps] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      setTodayLogs(getExerciseLogs(today));
      setAllLogs(getExerciseLogs());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setFormType('筋トレ');
    setFormName('');
    setFormSets('');
    setFormReps('');
    setFormDuration('');
    setFormNotes('');
  };

  const handleSave = () => {
    if (!formName.trim()) {
      Alert.alert('入力エラー', '種目名を入力してください');
      return;
    }
    try {
      addExerciseLog({
        date: today,
        exercise_type: formType,
        name: formName.trim(),
        sets: formSets ? parseInt(formSets) : undefined,
        reps: formReps ? parseInt(formReps) : undefined,
        duration_min: formDuration ? parseFloat(formDuration) : undefined,
        notes: formNotes || undefined,
      });
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const handleQuickAdd = (exercise: typeof QUICK_EXERCISES[0]) => {
    try {
      addExerciseLog({
        date: today,
        exercise_type: exercise.type,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        duration_min: exercise.duration,
      });
      loadData();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('削除確認', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          deleteExerciseLog(id);
          loadData();
        },
      },
    ]);
  };

  const getWeekStart = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return formatDate(d);
  };

  const weekStart = getWeekStart();
  const weekLogs = allLogs.filter((l) => l.date >= weekStart);
  const weekDays = new Set(weekLogs.map((l) => l.date)).size;
  const totalDuration = weekLogs.reduce((s, l) => s + (l.duration_min ?? 0), 0);
  const strengthCount = weekLogs.filter((l) => l.exercise_type === '筋トレ').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>運動記録</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.addButtonText}>記録追加</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>今週の実績</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{weekDays}</Text>
              <Text style={styles.statLabel}>運動日数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.secondary }]}>{Math.round(totalDuration)}</Text>
              <Text style={styles.statLabel}>合計分数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.accent }]}>{strengthCount}</Text>
              <Text style={styles.statLabel}>筋トレ回数</Text>
            </View>
          </View>
          {weekDays < 2 && (
            <View style={styles.suggestionBanner}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.suggestionText}>週2回以上の筋力トレーニングを目指しましょう</Text>
            </View>
          )}
        </View>

        {/* Quick Add */}
        <Text style={styles.sectionTitle}>クイック追加</Text>
        <View style={styles.quickAddGrid}>
          {QUICK_EXERCISES.map((exercise) => (
            <TouchableOpacity
              key={exercise.name}
              style={styles.quickAddButton}
              onPress={() => handleQuickAdd(exercise)}
            >
              <Ionicons
                name={exercise.type === '筋トレ' ? 'barbell-outline' : exercise.type === '有酸素' ? 'walk-outline' : 'body-outline'}
                size={22}
                color={EXERCISE_TYPE_COLORS[exercise.type]}
              />
              <Text style={styles.quickAddName}>{exercise.name}</Text>
              <Text style={styles.quickAddDetail}>
                {exercise.sets && exercise.reps
                  ? `${exercise.sets}×${exercise.reps}回`
                  : `${exercise.duration}分`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's Log */}
        <Text style={styles.sectionTitle}>今日の記録 ({today})</Text>
        {todayLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="fitness-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>今日の運動記録はありません</Text>
            <Text style={styles.emptyText}>クイック追加または記録追加ボタンから入力してください</Text>
          </View>
        ) : (
          todayLogs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={[styles.typeIndicator, { backgroundColor: EXERCISE_TYPE_COLORS[log.exercise_type as ExerciseType] ?? Colors.primary }]} />
              <View style={styles.logInfo}>
                <Text style={styles.logName}>{log.name}</Text>
                <View style={styles.logMetaRow}>
                  <View style={[styles.typeBadge, { backgroundColor: (EXERCISE_TYPE_COLORS[log.exercise_type as ExerciseType] ?? Colors.primary) + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: EXERCISE_TYPE_COLORS[log.exercise_type as ExerciseType] ?? Colors.primary }]}>
                      {log.exercise_type}
                    </Text>
                  </View>
                  {log.sets != null && log.reps != null && (
                    <Text style={styles.logMeta}>{log.sets}セット × {log.reps}回</Text>
                  )}
                  {log.duration_min != null && (
                    <Text style={styles.logMeta}>{log.duration_min}分</Text>
                  )}
                </View>
                {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(log.id!)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Add Exercise Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>運動を記録</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>種類</Text>
              <View style={styles.optionRow}>
                {EXERCISE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      formType === type && {
                        borderColor: EXERCISE_TYPE_COLORS[type],
                        backgroundColor: EXERCISE_TYPE_COLORS[type] + '20',
                      },
                    ]}
                    onPress={() => setFormType(type)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        formType === type && { color: EXERCISE_TYPE_COLORS[type], fontWeight: '700' },
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>種目名</Text>
              <TextInput
                style={styles.textInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="例: スクワット、ランニングなど"
                placeholderTextColor={Colors.textMuted}
              />

              {formType === '筋トレ' && (
                <>
                  <Text style={styles.fieldLabel}>セット数・回数</Text>
                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.inputSubLabel}>セット数</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formSets}
                        onChangeText={setFormSets}
                        keyboardType="number-pad"
                        placeholder="3"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.inputSubLabel}>回数</Text>
                      <TextInput
                        style={styles.textInput}
                        value={formReps}
                        onChangeText={setFormReps}
                        keyboardType="number-pad"
                        placeholder="10"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>時間（分）</Text>
              <TextInput
                style={styles.textInput}
                value={formDuration}
                onChangeText={setFormDuration}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />

              <Text style={styles.fieldLabel}>メモ（任意）</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="体調や感想など..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>保存する</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  suggestionText: { flex: 1, fontSize: 12, color: Colors.primary },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 10, marginTop: 4 },
  quickAddGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickAddButton: {
    width: '31%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAddName: { fontSize: 12, fontWeight: '600', color: Colors.text, marginTop: 6, textAlign: 'center' },
  quickAddDetail: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeIndicator: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 12 },
  logInfo: { flex: 1 },
  logName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  logMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  logMeta: { fontSize: 12, color: Colors.textSecondary },
  logNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  deleteButton: { padding: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, marginTop: 12 },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textAreaInput: { height: 80, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  rowInputs: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  inputSubLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: Colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
});
