'use client';
import { FlowStep } from '@/lib/case-store';

const labels = ['Start', 'Questionnaire', 'Upload', 'Eligibility', 'Summary'];

export default function Progress({
  current,
  completed,
}: {
  current: FlowStep;
  completed: Record<FlowStep, boolean>;
}) {
  return (
    <ol className="flex justify-between text-xs">
      {labels.map((label, idx) => {
        const step = idx as FlowStep;
        const isDone = completed[step];
        const isCurrent = current === step;
        return (
          <li key={label} className="flex-1 text-center">
            <div
              className={`h-1 mb-1 ${isDone ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-300'}`}
            />
            <span className={isCurrent ? 'font-semibold' : ''}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
