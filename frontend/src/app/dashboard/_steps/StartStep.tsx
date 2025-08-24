'use client';

export default function StartStep({
  onStart,
  loading,
}: {
  onStart: () => Promise<void> | void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-bold">Start Application</h2>
      <button
        onClick={onStart}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Starting...' : 'Start Application'}
      </button>
    </div>
  );
}
