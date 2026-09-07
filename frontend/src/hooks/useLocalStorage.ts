'use client';

import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Always initialize with initialValue to match SSR output
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const hookId = useRef(Math.random().toString(36).substring(2, 9));

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

    // Listen for custom event on the same window from other hook instances
    const handleLocalEvent = (e: Event) => {
      const custom = e as CustomEvent<{ key?: string; senderId?: string }>;
      if (custom.detail?.key && custom.detail.key !== key) return;
      if (custom.detail?.senderId && custom.detail.senderId === hookId.current) return;
      loadFromStorage();
    };

    window.addEventListener('local-storage', handleLocalEvent);
    // Listen for native storage event from other tabs
    window.addEventListener('storage', loadFromStorage);

    return () => {
      window.removeEventListener('local-storage', handleLocalEvent);
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
          window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, senderId: hookId.current } }));
        }
        return valueToStore;
      });
    } catch (error) {
    }
  };

  return [storedValue, setValue] as const;
}
