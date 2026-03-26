import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import useProfile from '../../hooks/useProfile';
import { calculatePFC, ACTIVITY_FACTORS, calculateAge } from '../../lib/pfc';
import { UserProfile } from '../../lib/database';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SettingsScreen() {
  const { profile, loading, updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);

  // Form state mirrors UserProfile
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthYear, setBirthYear] = useState('1985');
  const [height, setHeight] = useState('165');
  const [weight, setWeight] = useState('70');
  const [activityFactor, setActivityFactor] = useState(1.55);
  const [goal, setGoal] = useState<UserProfile['goal']>('減量');
  const [useManjaro, setUseManjaro] = useState(true);
  const [startDate, setStartDate] = useState(formatDate(new Date()));

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setGender(profile.gender);
      setBirthYear(String(profile.birth_year));
      setHeight(String(profile.height_cm));
      setWeight(String(profile.weight_kg));
      setActivityFactor(profile.activity_factor);
      setGoal(profile.goal);
      setUseManjaro(profile.use_manjaro);
      setStartDate(profile.start_date || formatDate(new Date()));
    }
  }, [profile]);

  const buildProfile = (): UserProfile | null => {
    const birthYearNum = parseInt(birthYear);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (isNaN(birthYearNum) || birthYearNum < 1920 || birthYearNum > 2010) {
      Alert.alert('入力エラー', '生まれ年を正しく入力してください');
      return null;
    }
    if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      Alert.alert('入力エラー', '身長を正しく入力してください（100〜250cm）');
      return null;
    }
    if (isNaN(weightNum) || weightNum < 20 || weightNum > 300) {
      Alert.alert('入力エラー', '体重を正しく入力してください（20〜300kg）');
      return null;
    }
    return {
      ...profile,
      name: name.trim(),
      gender,
      birth_year: birthYearNum,
      height_cm: heightNum,
      weight_kg: weightNum,
      activity_factor: activityFactor,
      goal,
      use_manjaro: useManjaro,
      start_date: startDate,
    };
  };

  const handleSave = () => {
    const newProfile = buildProfile();
    if (!newProfile) return;
    try {
      updateProfile(newProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  // Preview PFC based on current form inputs (without saving)
  const previewProfile = buildProfile();
  const previewPFC = previewProfile ? calculatePFC(previewProfile) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定・プロフィール</Text>
        <TouchableOpacity
          style={[styles.saveButton, saved && styles.saveButtonDone]}
          onPress={handleSave}
        >
          <Ionicons
            name={saved ? 'checkmark' : 'save-outline'}
            size={16}
            color={Colors.textOnPrimary}
          />
          <Text style={styles.saveButtonText}>{saved ? '保存済み' : '保存'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本情報</Text>

          <Text style={styles.fieldLabel}>名前</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="例: 田中 太郎"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.fieldLabel}>性別</Text>
          <View style={styles.optionRow}>
            <TouchableOpacity
              style={[styles.optionChip, gender === 'M' && styles.optionChipSelected]}
              onPress={() => setGender('M')}
            >
              <Text style={[styles.optionChipText, gender === 'M' && styles.optionChipTextSelected]}>
                男性
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionChip, gender === 'F' && styles.optionChipSelected]}
              onPress={() => setGender('F')}
            >
              <Text style={[styles.optionChipText, gender === 'F' && styles.optionChipTextSelected]}>
                女性
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>生まれ年</Text>
              <TextInput
                style={styles.textInput}
                value={birthYear}
                onChangeText={setBirthYear}
                keyboardType="number-pad"
                placeholder="1985"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>
                年齢: {birthYear ? calculateAge(parseInt(birthYear)) : '--'} 歳
              </Text>
              <View style={[styles.textInput, styles.readonlyField]}>
                <Text style={styles.readonlyText}>自動計算</Text>
              </View>
            </View>
          </View>

          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>身長 (cm)</Text>
              <TextInput
                style={styles.textInput}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                placeholder="165"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>体重 (kg)</Text>
              <TextInput
                style={styles.textInput}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="70"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Activity & Goal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>活動量・目標</Text>

          <Text style={styles.fieldLabel}>活動レベル</Text>
          {ACTIVITY_FACTORS.map((af) => (
            <TouchableOpacity
              key={af.value}
              style={[
                styles.activityOption,
                activityFactor === af.value && styles.activityOptionSelected,
              ]}
              onPress={() => setActivityFactor(af.value)}
            >
              <View style={styles.activityOptionLeft}>
                <View
                  style={[
                    styles.activityRadio,
                    activityFactor === af.value && styles.activityRadioSelected,
                  ]}
                >
                  {activityFactor === af.value && (
                    <View style={styles.activityRadioDot} />
                  )}
                </View>
                <Text
                  style={[
                    styles.activityOptionText,
                    activityFactor === af.value && styles.activityOptionTextSelected,
                  ]}
                >
                  {af.label}
                </Text>
              </View>
              <Text style={styles.activityFactor}>×{af.value}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.fieldLabel}>目標</Text>
          <View style={styles.optionRow}>
            {(['減量', '維持', '増量'] as UserProfile['goal'][]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.optionChip, goal === g && styles.optionChipSelected]}
                onPress={() => setGoal(g)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    goal === g && styles.optionChipTextSelected,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Manjaro Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>マンジャロ設定</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <Text style={styles.switchLabel}>マンジャロ使用中</Text>
              <Text style={styles.switchDesc}>オンにするとPFC計算が最適化されます</Text>
            </View>
            <Switch
              value={useManjaro}
              onValueChange={setUseManjaro}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={useManjaro ? Colors.primary : Colors.textMuted}
            />
          </View>

          {useManjaro && (
            <>
              <Text style={styles.fieldLabel}>投与開始日</Text>
              <TextInput
                style={styles.textInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.helperText}>
                24週ステップメッセージはこの日を基準に配信されます
              </Text>
            </>
          )}
        </View>

        {/* PFC Target Preview */}
        {previewPFC && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PFC目標（プレビュー）</Text>
            <View style={styles.pfcPreviewCard}>
              <View style={styles.pfcPreviewRow}>
                <View style={styles.pfcPreviewItem}>
                  <Text style={styles.pfcPreviewLabel}>BMR</Text>
                  <Text style={styles.pfcPreviewValue}>{previewPFC.bmr}</Text>
                  <Text style={styles.pfcPreviewUnit}>kcal</Text>
                </View>
                <View style={styles.pfcPreviewItem}>
                  <Text style={styles.pfcPreviewLabel}>TDEE</Text>
                  <Text style={styles.pfcPreviewValue}>{previewPFC.tdee}</Text>
                  <Text style={styles.pfcPreviewUnit}>kcal</Text>
                </View>
                <View style={styles.pfcPreviewItem}>
                  <Text style={styles.pfcPreviewLabel}>目標</Text>
                  <Text style={[styles.pfcPreviewValue, { color: Colors.primary }]}>
                    {previewPFC.targetCalories}
                  </Text>
                  <Text style={styles.pfcPreviewUnit}>kcal</Text>
                </View>
              </View>

              <View style={styles.pfcMacroRow}>
                <View style={styles.pfcMacroItem}>
                  <Text style={[styles.pfcMacroValue, { color: Colors.protein }]}>
                    {previewPFC.protein}g
                  </Text>
                  <Text style={styles.pfcMacroLabel}>タンパク質</Text>
                </View>
                <View style={styles.pfcMacroItem}>
                  <Text style={[styles.pfcMacroValue, { color: Colors.fat }]}>
                    {previewPFC.fat}g
                  </Text>
                  <Text style={styles.pfcMacroLabel}>脂質</Text>
                </View>
                <View style={styles.pfcMacroItem}>
                  <Text style={[styles.pfcMacroValue, { color: Colors.carbs }]}>
                    {previewPFC.carbs}g
                  </Text>
                  <Text style={styles.pfcMacroLabel}>炭水化物</Text>
                </View>
              </View>

              <Text style={styles.perMealText}>
                1食あたり約 {previewPFC.perMeal.calories}kcal ·
                P{previewPFC.perMeal.protein}g ·
                F{previewPFC.perMeal.fat}g ·
                C{previewPFC.perMeal.carbs}g
              </Text>
            </View>
          </View>
        )}

        {/* Save Button Bottom */}
        <TouchableOpacity
          style={[styles.bottomSaveButton, saved && styles.saveButtonDone]}
          onPress={handleSave}
        >
          <Ionicons
            name={saved ? 'checkmark-circle' : 'save'}
            size={20}
            color={Colors.textOnPrimary}
          />
          <Text style={styles.bottomSaveButtonText}>
            {saved ? '保存しました！' : 'プロフィールを保存する'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  saveButtonDone: { backgroundColor: Colors.secondary },
  saveButtonText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readonlyField: {
    justifyContent: 'center',
  },
  readonlyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  rowFields: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  optionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  optionChipText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  optionChipTextSelected: { color: Colors.primary, fontWeight: '700' },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 6,
    backgroundColor: Colors.surface,
  },
  activityOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  activityOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  activityRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityRadioSelected: { borderColor: Colors.primary },
  activityRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  activityOptionText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  activityOptionTextSelected: { color: Colors.primary, fontWeight: '600' },
  activityFactor: { fontSize: 12, color: Colors.textMuted, marginLeft: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLeft: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  switchDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  helperText: { fontSize: 12, color: Colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  pfcPreviewCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
  },
  pfcPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  pfcPreviewItem: { alignItems: 'center' },
  pfcPreviewLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  pfcPreviewValue: { fontSize: 22, fontWeight: '700', color: Colors.text },
  pfcPreviewUnit: { fontSize: 11, color: Colors.textMuted },
  pfcMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    marginBottom: 10,
  },
  pfcMacroItem: { alignItems: 'center' },
  pfcMacroValue: { fontSize: 18, fontWeight: '700' },
  pfcMacroLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  perMealText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  bottomSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 10,
  },
  bottomSaveButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: { height: 20 },
});
