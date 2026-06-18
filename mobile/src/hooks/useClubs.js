import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clubsAPI } from "../services/api";
import { useAuth } from "./useAuth";

const ClubsContext = createContext(null);

export function ClubsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const { data } = await clubsAPI.getAll();
      setClubs(data.clubs || []);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else setClubs([]);
  }, [isAuthenticated, refresh]);

  const updateClub = useCallback((clubId, patch) => {
    setClubs((prev) => prev.map((c) => (c._id === clubId ? { ...c, ...patch } : c)));
  }, []);

  return (
    <ClubsContext.Provider value={{ clubs, isLoading, refresh, updateClub }}>
      {children}
    </ClubsContext.Provider>
  );
}

export function useClubs() {
  const ctx = useContext(ClubsContext);
  if (!ctx) throw new Error("useClubs must be used within a ClubsProvider");
  return ctx;
}
