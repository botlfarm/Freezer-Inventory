
import React, { ReactNode } from 'react';
import { XIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  fullHeight?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg', fullHeight = false }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full ${maxWidth} ${fullHeight ? 'h-[90vh]' : 'max-h-[85vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-cool-gray-100">{title}</h2>
          <button onClick={onClose} className="text-cool-gray-400 hover:text-white transition cursor-pointer">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
