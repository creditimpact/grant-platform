'use client';

export default function SupportButton() {
  const openSupport = () => {
    if (typeof window !== 'undefined') {
      window.open('mailto:support@example.com');
    }
  };

  return (
    <button
      onClick={openSupport}
      aria-label="Support"
      className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center"
    >
      ?
    </button>
  );
}
