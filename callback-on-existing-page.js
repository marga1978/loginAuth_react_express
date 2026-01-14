// ==========================================
// GESTIRE IL CALLBACK OAUTH SU UNA PAGINA ESISTENTE
// ==========================================

// SCENARIO:
// redirectUri = 'https://testsc.openlearning-test.digitedacademy.net/esplora/dettaglio/133097/'
// Questa è una pagina già esistente con contenuti

// ==========================================
// OPZIONE 1: Gestire tutto lato client (Frontend)
// ==========================================

// Nel tuo file JavaScript della pagina:
// /esplora/dettaglio/133097/script.js

document.addEventListener('DOMContentLoaded', function() {
  // 1. Controlla se ci sono parametri OAuth nell'URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  
  // 2. Se c'è un code, è un callback OAuth
  if (code) {
    console.log('Callback OAuth ricevuto!');
    handleOAuthCallback(code, state);
  } 
  // 3. Se c'è un error, qualcosa è andato storto
  else if (error) {
    console.error('Errore OAuth:', error);
    alert('Errore durante il login: ' + error);
  }
  // 4. Altrimenti è una visita normale alla pagina
  else {
    console.log('Caricamento normale della pagina');
    loadPageContent();
  }
});

async function handleOAuthCallback(code, state) {
  try {
    // Mostra un loading
    showLoadingOverlay('Completamento login...');
    
    // Invia il code al tuo backend per lo scambio
    const response = await fetch('/api/auth/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, state })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Sessione creata!
      hideLoadingOverlay();
      
      // ⭐ IMPORTANTE: Pulisci l'URL dai parametri OAuth
      // Altrimenti l'utente vede ?code=ABC123... nella barra
      const cleanUrl = window.location.pathname; // Senza query params
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Ricarica la pagina come utente autenticato
      location.reload();
    } else {
      alert('Errore durante l\'autenticazione');
    }
    
  } catch (error) {
    console.error('Errore callback:', error);
    alert('Errore durante l\'autenticazione');
  }
}

function loadPageContent() {
  // Il tuo codice normale per caricare i contenuti della pagina
  console.log('Carico contenuti corso 133097...');
}

function showLoadingOverlay(message) {
  // Mostra un overlay mentre elabori
  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    ">
      <div style="
        background: white;
        padding: 40px;
        border-radius: 8px;
        text-align: center;
      ">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.remove();
}

// ==========================================
// OPZIONE 2: Gestire lato server (Backend)
// ==========================================

// Nel tuo controller Node.js/PHP/Python per quella route:

// Node.js Express esempio:
app.get('/esplora/dettaglio/:id', async (req, res) => {
  const { code, state, error } = req.query;
  const courseId = req.params.id; // 133097
  
  // È un callback OAuth?
  if (code) {
    try {
      // Verifica state (CSRF protection)
      if (state !== req.session.oauthState) {
        return res.status(403).send('Invalid state parameter');
      }
      
      // Scambia il code per token
      const tokens = await exchangeCodeForTokens(code);
      
      // Crea sessione
      req.session.userId = tokens.userId;
      req.session.accessToken = tokens.accessToken;
      
      // ⭐ REDIRECT per pulire l'URL
      // Rimuove ?code=... dall'URL
      return res.redirect(`/esplora/dettaglio/${courseId}`);
      
    } catch (error) {
      console.error('Errore OAuth:', error);
      return res.redirect(`/esplora/dettaglio/${courseId}?error=auth_failed`);
    }
  }
  
  // È un errore OAuth?
  if (error) {
    // Mostra un messaggio di errore
    return res.render('course-detail', {
      courseId,
      error: 'Autenticazione fallita',
      user: null
    });
  }
  
  // Visita normale - carica la pagina
  const course = await getCourseDetails(courseId);
  const user = req.session.userId ? await getUser(req.session.userId) : null;
  
  res.render('course-detail', {
    course,
    user
  });
});

// ==========================================
// OPZIONE 3: Pattern "Split" (Consigliato)
// ==========================================

// Usa un callback dedicato che poi reindirizza alla pagina finale

