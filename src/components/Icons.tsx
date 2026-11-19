// Line icons copied from the approved mockups.
type P = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const HomeIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
)

export const DiscoverIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M2 6v12M22 6v12" />
  </svg>
)

export const BooksIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="9" rx="1" />
    <rect x="3" y="15" width="7" height="6" rx="1" />
    <rect x="14" y="15" width="7" height="6" rx="1" />
  </svg>
)

export const SearchIcon = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

export const PlusIcon = ({ size = 20 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
