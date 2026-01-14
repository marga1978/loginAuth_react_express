/**
 * SERVER EXPRESS - Backend STATELESS per autenticazione SSO Microsoft con JWT
 *
 * Differenze rispetto alla versione stateful:
 * ❌ NON usa express-session (nessuna sessione sul server)
 * ❌ NON salva dati utente sul server
 * ✅ Usa JWT (JSON Web Token) per autenticazione
 * ✅ Il token viene inviato al client e salvato lì
 * ✅ Ogni richiesta include il token nell'header Authorization
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();

// STEP 1: Configurazione middleware (SENZA express-session)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// JWT Secret (in produzione usa una chiave sicura e salvala in .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // Durata del token

// STEP 2: Configurazione Microsoft Azure AD (identica)
const msalConfig = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  tenantId: process.env.TENANT_ID || 'common',
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:5000/auth/callback',

  authorizeEndpoint: `https://login.microsoftonline.com/${process.env.TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.TENANT_ID || 'common'}/oauth2/v2.0/token`,
  userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',

  scope: 'openid profile email User.Read'
};

// STEP 3: Middleware per verificare JWT
// Questo middleware verifica che il token sia valido
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Token non valido:', err.message);
      return res.status(403).json({ error: 'Token non valido o scaduto' });
    }

    req.user = user; // Aggiungi i dati utente alla richiesta
    next();
  });
}

// STEP 4: Route per iniziare il login (identica alla versione stateful)
app.get('/auth/login', (req, res) => {
  const authUrl = new URL(msalConfig.authorizeEndpoint);
  authUrl.searchParams.append('client_id', msalConfig.clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', msalConfig.redirectUri);
  authUrl.searchParams.append('scope', msalConfig.scope);
  authUrl.searchParams.append('response_mode', 'query');

  // State per CSRF (opzionale, ma più difficile senza sessioni)
  // Per semplicità lo omettiamo qui, ma in produzione puoi salvarlo in un cookie temporaneo
  const state = Math.random().toString(36).substring(7);
  authUrl.searchParams.append('state', state);

  console.log('🔐 Redirect to Microsoft login:', authUrl.toString());

  res.json({ authUrl: authUrl.toString() });
});

// STEP 5: Route callback - QUI CAMBIA TUTTO rispetto alla versione stateful
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  console.log('📥 Callback ricevuto da Microsoft');

  if (error) {
    console.error('❌ Errore da Microsoft:', error, error_description);
    return res.redirect(`${process.env.CLIENT_URL}/login?error=${error}`);
  }

  if (!code) {
    console.error('❌ Nessun codice di autorizzazione ricevuto');
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
  }

  try {
    // Exchange del codice per access token (identico)
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

    const { access_token } = tokenResponse.data;
    console.log('✅ Access token ottenuto');

    // Recupera informazioni utente (identico)
    console.log('👤 Recupero informazioni utente...');

    const userResponse = await axios.get(msalConfig.userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userData = userResponse.data;
    console.log('✅ Dati utente ottenuti:', userData.displayName);

    // 🔥 QUI CAMBIA: Invece di salvare in sessione, creiamo un JWT
    const userPayload = {
      id: userData.id,
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      firstName: userData.givenName,
      lastName: userData.surname
    };

    // Genera JWT token
    const jwtToken = jwt.sign(userPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    console.log('✅ JWT token generato');

    // 🔥 Invece di redirect, inviamo il token al client tramite query param
    // (In produzione potresti usare un cookie httpOnly)
    res.redirect(`${process.env.CLIENT_URL}/auth-success?token=${jwtToken}`);

  } catch (error) {
    console.error('❌ Errore durante autenticazione:', error.response?.data || error.message);
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
});

// STEP 6: Route per ottenere l'utente corrente (PROTETTA con JWT)
// 🔥 NON legge dalla sessione, ma dal token JWT
app.get('/auth/user', authenticateToken, (req, res) => {
  // req.user contiene i dati decodificati dal JWT
  res.json({
    isAuthenticated: true,
    user: req.user
  });
});

// STEP 7: Route per logout
// 🔥 In versione stateless il logout è solo client-side
// Il server NON deve fare nulla (non c'è sessione da distruggere)
app.post('/auth/logout', (req, res) => {
  console.log('👋 Logout richiesto (client-side)');

  // In versione stateless, il client semplicemente cancella il token
  // Opzionalmente potresti implementare una "blacklist" di token
  // per impedire l'uso di token prima della scadenza

  res.json({ message: 'Logout effettuato (cancella il token client-side)' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Avvio server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server STATELESS (JWT) in esecuzione sulla porta ${PORT}`);
  console.log(`📋 Client URL: ${process.env.CLIENT_URL}`);
  console.log(`🔗 Redirect URI: ${msalConfig.redirectUri}`);
  console.log(`🔑 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
});
