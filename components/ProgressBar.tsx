"use client";

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
}

export default function ProgressBar({ label, current, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-zinc-400 mb-1">
        <span>{label}</span>
        <span>
          {current}/{total} ({percentage}%)
        </span>
      </div>
      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
