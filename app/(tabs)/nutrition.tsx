import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Colors from '../../constants/colors';
import PFCProgressBar from '../../components/PFCProgressBar';
import useProfile from '../../hooks/useProfile';
import { calculatePFC } from '../../lib/pfc';
import {
  getMealLogs,
  addMealLog,
  deleteMealLog,
  MealLog,
} from '../../lib/database';
import {
  searchFoodByBarcode,
  searchFoodByName,
  FoodItem,
} from '../../lib/foodSearch';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type TabType = 'target' | 'log' | 'progress';
type MealType = '朝食' | '昼食' | '夕食' | '間食';

const MEAL_TYPES: MealType[] = ['朝食', '昼食', '夕食', '間食'];

const MEAL_TYPE_COLORS: Record<MealType, string> = {
  朝食: '#F39C12',
  昼食: '#27AE60',
  夕食: '#2980B9',
  間食: '#9B59B6',
};

export default function NutritionScreen() {
  const today = formatDate(new Date());
  const { profile } = useProfile();
  const [activeTab, setActiveTab] = useState<TabType>('log');
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Form
  const [formMealType, setFormMealType] = useState<MealType>('朝食');
  const [formName, setFormName] = useState('');
  const [formCalories, setFormCalories] = useState('');
  const [formProtein, setFormProtein] = useState('');
  const [formFat, setFormFat] = useState('');
  const [formCarbs, setFormCarbs] = useState('');

  // Food search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [baseFood, setBaseFood] = useState<FoodItem | null>(null);
  const [formAmount, setFormAmount] = useState('100');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pfcTarget = profile ? calculatePFC(profile) : null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setMeals(await getMealLogs(today));
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

  // Debounced food search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchFoodByName(searchQuery);
      setSearchResults(results);
      setSearchLoading(false);
    }, 600);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const applyFood = (food: FoodItem, amount: number) => {
    const scale = amount / 100;
    setFormName(food.name);
    setFormCalories(String(Math.round(food.calories_per100g * scale)));
    setFormProtein(String(Math.round(food.protein_per100g * scale * 10) / 10));
    setFormFat(String(Math.round(food.fat_per100g * scale * 10) / 10));
    setFormCarbs(String(Math.round(food.carbs_per100g * scale * 10) / 10));
    setBaseFood(food);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleAmountChange = (val: string) => {
    setFormAmount(val);
    if (baseFood) {
      const amount = parseFloat(val) || 0;
      const scale = amount / 100;
      setFormCalories(String(Math.round(baseFood.calories_per100g * scale)));
      setFormProtein(String(Math.round(baseFood.protein_per100g * scale * 10) / 10));
      setFormFat(String(Math.round(baseFood.fat_per100g * scale * 10) / 10));
      setFormCarbs(String(Math.round(baseFood.carbs_per100g * scale * 10) / 10));
    }
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('カメラの許可が必要です', '設定からカメラへのアクセスを許可してください。');
        return;
      }
    }
    setBarcodeScanned(false);
    setShowScanner(true);
  };

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (barcodeScanned) return;
    setBarcodeScanned(true);
    setShowScanner(false);
    const food = await searchFoodByBarcode(data);
    if (food) {
      applyFood(food, parseFloat(formAmount) || 100);
    } else {
      Alert.alert(
        '見つかりませんでした',
        'このバーコードの食品データは登録されていません。手動で入力してください。'
      );
    }
  };

  const resetForm = () => {
    setFormMealType('朝食');
    setFormName('');
    setFormCalories('');
    setFormProtein('');
    setFormFat('');
    setFormCarbs('');
    setSearchQuery('');
    setSearchResults([]);
    setFormAmount('100');
    setBaseFood(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('入力エラー', '食品名を入力してください');
      return;
    }
    try {
      await addMealLog({
        date: today,
        meal_type: formMealType,
        name: formName.trim(),
        calories: parseFloat(formCalories) || 0,
        protein_g: parseFloat(formProtein) || 0,
        fat_g: parseFloat(formFat) || 0,
        carbs_g: parseFloat(formCarbs) || 0,
      });
      setModalVisible(false);
      resetForm();
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
        onPress: async () => {
          await deleteMealLog(id);
          loadData();
        },
      },
    ]);
  };

  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = meals.reduce((s, m) => s + m.protein_g, 0);
  const totalFat = meals.reduce((s, m) => s + m.fat_g, 0);
  const totalCarbs = meals.reduce((s, m) => s + m.carbs_g, 0);

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
        <Text style={styles.headerTitle}>栄養管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.addButtonText}>食事追加</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {([
          { key: 'target', label: 'PFC目標' },
          { key: 'log', label: '食事記録' },
          { key: 'progress', label: '達成率' },
        ] as { key: TabType; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabItemText, activeTab === tab.key && styles.tabItemTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'target' && (
          <View>
            {pfcTarget ? (
              <>
                <View style={styles.summaryCard}>
                  <Text style={styles.cardTitle}>基礎代謝・TDEE</Text>
                  <View style={styles.metricRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricValue}>{pfcTarget.bmr}</Text>
                      <Text style={styles.metricLabel}>基礎代謝 (BMR)</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.metricItem}>
                      <Text style={styles.metricValue}>{pfcTarget.tdee}</Text>
                      <Text style={styles.metricLabel}>消費カロリー (TDEE)</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricValue, { color: Colors.primary }]}>
                        {pfcTarget.targetCalories}
                      </Text>
                      <Text style={styles.metricLabel}>目標カロリー</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.cardTitle}>1日のPFC目標</Text>
                  <View style={styles.pfcBigRow}>
                    <View style={[styles.pfcBigItem, { borderColor: Colors.protein }]}>
                      <Text style={[styles.pfcBigValue, { color: Colors.protein }]}>{pfcTarget.protein}g</Text>
                      <Text style={styles.pfcBigLabel}>タンパク質</Text>
                      <Text style={styles.pfcBigKcal}>{pfcTarget.protein * 4}kcal</Text>
                    </View>
                    <View style={[styles.pfcBigItem, { borderColor: Colors.fat }]}>
                      <Text style={[styles.pfcBigValue, { color: Colors.fat }]}>{pfcTarget.fat}g</Text>
                      <Text style={styles.pfcBigLabel}>脂質</Text>
                      <Text style={styles.pfcBigKcal}>{pfcTarget.fat * 9}kcal</Text>
                    </View>
                    <View style={[styles.pfcBigItem, { borderColor: Colors.carbs }]}>
                      <Text style={[styles.pfcBigValue, { color: Colors.carbs }]}>{pfcTarget.carbs}g</Text>
                      <Text style={styles.pfcBigLabel}>炭水化物</Text>
                      <Text style={styles.pfcBigKcal}>{pfcTarget.carbs * 4}kcal</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.cardTitle}>1食あたりの目安（3食換算）</Text>
                  <View style={styles.perMealRow}>
                    <Text style={styles.perMealItem}>カロリー: {pfcTarget.perMeal.calories} kcal</Text>
                    <Text style={styles.perMealItem}>タンパク質: {pfcTarget.perMeal.protein} g</Text>
                    <Text style={styles.perMealItem}>脂質: {pfcTarget.perMeal.fat} g</Text>
                    <Text style={styles.perMealItem}>炭水化物: {pfcTarget.perMeal.carbs} g</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>プロフィール未設定</Text>
                <Text style={styles.emptyText}>設定タブでプロフィールを入力するとPFC目標が計算されます</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'log' && (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.cardTitle}>今日の合計 ({today})</Text>
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Colors.accent }]}>{Math.round(totalCalories)}</Text>
                  <Text style={styles.metricLabel}>kcal</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Colors.protein }]}>{Math.round(totalProtein)}g</Text>
                  <Text style={styles.metricLabel}>タンパク質</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Colors.fat }]}>{Math.round(totalFat)}g</Text>
                  <Text style={styles.metricLabel}>脂質</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: Colors.carbs }]}>{Math.round(totalCarbs)}g</Text>
                  <Text style={styles.metricLabel}>炭水化物</Text>
                </View>
              </View>
            </View>

            {meals.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="restaurant-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>食事記録がありません</Text>
                <Text style={styles.emptyText}>上の「食事追加」ボタンから記録を追加してください</Text>
              </View>
            ) : (
              MEAL_TYPES.map((mealType) => {
                const typeMeals = meals.filter((m) => m.meal_type === mealType);
                if (typeMeals.length === 0) return null;
                return (
                  <View key={mealType} style={styles.mealSection}>
                    <View style={[styles.mealSectionHeader, { backgroundColor: MEAL_TYPE_COLORS[mealType] + '22' }]}>
                      <View style={[styles.mealTypeDot, { backgroundColor: MEAL_TYPE_COLORS[mealType] }]} />
                      <Text style={[styles.mealSectionTitle, { color: MEAL_TYPE_COLORS[mealType] }]}>{mealType}</Text>
                      <Text style={styles.mealSectionTotal}>
                        {Math.round(typeMeals.reduce((s, m) => s + m.calories, 0))} kcal
                      </Text>
                    </View>
                    {typeMeals.map((meal) => (
                      <View key={meal.id} style={styles.mealItem}>
                        <View style={styles.mealItemLeft}>
                          <Text style={styles.mealName}>{meal.name}</Text>
                          <Text style={styles.mealDetails}>
                            {Math.round(meal.calories)}kcal
                            {meal.protein_g > 0 && ` · P${Math.round(meal.protein_g)}g`}
                            {meal.fat_g > 0 && ` · F${Math.round(meal.fat_g)}g`}
                            {meal.carbs_g > 0 && ` · C${Math.round(meal.carbs_g)}g`}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDelete(meal.id!)} style={styles.deleteButton}>
                          <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'progress' && (
          <View>
            {pfcTarget ? (
              <View style={styles.summaryCard}>
                <Text style={styles.cardTitle}>今日の達成率</Text>
                <PFCProgressBar label="カロリー" current={totalCalories} target={pfcTarget.targetCalories} unit="kcal" color={Colors.accent} />
                <PFCProgressBar label="タンパク質" current={totalProtein} target={pfcTarget.protein} color={Colors.protein} />
                <PFCProgressBar label="脂質" current={totalFat} target={pfcTarget.fat} color={Colors.fat} />
                <PFCProgressBar label="炭水化物" current={totalCarbs} target={pfcTarget.carbs} color={Colors.carbs} />
                <View style={styles.remainingSection}>
                  <Text style={styles.remainingTitle}>残り摂取量</Text>
                  <View style={styles.remainingGrid}>
                    {[
                      { label: 'カロリー', value: Math.max(0, pfcTarget.targetCalories - totalCalories), unit: 'kcal', color: Colors.accent },
                      { label: 'タンパク質', value: Math.max(0, pfcTarget.protein - totalProtein), unit: 'g', color: Colors.protein },
                      { label: '脂質', value: Math.max(0, pfcTarget.fat - totalFat), unit: 'g', color: Colors.fat },
                      { label: '炭水化物', value: Math.max(0, pfcTarget.carbs - totalCarbs), unit: 'g', color: Colors.carbs },
                    ].map((item) => (
                      <View key={item.label} style={styles.remainingItem}>
                        <Text style={[styles.remainingValue, { color: item.color }]}>
                          {Math.round(item.value)}{item.unit}
                        </Text>
                        <Text style={styles.remainingLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>プロフィール未設定</Text>
                <Text style={styles.emptyText}>設定タブでプロフィールを入力してください</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
            onBarcodeScanned={barcodeScanned ? undefined : handleBarcodeScan}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
            <Text style={styles.scannerHint}>バーコードをフレームに合わせてください</Text>
          </View>
          <TouchableOpacity
            style={styles.scanCancelButton}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.scanCancelText}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Add Meal Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>食事を記録</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Search Row */}
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.textInput, styles.searchInput]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="食品名で検索..."
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.scanButton} onPress={handleOpenScanner}>
                  <Ionicons name="barcode-outline" size={22} color={Colors.textOnPrimary} />
                </TouchableOpacity>
              </View>

              {/* Search Loading */}
              {searchLoading && (
                <ActivityIndicator style={{ marginVertical: 8 }} color={Colors.primary} />
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.searchResultItem,
                        i < searchResults.length - 1 && styles.searchResultBorder,
                      ]}
                      onPress={() => applyFood(item, parseFloat(formAmount) || 100)}
                    >
                      <Text style={styles.searchResultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.searchResultDetails}>
                        {Math.round(item.calories_per100g)}kcal · P{Math.round(item.protein_per100g)}g · F{Math.round(item.fat_per100g)}g · C{Math.round(item.carbs_per100g)}g / 100g
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Meal Type */}
              <Text style={styles.fieldLabel}>食事の種類</Text>
              <View style={styles.optionRow}>
                {MEAL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      formMealType === type && {
                        borderColor: MEAL_TYPE_COLORS[type],
                        backgroundColor: MEAL_TYPE_COLORS[type] + '20',
                      },
                    ]}
                    onPress={() => setFormMealType(type)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        formMealType === type && { color: MEAL_TYPE_COLORS[type], fontWeight: '700' },
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount (shown when food is selected from search/barcode) */}
              {baseFood && (
                <>
                  <Text style={styles.fieldLabel}>量 (g)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formAmount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    placeholder="100"
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              {/* Food Name */}
              <Text style={styles.fieldLabel}>食品名</Text>
              <TextInput
                style={styles.textInput}
                value={formName}
                onChangeText={(v) => { setFormName(v); setBaseFood(null); }}
                placeholder="例: ゆで卵、鶏胸肉など"
                placeholderTextColor={Colors.textMuted}
              />

              {/* Calories */}
              <Text style={styles.fieldLabel}>カロリー (kcal)</Text>
              <TextInput
                style={styles.textInput}
                value={formCalories}
                onChangeText={setFormCalories}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />

              {/* PFC */}
              <Text style={styles.fieldLabel}>PFC (g)</Text>
              <View style={styles.pfcInputRow}>
                <View style={styles.pfcInputItem}>
                  <Text style={[styles.pfcInputLabel, { color: Colors.protein }]}>タンパク質</Text>
                  <TextInput
                    style={[styles.textInput, styles.pfcInput]}
                    value={formProtein}
                    onChangeText={setFormProtein}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.pfcInputItem}>
                  <Text style={[styles.pfcInputLabel, { color: Colors.fat }]}>脂質</Text>
                  <TextInput
                    style={[styles.textInput, styles.pfcInput]}
                    value={formFat}
                    onChangeText={setFormFat}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.pfcInputItem}>
                  <Text style={[styles.pfcInputLabel, { color: Colors.carbs }]}>炭水化物</Text>
                  <TextInput
                    style={[styles.textInput, styles.pfcInput]}
                    value={formCarbs}
                    onChangeText={setFormCarbs}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>保存する</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: Colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  addButtonText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: Colors.primary },
  tabItemText: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  tabItemTextActive: { color: Colors.primary, fontWeight: '700' },
  container: { flex: 1 },
  contentContainer: { padding: 16 },
  summaryCard: {
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  divider: { width: 1, height: 40, backgroundColor: Colors.border },
  pfcBigRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  pfcBigItem: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 2, padding: 12 },
  pfcBigValue: { fontSize: 20, fontWeight: '700' },
  pfcBigLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pfcBigKcal: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  perMealRow: { gap: 6 },
  perMealItem: { fontSize: 14, color: Colors.textSecondary, paddingVertical: 2 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  mealSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  mealTypeDot: { width: 8, height: 8, borderRadius: 4 },
  mealSectionTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  mealSectionTotal: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  mealItemLeft: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '500', color: Colors.text },
  mealDetails: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  deleteButton: { padding: 6 },
  remainingSection: { marginTop: 16 },
  remainingTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  remainingGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  remainingItem: { alignItems: 'center' },
  remainingValue: { fontSize: 18, fontWeight: '700' },
  remainingLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  // Scanner
  scannerContainer: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
  scannerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerHint: {
    color: 'white',
    marginTop: 16,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scanCancelButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  scanCancelText: { color: 'white', fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  // Search
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  searchInput: { flex: 1 },
  scanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResults: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
    maxHeight: 220,
    overflow: 'hidden',
  },
  searchResultItem: { paddingHorizontal: 12, paddingVertical: 10 },
  searchResultBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  searchResultName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  searchResultDetails: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  // Form
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
  pfcInputRow: { flexDirection: 'row', gap: 8 },
  pfcInputItem: { flex: 1 },
  pfcInputLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  pfcInput: { textAlign: 'center' },
  saveButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: Colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
});
