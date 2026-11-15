import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
  error?: string
}

export default function Select({ label, options, error, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select
        {...props}
        className={cn(
          'input appearance-none cursor-pointer',
          error && 'border-red-400 focus:ring-red-400',
          className
        )}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
