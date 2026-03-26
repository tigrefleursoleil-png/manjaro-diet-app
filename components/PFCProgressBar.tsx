import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../constants/colors';

interface PFCProgressBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}

export default function PFCProgressBar({
  label,
  current,
  target,
  unit = 'g',
  color = Colors.primary,
}: PFCProgressBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isOver = target > 0 && current > target;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.values, isOver && styles.overValues]}>
          {Math.round(current)}{unit} / {Math.round(target)}{unit}
        </Text>
      </View>
      <View style={styles.barBackground}>
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%` as any,
              backgroundColor: isOver ? Colors.danger : color,
            },
          ]}
        />
      </View>
      <Text style={[styles.percentage, isOver && styles.overValues]}>
        {Math.round(percentage)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  values: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  overValues: {
    color: Colors.danger,
  },
  barBackground: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentage: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'right',
  },
});
