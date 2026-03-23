import { motion } from 'motion/react';

interface BrandWatermarkProps {
  className?: string;
  compact?: boolean;
}

export default function BrandWatermark({ className = '', compact = false }: BrandWatermarkProps) {
  const logoSizeClass = compact ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]';
  const textSizeClass = compact ? 'text-[9px]' : 'text-[10px]';

  return (
    <motion.div
      initial={{ opacity: 0.7 }}
      animate={{ opacity: [0.72, 0.95, 0.72] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative overflow-hidden rounded-full border border-white/25 bg-black/35 px-2.5 py-1.5 backdrop-blur-sm select-none pointer-events-none ${className}`}
    >
      <div className="relative z-10 flex items-center gap-1.5 text-white">
        <motion.div
          animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          className={`${logoSizeClass} rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 border border-white/35 flex items-center justify-center font-black tracking-tight`}
        >
          AC
        </motion.div>
        <span className={`${textSizeClass} font-bold tracking-wide text-white/90`}>Amigos Coimbra</span>
      </div>

      <motion.div
        className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        animate={{ x: ['-120%', '330%'] }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'linear' }}
      />
    </motion.div>
  );
}
