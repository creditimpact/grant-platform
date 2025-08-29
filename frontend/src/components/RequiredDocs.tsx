type Item = { key:string; label:string; optional?:boolean; accept_mime:string[]; notes?:string; examples:string[] };

export default function RequiredDocs({ items }: { items: Item[] }) {
  return (
    <div className="space-y-3">
      {items.map(i => (
        <div key={i.key} className="rounded-xl border p-4">
          <div className="font-medium">{i.label} {i.optional && <span className="text-sm text-gray-500">(optional)</span>}</div>
          <div className="text-sm">Accepted: {i.accept_mime.join(", ")}</div>
          {i.examples?.length ? <div className="text-sm">Examples: {i.examples.join(" • ")}</div> : null}
          {i.notes ? <div className="text-sm text-gray-500">{i.notes}</div> : null}
        </div>
      ))}
    </div>
  );
}
