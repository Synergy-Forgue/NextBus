// Theme helper for dark/light mode

export const getTheme = (darkMode: boolean) => {
  if (darkMode) {
    return {
      background: '#121212',
      surface: '#1E1E1E',
      surfaceVariant: '#2C2C2C',
      text: '#FFFFFF',
      textSecondary: '#B3B3B3',
      textTertiary: '#808080',
      border: '#3F3F3F',
      divider: '#404040',
      card: '#1E1E1E',
    };
  }

  // Light mode
  return {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F5',
    text: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#E8E8E8',
    divider: '#EEEEEE',
    card: '#FFFFFF',
  };
};
