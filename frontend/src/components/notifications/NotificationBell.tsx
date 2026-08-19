'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationCenter } from './NotificationCenter';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationBellProps {
  className?: string;
  dropdownAlign?: 'left' | 'right';
}

export function NotificationBell({
  className = '',
  dropdownAlign = 'right',
}: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        bellContainerRef.current &&
        !bellContainerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={bellContainerRef} className={`relative inline-block ${className}`}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label="Open notifications"
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-purple-500/20 text-white shadow-md shadow-purple-500/20 ring-1 ring-purple-500/30'
            : 'bg-secondary/30 hover:bg-secondary/60 text-[#9d91c4] hover:text-white border border-border/30'
        }`}
      >
        <Bell className={`h-4.5 w-4.5 transition-transform duration-200 ${isOpen ? 'scale-110' : ''}`} />

        {/* Glowing Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-60"></span>
            <span className="relative inline-flex items-center justify-center rounded-full h-4 min-w-[16px] px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-extrabold shadow-sm border border-[#0d0a1a]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Floating Notification Center Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`fixed md:absolute z-50 top-16 md:top-full mt-2 left-4 right-4 md:left-auto ${
                dropdownAlign === 'right' ? 'md:right-0' : 'md:left-0'
              } md:w-[400px] flex justify-center`}
            >
              <NotificationCenter onClose={() => setIsOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
