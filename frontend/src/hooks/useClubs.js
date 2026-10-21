import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { clubsAPI } from '../services/api';
import { useAuth } from './useAuth';

const ClubsContext = createContext(null);

/**
 * ClubsProvider component that manages club data across the application
 */
export const ClubsProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?._id;
  const [clubs, setClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  // Only the latest request may write, so a reply that lands after someone
  // else has signed in never hands them the previous person's clubs
  const latestRequestRef = useRef(0);

  const loadClubs = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    const isCurrent = () => isMountedRef.current && requestId === latestRequestRef.current;
    try {
      const response = await clubsAPI.getAll();

      if (response.data.success && isCurrent()) {
        setClubs(response.data.clubs);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      if (isCurrent()) {
        setError(err.message);
      }
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // The list belongs to whoever is signed in. Signing in does not reload the
  // page, so the list loads when the user changes, and empties on sign-out.
  useEffect(() => {
    if (authLoading) return;
    if (userId) {
      setIsLoading(true);
      loadClubs();
    } else {
      latestRequestRef.current += 1; // a reply still on its way is dropped
      setClubs([]);
      setIsLoading(false);
    }
  }, [authLoading, userId, loadClubs]);

  const addClub = (club) => {
    setClubs(prev => [...prev, club]);
  };

  const updateClub = (clubId, updatedData) => {
    setClubs(prev => prev.map(club => 
      club._id === clubId ? { ...club, ...updatedData } : club
    ));
  };

  const removeClub = (clubId) => {
    setClubs(prev => prev.filter(club => club._id !== clubId));
  };

  const getClubById = (clubId) => {
    return clubs.find(club => club._id === clubId);
  };

  const isUserMember = (clubId, userId) => {
    const club = clubs.find(c => c._id === clubId);
    if (!club) return false;
    return club.members.some(member => 
      typeof member === 'string' ? member === userId : member._id === userId
    );
  };

  const isUserLeader = (clubId, userId) => {
    const club = clubs.find(c => c._id === clubId);
    if (!club) return false;
    const leaderId = club.leader?._id || club.leader;
    return leaderId === userId;
  };

  const value = {
    clubs,
    isLoading,
    error,
    refreshClubs: loadClubs,
    addClub,
    updateClub,
    removeClub,
    getClubById,
    isUserMember,
    isUserLeader,
  };

  return React.createElement(ClubsContext.Provider, { value }, children);
};

/**
 * Custom hook to access clubs context
 */
export const useClubs = () => {
  const context = useContext(ClubsContext);
  if (!context) {
    throw new Error('useClubs must be used within a ClubsProvider');
  }
  return context;
};

export default ClubsContext;