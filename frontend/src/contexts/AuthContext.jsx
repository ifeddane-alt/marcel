import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

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

  // Check token expiry on mount
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          logout();
        }
      } catch {
        logout();
      }
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
