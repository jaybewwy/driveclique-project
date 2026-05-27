/**
 * Skeleton loading components for better UX during data fetching
 */

export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800/50 animate-pulse ${className}`}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="h-5 bg-zinc-800 rounded-lg w-3/4 mb-3" />
        <div className="flex items-center gap-4">
          <div className="h-4 bg-zinc-800 rounded w-20" />
          <div className="h-4 bg-zinc-800 rounded w-16" />
          <div className="h-4 bg-zinc-800 rounded w-24" />
        </div>
      </div>
      <div className="w-12 h-12 bg-zinc-800 rounded-xl" />
    </div>
  </div>
);

export const SkeletonClubCard = ({ className = '' }) => (
  <div className={`bg-zinc-900 rounded-3xl p-6 border border-zinc-800 animate-pulse ${className}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-800" />
        <div>
          <div className="h-5 bg-zinc-800 rounded w-32 mb-2" />
          <div className="h-4 bg-zinc-800 rounded w-20" />
        </div>
      </div>
      <div className="text-right">
        <div className="h-8 bg-zinc-800 rounded w-12 mb-1" />
        <div className="h-3 bg-zinc-800 rounded w-16" />
      </div>
    </div>
    <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
    <div className="h-4 bg-zinc-800 rounded w-2/3 mb-6" />
    <div className="h-10 bg-zinc-800 rounded-2xl w-full" />
  </div>
);

export const SkeletonAvatar = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-32 h-32',
  };

  return (
    <div className={`rounded-full bg-zinc-800 animate-pulse ${sizeClasses[size]} ${className}`} />
  );
};

export const SkeletonText = ({ lines = 1, className = '' }) => (
  <div className="space-y-2 animate-pulse">
    {Array.from({ length: lines }).map((_, i) => (
      <div 
        key={i} 
        className={`h-4 bg-zinc-800 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'} ${className}`} 
      />
    ))}
  </div>
);

export const SkeletonProfile = () => (
  <div className="animate-pulse">
    <div className="flex items-center gap-4 mb-6">
      <div className="w-20 h-20 rounded-full bg-zinc-800" />
      <div className="space-y-2">
        <div className="h-6 bg-zinc-800 rounded w-40" />
        <div className="h-4 bg-zinc-800 rounded w-24" />
      </div>
    </div>
    <div className="space-y-4">
      <div className="h-12 bg-zinc-800 rounded-xl" />
      <div className="h-12 bg-zinc-800 rounded-xl" />
      <div className="h-32 bg-zinc-800 rounded-xl" />
    </div>
  </div>
);

export const SkeletonSidebar = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-2xl">
      <div className="w-10 h-10 rounded-xl bg-zinc-800" />
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-zinc-800 rounded w-24" />
        <div className="h-3 bg-zinc-800 rounded w-16" />
      </div>
    </div>
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl">
          <div className="w-5 h-5 bg-zinc-800 rounded-lg" />
          <div className="h-4 bg-zinc-800 rounded w-20" />
        </div>
      ))}
    </div>
  </div>
);

export default {
  SkeletonCard,
  SkeletonClubCard,
  SkeletonAvatar,
  SkeletonText,
  SkeletonProfile,
  SkeletonSidebar,
};