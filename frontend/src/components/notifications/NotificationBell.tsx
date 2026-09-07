'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { NotificationCenter } from './NotificationCenter';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationBellProps {
  className?: string;
  dropdownAlign?: 'left' | 'right';
}

interface Coords {
  top: number;
  left?: number;
  right?: number;
  isMobile: boolean;
}

export function NotificationBell({
  className = '',
  dropdownAlign = 'right',
}: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute adaptive coordinates for desktop & mobile
  const updatePosition = useCallback(() => {
    if (!bellContainerRef.current) return;
    const isMobile = window.innerWidth < 768;
    const rect = bellContainerRef.current.getBoundingClientRect();

    if (isMobile) {
      setCoords({
        top: Math.max(60, rect.bottom + 8),
        isMobile: true,
      });
    } else {
      // Desktop: check if bell is in the left sidebar or top-right header
      if (rect.left < 300 || dropdownAlign === 'left') {
        // Left sidebar placement: fly out cleanly to the right of the 256px sidebar
        const sidebarRightEdge = 268;
        const targetLeft = Math.max(sidebarRightEdge, rect.right + 12);
        const targetTop = Math.max(12, Math.min(rect.top - 6, window.innerHeight - 580));
        setCoords({
          top: targetTop,
          left: targetLeft,
          isMobile: false,
        });
      } else {
        // Top right placement
        setCoords({
          top: rect.bottom + 8,
          right: Math.max(16, window.innerWidth - rect.right),
          isMobile: false,
        });
      }
    }
  }, [dropdownAlign]);

  // Recalculate position on open, window resize, and scroll
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', handleScrollOrResize);
        window.removeEventListener('scroll', handleScrollOrResize, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (bellContainerRef.current && bellContainerRef.current.contains(target)) {
        return;
      }
      const panel = document.getElementById('svanexa-notification-panel');
      if (panel && panel.contains(target)) {
        return;
      }
      setIsOpen(false);
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

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  const renderDropdown = () => {
    if (!isMounted || typeof document === 'undefined') return null;

    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <div className="svanexa-notification-portal-root">
            {/* Backdrop: translucent dark blur on mobile, click-capturing transparent on desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsOpen(false)}
              className={`fixed inset-0 z-[9998] ${
                coords?.isMobile ? 'bg-black/65 backdrop-blur-xs' : 'bg-transparent'
              }`}
            />

            {/* Floating Notification Center Card */}
            <motion.div
              id="svanexa-notification-panel"
              initial={{ opacity: 0, y: coords?.isMobile ? -8 : 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: coords?.isMobile ? -8 : 6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={
                coords?.isMobile
                  ? {
                      position: 'fixed',
                      top: `${coords.top}px`,
                      left: '12px',
                      right: '12px',
                      zIndex: 9999,
                    }
                  : {
                      position: 'fixed',
                      top: `${coords?.top ?? 16}px`,
                      ...(coords?.left !== undefined ? { left: `${coords.left}px` } : {}),
                      ...(coords?.right !== undefined ? { right: `${coords.right}px` } : {}),
                      width: '410px',
                      zIndex: 9999,
                    }
              }
              className="flex justify-center pointer-events-auto"
            >
              <NotificationCenter onClose={() => setIsOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  return (
    <div ref={bellContainerRef} className={`relative inline-block ${className}`}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label="Open notifications"
        onClick={handleToggle}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-white/[0.14] text-white shadow-sm ring-1 ring-white/[0.16]'
            : 'bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground border border-white/[0.08]'
        }`}
      >
        <Bell className={`h-4.5 w-4.5 transition-transform duration-200 ${isOpen ? 'scale-105 text-foreground' : ''}`} />

        {/* iOS Style Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center pointer-events-none">
            <span className="relative inline-flex items-center justify-center rounded-full h-4 min-w-[16px] px-1 bg-[#ff3b30] text-white text-[9px] font-semibold shadow-sm border border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Render popover into document.body to prevent parent overflow/clipping */}
      {renderDropdown()}
    </div>
  );
}
