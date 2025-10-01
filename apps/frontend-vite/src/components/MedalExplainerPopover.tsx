// Stub component - TODO: Migrate full functionality from old frontend
interface MedalExplainerPopoverProps {
  open: boolean;
  onClose: () => void;
}

export default function MedalExplainerPopover({
  open,
  onClose,
}: MedalExplainerPopoverProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white p-6 rounded-lg max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Medal System</h2>
        <p className="text-gray-600 mb-4">
          Earn medals by completing activities and building streaks!
        </p>
        <button
          onClick={onClose}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
}
