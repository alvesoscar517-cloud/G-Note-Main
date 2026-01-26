interface LoadingOverlayProps {
  isVisible: boolean
}

export function LoadingOverlay({ isVisible }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 transition-opacity duration-300">
      {/* Loading indicator - Three dots only */}
      <div className="flex gap-1.5 animate-fadeIn">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500"
            style={{
              animation: 'loadingPulse 1.4s infinite ease-in-out both',
              animationDelay: `${i * 0.16}s`
            }}
          />
        ))}
      </div>
      
      <style>{`
        @keyframes loadingPulse {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
