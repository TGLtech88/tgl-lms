import React from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, title, description, children, className }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-50 w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl max-h-[90vh] overflow-y-auto", className)}>
        <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6">
          <h2 className="text-2xl font-bold leading-none tracking-tight text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500 mt-2">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full p-2 bg-slate-50 opacity-70 ring-offset-white transition-opacity hover:opacity-100 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  );
}