// 1. redirectUri in Azure:
const redirectUri = 'https://testsc.openlearning-test.digitedacademy.net/auth/callback';

// 2. Route callback dedicata:
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Salva dove l'utente voleva andare
  const returnUrl = req.session.returnUrl || '/';
  
  try {
    // Elabora OAuth
    const tokens = await exchangeCodeForTokens(code);
    req.session.userId = tokens.userId;
    
    // Redirect alla destinazione originale
    res.redirect(returnUrl);
    
  } catch (error) {
    res.redirect('/login?error=auth_failed');
  }
});

// 3. Prima del login, salva dove voleva andare:
app.get('/esplora/dettaglio/:id', (req, res) => {
  // Se non autenticato, salva l'URL
  if (!req.session.userId) {
    req.session.returnUrl = req.originalUrl;
    return res.redirect('/login');
  }
  
  // Se autenticato, mostra la pagina
  res.render('course-detail', { courseId: req.params.id });
});

// ==========================================
// CONFRONTO: Cosa cambia?
// ==========================================

/*
❌ CON CALLBACK SULLA PAGINA ESISTENTE:
https://testsc.openlearning-test.digitedacademy.net/esplora/dettaglio/133097/?code=ABC123...

PROBLEMI:
1. URL brutto visibile all'utente
2. Se l'utente bookmarkizza, salva il code nell'URL
3. Logica OAuth mista con logica della pagina
4. Devi controllare i parametri OAuth in OGNI caricamento
5. Browser history contiene il code

VANTAGGI:
- Un endpoint in meno da gestire
- L'utente "rimane" sulla stessa pagina


✅ CON CALLBACK DEDICATO:
https://testsc.openlearning-test.digitedacademy.net/auth/callback?code=ABC123...
        ↓ (elabora e redirect)
https://testsc.openlearning-test.digitedacademy.net/esplora/dettaglio/133097/

VANTAGGI:
1. URL pulito per l'utente finale
2. Separazione logica OAuth / contenuti
3. Più facile da debuggare
4. Più sicuro (code non nel browser history della pagina)
5. Esperienza utente migliore

SVANTAGGI:
- Un endpoint in più da configurare
*/

// ==========================================
// ESEMPIO PRATICO HTML + JAVASCRIPT
// ==========================================

// File: /esplora/dettaglio/133097/index.html

const htmlExample = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Corso 133097 - Dettaglio</title>
</head>
<body>
  <div id="app">
    <h1>Dettaglio Corso</h1>
    <div id="content">
      <!-- Contenuti normali del corso -->
    </div>
  </div>

  <script>
    // ⭐ Controlla se è un callback OAuth
    (function() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        // È un callback OAuth!
        console.log('Gestisco callback OAuth...');
        
        // Mostra loading
        document.getElementById('app').innerHTML = 
          '<div style="text-align:center; padding:50px;">' +
          '<h2>Completamento login...</h2>' +
          '<div class="spinner"></div>' +
          '</div>';
        
        // Elabora il code
        fetch('/api/auth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Pulisci URL e ricarica
            window.history.replaceState({}, '', window.location.pathname);
            location.reload();
          }
        })
        .catch(err => {
          alert('Errore autenticazione');
        });
        
        return; // Non caricare il resto della pagina
      }
      
      // Caricamento normale della pagina
      loadCourseContent();
    })();
    
    function loadCourseContent() {
      // Il tuo codice normale
      console.log('Carico corso 133097...');
    }
  </script>
</body>
</html>
`;

// ==========================================
// LA MIA RACCOMANDAZIONE
// ==========================================

/*
🎯 USA UN CALLBACK DEDICATO!

redirectUri: 'https://testsc.openlearning-test.digitedacademy.net/auth/callback'

Perché:
1. Più pulito
2. Più sicuro
3. Più facile da mantenere
4. Standard del settore
5. Migliore UX

Come implementare:
1. Crea route /auth/callback
2. Elabora OAuth
3. Salva sessione
4. Redirect alla pagina desiderata

Il piccolo sforzo extra vale ASSOLUTAMENTE la pena!
*/
