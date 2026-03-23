import { motion } from 'motion/react';

interface BrandWatermarkProps {
  className?: string;
  compact?: boolean;
  handle?: string;
  variant?: 'pill' | 'center';
}

export default function BrandWatermark({
  className = '',
  compact = false,
  handle = '@amigoscoimbra',
  variant = 'pill',
}: BrandWatermarkProps) {
  const isCenter = variant === 'center';
  const logoSizeClass = isCenter ? 'w-9 h-9 text-sm' : compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]';
  const textSizeClass = isCenter ? 'text-base' : compact ? 'text-[9px]' : 'text-[10px]';
  const wrapperClass = isCenter
    ? 'rounded-2xl border border-white/30 bg-black/45 px-4 py-3'
    : 'rounded-full border border-white/25 bg-black/35 px-2.5 py-1.5';

  return (
    <motion.div
      initial={{ opacity: 0.7 }}
      animate={{ opacity: [0.72, 0.95, 0.72] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative overflow-hidden ${wrapperClass} backdrop-blur-sm select-none pointer-events-none ${className}`}
    >
      <div className="relative z-10 flex items-center gap-1.5 text-white">
        <motion.div
          animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className={`${logoSizeClass} rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 border border-white/35 flex items-center justify-center font-black tracking-tight`}
        >
          AC
        </motion.div>
        <div className="flex flex-col leading-tight">
          <span className={`${textSizeClass} font-bold tracking-wide text-white/95`}>{handle}</span>
          <span className={`${isCenter ? 'text-xs' : 'text-[9px]'} text-white/75 font-semibold`}>Amigos Coimbra</span>
        </div>
      </div>

      <motion.div
        className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        animate={{ x: ['-120%', '330%'] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'linear' }}
      />
    </motion.div>
  );
}
