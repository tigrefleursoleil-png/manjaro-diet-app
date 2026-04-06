import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Colors from '../constants/colors';
import { MealDayTotal } from '../lib/database';

interface NutritionChartProps {
  data: MealDayTotal[];
  target: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function NutritionChart({ data, target }: NutritionChartProps) {
  if (data.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          2日以上のデータが揃うとグラフが表示されます
        </Text>
      </View>
    );
  }

  const labels = data.map((d) => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });

  const calories = data.map((d) => Math.round(d.calories));
  const targetLine = data.map(() => target);
  const maxVal = Math.max(...calories, target) + 100;

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [
            { data: calories, color: () => Colors.accent, strokeWidth: 2 },
            { data: targetLine, color: () => 'rgba(39,174,96,0.5)', strokeWidth: 1.5, withDots: false },
          ],
          legend: ['実績', '目標'],
        }}
        width={SCREEN_WIDTH - 64}
        height={180}
        yAxisSuffix="k"
        fromZero={false}
        fromNumber={maxVal}
        chartConfig={{
          backgroundColor: Colors.surface,
          backgroundGradientFrom: Colors.surface,
          backgroundGradientTo: Colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(230, 126, 34, ${opacity})`,
          labelColor: () => Colors.textSecondary,
          style: { borderRadius: 12 },
          propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.accent },
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
        segments={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  chart: { borderRadius: 12 },
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
