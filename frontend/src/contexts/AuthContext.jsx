import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);
const API_BASE = process.env.REACT_APP_BACKEND_URL + "/api";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("projetenne_token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("projetenne_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (accessToken, userData) => {
    localStorage.setItem("projetenne_token", accessToken);
    localStorage.setItem("projetenne_user", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("projetenne_token");
    localStorage.removeItem("projetenne_user");
    setToken(null);
    setUser(null);
  };

  // Vérification expiry + refresh permissions si absentes (migration V1.0 → V1.1+)
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        logout();
        return;
      }
    } catch {
      logout();
      return;
    }

    // Si l'user en localStorage n'a pas de permissions, les rafraîchir depuis /api/auth/me
    const stored = localStorage.getItem("projetenne_user");
    const storedUser = stored ? JSON.parse(stored) : null;
    if (!storedUser?.permissions?.length) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data?.permissions) {
            const updated = { ...storedUser, ...data, permissions: data.permissions };
            localStorage.setItem("projetenne_user", JSON.stringify(updated));
            setUser(updated);
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
