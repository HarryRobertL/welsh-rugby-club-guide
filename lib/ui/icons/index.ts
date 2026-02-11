/**
 * Icon registry. All icon names used by the app go through this module.
 * Maps semantic names to @expo/vector-icons (Ionicons) name strings.
 */

export const ICON_REGISTRY = {
  Home: 'home',
  Search: 'search',
  Star: 'star',
  Bell: 'notifications-outline',
  Calendar: 'calendar-outline',
  Table: 'grid-outline',
  Trophy: 'trophy',
  MapPin: 'location-outline',
  Users: 'people-outline',
  Shield: 'shield-checkmark-outline',
  ChevronRight: 'chevron-forward',
  Refresh: 'refresh',
  // Used by app (tabs, design-system)
  Person: 'person-outline',
  Football: 'football',
  Rugby: 'american-football',
  ArrowBack: 'arrow-back',
  Moon: 'moon',
  Sunny: 'sunny',
  PhonePortrait: 'phone-portrait-outline',
} as const;

export type IconName = keyof typeof ICON_REGISTRY;

export function getIoniconsName(name: IconName): string {
  return ICON_REGISTRY[name];
}
