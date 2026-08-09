// Unified Theme & Design System for NextBus Commuter App
// Inspired by Uber, Rapido, and modern transportation apps

export const theme = {
  // Color Palette
  colors: {
    primary: '#1E3A8A',
    primaryDark: '#312E81',
    primaryLight: '#C7D2FE',
    secondary: '#F59E0B',
    success: '#4CAF50',
    successDark: '#388E3C',
    warning: '#FFB800',
    danger: '#F44336',
    dangerDark: '#E53935',

    // Neutral Colors
    white: '#FFFFFF',
    black: '#000000',
    text: {
      primary: '#333333',
      secondary: '#666666',
      tertiary: '#999999',
      disabled: '#CCCCCC',
    },
    background: {
      primary: '#FFFFFF',
      secondary: '#F8F9FA',
      tertiary: '#F5F5F5',
      light: '#FAFAFA',
    },
    border: '#E8E8E8',
    divider: '#EEEEEE',
  },

  // Typography
  typography: {
    // Headings
    h1: {
      fontSize: 32,
      fontWeight: '800',
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 28,
      fontWeight: '800',
      lineHeight: 36,
      letterSpacing: -0.3,
    },
    h3: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 32,
    },
    h4: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 28,
    },
    h5: {
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 26,
    },

    // Body Text
    body1: {
      fontSize: 15,
      fontWeight: '600',
      lineHeight: 22,
    },
    body2: {
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
    },
    body3: {
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },

    // Labels & Captions
    caption1: {
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    },
    caption2: {
      fontSize: 11,
      fontWeight: '500',
      lineHeight: 14,
    },

    // Small
    small: {
      fontSize: 10,
      fontWeight: '400',
      lineHeight: 12,
    },
  },

  // Spacing System (Base unit: 4px)
  spacing: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
  },

  // Border Radius
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    xxl: 16,
    full: 999,
  },

  // Shadows
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 5,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
    xxl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
  },

  // Component Sizes
  sizes: {
    // Button Sizes
    button: {
      small: {
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 6,
      },
      medium: {
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 8,
      },
      large: {
        height: 52,
        paddingHorizontal: 20,
        borderRadius: 10,
      },
    },

    // Input Sizes
    input: {
      height: 44,
      borderRadius: 10,
      paddingHorizontal: 14,
    },

    // FAB Sizes
    fab: {
      small: 48,
      medium: 56,
      large: 64,
    },
  },

  // Transitions
  transitions: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
}

// Common Component Styles
export const componentStyles = {
  // Card Styles
  card: {
    default: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      ...theme.shadows.sm,
    },
    elevated: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      ...theme.shadows.md,
    },
    interactive: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      ...theme.shadows.sm,
    },
  },

  // Button Styles
  button: {
    primary: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    danger: {
      backgroundColor: theme.colors.danger,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
  },

  // Input Styles
  input: {
    default: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      fontSize: 14,
    },
    focused: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
  },
}
