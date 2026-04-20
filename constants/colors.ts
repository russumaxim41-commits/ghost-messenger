const accent = '#00C48C';
const accentDark = '#00A37A';
const accentGlow = 'rgba(0,196,140,0.18)';

export const Glass = {
  dark: {
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.09)',
    cardStrong: 'rgba(255,255,255,0.09)',
    cardStrongBorder: 'rgba(255,255,255,0.14)',
    inputBg: 'rgba(255,255,255,0.06)',
    inputBorder: 'rgba(255,255,255,0.12)',
    overlay: 'rgba(7,9,26,0.7)',
    tabBar: 'rgba(7,9,26,0.88)',
    tabBarBorder: 'rgba(255,255,255,0.08)',
    accentGlow,
  },
  light: {
    card: 'rgba(255,255,255,0.72)',
    cardBorder: 'rgba(255,255,255,0.9)',
    cardStrong: 'rgba(255,255,255,0.88)',
    cardStrongBorder: 'rgba(255,255,255,1)',
    inputBg: 'rgba(255,255,255,0.8)',
    inputBorder: 'rgba(255,255,255,1)',
    overlay: 'rgba(230,233,245,0.7)',
    tabBar: 'rgba(240,242,250,0.92)',
    tabBarBorder: 'rgba(0,0,0,0.06)',
    accentGlow,
  },
};

const Colors = {
  light: {
    text: '#0D0F1A',
    textSecondary: '#5A6070',
    background: '#E8EBF5',
    backgroundSecondary: 'rgba(255,255,255,0.75)',
    backgroundTertiary: 'rgba(255,255,255,0.45)',
    tint: accent,
    tintDark: accentDark,
    tintGlow: accentGlow,
    tabIconDefault: '#9CA3AF',
    tabIconSelected: accent,
    border: 'rgba(0,0,0,0.07)',
    online: '#34D399',
    danger: '#EF4444',
    warning: '#F59E0B',
    gradientStart: '#E8EBF5',
    gradientEnd: '#D0D6EC',
  },
  dark: {
    text: '#F0F2FF',
    textSecondary: '#7A8099',
    background: '#07091A',
    backgroundSecondary: 'rgba(255,255,255,0.05)',
    backgroundTertiary: 'rgba(255,255,255,0.09)',
    tint: accent,
    tintDark: accentDark,
    tintGlow: accentGlow,
    tabIconDefault: '#4A5270',
    tabIconSelected: accent,
    border: 'rgba(255,255,255,0.08)',
    online: '#34D399',
    danger: '#EF4444',
    warning: '#F59E0B',
    gradientStart: '#07091A',
    gradientEnd: '#0E1230',
  },
};

export default Colors;
