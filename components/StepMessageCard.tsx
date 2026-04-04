import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';
import { StepMessage } from '../constants/stepMessages';

interface StepMessageCardProps {
  message: StepMessage;
  currentWeek: number;
}

export default function StepMessageCard({
  message,
  currentWeek,
}: StepMessageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>Week {currentWeek}</Text>
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{message.title}</Text>
          <Text style={styles.subtitle}>今週のメッセージ</Text>
        </View>
        <TouchableOpacity onPress={handleToggle} style={styles.expandButton}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.body}>{message.body}</Text>
          <View style={styles.actionContainer}>
            <View style={styles.actionIcon}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.secondary} />
            </View>
            <Text style={styles.actionItem}>{message.actionItem}</Text>
          </View>
        </View>
      )}

      {!expanded && (
        <Text style={styles.bodyPreview} numberOfLines={2}>
          {message.body}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weekBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  weekBadgeText: {
    color: Colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  expandButton: {
    padding: 4,
  },
  bodyPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  content: {
    marginTop: 8,
  },
  body: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
  },
  actionIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  actionItem: {
    flex: 1,
    fontSize: 13,
    color: Colors.secondary,
    fontWeight: '600',
    lineHeight: 20,
  },
});
