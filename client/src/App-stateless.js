/**
 * APP REACT - Frontend STATELESS per autenticazione SSO Microsoft con JWT
 *
 * Differenze rispetto alla versione stateful:
 * ❌ NON si basa su sessioni server
 * ❌ NON usa cookies automatici
 * ✅ Salva il JWT token in localStorage
 * ✅ Invia il token in ogni richiesta tramite header Authorization
 */

import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

// STEP 1: Crea Context per autenticazione globale
export const AuthContext = createContext(null);

// STEP 2: Configurazione axios per includere JWT in ogni richiesta
const api = axios.create({
  baseURL: 'http://localhost:5000'
});

// Interceptor per aggiungere JWT token a ogni richiesta
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// STEP 3: Componente per gestire il callback con il token
function AuthSuccessHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Salva il token in localStorage
      localStorage.setItem('jwt_token', token);
      console.log('✅ Token JWT salvato in localStorage');

      // Redirect alla dashboard
      navigate('/dashboard');
    } else {
      navigate('/login?error=no_token');
    }
  }, [searchParams, navigate]);

  return <div className="loading">Autenticazione in corso...</div>;
}

function App() {
  // STEP 4: State per gestire autenticazione
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  // STEP 5: Al caricamento, verifica se c'è un token valido
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('jwt_token');

    if (!token) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
      return;
    }

    try {
      // 🔥 Invia richiesta con token nell'header (gestito dall'interceptor)
      const response = await api.get('/auth/user');

      setAuthState({
        isAuthenticated: true,
        user: response.data.user,
        loading: false
      });
    } catch (error) {
      console.error('Token non valido o scaduto:', error);

      // Token non valido, rimuovilo
      localStorage.removeItem('jwt_token');

      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  };

  // STEP 6: Funzione per effettuare login (identica)
  const login = async () => {
    try {
      const response = await api.get('/auth/login');
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Errore durante login:', error);
      alert('Errore durante il login. Riprova.');
    }
  };

  // STEP 7: Funzione per effettuare logout
  const logout = async () => {
    try {
      await api.post('/auth/logout');

      // 🔥 Rimuovi il token dal localStorage (logout client-side)
      localStorage.removeItem('jwt_token');

      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });

      console.log('✅ Logout effettuato, token rimosso');
    } catch (error) {
      console.error('Errore durante logout:', error);

      // Anche se la chiamata fallisce, rimuovi comunque il token
      localStorage.removeItem('jwt_token');
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  };

  // STEP 8: Protected Route Component
  const ProtectedRoute = ({ children }) => {
    if (authState.loading) {
      return <div className="loading">Caricamento...</div>;
    }

    return authState.isAuthenticated ? children : <Navigate to="/login" />;
  };

  if (authState.loading) {
    return <div className="loading">Caricamento...</div>;
  }

  // STEP 9: Render con routing
  return (
    <AuthContext.Provider value={{ ...authState, login, logout, checkAuth }}>
      <Router>
        <div className="App">
          <Routes>
            {/* Pagina di login */}
            <Route
              path="/login"
              element={
                authState.isAuthenticated ?
                  <Navigate to="/dashboard" /> :
                  <LoginPage />
              }
            />

            {/* Route per gestire il callback con il token */}
            <Route
              path="/auth-success"
              element={<AuthSuccessHandler />}
            />

            {/* Dashboard protetta */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Redirect default */}
            <Route
              path="/"
              element={
                <Navigate to={authState.isAuthenticated ? "/dashboard" : "/login"} />
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
