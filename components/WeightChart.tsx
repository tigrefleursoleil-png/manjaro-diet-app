import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Colors from '../constants/colors';
import { WeightLog } from '../lib/database';

interface WeightChartProps {
  logs: WeightLog[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_LABELS = 8;

export default function WeightChart({ logs }: WeightChartProps) {
  if (logs.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          体重データが2件以上になるとグラフが表示されます
        </Text>
      </View>
    );
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const step = Math.max(1, Math.ceil(sorted.length / MAX_LABELS));

  const labels = sorted.map((log, i) => {
    if (i % step !== 0 && i !== sorted.length - 1) return '';
    const parts = log.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });

  const data = sorted.map((log) => log.weight_kg);
  const minVal = Math.min(...data) - 1;
  const maxVal = Math.max(...data) + 1;

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [{ data, color: () => Colors.primary, strokeWidth: 2 }],
        }}
        width={SCREEN_WIDTH - 64}
        height={180}
        yAxisSuffix="kg"
        fromNumber={maxVal}
        chartConfig={{
          backgroundColor: Colors.surface,
          backgroundGradientFrom: Colors.surface,
          backgroundGradientTo: Colors.surface,
          decimalPlaces: 1,
          color: (opacity = 1) => `rgba(41, 128, 185, ${opacity})`,
          labelColor: () => Colors.textSecondary,
          style: { borderRadius: 12 },
          propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primaryDark },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: Colors.borderLight,
            strokeWidth: 1,
          },
        }}
        bezier
        style={styles.chart}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        segments={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
