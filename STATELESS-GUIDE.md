# Guida: Autenticazione STATELESS con JWT

## Cos'è cambiato rispetto alla versione Stateful?

### Versione STATEFUL (originale)
```
User → Login → Microsoft → Server
                            ↓
                   Salva in req.session
                            ↓
                   Ogni richiesta verifica sessione
```

### Versione STATELESS (JWT)
```
User → Login → Microsoft → Server
                            ↓
                   Genera JWT token
                            ↓
                   Invia token al client
                            ↓
                   Client salva in localStorage
                            ↓
                   Ogni richiesta include token in header
```

---

## File modificati/creati

### Backend (Server)
- **File nuovo**: `server/index-stateless.js` (versione JWT)
- **File originale**: `server/index.js` (versione sessioni - non modificato)

### Frontend (Client)
- **File nuovo**: `client/src/App-stateless.js` (versione JWT)
- **File originale**: `client/src/App.js` (versione sessioni - non modificato)

### Configurazione
- **File nuovo**: `.env.stateless.example` (con JWT_SECRET)
- **File nuovo**: `package.json` (aggiunto `jsonwebtoken`)

---

## Differenze chiave nel codice

### 1. Server - NO express-session

**BEFORE (Stateful)**
```javascript
const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Callback route
req.session.user = userData;
req.session.isAuthenticated = true;
```

**AFTER (Stateless)**
```javascript
const jwt = require('jsonwebtoken');

// NO express-session!

// Callback route
const jwtToken = jwt.sign(userPayload, JWT_SECRET, {
  expiresIn: '24h'
});

res.redirect(`/auth-success?token=${jwtToken}`);
```

### 2. Server - Middleware di autenticazione

**BEFORE (Stateful)**
```javascript
app.get('/auth/user', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: 'Non autenticato' });
  }

  res.json({ user: req.session.user });
});
```

**AFTER (Stateless)**
```javascript
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token mancante' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token non valido' });
    }

    req.user = user;
    next();
  });
}

app.get('/auth/user', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});
```

### 3. Client - localStorage invece di cookies

**BEFORE (Stateful)**
```javascript
// Il browser gestisce automaticamente i cookies
axios.defaults.withCredentials = true;

const response = await axios.get('/auth/user');
// La sessione è verificata automaticamente tramite cookie
```

**AFTER (Stateless)**
```javascript
// Salva il token manualmente
localStorage.setItem('jwt_token', token);

// Axios interceptor per aggiungere il token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const response = await api.get('/auth/user');
// Il token è inviato nell'header Authorization
```

### 4. Client - Gestione callback con token

**BEFORE (Stateful)**
```javascript
// Callback redirect diretto alla dashboard
app.get('/auth/callback', (req, res) => {
  req.session.user = userData;
  res.redirect('/dashboard'); // Il cookie è già impostato
});
```

**AFTER (Stateless)**
```javascript
// Callback redirect con token nella query string
app.get('/auth/callback', (req, res) => {
  const token = jwt.sign(userData, JWT_SECRET);
  res.redirect(`/auth-success?token=${token}`);
});

// Client deve estrarre il token e salvarlo
function AuthSuccessHandler() {
  const token = searchParams.get('token');
  localStorage.setItem('jwt_token', token);
  navigate('/dashboard');
}
```

### 5. Logout

**BEFORE (Stateful)**
```javascript
// Server distrugge la sessione
app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout OK' });
});
```

**AFTER (Stateless)**
```javascript
// Server NON fa nulla (stateless!)
app.post('/auth/logout', (req, res) => {
  // Opzionale: aggiungi token a blacklist
  res.json({ message: 'Logout OK' });
});

// Client rimuove il token
const logout = () => {
  localStorage.removeItem('jwt_token');
  setAuthState({ isAuthenticated: false });
};
```

---

## Come testare la versione STATELESS

### 1. Installa le dipendenze
```bash
npm install
```

### 2. Crea il file .env
Copia `.env.stateless.example` in `.env` e compila i valori:
```bash
cp .env.stateless.example .env
```

Modifica `.env`:
```env
CLIENT_ID=tuo_client_id
CLIENT_SECRET=tuo_client_secret
JWT_SECRET=una_stringa_random_lunga_e_sicura_almeno_32_caratteri
```

### 3. Avvia il server STATELESS
```bash
# Invece di: npm run server
node server/index-stateless.js
```

### 4. Modifica il client per usare la versione stateless
Rinomina i file:
```bash
cd client/src
mv App.js App-stateful.js
mv App-stateless.js App.js
```

### 5. Avvia il client
```bash
cd client
npm start
```

