import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authAPI, getErrorMessage, setSessionExpiredHandler } from "../services/api";
import { tokenStorage, userStorage, clearSession } from "../services/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          tokenStorage.getToken(),
          userStorage.getUser(),
        ]);
        if (token && storedUser) {
          setUser(storedUser);
          // Refresh from server in the background to catch any profile changes
          try {
            const { data } = await authAPI.getProfile();
            if (data?.user) {
              setUser(data.user);
              await userStorage.setUser(data.user);
            }
          } catch {
            /* keep cached user if the profile refresh fails */
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await authAPI.login(username, password);
    await tokenStorage.setToken(data.token);
    if (data.refreshToken) await tokenStorage.setRefreshToken(data.refreshToken);

    let fullUser = data.user;
    try {
      const profileRes = await authAPI.getProfile();
      if (profileRes.data?.user) fullUser = profileRes.data.user;
    } catch {
      /* basic login payload is enough to proceed */
    }

    await userStorage.setUser(fullUser);
    setUser(fullUser);
    return fullUser;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await authAPI.register(payload);
    await tokenStorage.setToken(data.token);
    if (data.refreshToken) await tokenStorage.setRefreshToken(data.refreshToken);
    await userStorage.setUser(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      await clearSession();
    }
    setUser(null);
  }, []);

  const updateUser = useCallback(async (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      userStorage.setUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { getErrorMessage };
