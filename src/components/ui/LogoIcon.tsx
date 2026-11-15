import { cn } from '@/lib/utils'

interface LogoIconProps {
  className?: string
}

/**
 * Brand icon for Budget Flow: Lucide Wallet above a simple wavy line.
 */
export default function LogoIcon({ className }: LogoIconProps) {
  return (
    <div
      className={cn(
        'w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center text-white flex-shrink-0',
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
        <g
          transform="translate(6.6, 3.8) scale(0.75)"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </g>
        <path
          d="M 6.5 24.5 Q 11.25 22.3, 16 24.5 T 25.5 24.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
