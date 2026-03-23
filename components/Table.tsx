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

const DEFAULT_COLUMN_MIN_WIDTH = 84;
const TEAM_COLUMN_MIN_WIDTH = 140;

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
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [contentWidth, setContentWidth] = React.useState(0);

  const normalizedColumns = React.useMemo(
    () =>
      columns.map((col) => ({
        ...col,
        width:
          col.width ??
          (col.key === 'team_name' || col.label.toLowerCase() === 'team'
            ? TEAM_COLUMN_MIN_WIDTH
            : DEFAULT_COLUMN_MIN_WIDTH),
      })),
    [columns]
  );

  const intrinsicTableWidth = React.useMemo(
    () => normalizedColumns.reduce((sum, col) => sum + (col.width ?? DEFAULT_COLUMN_MIN_WIDTH), 0),
    [normalizedColumns]
  );
  const tableWidth = Math.max(containerWidth, intrinsicTableWidth);
  const showHorizontalHint = contentWidth > containerWidth + 2;

  return (
    <View
      style={styles.wrapper}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      {showHorizontalHint ? (
        <View style={[styles.hintPill, { borderColor, backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>Swipe</Text>
        </View>
      ) : null}
      <ScrollView
        horizontal
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        bounces={false}
        decelerationRate="fast"
        onContentSizeChange={(w) => setContentWidth(w)}
      >
        <View style={[styles.table, { borderColor, width: tableWidth }]}>
          <View style={[styles.headerRow, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
            {normalizedColumns.map((col) => (
              <View key={col.key} style={[styles.cell, { width: col.width }]}>
                <Text style={[styles.headerText, { color: headerTextColor }]} numberOfLines={1} ellipsizeMode="tail">
                  {col.label}
                </Text>
              </View>
            ))}
          </View>
          {data.map((row) => (
            <View key={keyExtractor(row)} style={[styles.dataRow, { borderBottomColor: borderColor }]}>
              {normalizedColumns.map((col) => {
                const value = row[col.key];
                const content = col.render ? col.render(value, row) : (value != null ? String(value) : '—');
                const isPrimitive = typeof content === 'string' || typeof content === 'number';
                return (
                  <View key={col.key} style={[styles.cell, { width: col.width }]}>
                    {isPrimitive ? (
                      <Text style={[styles.cellText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  hintPill: {
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hintText: { fontSize: 11, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  scrollContent: { flexGrow: 0 },
  table: { borderWidth: 1, borderRadius: 4 },
  headerRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  dataRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { paddingVertical: 8, paddingHorizontal: 10, minWidth: 44 },
  headerText: { fontWeight: '600', fontSize: 12 },
  cellText: { fontSize: 14 },
});
