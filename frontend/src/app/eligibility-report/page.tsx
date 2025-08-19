'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function EligibilityReport() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/eligibility-report').then(res => setData(res.data));
  }, []);

  return (
    <div className="py-10">
      <h1 className="text-2xl font-bold mb-4">Eligibility Report</h1>
      {data ? (
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
