import { useEffect, useState } from 'react';
import { getErrorMessage, notificationsAPI } from '../services/api';

/**
 * The user's per-type notification preferences (UC-30), loaded on mount.
 * A type missing from the map, or set to anything but false, is enabled.
 * toggle() updates optimistically and reverts if the save fails.
 */
export const useNotificationPreferences = () => {
  const [prefs, setPrefs] = useState({});
  const [savingType, setSavingType] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    notificationsAPI.getPreferences()
      .then(res => { if (res.data.success) setPrefs(res.data.data.notificationPreferences || {}); })
      .catch(err => console.warn('Failed to load notification preferences, defaulting to all enabled:', err));
  }, []);

  const toggle = async (type, value) => {
    setError('');
    const previous = prefs;
    setPrefs(prev => ({ ...prev, [type]: value })); // optimistic
    setSavingType(type);
    try {
      await notificationsAPI.updatePreferences({ [type]: value });
    } catch (err) {
      setPrefs(previous); // revert on failure
      setError(getErrorMessage(err));
    } finally {
      setSavingType(null);
    }
  };

  return { prefs, savingType, error, toggle };
};
