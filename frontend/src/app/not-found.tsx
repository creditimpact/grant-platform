export default function NotFound() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2">This page doesn’t exist.</p>
      <a className="underline mt-4 inline-block" href="/dashboard">Go to Dashboard</a>
    </main>
  );
}
