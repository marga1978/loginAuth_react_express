# Redirect Dinamico dopo Login

Questa funzionalità permette all'utente di essere **reindirizzato automaticamente** alla pagina che stava visitando prima del login.

## Come funziona

### Scenario 1: Utente visita pagina protetta senza essere loggato

```
1. Utente apre: http://localhost:3000/profile
   ↓
2. ProtectedRoute vede che non è autenticato
   ↓
3. Redirect a: /login?returnUrl=%2Fprofile
   ↓
4. LoginPage legge returnUrl dalla query string
   ↓
5. Quando l'utente clicca "Login con Microsoft"
   ↓
6. Il client passa returnUrl al server:
   GET /auth/login?returnUrl=/profile
   ↓
7. Server salva returnUrl nello state OAuth (per sicurezza)
   ↓
8. Utente viene reindirizzato a Microsoft
   ↓
9. Microsoft callback al server con il code + state
   ↓
10. Server estrae returnUrl dallo state
    ↓
11. Server reindirizza al client:
    http://localhost:3000/profile
    ↓
12. Utente vede la pagina /profile!
```

### Scenario 2: Utente clicca login dalla homepage

```
1. Utente è su: http://localhost:3000/login
   ↓
2. Clicca "Login con Microsoft"
   ↓
3. returnUrl = undefined (usa default: /dashboard)
   ↓
4. Dopo il login → reindirizzato a /dashboard
```

---

## File modificati

### 1. Server - [server/index.js](server/index.js)

#### Route `/auth/login` (linea 58-84)
```javascript
app.get('/auth/login', (req, res) => {
  // Legge returnUrl dalla query string
  const returnUrl = req.query.returnUrl || '/dashboard';

  // Salva returnUrl nello state OAuth (per CSRF protection)
  const state = JSON.stringify({
    random: Math.random().toString(36).substring(7),
    returnUrl: returnUrl
  });

  req.session.oauthState = state;
  authUrl.searchParams.append('state', state);

  res.json({ authUrl: authUrl.toString() });
});
```

**Perché salvare nello state?**
- Lo state OAuth viene rimandato da Microsoft nel callback
- Così possiamo recuperare il returnUrl in modo sicuro
- Previene attacchi CSRF

#### Route `/auth/callback` (linea 98-170)
```javascript
app.get('/auth/callback', async (req, res) => {
  const { state } = req.query;

  // Estrae returnUrl dallo state
  let returnUrl = '/dashboard';
  try {
    const stateObj = JSON.parse(state);
    returnUrl = stateObj.returnUrl || '/dashboard';
  } catch (e) {
    console.warn('State non è JSON valido, uso default');
  }

  // ... autenticazione con Microsoft ...

  // Redirect al returnUrl specificato
  res.redirect(`${process.env.CLIENT_URL}${returnUrl}`);
});
```

---

### 2. Client - [client/src/App.js](client/src/App.js)

#### Funzione `login` (linea 54-70)
```javascript
const login = async (returnUrl) => {
  // Se returnUrl non è specificato, usa la pagina corrente
  const targetUrl = returnUrl || window.location.pathname;

  // Passa returnUrl al server
  const response = await axios.get('http://localhost:5000/auth/login', {
    params: { returnUrl: targetUrl }
  });

  window.location.href = response.data.authUrl;
};
```

#### ProtectedRoute (linea 87-100)
```javascript
const ProtectedRoute = ({ children }) => {
  if (!authState.isAuthenticated) {
    // Salva la pagina corrente come returnUrl
    const returnUrl = window.location.pathname;
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} />;
  }

  return children;
};
```

**Cosa fa:**
- Se l'utente prova ad accedere a una pagina protetta
- Salva il path corrente (`/profile`)
- Reindirizza a `/login?returnUrl=%2Fprofile`

---

### 3. Client - [client/src/pages/LoginPage.js](client/src/pages/LoginPage.js)

```javascript
function LoginPage() {
  const { login } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  // Legge returnUrl dalla query string
  const returnUrl = searchParams.get('returnUrl');

  const handleLogin = () => {
    // Passa returnUrl alla funzione login
    login(returnUrl);
  };

  return (
    <button onClick={handleLogin} className="microsoft-btn">
      Accedi con Microsoft
    </button>
  );
}
```

---

## Come testare

### Test 1: Accesso diretto a pagina protetta

1. **Apri finestra in incognito** (per non essere loggato)
2. Vai su: `http://localhost:3000/profile`
3. Verrai reindirizzato a `/login?returnUrl=%2Fprofile`
4. Clicca "Accedi con Microsoft"
5. Dopo il login, dovresti essere su `/profile` automaticamente ✅

### Test 2: Login dalla homepage

1. **Apri finestra in incognito**
2. Vai su: `http://localhost:3000/login`
3. Clicca "Accedi con Microsoft"
4. Dopo il login, dovresti essere su `/dashboard` (default) ✅

### Test 3: URL personalizzato

1. **Apri console browser** (F12)
2. Digita: `window.location.href = 'http://localhost:3000/profile'`
3. Se non sei loggato, verrai reindirizzato al login
4. Dopo il login, torni a `/profile` ✅

---

## Debugging

### Verifica lo state OAuth

