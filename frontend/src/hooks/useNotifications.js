import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsAPI } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Merge notification lists, deduping by server-assigned id and sorting
// newest-first. Used both to hydrate from persisted history and to fold in
// live SSE events, so it doesn't matter which one arrives first — neither
// can drop or duplicate an entry relative to the other.
const mergeById = (...lists) => {
  const byId = new Map();
  lists.flat().forEach((n) => {
    if (n?.id) byId.set(n.id, n);
  });
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 50);
};

export const useNotifications = (enabled = true) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sourceRef = useRef(null);
  // Holds the Capacitor app-state listener handle so we can remove it on cleanup
  const appListenerRef = useRef(null);

  // unreadCount is derived from notifications rather than tracked with its own
  // +1/-1 counter — that avoids drift when the REST hydration fetch and a live
  // SSE event for the same notification land in either order.
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.read).length);
  }, [notifications]);

  const addNotification = useCallback((payload) => {
    setNotifications((prev) => mergeById(prev, [payload]));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notificationsAPI.markAllRead().catch((error) =>
      console.warn('Failed to persist mark-all-read:', error)
    );
  }, []);

  const markOneRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    notificationsAPI.markRead(id).catch((error) =>
      console.warn('Failed to persist mark-read:', error)
    );
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Hydrate from persisted history so a fresh login or page reload shows
    // whatever happened while this client wasn't connected, instead of
    // starting empty and only ever seeing notifications from this point on.
    notificationsAPI
      .getAll()
      .then((res) => {
        const history = res.data?.data?.notifications || [];
        setNotifications((prev) => mergeById(prev, history));
      })
      .catch((error) => console.warn('Failed to load notification history:', error));

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
