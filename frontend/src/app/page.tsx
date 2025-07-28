export default function Home() {
  return (
    <section className="text-center py-20">
      <h1 className="text-4xl font-bold mb-4">Grant Application Platform</h1>
      <p className="mb-8">Accelerate your funding process with AI-powered tools.</p>
      <div className="space-x-4">
        <a href="/register" className="px-4 py-2 bg-blue-600 text-white rounded">Get Started</a>
        <a href="/login" className="px-4 py-2 border rounded">Login</a>
      </div>
    </section>
  );
}
