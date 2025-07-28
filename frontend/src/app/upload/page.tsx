'use client';
import { useState } from 'react';
import Protected from '@/components/Protected';
import api from '@/lib/api';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload-doc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setMessage(res.data.message || 'Uploaded');
  };

  return (
    <Protected>
      <div className="max-w-md mx-auto py-10">
        <h1 className="text-2xl font-bold mb-4">Upload Documents</h1>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="mb-4" />
        <button onClick={handleUpload} className="px-4 py-2 bg-blue-600 text-white rounded">Upload</button>
        {message && <p className="mt-4">{message}</p>}
      </div>
    </Protected>
  );
}
