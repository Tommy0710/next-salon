export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-slate-700" />
        <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-md w-36" />
      </div>
      <div
        className="h-52 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 bg-[length:200%_100%] animate-[shimmer_1.8s_infinite]"
      />
      <div className="flex justify-between mt-3 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 flex-1 bg-gray-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-slate-700 rounded-md w-44 mb-5" />
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-gray-50 dark:bg-slate-700 rounded w-1/2" />
            </div>
            <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
