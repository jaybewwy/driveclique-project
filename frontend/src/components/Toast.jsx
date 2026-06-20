import { useState, createContext, useCallback, useRef, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorClasses = {
  success: 'bg-green-900/90 border-green-600 text-green-400',
  error: 'bg-red-900/90 border-red-600 text-red-400',
  warning: 'bg-yellow-900/90 border-yellow-600 text-yellow-400',
  info: 'bg-blue-900/90 border-blue-600 text-blue-400',
};

/**
 * ToastProvider component that manages toast notifications across the application
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastTimeouts = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timeout = toastTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeouts.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      toastTimeouts.current.set(id, timeout);
    }

    return id;
  }, [removeToast]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = toastTimeouts.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast]);
  const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast]);
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm animate-in slide-in-from-right-full transition-all duration-300 ${colorClasses[toast.type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 hover:bg-white/10 rounded-lg p-1 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastProvider;