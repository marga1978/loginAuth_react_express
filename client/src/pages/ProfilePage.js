/**
 * PROFILE PAGE
 *
 * Pagina di esempio per testare il redirect dinamico
 * Se accedi a /profile senza essere loggato, dopo il login torni qui
 */

import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

function ProfilePage() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Profilo Utente</h1>
        <div>
          <button onClick={() => navigate('/dashboard')} className="logout-btn" style={{marginRight: '10px'}}>
            Dashboard
          </button>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="user-card">
        <h2>Il tuo profilo</h2>

        <div className="user-info">
          <div className="info-row">
            <span className="label">Nome completo:</span>
            <span className="value">{user?.name}</span>
          </div>

          <div className="info-row">
            <span className="label">Email:</span>
            <span className="value">{user?.email}</span>
          </div>

          <div className="info-row">
            <span className="label">ID utente:</span>
            <span className="value">{user?.id}</span>
          </div>
        </div>
      </div>

      <div className="info-box">
        <h3>Test del redirect dinamico</h3>
        <p>
          Se hai provato ad accedere a questa pagina senza essere autenticato,
          dopo il login sei stato reindirizzato automaticamente qui!
        </p>
        <p>
          Prova ad aprire <code>http://localhost:3000/profile</code> in una finestra
          in incognito per testare il flusso completo.
        </p>
      </div>
    </div>
  );
}

export default ProfilePage;
