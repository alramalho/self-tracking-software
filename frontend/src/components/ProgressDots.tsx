interface ProgressDotsProps {
  current: number;
  max: number;
}

export function ProgressDots({ current, max }: ProgressDotsProps) {
  return (
    <div className="flex gap-2 mb-8 mt-4">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < current ? "bg-blue-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
} 