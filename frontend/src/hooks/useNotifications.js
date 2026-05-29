import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useNotifications = (enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef(null);

  const addNotification = useCallback((payload) => {
    setNotifications(prev => [{ ...payload, id: Date.now(), read: false }, ...prev].slice(0, 50));
    setUnreadCount(c => c + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const connect = () => {
      const url = `${API_BASE}/notifications/stream`;
      const es = new EventSource(`${url}?token=${token}`);
      sourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          addNotification(payload);
        } catch { /* ignore malformed frames */ }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5 seconds on error
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      sourceRef.current?.close();
    };
  }, [enabled, addNotification]);

  return { notifications, unreadCount, markAllRead, clear };
};
