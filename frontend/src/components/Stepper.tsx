'use client';

interface StepperProps {
  steps: string[];
  current: number; // zero-based index
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center mb-6 text-sm">
      {steps.map((label, idx) => (
        <li key={label} className="flex items-center flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full font-medium
              ${idx <= current ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
          >
            {idx + 1}
          </div>
          <span className={`ml-2 ${idx <= current ? 'text-blue-600' : 'text-gray-600'}`}>{label}</span>
          {idx < steps.length - 1 && <div className="flex-1 h-px bg-gray-300 ml-4" />}
        </li>
      ))}
    </ol>
  );
}

