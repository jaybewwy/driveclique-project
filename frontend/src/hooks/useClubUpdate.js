import { useState } from 'react';
import { clubsAPI } from '../services/api';

/**
 * Saves part of a club for a Club Settings section. PUT /api/clubs/:clubId
 * only touches the fields it is sent, so each section sends its own.
 *
 * `save(changes, successText)` resolves to the server's updated club, or
 * null if the request failed. That club comes back without its populated
 * leader/members, so callers should merge the fields they changed rather
 * than replace the club they hold. `message` is the { type, text } to show.
 */
export const useClubUpdate = (clubId) => {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const save = async (changes, successText) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await clubsAPI.update(clubId, changes);
      if (!response.data?.success) return null;
      setMessage({ type: 'success', text: successText });
      return response.data.club;
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update club. Please try again.' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { saving, message, setMessage, save };
};
