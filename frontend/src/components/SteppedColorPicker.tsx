import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

interface ColorOption {
  name: string;
  hex: string; 
  lightHex: string;
  middleHex: string;
}

const tailwindColorPalette: ColorOption[] = [
  { name: 'Red', hex: '#ef4444', lightHex: '#ef444466', middleHex: '#ef4444aa' },
  { name: 'Orange', hex: '#f97316', lightHex: '#f9731666', middleHex: '#f97316aa' },
  { name: 'Amber', hex: '#f59e0b', lightHex: '#f59e0b66', middleHex: '#f59e0baa' },
  { name: 'Yellow', hex: '#eab308', lightHex: '#eab30866', middleHex: '#eab308aa' },
  { name: 'Lime', hex: '#84cc16', lightHex: '#84cc1666', middleHex: '#84cc16aa' },
  { name: 'Green', hex: '#22c55e', lightHex: '#22c55e66', middleHex: '#22c55eaa' },
  { name: 'Emerald', hex: '#10b981', lightHex: '#10b98166', middleHex: '#10b981aa' },
  { name: 'Teal', hex: '#14b8a6', lightHex: '#14b8a666', middleHex: '#14b8a6aa' },
  { name: 'Cyan', hex: '#06b6d4', lightHex: '#06b6d466', middleHex: '#06b6d4aa' },
  { name: 'Sky', hex: '#0ea5e9', lightHex: '#0ea5e966', middleHex: '#0ea5e9aa' },
  { name: 'Blue', hex: '#3b82f6', lightHex: '#3b82f666', middleHex: '#3b82f6aa' },
  { name: 'Indigo', hex: '#6366f1', lightHex: '#6366f166', middleHex: '#6366f1aa' },
  { name: 'Violet', hex: '#8b5cf6', lightHex: '#8b5cf666', middleHex: '#8b5cf6aa' },
  { name: 'Purple', hex: '#a855f7', lightHex: '#a855f766', middleHex: '#a855f7aa' },
  { name: 'Fuchsia', hex: '#d946ef', lightHex: '#d946ef66', middleHex: '#d946efaa' },
  { name: 'Pink', hex: '#ec4899', lightHex: '#ec489966', middleHex: '#ec4899aa' },
  { name: 'Rose', hex: '#f43f5e', lightHex: '#f43f5e66', middleHex: '#f43f5eaa' },
];

// Special option for "no color"
const noColorOption: ColorOption = {
  name: 'Automatic (based on plan)',
  hex: '',
  lightHex: '#e5e7eb66',
  middleHex: '#e5e7ebcc',
};

interface SteppedColorPickerProps {
  value: string; // This will be the hex or empty string
  onChange: (hex: string) => void;
}

const SteppedColorPicker: React.FC<SteppedColorPickerProps> = ({ value, onChange }) => {
  const allOptions = [noColorOption, ...tailwindColorPalette];
  const [isOpen, setIsOpen] = useState(true);

  // Find the currently selected color option
  const selectedOption = allOptions.find(color => color.hex === value) || noColorOption;

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Accordion Header */}
      <div 
        className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-md font-semibold">Activity Color</h3>
        <div className="flex items-center gap-3">
          {/* Show the selected color summary when collapsed */}
          {!isOpen && (
            <div className="flex items-center gap-2">
              <span className="text-sm">{selectedOption.name}</span>
              <div className="flex gap-1">
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: selectedOption.lightHex }}
                ></div>
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: selectedOption.middleHex }}
                ></div>
                <div 
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: selectedOption.hex || '#e5e7eb' }}
                ></div>
              </div>
            </div>
          )}
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      
      {/* Accordion Content */}
      {isOpen && (
        <div className="border-t p-3">
          <div className="grid gap-2 max-h-[280px] overflow-y-auto pr-1 -mr-1">
            {allOptions.map((color) => {
              const isSelected = value === color.hex;
              return (
                <div
                  key={color.name}
                  className={`flex items-center gap-4 p-3 border rounded-xl transition-all
                    ${isSelected ? 'bg-gray-100 shadow-sm' : 'hover:bg-gray-50 bg-white'} 
                    cursor-pointer`}
                  onClick={() => onChange(color.hex)}
                >
                  <div className="flex items-center gap-3">
                    {isSelected && (
                      <Check className="w-5 h-5 text-gray-700" />
                    )}
                    <span className="font-medium text-gray-800">{color.name}</span>
                  </div>
                  
                  <div className="flex gap-2 ml-auto">
                    <div 
                      className="w-6 h-6 rounded-sm"
                      style={{ backgroundColor: color.lightHex }}
                    ></div>
                    <div 
                      className="w-6 h-6 rounded-sm"
                      style={{ backgroundColor: color.middleHex }}
                    ></div>
                    <div 
                      className="w-6 h-6 rounded-sm"
                      style={{ backgroundColor: color.hex || '#e5e7eb' }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SteppedColorPicker; 