/**
 * LOGIN PAGE
 *
 * Pagina semplice con bottone per login Microsoft
 */

import React, { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';

function LoginPage() {
  const { login } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  // Gestisci errori dal callback
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      alert(`Errore durante login: ${error}`);
    }
  }, [searchParams]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Benvenuto</h1>
        <p>Effettua il login con il tuo account Microsoft</p>

        {/* Bottone per login Microsoft */}
        <button onClick={login} className="microsoft-btn">
          <svg viewBox="0 0 23 23" width="21" height="21">
            <path fill="#f25022" d="M0 0h11v11H0z"/>
            <path fill="#00a4ef" d="M12 0h11v11H12z"/>
            <path fill="#7fba00" d="M0 12h11v11H0z"/>
            <path fill="#ffb900" d="M12 12h11v11H12z"/>
          </svg>
          Accedi con Microsoft
        </button>

        <div className="login-info">
          <h3>Come funziona:</h3>
          <ol>
            <li>Clicca sul bottone sopra</li>
            <li>Verrai reindirizzato a Microsoft</li>
            <li>Inserisci le tue credenziali Microsoft</li>
            <li>Autorizza l'applicazione</li>
            <li>Verrai reindirizzato alla dashboard</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
