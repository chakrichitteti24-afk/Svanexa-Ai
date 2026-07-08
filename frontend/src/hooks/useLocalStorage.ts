'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Always initialize with initialValue to match SSR output
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // Load from localStorage on client-side mount
  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) {
          setStoredValue(JSON.parse(item));
        }
      } catch (error) {
      }
    };

    loadFromStorage();

    // Listen for custom event on the same window
    window.addEventListener('local-storage', loadFromStorage);
    // Listen for native storage event from other tabs
    window.addEventListener('storage', loadFromStorage);

    return () => {
      window.removeEventListener('local-storage', loadFromStorage);
      window.removeEventListener('storage', loadFromStorage);
    };
  }, [key]);

  // Persist setter
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          window.dispatchEvent(new Event('local-storage'));
        }
        return valueToStore;
      });
    } catch (error) {
    }
  };

  return [storedValue, setValue] as const;
}
