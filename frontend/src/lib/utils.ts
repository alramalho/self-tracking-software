import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function arrayBufferToBase64Async(arrayBuffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    const reader = new FileReader();
    
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result.split(',')[1]); // Extract base64 part
      } else {
        reject(new Error('Failed to convert ArrayBuffer to base64'));
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}