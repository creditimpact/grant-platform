"use client";
import { useEffect, useRef, useState } from "react";
import { api, uploadFile } from "@/lib/apiClient";
import Tooltip from "@/components/Tooltip";
import PreUploadWizard from "@/components/PreUploadWizard";

export interface ChecklistItem {
  doc_type: string;
  source: "common" | "grant";
  grants: string[];
  status:
    | "not_uploaded"
    | "uploaded"
    | "parsing"
    | "extracted"
    | "approved"
    | "mismatch";
  description?: string;
  example_url?: string;
}

const STATUS_COLORS: Record<ChecklistItem["status"], string> = {
  not_uploaded: "bg-gray-200 text-gray-800",
  uploaded: "bg-blue-200 text-blue-800",
  parsing: "bg-yellow-200 text-yellow-800",
  extracted: "bg-purple-200 text-purple-800",
  approved: "bg-green-200 text-green-800",
  mismatch: "bg-red-200 text-red-800",
};

function StatusBadge({ status }: { status: ChecklistItem["status"] }) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ChecklistRow({
  doc,
  onUpload,
  uploading,
}: {
  doc: ChecklistItem;
  onUpload: (doc: ChecklistItem, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const needUpload = doc.status === "not_uploaded" || doc.status === "mismatch";
  return (
    <li
      key={doc.doc_type}
      className="flex items-center justify-between border rounded p-3"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium">{doc.doc_type}</span>
          {doc.description && (
            <Tooltip description={doc.description} exampleUrl={doc.example_url} />
          )}
        </div>
        {doc.grants.length ? (
          <div className="text-xs text-gray-500">
            Required by: {doc.grants.join(", ")}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={doc.status} />
        {needUpload && (
          uploading ? (
            <span className="text-sm text-gray-500">Uploading…</span>
          ) : (
            <>
              <input
                type="file"
                ref={inputRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await onUpload(doc, file);
                }}
              />
              <button
                className="px-2 py-1 text-sm bg-blue-500 text-white rounded"
                onClick={() => inputRef.current?.click()}
              >
                Upload
              </button>
            </>
          )
        )}
      </div>
    </li>
  );
}

export default function DocumentChecklist({
  caseId,
}: {
  caseId: string;
}) {
  const storageKey = `preupload_done_${caseId}`;
  const [wizardDone, setWizardDone] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    async function handleEligibility(e: CustomEvent) {
      if (e.detail?.caseId !== caseId) return;
      await fetchDocs();
      setNotice(true);
    }
    window.addEventListener(
      'eligibility-changed',
      handleEligibility as unknown as EventListener,
    );
    return () =>
      window.removeEventListener(
        'eligibility-changed',
        handleEligibility as unknown as EventListener,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function fetchDocs() {
    const res = await api.get(`/case/required-documents?caseId=${caseId}`);
    const list: ChecklistItem[] = Array.isArray(res.data)
      ? res.data
      : res.data.required || res.data.documents || [];
    const deduped = dedupe(list);
    setItems(deduped);
  }

  function dedupe(arr: ChecklistItem[]): ChecklistItem[] {
    const map = new Map<string, ChecklistItem>();
    arr.forEach((item) => {
      const existing = map.get(item.doc_type);
      if (existing) {
        existing.grants = Array.from(
          new Set([...(existing.grants || []), ...(item.grants || [])])
        );
        existing.status = item.status;
      } else {
        map.set(item.doc_type, { ...item });
      }
    });
    return Array.from(map.values());
  }

  async function handleUpload(doc: ChecklistItem, file: File) {
    setUploading((u) => ({ ...u, [doc.doc_type]: true }));
    const form = new FormData();
    form.append("file", file);
    form.append("key", doc.doc_type);
    form.append("caseId", caseId);
    try {
      await uploadFile(form);
    } catch (e) {
      alert("Upload failed");
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next[doc.doc_type];
        return next;
      });
    }
  }

  const common = items.filter((i) => i.source === "common");
  const grant = items
    .filter((i) => i.source === "grant")
    .sort((a, b) => a.doc_type.localeCompare(b.doc_type));

  if (!wizardDone) {
    return (
      <PreUploadWizard
        onContinue={() => {
          setWizardDone(true);
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {}
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p role="alert" className="text-sm text-blue-600">
          Your required documents have been updated based on new eligibility
          results.
        </p>
      )}
      <div>
        <h3 className="font-semibold mb-2">Common Documents</h3>
        <ul className="space-y-2">
          {common.map((doc) => (
            <ChecklistRow
              key={doc.doc_type}
              doc={doc}
              onUpload={handleUpload}
              uploading={!!uploading[doc.doc_type]}
            />
          ))}
        </ul>
      </div>
      {grant.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Grant-Specific Documents</h3>
          <ul className="space-y-2">
            {grant.map((doc) => (
              <ChecklistRow
                key={doc.doc_type}
                doc={doc}
                onUpload={handleUpload}
                uploading={!!uploading[doc.doc_type]}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

