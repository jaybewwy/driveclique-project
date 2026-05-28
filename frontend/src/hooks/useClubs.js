import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { clubsAPI } from '../services/api';

const ClubsContext = createContext(null);

/**
 * ClubsProvider component that manages club data across the application
 */
export const ClubsProvider = ({ children }) => {
  const [clubs, setClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  const loadClubs = useCallback(async () => {
    try {
      const response = await clubsAPI.getAll();
      
      if (response.data.success && isMountedRef.current) {
        setClubs(response.data.clubs);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadClubs();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadClubs]);

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