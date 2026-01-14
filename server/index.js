/**
 * SERVER EXPRESS - Backend per autenticazione SSO Microsoft
 *
 * Questo server gestisce:
 * 1. Redirect verso Microsoft per login
 * 2. Callback da Microsoft con il codice di autorizzazione
 * 3. Exchange del codice per access token
 * 4. Recupero dati utente
 * 5. Gestione sessione utente
 */

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const axios = require('axios');
require('dotenv').config();

const app = express();

// STEP 1: Configurazione middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true // Importante per inviare cookies
}));

app.use(express.json());

// Configurazione sessione per mantenere l'utente loggato
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true in produzione con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ore
  }
}));

// STEP 2: Configurazione Microsoft Azure AD
const msalConfig = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  tenantId: process.env.TENANT_ID || 'common',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:5000/auth/callback',

  // Endpoint Microsoft
  authorizeEndpoint: `https://login.microsoftonline.com/${process.env.TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.TENANT_ID || 'common'}/oauth2/v2.0/token`,
  userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',

  // Permessi richiesti (scope)
  scope: 'openid profile email User.Read'
};

// STEP 3: Route per iniziare il login
// Questa route genera l'URL per reindirizzare l'utente a Microsoft
app.get('/auth/login', (req, res) => {
  // Parametri per la richiesta OAuth 2.0
  const authUrl = new URL(msalConfig.authorizeEndpoint);
  authUrl.searchParams.append('client_id', msalConfig.clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', msalConfig.redirectUri);
  authUrl.searchParams.append('scope', msalConfig.scope);
  authUrl.searchParams.append('response_mode', 'query');

  // 🔥 NUOVO: Salva il returnUrl passato dal client
  const returnUrl = req.query.returnUrl || '/dashboard';

  // State per prevenire CSRF attacks + include returnUrl
  const state = JSON.stringify({
    random: Math.random().toString(36).substring(7),
    returnUrl: returnUrl
  });

  req.session.oauthState = state;
  authUrl.searchParams.append('state', state);

  console.log('🔐 Redirect to Microsoft login:', authUrl.toString());
  console.log('📍 Return URL:', returnUrl);

  // Invia l'URL al frontend
  res.json({ authUrl: authUrl.toString() });
});

// STEP 4: Route callback - Microsoft reindirizza qui dopo il login
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  console.log('📥 Callback ricevuto da Microsoft');

  // Gestione errori da Microsoft
  if (error) {
    console.error('❌ Errore da Microsoft:', error, error_description);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=${error}`);
  }

  // 🔥 NUOVO: Estrai returnUrl dallo state
  let returnUrl = '/dashboard'; // default
  try {
    const stateObj = JSON.parse(state);
    returnUrl = stateObj.returnUrl || '/dashboard';
  } catch (e) {
    console.warn('⚠️ State non è JSON valido, uso default');
  }

  // Verifica state per sicurezza CSRF (opzionale)
  if (state && req.session.oauthState && state !== req.session.oauthState) {
    console.error('❌ State mismatch - possibile CSRF attack');
    return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_state`);
  }

  if (!code) {
    console.error('❌ Nessun codice di autorizzazione ricevuto');
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
  }

  try {
    // STEP 5: Exchange del codice per access token
    console.log('🔄 Exchange codice per access token...');

    const tokenResponse = await axios.post(
      msalConfig.tokenEndpoint,
      new URLSearchParams({
        client_id: msalConfig.clientId,
        client_secret: msalConfig.clientSecret,
        code: code,
        redirect_uri: msalConfig.redirectUri,
        grant_type: 'authorization_code',
        scope: msalConfig.scope
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, id_token } = tokenResponse.data;
    console.log('✅ Access token ottenuto');

    // STEP 6: Recupera informazioni utente da Microsoft Graph API
    console.log('👤 Recupero informazioni utente...');

    const userResponse = await axios.get(msalConfig.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userData = userResponse.data;
    console.log('✅ Dati utente ottenuti:', userData.displayName);

    // STEP 7: Salva utente nella sessione
    req.session.user = {
      id: userData.id,
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      firstName: userData.givenName,
      lastName: userData.surname,
      accessToken: access_token // Salva per chiamate future a Graph API
    };

    req.session.isAuthenticated = true;

    console.log('✅ Utente autenticato e salvato in sessione');

    // 🔥 NUOVO: Redirect al returnUrl specificato
    console.log('📍 Redirect a:', returnUrl);
    res.redirect(`${process.env.CLIENT_URL}${returnUrl}`);

  } catch (error) {
    console.error('❌ Errore durante autenticazione:', error.response?.data || error.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
});

// STEP 8: Route per ottenere l'utente corrente (protected)
app.get('/auth/user', (req, res) => {
  if (!req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  // Non inviare l'access token al frontend per sicurezza
  const { accessToken, ...userWithoutToken } = req.session.user;

  res.json({
    isAuthenticated: true,
    user: userWithoutToken
  });
});

// STEP 9: Route per logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Errore durante logout:', err);
      return res.status(500).json({ error: 'Errore durante logout' });
    }

    console.log('👋 Utente disconnesso');
    res.json({ message: 'Logout effettuato con successo' });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Avvio server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server in esecuzione sulla porta ${PORT}`);
  console.log(`📋 Client URL: ${process.env.CLIENT_URL}`);
  console.log(`🔗 Redirect URI: ${msalConfig.redirectUri}`);
});
