import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      // Deep clone the parsed JSON to avoid reference issues
      return item
        ? JSON.parse(JSON.stringify(JSON.parse(item)))
        : JSON.parse(JSON.stringify(initialValue));
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return JSON.parse(JSON.stringify(initialValue));
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      // Deep clone before storing to avoid reference issues
      const clonedValue = JSON.parse(JSON.stringify(valueToStore));
      setStoredValue(clonedValue);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(clonedValue));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}