### 6. Testa il flusso
1. Vai su `http://localhost:3000/login`
2. Clicca "Accedi con Microsoft"
3. Dopo il login, verrai reindirizzato a `/auth-success?token=...`
4. Il token viene salvato in `localStorage`
5. Vieni reindirizzato a `/dashboard`

### 7. Verifica il token in localStorage
Apri DevTools → Application → Local Storage:
```
jwt_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 8. Verifica le richieste
Apri DevTools → Network → Guarda le richieste a `/auth/user`:
```
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Vantaggi della versione STATELESS

### ✅ Scalabilità
- Nessuno stato sul server
- Puoi aggiungere più server senza condividere sessioni
- Load balancing semplice

### ✅ Microservizi
- Il token può essere verificato da qualsiasi servizio
- Non serve un database centrale delle sessioni

### ✅ Mobile-friendly
- Perfetto per app mobili (React Native, Flutter, etc.)
- Più facile gestire il token in localStorage/AsyncStorage

### ✅ Performance
- Nessuna query al database per verificare la sessione
- Verifica del token in memoria (molto veloce)

---

## Svantaggi della versione STATELESS

### ❌ Revoca token difficile
- Non puoi invalidare un token prima della scadenza
- Soluzione: implementa una blacklist (ma diventa stateful!)

### ❌ Dimensione payload
- Il token contiene dati utente (più grande di un session ID)
- Ogni richiesta include tutto il payload nel header

### ❌ Logout problematico
- Il token rimane valido fino alla scadenza
- Se rubato, può essere usato fino allo scadere

### ❌ Sicurezza localStorage
- Il token in localStorage è vulnerabile a XSS
- Meglio usare cookie `httpOnly` (ma richiede configurazione extra)

---

## Quando usare STATEFUL vs STATELESS?

### Usa STATEFUL (sessioni) se:
- 👤 Hai un'app monolitica single-server
- 🔒 Vuoi controllo totale su logout/revoca sessioni
- 🏢 L'app è usata solo da browser web
- 📊 Hai già Redis/Database per le sessioni

### Usa STATELESS (JWT) se:
- 🚀 Hai microservizi o architettura distribuita
- 📱 Hai app mobile o multi-piattaforma
- ⚡ Vuoi massima performance (no DB lookup)
- 🌐 Hai API pubbliche consumate da terze parti

---

## Miglioramenti di sicurezza (Produzione)

### 1. Usa cookie httpOnly invece di localStorage
```javascript
// Server
res.cookie('token', jwtToken, {
  httpOnly: true,  // Non accessibile da JavaScript
  secure: true,    // Solo HTTPS
  sameSite: 'strict'
});

// Client
// Il browser gestisce automaticamente il cookie
```

### 2. Refresh token
```javascript
// Token di breve durata (15 min) + refresh token
const accessToken = jwt.sign(payload, SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

// Quando l'access token scade, usa il refresh token per ottenerne uno nuovo
```

### 3. Token blacklist per logout
```javascript
const blacklist = new Set(); // In produzione usa Redis

app.post('/auth/logout', authenticateToken, (req, res) => {
  blacklist.add(req.token);
  res.json({ message: 'Logout OK' });
});

// Nel middleware
if (blacklist.has(token)) {
  return res.status(403).json({ error: 'Token revocato' });
}
```

### 4. Rotazione JWT_SECRET
```javascript
// Usa un sistema di rotazione delle chiavi
const JWT_SECRETS = [
  process.env.JWT_SECRET_CURRENT,
  process.env.JWT_SECRET_PREVIOUS  // Per grace period
];
```

---

## Debugging

### Come vedere il contenuto del JWT?
Vai su [jwt.io](https://jwt.io) e incolla il token.

Esempio:
```json
{
  "id": "12345-67890",
  "email": "user@example.com",
  "name": "Mario Rossi",
  "firstName": "Mario",
  "lastName": "Rossi",
  "iat": 1704067200,
  "exp": 1704153600
}
```

### Come verificare che il token sia valido?
```bash
# Nel terminale del server
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.verify('IL_TUO_TOKEN', 'JWT_SECRET'))"
```

### Token scaduto?
```javascript
// Client
try {
  const response = await api.get('/auth/user');
} catch (error) {
  if (error.response?.status === 403) {
    // Token scaduto, reindirizza al login
    localStorage.removeItem('jwt_token');
    navigate('/login');
  }
}
```

---

## Conclusione

Ora hai **DUE versioni** dell'applicazione:

1. **Stateful** (`server/index.js` + `client/src/App.js`)
   - Usa sessioni server
   - Più semplice per app monolitiche

2. **Stateless** (`server/index-stateless.js` + `client/src/App-stateless.js`)
   - Usa JWT token
   - Più scalabile per microservizi

Scegli quella più adatta al tuo caso d'uso! 🚀
