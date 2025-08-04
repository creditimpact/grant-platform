'use client';
import { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  tooltip?: string;
}

export default function FormInput({ label, error, hint, tooltip, ...props }: Props) {
  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">
        {label}
        {tooltip && (
          <span className="ml-1 text-gray-400 cursor-pointer" title={tooltip}>
            ?
          </span>
        )}
      </label>
      <input
        {...props}
        className={`w-full rounded border px-3 py-2 ${error ? 'border-red-500' : ''}`}
      />
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      {!error && hint && <p className="text-gray-500 text-sm mt-1">{hint}</p>}
    </div>
  );
}
