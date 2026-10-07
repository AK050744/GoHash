interface Props { size?: 'sm' | 'md' | 'lg' }
const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }

export default function Spinner({ size = 'md' }: Props) {
  return (
    <svg
      className={`animate-spin text-primary-400 ${sizes[size]}`}
      fill="none" viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
