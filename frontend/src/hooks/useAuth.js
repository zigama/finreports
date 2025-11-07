// src/hooks/useAuth.js
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, setToken, login } from '../api/client';

const API = import.meta.env.VITE_API_BASE;

export function useAuth(){
  const nav = useNavigate();
  const [token, setTok] = useState(getToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // keep state in sync with localStorage (multi-tab support)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'auth_token') setTok(getToken());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // in case token was set before hook mounted
    setTok(getToken());
  }, []);

  const signIn = useCallback(async (username, password) => {
    setLoading(true); setError(null);
    try {
      const res = await login(username, password); // your existing API helper sets token via setToken()
      setTok(getToken());
      return res;
    } catch (e) {
      setError(e.message || 'Login failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const t = getToken();
    // best-effort server revoke; ignore network errors
    if (t) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t}` }
        });
      } catch { /* ignore */ }
    }
    // client-side clear
    setToken(null);
    setTok(null);
    // redirect to login
    nav('/login', { replace: true });
  }, [nav]);

  return { token, loading, error, signIn, signOut };
}
