'use client';
import { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function FormInput({ label, ...props }: Props) {
  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">{label}</label>
      <input {...props} className="w-full rounded border px-3 py-2" />
    </div>
  );
}
