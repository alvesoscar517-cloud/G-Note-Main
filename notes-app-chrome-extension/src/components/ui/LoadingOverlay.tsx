import { useThemeStore } from '@/stores/themeStore'

interface LoadingOverlayProps {
  isVisible: boolean
  text?: string
}

export function LoadingOverlay({ isVisible, text }: LoadingOverlayProps) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 transition-opacity duration-300">
      {/* App Icon - responsive size: smaller on desktop */}
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <div className="w-20 h-20 rounded-[20px] bg-neutral-900/90 dark:bg-white/90 shadow-2xl flex items-center justify-center p-3.5 animate-scaleIn">
          <img 
            src={isDark ? "/g-note.svg" : "/g-note-dark.svg"}
            alt="G-Note" 
            className="w-full h-full"
          />
        </div>
        
        {/* App Name */}
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-white animate-fadeInUp">
          {text || 'G-Note'}
        </h1>
        
        {/* Loading indicator */}
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500"
              style={{
                animation: 'loadingPulse 1.4s infinite ease-in-out both',
                animationDelay: `${i * 0.16}s`
              }}
            />
          ))}
        </div>
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
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.8);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeInUp {
          from { 
            opacity: 0;
            transform: translateY(10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out 0.1s both;
        }
      `}</style>
    </div>
  )
}