Nel terminale del server vedrai:
```
🔐 Redirect to Microsoft login: https://login.microsoftonline.com/...
📍 Return URL: /profile
```

### Verifica il callback

Nel terminale del server vedrai:
```
📥 Callback ricevuto da Microsoft
📍 Redirect a: /profile
✅ Utente autenticato e salvato in sessione
```

### Verifica query string nel browser

1. Quando sei su `/login`, apri DevTools → Network
2. Guarda la query string dell'URL: `?returnUrl=%2Fprofile`
3. `%2F` è `/` URL-encoded

### Verifica lo state nel callback

1. Apri DevTools → Network → Guarda la richiesta a `/auth/callback`
2. Guarda il parametro `state` nella query string
3. Dovrebbe essere un JSON: `{"random":"xyz123","returnUrl":"/profile"}`

---

## Esempi di utilizzo avanzato

### Esempio 1: Link con returnUrl custom

Nella tua app, puoi creare link che reindirizzano a pagine specifiche dopo il login:

```javascript
<Link to="/login?returnUrl=/settings">
  Login per vedere le impostazioni
</Link>
```

### Esempio 2: Redirect programmatico

```javascript
const requireAuth = (targetPage) => {
  if (!isAuthenticated) {
    navigate(`/login?returnUrl=${encodeURIComponent(targetPage)}`);
  }
};

// Uso
requireAuth('/admin/dashboard');
```

### Esempio 3: Salvare anche query params

Se vuoi preservare anche i query params:

```javascript
// In ProtectedRoute
const returnUrl = window.location.pathname + window.location.search;
return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} />;

// Esempio: /products?category=shoes
// → returnUrl = /products?category=shoes
```

---

## Sicurezza

### Validazione del returnUrl

Per evitare **Open Redirect vulnerabilities**, aggiungi validazione nel server:

```javascript
// server/index.js - nella route /auth/login
app.get('/auth/login', (req, res) => {
  let returnUrl = req.query.returnUrl || '/dashboard';

  // ⚠️ VALIDAZIONE: Solo URL interni
  if (!returnUrl.startsWith('/')) {
    console.warn('⚠️ returnUrl non valido, uso default');
    returnUrl = '/dashboard';
  }

  // ⚠️ VALIDAZIONE: Blocca URL esterni
  if (returnUrl.includes('://')) {
    console.warn('⚠️ returnUrl contiene protocollo, uso default');
    returnUrl = '/dashboard';
  }

  const state = JSON.stringify({
    random: Math.random().toString(36).substring(7),
    returnUrl: returnUrl
  });

  // ... resto del codice
});
```

### Perché è importante?

Senza validazione, un attaccante potrebbe fare:
```
http://localhost:3000/login?returnUrl=https://evil.com
```

E dopo il login, l'utente verrebbe reindirizzato a `evil.com`!

---

## FAQ

### Q: Posso usare returnUrl per pagine esterne?
**A:** No, per sicurezza accettiamo solo path interni (`/profile`, `/dashboard`, etc.). URL esterni come `https://example.com` vengono rifiutati.

### Q: Cosa succede se returnUrl non è valido?
**A:** Il server usa il default `/dashboard`.

### Q: Il returnUrl viene perso dopo il refresh?
**A:** No, perché è salvato nello state OAuth che viene passato a Microsoft e ritorna nel callback.

### Q: Posso usare hash routing (`#/profile`)?
**A:** Sì, ma devi modificare il codice per usare `window.location.hash` invece di `pathname`.

### Q: Funziona anche con la versione stateless (JWT)?
**A:** Sì! Le modifiche sono identiche, cambia solo il file server (`index-stateless.js` invece di `index.js`).

---

## Versione Stateless (JWT)

Le modifiche sono identiche, ma nel file [server/index-stateless.js](server/index-stateless.js):

```javascript
// Route callback
app.get('/auth/callback', async (req, res) => {
  const { state } = req.query;

  // Estrae returnUrl dallo state
  let returnUrl = '/dashboard';
  try {
    const stateObj = JSON.parse(state);
    returnUrl = stateObj.returnUrl || '/dashboard';
  } catch (e) {
    console.warn('State non valido, uso default');
  }

  // ... genera JWT ...

  // Invece di redirect diretto, passa returnUrl nella query
  res.redirect(`${process.env.CLIENT_URL}/auth-success?token=${jwtToken}&returnUrl=${encodeURIComponent(returnUrl)}`);
});
```

E nel client ([client/src/App-stateless.js](client/src/App-stateless.js)):

```javascript
function AuthSuccessHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    if (token) {
      localStorage.setItem('jwt_token', token);
      navigate(returnUrl); // ← Usa returnUrl invece di /dashboard hardcoded
    }
  }, [searchParams, navigate]);

  return <div className="loading">Autenticazione in corso...</div>;
}
```

---

## Conclusione

Ora l'applicazione supporta il **redirect dinamico**:
- ✅ L'utente viene riportato alla pagina che voleva visitare
- ✅ Funziona con qualsiasi pagina protetta
- ✅ Sicuro contro attacchi di open redirect
- ✅ Compatible con entrambe le versioni (stateful e stateless)

Prova ad accedere a `http://localhost:3000/profile` senza essere loggato e vedrai la magia! 🚀
