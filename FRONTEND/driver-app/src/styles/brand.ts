// NextBus brand tokens — same design system as the commuter app.
// Indigo → purple identity, white cards, soft slate neutrals.

export const BRAND = {
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  purple: '#7C3AED',
  gradient: ['#4F46E5', '#7C3AED'] as [string, string],

  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',

  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',

  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',

  radius: { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 },

  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
};
