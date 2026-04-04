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
  getInjectionLogs,
  addInjectionLog,
  updateInjectionLog,
  deleteInjectionLog,
  InjectionLog,
} from '../../lib/database';

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextInjectionDate(lastDate: string): string {
  const d = new Date(lastDate);
  d.setDate(d.getDate() + 7);
  return formatDate(d);
}

const DOSES = [2.5, 5, 7.5, 10, 12.5, 15];
const SITES = ['お腹', '太もも', '二の腕'];
const SIDE_EFFECTS = ['吐き気', '便秘', '胃もたれ', '倦怠感', '食欲不振', 'その他'];

export default function InjectionScreen() {
  const today = formatDate(new Date());
  const [logs, setLogs] = useState<InjectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<InjectionLog | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(today);
  const [formDose, setFormDose] = useState(2.5);
  const [formSite, setFormSite] = useState('お腹');
  const [formNotes, setFormNotes] = useState('');
  const [formSideEffects, setFormSideEffects] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setLogs(await getInjectionLogs(50));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetForm = () => {
    setFormDate(today);
    setFormDose(2.5);
    setFormSite('お腹');
    setFormNotes('');
    setFormSideEffects([]);
  };

  const handleOpenModal = () => {
    setEditingLog(null);
    resetForm();
    setModalVisible(true);
  };

  const handleOpenEdit = (log: InjectionLog) => {
    setEditingLog(log);
    setFormDate(log.date);
    setFormDose(log.dose_mg);
    setFormSite(log.injection_site);
    setFormNotes(log.notes ?? '');
    setFormSideEffects(log.side_effects ? log.side_effects.split(',') : []);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const payload = {
      date: formDate,
      dose_mg: formDose,
      injection_site: formSite,
      notes: formNotes || undefined,
      side_effects: formSideEffects.length > 0 ? formSideEffects.join(',') : undefined,
    };
    try {
      if (editingLog) {
        await updateInjectionLog(editingLog.id!, payload);
      } else {
        await addInjectionLog(payload);
      }
      setModalVisible(false);
      setEditingLog(null);
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
          await deleteInjectionLog(id);
          loadData();
        },
      },
    ]);
  };

  const toggleSideEffect = (effect: string) => {
    setFormSideEffects((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect]
    );
  };

  const lastLog = logs[0];
  const nextDate = lastLog ? getNextInjectionDate(lastLog.date) : null;
  const totalWeeks = logs.length;
  const currentDose = lastLog?.dose_mg ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>投与記録</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleOpenModal}>
          <Ionicons name="add" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.addButtonText}>新規記録</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalWeeks}</Text>
            <Text style={styles.statLabel}>投与回数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {currentDose !== null ? `${currentDose}mg` : '---'}
            </Text>
            <Text style={styles.statLabel}>現在の用量</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {totalWeeks > 0 ? `${totalWeeks}週` : '---'}
            </Text>
            <Text style={styles.statLabel}>投薬期間</Text>
          </View>
        </View>

        {/* Next injection banner */}
        {nextDate && (
          <View style={styles.nextInjectionBanner}>
            <Ionicons name="calendar" size={20} color={Colors.primary} />
            <View style={styles.nextInjectionText}>
              <Text style={styles.nextInjectionLabel}>次回投与予定日</Text>
              <Text style={styles.nextInjectionDate}>{nextDate}</Text>
            </View>
          </View>
        )}

        {/* Log List */}
        {logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="medical-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>投与記録がありません</Text>
            <Text style={styles.emptyText}>上の「新規記録」ボタンから記録を追加してください</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logCardLeft}>
                <View style={styles.doseBadge}>
                  <Text style={styles.doseBadgeText}>{log.dose_mg}mg</Text>
                </View>
                <View style={styles.logCardInfo}>
                  <Text style={styles.logDate}>{log.date}</Text>
                  <Text style={styles.logSite}>
                    <Ionicons name="location-outline" size={12} /> {log.injection_site}
                  </Text>
                  {log.side_effects && (
                    <View style={styles.sideEffectsRow}>
                      {log.side_effects.split(',').map((se) => (
                        <View key={se} style={styles.sideEffectChip}>
                          <Text style={styles.sideEffectText}>{se}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {log.notes && (
                    <Text style={styles.logNotes}>{log.notes}</Text>
                  )}
                </View>
              </View>
              <View style={styles.logCardActions}>
                <TouchableOpacity onPress={() => handleOpenEdit(log)} style={styles.editButton}>
                  <Ionicons name="pencil" size={13} color="#fff" />
                  <Text style={styles.editButtonText}>編集</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(log.id!)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add Injection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingLog ? '投与記録を修正' : '新規投与記録'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date */}
              <Text style={styles.fieldLabel}>投与日</Text>
              <TextInput
                style={styles.textInput}
                value={formDate}
                onChangeText={setFormDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />

              {/* Dose */}
              <Text style={styles.fieldLabel}>用量</Text>
              <View style={styles.optionRow}>
                {DOSES.map((dose) => (
                  <TouchableOpacity
                    key={dose}
                    style={[
                      styles.optionChip,
                      formDose === dose && styles.optionChipSelected,
                    ]}
                    onPress={() => setFormDose(dose)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        formDose === dose && styles.optionChipTextSelected,
                      ]}
                    >
                      {dose}mg
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Injection Site */}
              <Text style={styles.fieldLabel}>注射部位</Text>
              <View style={styles.optionRow}>
                {SITES.map((site) => (
                  <TouchableOpacity
                    key={site}
                    style={[
                      styles.optionChip,
                      formSite === site && styles.optionChipSelected,
                    ]}
                    onPress={() => setFormSite(site)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        formSite === site && styles.optionChipTextSelected,
                      ]}
                    >
                      {site}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Side Effects */}
              <Text style={styles.fieldLabel}>副作用（複数選択可）</Text>
              <View style={styles.optionRow}>
                {SIDE_EFFECTS.map((effect) => (
                  <TouchableOpacity
                    key={effect}
                    style={[
                      styles.optionChip,
                      formSideEffects.includes(effect) && styles.optionChipWarning,
                    ]}
                    onPress={() => toggleSideEffect(effect)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        formSideEffects.includes(effect) && styles.optionChipTextWarning,
                      ]}
                    >
                      {effect}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={styles.fieldLabel}>メモ（任意）</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="体調や気になることを記入..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />

              {/* Save Button */}
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  nextInjectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '33',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nextInjectionText: { flex: 1 },
  nextInjectionLabel: { fontSize: 12, color: Colors.textSecondary },
  nextInjectionDate: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
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
  logCardLeft: { flexDirection: 'row', flex: 1 },
  doseBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginRight: 12,
  },
  doseBadgeText: { color: Colors.textOnPrimary, fontWeight: '700', fontSize: 13 },
  logCardInfo: { flex: 1 },
  logDate: { fontSize: 14, fontWeight: '600', color: Colors.text },
  logSite: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sideEffectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  sideEffectChip: {
    backgroundColor: Colors.warning + '22',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.warning + '66',
  },
  sideEffectText: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  logNotes: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  logCardActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editButtonText: { fontSize: 11, color: '#fff', fontWeight: '700', marginLeft: 3 },
  deleteButton: { padding: 6 },
  bottomSpacer: { height: 20 },
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
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, marginTop: 14 },
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
  optionChipSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  optionChipWarning: { borderColor: Colors.warning, backgroundColor: Colors.warning + '15' },
  optionChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  optionChipTextSelected: { color: Colors.primary, fontWeight: '700' },
  optionChipTextWarning: { color: Colors.warning, fontWeight: '700' },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: Colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
});
