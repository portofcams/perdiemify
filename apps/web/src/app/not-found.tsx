import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 bg-travel-pattern flex flex-col">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-brand-700">
              Perdiemify
            </span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-7xl font-extrabold text-brand-500 mb-4">404</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-500 mb-8">
            Looks like this page went over budget. Let&apos;s get you back on track.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25"
            >
              Back to Home
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold border-2 border-gray-200 hover:border-gray-300 rounded-xl transition-all"
            >
              Search Hotels
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
