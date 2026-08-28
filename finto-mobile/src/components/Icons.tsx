import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';

type P = { size?: number; color?: string };

const stroke = { strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const HomeIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 20V9.6l8-5.6 8 5.6V20" stroke={color} {...stroke} />
    <Path d="M9.6 20v-5.4h4.8V20" stroke={color} {...stroke} />
  </Svg>
);

export const PayIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 19V5" stroke={color} {...stroke} />
    <Path d="M6 11l6-6 6 6" stroke={color} {...stroke} />
  </Svg>
);

export const ActivityIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 15l4.5-5 3.5 3.4L20 6" stroke={color} {...stroke} />
    <Path d="M4 20h16" stroke={color} {...stroke} />
  </Svg>
);

export const CardsIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="5.5" width="18" height="13" rx="3.4" stroke={color} {...stroke} />
    <Path d="M3 10h18" stroke={color} {...stroke} />
  </Svg>
);

export const ProfileIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8.5" r="3.6" stroke={color} {...stroke} />
    <Path d="M5 19.5c1.4-3.2 4-4.8 7-4.8s5.6 1.6 7 4.8" stroke={color} {...stroke} />
  </Svg>
);

export const BellIcon = ({ size = 19, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 15V10a6 6 0 10-12 0v5l-1.5 2.5h15L18 15z" stroke={color} {...stroke} />
    <Path d="M9.5 20a2.6 2.6 0 005 0" stroke={color} {...stroke} />
  </Svg>
);

export const SearchIcon = ({ size = 17, color = colors.faint }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="6.4" stroke={color} {...stroke} />
    <Path d="M15.8 15.8L20 20" stroke={color} {...stroke} />
  </Svg>
);

export const BackIcon = ({ size = 20, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 19l-7-7 7-7" stroke={color} {...stroke} />
  </Svg>
);

export const ChevronIcon = ({ size = 18, color = colors.faint }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 5l7 7-7 7" stroke={color} {...stroke} />
  </Svg>
);

export const RequestIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14" stroke={color} {...stroke} />
    <Path d="M18 13l-6 6-6-6" stroke={color} {...stroke} />
  </Svg>
);

export const ScanIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9V6.5A2.5 2.5 0 016.5 4H9" stroke={color} {...stroke} />
    <Path d="M15 4h2.5A2.5 2.5 0 0120 6.5V9" stroke={color} {...stroke} />
    <Path d="M20 15v2.5a2.5 2.5 0 01-2.5 2.5H15" stroke={color} {...stroke} />
    <Path d="M9 20H6.5A2.5 2.5 0 014 17.5V15" stroke={color} {...stroke} />
    <Path d="M4 12h16" stroke={color} {...stroke} />
  </Svg>
);

export const WalletIcon = ({ size = 22, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="6" width="18" height="12.5" rx="3.2" stroke={color} {...stroke} />
    <Path d="M16 12.2h2.6" stroke={color} {...stroke} />
  </Svg>
);

export const LockIcon = ({ size = 19, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="5" y="10.5" width="14" height="9.5" rx="2.6" stroke={color} {...stroke} />
    <Path d="M8.4 10.5V8a3.6 3.6 0 017.2 0v2.5" stroke={color} {...stroke} />
  </Svg>
);

export const HelpIcon = ({ size = 19, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="8.4" stroke={color} {...stroke} />
    <Path d="M9.8 9.6a2.3 2.3 0 114.2 1.3c-.7.9-2 1.2-2 2.5" stroke={color} {...stroke} />
    <Path d="M12 16.8v.01" stroke={color} {...stroke} />
  </Svg>
);

export const CheckIcon = ({ size = 34, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4.5 12.5l5 5 10-10" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SnowIcon = ({ size = 18, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3v18" stroke={color} {...stroke} />
    <Path d="M4.2 7.5l15.6 9" stroke={color} {...stroke} />
    <Path d="M19.8 7.5l-15.6 9" stroke={color} {...stroke} />
  </Svg>
);

export const PlusIcon = ({ size = 20, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} {...stroke} />
  </Svg>
);
