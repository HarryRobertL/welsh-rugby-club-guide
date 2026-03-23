/**
 * Date picker modal for Games tab. Horizontal scrollable date strip.
 * Lets user jump to a specific matchday. Glass-style bottom sheet.
 * Uses View overlay instead of Modal for web compatibility.
 * File: features/games/DatePickerModal.tsx
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../lib/theme';
import {
  Icon,
  Text,
  useResolvedColors,
} from '../../lib/ui';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const DAY_WIDTH = 56;
const DAYS_BEFORE = 30;
const DAYS_AFTER = 60;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function generateDays(center: Date): Date[] {
  const days: Date[] = [];
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function formatDayLabel(d: Date): { weekday: string; day: string; month: string } {
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  matchDays: Set<string>;
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DatePickerModal({
  visible,
  onClose,
  selectedDate,
  onSelectDate,
  matchDays,
}: Props) {
  const colors = useResolvedColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const days = useMemo(() => generateDays(today), [today]);

  const scrollToSelected = useCallback(() => {
    const idx = days.findIndex((d) => isSameDay(d, selectedDate));
    if (idx >= 0 && scrollRef.current) {
      const offset = Math.max(0, idx * DAY_WIDTH - 120);
      scrollRef.current.scrollTo({ x: offset, animated: false });
    }
  }, [days, selectedDate]);

  useEffect(() => {
    if (visible) {
      setTimeout(scrollToSelected, 50);
    }
  }, [visible, scrollToSelected]);

  const handleSelect = useCallback(
    (d: Date) => {
      onSelectDate(d);
      onClose();
    },
    [onSelectDate, onClose]
  );

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + tokens.spacing.lg,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="bodyBold" color="text">Jump to date</Text>
          <Pressable
            onPress={onClose}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Icon name="Close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          style={styles.strip}
        >
          {days.map((d) => {
            const selected = isSameDay(d, selectedDate);
            const isToday = isSameDay(d, today);
            const hasMatch = matchDays.has(dateKey(d));
            const { weekday, day, month } = formatDayLabel(d);

            return (
              <Pressable
                key={dateKey(d)}
                onPress={() => handleSelect(d)}
                style={[
                  styles.dayCell,
                  selected && { backgroundColor: colors.primary },
                  !selected && isToday && { borderColor: colors.primary, borderWidth: 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${weekday} ${day} ${month}`}
                hitSlop={HIT_SLOP}
              >
                <Text
                  variant="micro"
                  color={selected ? 'primaryContrast' : 'textMuted'}
                >
                  {weekday}
                </Text>
                <Text
                  variant="bodyBold"
                  color={selected ? 'primaryContrast' : 'text'}
                >
                  {day}
                </Text>
                <Text
                  variant="micro"
                  color={selected ? 'primaryContrast' : 'textMuted'}
                >
                  {month}
                </Text>
                {hasMatch && (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: selected ? colors.primaryContrast : colors.primary },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={() => handleSelect(today)}
            style={[styles.todayBtn, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            hitSlop={HIT_SLOP}
          >
            <Text variant="caption" color="primary">Today</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingTop: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  strip: {
    flexGrow: 0,
  },
  stripContent: {
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  dayCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  todayBtn: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.xl,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
  },
});
