// NextBus brand tokens — Modern Neo-Transit Design System
// Electric Indigo → Royal Violet gradient, crisp surfaces, high-contrast typography

export const BRAND = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  purple: '#7C3AED',
  cyan: '#06B6D4',
  gradient: ['#4338CA', '#6366F1', '#8B5CF6'] as [string, string, string],
  heroGradient: ['#1E1B4B', '#312E81', '#4338CA'] as [string, string, string],
  cardGradient: ['#FFFFFF', '#F8FAFC'] as [string, string],
  accentGradient: ['#06B6D4', '#3B82F6'] as [string, string],

  bg: '#F8FAFC',
  bgDark: '#0B0F1A',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfaceElevated: '#FFFFFF',
  border: '#E2E8F0',
  borderFocus: '#818CF8',

  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  dangerBorder: '#FCA5A5',

  success: '#10B981',
  successSoft: '#D1FAE5',
  successBorder: '#6EE7B7',

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningBorder: '#FCD34D',

  info: '#3B82F6',
  infoSoft: '#DBEAFE',

  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
    pill: 999,
  },

  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  shadowLg: {
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },

  shadowPrimary: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
};
