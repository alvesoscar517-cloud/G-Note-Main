import { highlightText } from '@/lib/search'

interface HighlightProps {
  text: string
  query?: string
  className?: string
}

export function Highlight({ text, query, className = '' }: HighlightProps) {
  const segments = highlightText(text, query || '')

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        segment.highlight ? (
          <mark 
            key={i} 
            className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded-sm px-0.5"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </span>
  )
}
