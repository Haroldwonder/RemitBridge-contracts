import { createContext, useContext, useState } from 'react';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [org, setOrg] = useState(() => {
    try { return JSON.parse(localStorage.getItem('org')); } catch { return null; }
  });

  function login(token, org) {
    localStorage.setItem('token', token);
    localStorage.setItem('org', JSON.stringify(org));
    setToken(token);
    setOrg(org);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('org');
    setToken(null);
    setOrg(null);
  }

  return <AuthCtx.Provider value={{ token, org, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
