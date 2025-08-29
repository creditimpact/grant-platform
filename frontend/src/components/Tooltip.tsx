export default function Tooltip({
  description,
  exampleUrl,
}: {
  description: string;
  exampleUrl?: string;
}) {
  return (
    <div className="relative group">
      <span className="text-xs text-gray-500 cursor-pointer">ℹ️</span>
      <div className="absolute z-10 hidden group-hover:block bg-black text-white text-xs rounded p-2 w-48">
        <p>{description}</p>
        {exampleUrl && (
          <a
            href={exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-300 underline mt-1 inline-block"
          >
            See example
          </a>
        )}
      </div>
    </div>
  );
}
