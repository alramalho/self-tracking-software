import React, { ChangeEvent } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type EmojiInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

const isEmoji = (str: string): boolean => {
  // Individual components for better maintainability
  const patterns = [
      // Basic emoji ranges
      '[\u{1F300}-\u{1F9FF}]', // Miscellaneous Symbols and Pictographs, Supplemental Symbols
      '[\u{1F600}-\u{1F64F}]', // Emoticons
      '[\u{1F680}-\u{1F6FF}]', // Transport and Map
      '[\u{2600}-\u{26FF}]',   // Misc symbols
      '[\u{2700}-\u{27BF}]',   // Dingbats
      '[\u{1F900}-\u{1F9FF}]', // Supplemental Symbols and Pictographs
      '[\u{1FA70}-\u{1FAFF}]', // Symbols and Pictographs Extended-A
      
      // Regional indicators for flags
      '[\u{1F1E6}-\u{1F1FF}]',
      
      // Joiners and modifiers
      '[\u{FE00}-\u{FE0F}]', // Variation Selectors
      '[\u{1F3FB}-\u{1F3FF}]', // Skin tone modifiers
      '\u200D', // Zero Width Joiner
      
      // Misc symbols often used in emoji sequences
      '[\u{2B50}\u{2600}-\u{2B55}]', // Misc symbols
      '[\u{23E9}-\u{23EC}]', // Media control
      '[\u{23F0}\u{23F3}]',  // Clock faces
      '[\u{2934}\u{2935}]',  // Arrows
      '[\u{2B05}-\u{2B07}]'  // Directional arrows
  ].join('|');

  // Complete pattern that allows for sequences
  const emojiRegex = new RegExp(
      `^(?:${patterns})+$`,
      'u' // Unicode flag is essential
  );

  return emojiRegex.test(str);
};

export const EmojiInput: React.FC<EmojiInputProps> = ({
  value,
  onChange,
  className,
  ...props
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue === "" || isEmoji(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <Input
      type="text"
      value={value}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}; 