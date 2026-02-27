import { Skeleton, SearchResultSkeleton } from '@/components/Skeleton';

export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title skeleton */}
        <div className="mb-8">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Search bar skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8 space-y-5">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </div>

        {/* Results skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(4)].map((_, i) => (
              <SearchResultSkeleton key={i} />
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-24 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
