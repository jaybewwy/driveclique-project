import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useNotifications = (enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef(null);
  // Holds the Capacitor app-state listener handle so we can remove it on cleanup
  const appListenerRef = useRef(null);

  const addNotification = useCallback((payload) => {
    setNotifications(prev => [{ ...payload, id: Date.now(), read: false }, ...prev].slice(0, 50));
    setUnreadCount(c => c + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markOneRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id && !n.read ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
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
        } catch (error) {
          console.warn('Ignored malformed SSE frame:', e.data, error);
        }
      };

      es.onerror = () => {
        es.close();
        // Only reconnect if the user is still logged in
        if (localStorage.getItem('token')) {
          setTimeout(connect, 5000);
        }
      };
    };

    connect();

    // On native platforms (iOS / Android), the WebView suspends JS execution when
    // the app is backgrounded, which drops the SSE connection. We use the Capacitor
    // App plugin to close it cleanly on background and reconnect on foreground.
    if (window.Capacitor?.isNativePlatform()) {
      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive && localStorage.getItem('token')) {
            if (!sourceRef.current || sourceRef.current.readyState === EventSource.CLOSED) {
              connect();
            }
          } else {
            sourceRef.current?.close();
          }
        }).then(handle => {
          appListenerRef.current = handle;
        });
      });
    }

    return () => {
      sourceRef.current?.close();
      appListenerRef.current?.remove();
    };
  }, [enabled, addNotification]);

  return { notifications, unreadCount, markAllRead, markOneRead, clear };
};
