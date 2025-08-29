import RequiredDocs from "@/components/RequiredDocs";
import { getRequiredDocs } from "@/lib/apiClient";

export default async function Page({ params }: { params: { key: string } }) {
  const items = await getRequiredDocs(params.key);
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Required documents</h1>
      <RequiredDocs items={items} />
    </main>
  );
}
