/**
 * APP REACT - Frontend per autenticazione SSO Microsoft
 *
 * Questo componente gestisce:
 * 1. Routing tra pagine (Login, Dashboard)
 * 2. Context per stato autenticazione globale
 * 3. Protected routes
 */

import React, { createContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';

// STEP 1: Crea Context per autenticazione globale
export const AuthContext = createContext(null);

// Configura axios per inviare cookies
axios.defaults.withCredentials = true;

function App() {
  // STEP 2: State per gestire autenticazione
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  // STEP 3: Al caricamento, verifica se l'utente è già autenticato
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('http://localhost:5000/auth/user');
      setAuthState({
        isAuthenticated: true,
        user: response.data.user,
        loading: false
      });
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  };

  // STEP 4: Funzione per effettuare login
  const login = async (returnUrl) => {
    try {
      // 🔥 NUOVO: Passa returnUrl al backend (default: pagina corrente)
      const targetUrl = returnUrl || window.location.pathname;

      // Chiama il backend per ottenere l'URL di Microsoft
      const response = await axios.get('http://localhost:5000/auth/login', {
        params: { returnUrl: targetUrl }
      });

      // Reindirizza l'utente a Microsoft
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Errore durante login:', error);
      alert('Errore durante il login. Riprova.');
    }
  };

  // STEP 5: Funzione per effettuare logout
  const logout = async () => {
    try {
      await axios.post('http://localhost:5000/auth/logout');
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    } catch (error) {
      console.error('Errore durante logout:', error);
    }
  };

  // STEP 6: Protected Route Component
  const ProtectedRoute = ({ children }) => {
    if (authState.loading) {
      return <div className="loading">Caricamento...</div>;
    }

    // 🔥 NUOVO: Se non autenticato, salva la pagina corrente e reindirizza al login
    if (!authState.isAuthenticated) {
      // Salva dove l'utente voleva andare
      const returnUrl = window.location.pathname;
      return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} />;
    }

    return children;
  };

  if (authState.loading) {
    return <div className="loading">Caricamento...</div>;
  }

  // STEP 7: Render con routing
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

            {/* Dashboard protetta */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Profile page protetta - per testare il redirect dinamico */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
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
