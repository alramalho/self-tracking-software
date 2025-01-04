import { Check } from "lucide-react";

interface DurationOptionProps {
  type: "habit" | "lifestyle" | "custom";
  title: string;
  description: string;
  emoji: string;
  isSelected: boolean;
  onSelect: () => void;
}

const DurationOption: React.FC<DurationOptionProps> = ({
  type,
  title,
  description,
  emoji,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      {isSelected && (
        <Check className="absolute top-3 right-3 h-4 w-4 text-blue-500" />
      )}
      <span className="text-2xl mb-2">{emoji}</span>
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
};

export default DurationOption; 