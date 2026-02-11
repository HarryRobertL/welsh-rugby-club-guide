import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useResolvedColors } from '../lib/ui/theme/ThemeProvider';

export type TableColumn<T = Record<string, unknown>> = {
  key: string;
  label: string;
  width?: number;
  render?: (value: unknown, row: T) => React.ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
};

/**
 * Reusable table: header row + data rows. Sorted data is the caller's responsibility.
 * Theme-aware: white text on dark for legibility.
 * File: components/Table.tsx — shared table for league table and other tabular views.
 */
export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
}: TableProps<T>) {
  const colors = useResolvedColors();
  const borderColor = colors.border;
  const headerBg = colors.surfaceMuted;
  const textColor = colors.text;
  const headerTextColor = colors.text;

  return (
    <ScrollView horizontal style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.table, { borderColor }]}>
        <View style={[styles.headerRow, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
          {columns.map((col) => (
            <View key={col.key} style={[styles.cell, col.width != null && { width: col.width }]}>
              <Text style={[styles.headerText, { color: headerTextColor }]} numberOfLines={1}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {data.map((row) => (
          <View key={keyExtractor(row)} style={[styles.dataRow, { borderBottomColor: borderColor }]}>
            {columns.map((col) => {
              const value = row[col.key];
              const content = col.render ? col.render(value, row) : (value != null ? String(value) : '—');
              const isPrimitive = typeof content === 'string' || typeof content === 'number';
              return (
                <View key={col.key} style={[styles.cell, col.width != null && { width: col.width }]}>
                  {isPrimitive ? (
                    <Text style={[styles.cellText, { color: textColor }]} numberOfLines={1}>
                      {String(content)}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 0 },
  table: { borderWidth: 1, borderRadius: 4 },
  headerRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  dataRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { paddingVertical: 8, paddingHorizontal: 10, minWidth: 44 },
  headerText: { fontWeight: '600', fontSize: 12 },
  cellText: { fontSize: 14 },
});
