/* Inline stroke icons (feather-style) — no icon dependency needed. */
import type { AppIcon } from '../api'

interface IconProps {
  size?: number
  className?: string
}

function base(size: number) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
}

export const PyramidLogo = ({ size = 20, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3 2 21h20L12 3z" /><path d="M7.5 13h9M5 17.5h14" />
  </svg>
)
export const PeopleIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
export const ScopeIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" /><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
    <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
  </svg>
)
export const RulerIcon = ({ size = 22, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21.3 8.7 15.3 2.7a1 1 0 0 0-1.4 0l-11.2 11.2a1 1 0 0 0 0 1.4l6 6a1 1 0 0 0 1.4 0l11.2-11.2a1 1 0 0 0 0-1.4z" />
    <path d="m7.5 10.5 2 2" /><path d="m10.5 7.5 2 2" /><path d="m13.5 4.5 2 2" /><path d="m4.5 13.5 2 2" />
  </svg>
)
export const AppIconFor = ({ icon, size, className }: IconProps & { icon: AppIcon }) => {
  const C = icon === 'people' ? PeopleIcon : icon === 'scope' ? ScopeIcon : RulerIcon
  return <C size={size} className={className} />
}
export const ArrowRightIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2.5}>
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)
export const ChevronRightIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="m9 18 6-6-6-6" /></svg>
)
export const CheckIcon = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
)
export const CrossIcon = ({ size = 11, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={3}><path d="M18 6 6 18M6 6l12 12" /></svg>
)
export const SpinnerIcon = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={3}><path d="M21 12a9 9 0 1 1-6.2-8.56" /></svg>
)
export const SunIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const MoonIcon = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
)
export const LogoutIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
  </svg>
)
export const SearchIcon = ({ size = 15, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
)
