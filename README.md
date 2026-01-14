# Autenticazione SSO con Microsoft (React + Express)

Esempio completo di Single Sign-On usando Microsoft Azure AD, React e Express.

## Indice
1. [Come funziona](#come-funziona)
2. [Setup Azure](#setup-azure)
3. [Installazione](#installazione)
4. [Configurazione](#configurazione)
5. [Avvio applicazione](#avvio-applicazione)
6. [Flusso di autenticazione](#flusso-di-autenticazione)
7. [Struttura progetto](#struttura-progetto)

---

## Come funziona

### Flusso OAuth 2.0 Authorization Code

```
1. Utente clicca "Login con Microsoft"
   ↓
2. Frontend richiede authUrl al backend (/auth/login)
   ↓
3. Backend genera URL Microsoft e lo invia al frontend
   ↓
4. Frontend reindirizza l'utente a Microsoft
   ↓
5. Utente inserisce credenziali su Microsoft
   ↓
6. Microsoft reindirizza al backend con un CODE (/auth/callback?code=...)
   ↓
7. Backend fa exchange del CODE per ACCESS TOKEN
   ↓
8. Backend usa ACCESS TOKEN per recuperare dati utente da Graph API
   ↓
9. Backend salva utente in sessione
   ↓
10. Backend reindirizza al frontend (/dashboard)
    ↓
11. Frontend mostra dati utente
```

---

## Setup Azure

### Passo 1: Crea un'App Registration su Azure

1. Vai su [Azure Portal](https://portal.azure.com)
2. Cerca "Azure Active Directory" o "Microsoft Entra ID"
3. Nel menu laterale, clicca su **App registrations**
4. Clicca su **+ New registration**

### Passo 2: Configura l'applicazione

**Nome applicazione:**
- Inserisci un nome (es. "SSO Microsoft Example")

**Supported account types:**
- Seleziona una delle opzioni:
  - `Accounts in this organizational directory only` - Solo utenti della tua azienda
  - `Accounts in any organizational directory` - Qualsiasi azienda Azure AD
  - `Accounts in any organizational directory and personal Microsoft accounts` - Chiunque (consigliato per test)

**Redirect URI:**
- Seleziona **Web**
- Inserisci: `http://localhost:5000/auth/callback`

Clicca su **Register**

### Passo 3: Ottieni le credenziali

Dopo la registrazione, ti troverai nella pagina dell'app:

**Client ID:**
- Nella pagina "Overview", copia il valore di **Application (client) ID**

**Client Secret:**
1. Nel menu laterale, clicca su **Certificates & secrets**
2. Clicca su **+ New client secret**
3. Aggiungi una descrizione (es. "SSO Secret")
4. Seleziona una scadenza (es. "6 months", "12 months", "24 months")
5. Clicca su **Add**
6. **IMPORTANTE:** Copia subito il **Value** (non lo vedrai più!)

**Tenant ID:**
- Nella pagina "Overview", copia il valore di **Directory (tenant) ID**
- Oppure usa `common` per supportare qualsiasi account Microsoft

### Passo 4: Configura i permessi API

1. Nel menu laterale, clicca su **API permissions**
2. Dovresti già vedere **Microsoft Graph** con permessi di base
3. Verifica che ci siano questi permessi:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
4. Se mancano, clicca su **+ Add a permission** → **Microsoft Graph** → **Delegated permissions** → seleziona i permessi mancanti

---

## Installazione

### 1. Installa dipendenze del backend

```bash
npm install
```

### 2. Installa dipendenze del frontend

```bash
cd client
npm install
cd ..
```

---

## Configurazione

### 1. Crea file .env

Copia il file `.env.example` in `.env`:

```bash
cp .env.example .env
```

### 2. Compila il file .env

Apri il file `.env` e inserisci le credenziali ottenute da Azure:

```env
# Microsoft Azure App Registration
CLIENT_ID=your_client_id_here                    # Application (client) ID
CLIENT_SECRET=your_client_secret_here            # Client secret Value
TENANT_ID=common                                 # common o il tuo Tenant ID
REDIRECT_URI=http://localhost:5000/auth/callback

# Session
SESSION_SECRET=genera_una_stringa_random_qui     # Stringa random per sicurezza sessioni

# Server
PORT=5000
CLIENT_URL=http://localhost:3000
```

**Come generare SESSION_SECRET random:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Avvio applicazione

### Opzione 1: Avvio completo (backend + frontend)

```bash
npm run dev
```

Questo comando avvia:
- Backend Express su `http://localhost:5000`
- Frontend React su `http://localhost:3000`

### Opzione 2: Avvio separato

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

### Test dell'applicazione

1. Apri il browser su `http://localhost:3000`
2. Clicca su "Accedi con Microsoft"
3. Inserisci le credenziali Microsoft
4. Autorizza l'applicazione
5. Verrai reindirizzato alla dashboard con i tuoi dati

---

## Flusso di autenticazione

### Passo 1: Utente clicca "Login"

**File:** `client/src/pages/LoginPage.js`

```javascript
// Quando l'utente clicca il bottone, chiama la funzione login
<button onClick={login}>Accedi con Microsoft</button>
```

### Passo 2: Frontend richiede authUrl

**File:** `client/src/App.js`

```javascript
const login = async () => {
  // Chiama il backend per ottenere l'URL di Microsoft
  const response = await axios.get('http://localhost:5000/auth/login');

  // Reindirizza l'utente a Microsoft
  window.location.href = response.data.authUrl;
};
```

### Passo 3: Backend genera URL Microsoft

**File:** `server/index.js`

```javascript
app.get('/auth/login', (req, res) => {
  // Crea URL con parametri OAuth 2.0
  const authUrl = new URL(msalConfig.authorizeEndpoint);
  authUrl.searchParams.append('client_id', msalConfig.clientId);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', msalConfig.redirectUri);
  authUrl.searchParams.append('scope', msalConfig.scope);

  res.json({ authUrl: authUrl.toString() });
});
```

### Passo 4: Microsoft reindirizza al callback

**URL:** `http://localhost:5000/auth/callback?code=AUTHORIZATION_CODE`

### Passo 5: Backend fa exchange del code

**File:** `server/index.js`

```javascript
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  // Exchange code per access token
  // tokenEndpoint è loginmicrosft
  // In sintesi: il code è come un biglietto della ////lotteria, l'access_token è il premio vero che puoi spendere! 🎫→💰

  /*

  Il code che ricevi in /auth/callback è:
  Temporaneo (scade in pochi minuti)
  Non utilizzabile per chiamare le API di Microsoft
  Solo un voucher che prova che l'utente si è autenticato
  L'access_token che ottieni con questo POST è:
  Il token reale da usare per chiamare Microsoft Graph API
  Valido per ~1 ora
  Accompagnato da un refresh_token per rinnovarlo

  */

  const tokenResponse = await axios.post(
    msalConfig.tokenEndpoint,
    {
      client_id: msalConfig.clientId,
      client_secret: msalConfig.clientSecret,
      code: code,
      redirect_uri: msalConfig.redirectUri,
      grant_type: 'authorization_code'
    }
  );

  const { access_token } = tokenResponse.data;

  // Usa access token per recuperare dati utente
  // userInfoEndpoint
  const userResponse = await axios.get(msalConfig.userInfoEndpoint, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });

  // Salva utente in sessione
  req.session.user = userResponse.data;
  req.session.isAuthenticated = true;

  // Redirect al frontend
  res.redirect(`${process.env.CLIENT_URL}/dashboard`);
});
```

### Passo 6: Frontend verifica autenticazione

**File:** `client/src/App.js`

```javascript
useEffect(() => {
  checkAuth();
}, []);

const checkAuth = async () => {
  try {
    // Chiede al backend se l'utente è autenticato
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
```

### Passo 7: Dashboard mostra dati utente

**File:** `client/src/pages/DashboardPage.js`

```javascript
<h2>Benvenuto, {user?.name}!</h2>
<p>Email: {user?.email}</p>
```

---

## Struttura progetto

```
login_microsoft/
│
├── server/                      # Backend Express
│   └── index.js                 # Server principale con tutte le routes
│
├── client/                      # Frontend React
│   ├── public/
│   │   └── index.html          # HTML template
│   │
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.js    # Pagina di login
│       │   └── DashboardPage.js # Dashboard protetta
│       │
│       ├── App.js              # Componente principale + routing
│       ├── App.css             # Stili
│       ├── index.js            # Entry point React
│       └── index.css           # Stili globali
│
├── .env                        # Configurazione (NON committare!)
├── .env.example               # Template configurazione
├── package.json               # Dipendenze root
└── README.md                  # Questa guida
```

---

## API Endpoints

### Backend (Express)

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/auth/login` | GET | Genera URL per login Microsoft |
| `/auth/callback` | GET | Callback OAuth 2.0 da Microsoft |
| `/auth/user` | GET | Ottieni utente corrente (protetto) |
| `/auth/logout` | POST | Effettua logout |
| `/health` | GET | Health check del server |

---

## Sicurezza

### Implementazioni di sicurezza incluse:

1. **Sessioni sicure**: Express Session con cookie httpOnly
2. **CORS configurato**: Solo il frontend può fare richieste
3. **State parameter**: Protezione CSRF nel flusso OAuth
4. **Client Secret**: Mai esposto al frontend
5. **Access Token**: Salvato solo nel backend, mai inviato al frontend
6. **HTTPS in produzione**: Cookie secure flag abilitabile

### Best practices per produzione:

1. **Usa HTTPS**: Abilita `cookie.secure = true`
2. **Cambia SESSION_SECRET**: Usa una stringa random forte
3. **Environment variables**: Mai committare `.env`
4. **Database per sessioni**: Sostituisci express-session in-memory con Redis/Database
5. **Rate limiting**: Aggiungi express-rate-limit
6. **Helmet.js**: Aggiungi security headers
7. **Validazione input**: Valida tutti i parametri in ingresso

---

## Troubleshooting

### Errore: "redirect_uri mismatch"
- Verifica che il redirect URI in `.env` corrisponda esattamente a quello configurato su Azure
- Deve essere: `http://localhost:5000/auth/callback`

### Errore: "CORS error"
- Verifica che `CLIENT_URL` nel `.env` sia corretto
- Verifica che axios usi `withCredentials: true`

### Errore: "Client secret invalid"
- Il client secret potrebbe essere scaduto
- Genera un nuovo client secret su Azure e aggiorna `.env`

### L'utente non resta loggato
- Verifica che i cookies funzionino (controlla DevTools → Application → Cookies)
- Verifica che axios abbia `withCredentials: true`

### Errore: "Cannot read property 'user' of undefined"
- La sessione potrebbe essere persa
- Verifica che express-session sia configurato correttamente
- In produzione usa un session store persistente (Redis, Database)

---

## Prossimi passi

Miglioramenti possibili:

1. **Database**: Salva utenti in un database (MongoDB, PostgreSQL)
2. **Refresh Token**: Implementa il refresh automatico dei token
3. **Logout Microsoft**: Implementa il logout completo anche da Microsoft
4. **Role-based access**: Aggiungi ruoli e permessi utente
5. **Profile page**: Aggiungi una pagina profilo utente editabile
6. **Multiple providers**: Aggiungi Google, GitHub SSO

---

## Risorse utili

- [Microsoft Identity Platform](https://learn.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)

---

## Licenza

MIT - Usa liberamente per i tuoi progetti!
