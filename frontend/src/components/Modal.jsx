import { useEffect } from 'react';
import { X } from 'lucide-react';
import useFocusTrap from '../hooks/useFocusTrap';

/**
 * Reusable Modal component with consistent styling and behavior
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const dialogRef = useFocusTrap(isOpen);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 ${closeOnOverlayClick ? 'cursor-pointer' : ''}`}
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 rounded-3xl p-6 w-full ${sizeClasses[size]} border border-zinc-700/50 shadow-2xl animate-in zoom-in-95 duration-200`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {title && (
            <h2 id="modal-title" className="text-2xl font-bold text-white">
              {title}
            </h2>
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition p-2 hover:bg-zinc-800 rounded-xl"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        {/* Body */}
        <div className="text-zinc-300">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;