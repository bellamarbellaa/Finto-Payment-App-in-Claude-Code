/** Icons traced from the design file, so stroke weights match the mockups. */
type P = { size?: number; color?: string };

const base = (size: number, color: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
});

export const HomeIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M4 20V9.6l8-5.6 8 5.6V20" /><path d="M9.6 20v-5.4h4.8V20" /></svg>
);

export const PayIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>
);

export const ActivityIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M4 15l4.5-5 3.5 3.4L20 6" /><path d="M4 20h16" /></svg>
);

export const CardsIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><rect x="3" y="5.5" width="18" height="13" rx="3.4" /><path d="M3 10h18" /></svg>
);

export const ProfileIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><circle cx="12" cy="8.5" r="3.6" /><path d="M5 19.5c1.4-3.2 4-4.8 7-4.8s5.6 1.6 7 4.8" /></svg>
);

export const BellIcon = ({ size = 19, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M18 15V10a6 6 0 10-12 0v5l-1.5 2.5h15L18 15z" /><path d="M9.5 20a2.6 2.6 0 005 0" /></svg>
);

export const SearchIcon = ({ size = 17, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><circle cx="11" cy="11" r="6.4" /><path d="M15.8 15.8L20 20" /></svg>
);

export const BackIcon = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M15 19l-7-7 7-7" /></svg>
);

export const ChevronIcon = ({ size = 18, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M9 5l7 7-7 7" /></svg>
);

export const RequestIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M12 5v14" /><path d="M18 13l-6 6-6-6" /></svg>
);

export const ScanIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M4 9V6.5A2.5 2.5 0 016.5 4H9" /><path d="M15 4h2.5A2.5 2.5 0 0120 6.5V9" />
    <path d="M20 15v2.5a2.5 2.5 0 01-2.5 2.5H15" /><path d="M9 20H6.5A2.5 2.5 0 014 17.5V15" />
    <path d="M4 12h16" />
  </svg>
);

export const WalletIcon = ({ size = 21, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><rect x="3" y="6" width="18" height="12.5" rx="3.2" /><path d="M16 12.2h2.6" /></svg>
);

export const LockIcon = ({ size = 19, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><rect x="5" y="10.5" width="14" height="9.5" rx="2.6" /><path d="M8.4 10.5V8a3.6 3.6 0 017.2 0v2.5" /></svg>
);

export const HelpIcon = ({ size = 19, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><circle cx="12" cy="12" r="8.4" /><path d="M9.8 9.6a2.3 2.3 0 114.2 1.3c-.7.9-2 1.2-2 2.5" /><path d="M12 16.8v.01" /></svg>
);

export const EyeIcon = ({ size = 19, color = 'currentColor', off = false }: P & { off?: boolean }) => (
  <svg {...base(size, color)}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
    {off && <path d="M4 20L20 4" />}
  </svg>
);

export const CheckIcon = ({ size = 22, color = 'currentColor' }: P) => (
  <svg {...base(size, color)} strokeWidth={2.4}><path d="M4.5 12.5l5 5 10-10" /></svg>
);

export const CloseIcon = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export const PlusIcon = ({ size = 20, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}><path d="M12 5v14M5 12h14" /></svg>
);

export const SnowIcon = ({ size = 19, color = 'currentColor' }: P) => (
  <svg {...base(size, color)}>
    <path d="M12 3v18" /><path d="M4.2 7.5l15.6 9" /><path d="M19.8 7.5l-15.6 9" />
    <path d="M12 6.6l2.2-2.2M12 6.6L9.8 4.4" />
  </svg>
);
