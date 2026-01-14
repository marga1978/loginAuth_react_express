/**
 * DASHBOARD PAGE
 *
 * Pagina protetta visibile solo dopo il login
 * Mostra i dati dell'utente autenticato
 */

import React, { useContext } from 'react';
import { AuthContext } from '../App';

function DashboardPage() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={logout} className="logout-btn">
          Logout
        </button>
      </div>

      <div className="user-card">
        <h2>Benvenuto, {user?.name}!</h2>

        <div className="user-info">
          <div className="info-row">
            <span className="label">Nome completo:</span>
            <span className="value">{user?.name}</span>
          </div>

          <div className="info-row">
            <span className="label">Nome:</span>
            <span className="value">{user?.firstName}</span>
          </div>

          <div className="info-row">
            <span className="label">Cognome:</span>
            <span className="value">{user?.lastName}</span>
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
        <h3>Hai effettuato l'accesso con successo!</h3>
        <p>
          Questa è una pagina protetta. Solo gli utenti autenticati possono vederla.
        </p>
        <p>
          I tuoi dati sono stati recuperati da Microsoft Graph API e salvati
          nella sessione del server.
        </p>
      </div>
    </div>
  );
}

export default DashboardPage;
