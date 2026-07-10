import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../theme';

export interface CalendarHeatmapProps {
  calendar: { date: string; completed: boolean }[];
  title?: string;
}

export function CalendarHeatmap({ calendar, title = 'Last 180 days' }: CalendarHeatmapProps) {
  // Group by week (7 days per column)
  const weeks: { date: string; completed: boolean }[][] = [];
  for (let i = 0; i < calendar.length; i += 7) {
    weeks.push(calendar.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.column}>
              {week.map((day) => (
                <View
                  key={day.date}
                  style={[styles.cell, day.completed ? styles.cellCompleted : styles.cellEmpty]}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <View style={[styles.cell, styles.cellEmpty]} />
        <Text style={styles.legendText}>Missed</Text>
        <View style={[styles.cell, styles.cellCompleted]} />
        <Text style={styles.legendText}>Completed</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 8 },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, marginTop: 8 },
  grid: { flexDirection: 'row', gap: 3 },
  column: { gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 2 },
  cellEmpty: { backgroundColor: theme.colors.surfaceRaised },
  cellCompleted: { backgroundColor: theme.colors.accent },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  legendText: { ...theme.typography.caption, color: theme.colors.textMuted },
});
