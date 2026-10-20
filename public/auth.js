/* Provider boundary: the UI depends on startGoogle/completeGoogle/restore/signOut.
   not on Supabase SDK types. Never use this browser state as server authorization. */
(function (root) {
  'use strict';
  function createVeronaAuth(config, options = {}) {
    let storage;
    try { storage = options.storage || root.localStorage; } catch {}
    storage ||= { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Storage unavailable'); }, removeItem() {} };
    const request = options.fetch || root.fetch.bind(root);
    const now = options.now || Date.now;
    const storageKey = 'verona-auth-v1:' + config.url;
    const pendingKey = storageKey + ':pkce';
    const temporary = options.temporaryStorage || root.sessionStorage;
    const cryptoApi = options.crypto || root.crypto;
    const base64url = bytes => root.btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    let session = null;
    let persistent = true;
    let revision = 0;
    const valid = value => value && typeof value.access_token === 'string' && typeof value.refresh_token === 'string' && typeof value.user?.id === 'string' && Number.isFinite(value.expires_at);
    function read() { try { const value = JSON.parse(storage.getItem(storageKey)); return valid(value) ? value : null; } catch { return null; } }
    function save(value) {
      session = value;
      try { if (value) storage.setItem(storageKey, JSON.stringify(value)); else storage.removeItem(storageKey); persistent = true; }
      catch { persistent = false; }
    }
    async function api(path, body, token) {
      let response;
      try {
        response = await request(config.url + '/auth/v1/' + path, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { apikey: config.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(15000), credentials: 'omit', cache: 'no-store'
        });
      } catch { throw new Error('Connessione non riuscita. Controlla la rete e riprova.'); }
      if (!response.ok) {
        const error = new Error(response.status === 429 ? 'Troppe richieste. Attendi qualche minuto e riprova.' : response.status >= 500 ? 'Servizio temporaneamente non disponibile. Riprova tra poco.' : 'Accesso non riuscito. Riprova o avvia un nuovo accesso.');
        error.status = response.status;
        throw error;
      }
      if (response.status === 204) return null;
      return response.json();
    }
    function normalize(value) {
      const result = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at || Math.floor(now() / 1000) + value.expires_in, user: { id: value.user?.id, email: value.user?.email } };
      if (!valid(result)) throw new Error('Risposta di accesso non valida. Riprova.');
      return result;
    }
    return {
      storageKey,
      get session() { return session; },
      get persistent() { return persistent; },
      async startGoogle(redirectTo) {
        const redirect = new URL(redirectTo);
        if (redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(redirect.hostname))) throw new Error('Apri Verona tramite HTTPS o dall’anteprima localhost.');
        redirect.search = ''; redirect.hash = '';
        if (!cryptoApi?.subtle) throw new Error('Questo browser non consente l’accesso sicuro. Usa HTTPS o localhost.');
        const verifier = base64url(cryptoApi.getRandomValues(new Uint8Array(32)));
        const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        try { temporary.setItem(pendingKey, JSON.stringify({ verifier, redirect: redirect.href, createdAt: now() })); }
        catch { throw new Error('Consenti la memoria di sessione del browser per accedere con Google.'); }
        const url = new URL(config.url + '/auth/v1/authorize');
        url.search = new URLSearchParams({ provider: 'google', redirect_to: redirect.href, code_challenge: base64url(new Uint8Array(digest)), code_challenge_method: 's256' }).toString();
        return url.href;
      },
      async completeGoogle(callback) {
        const url = new URL(callback);
        const fragment = new URLSearchParams(url.hash.slice(1));
        const failure = url.searchParams.get('error') || fragment.get('error');
        const code = url.searchParams.get('code');
        if (!failure && !code) return false;
        let pending;
        try { pending = JSON.parse(temporary.getItem(pendingKey)); temporary.removeItem(pendingKey); } catch {}
        if (failure) throw new Error('Accesso Google annullato o non disponibile. Puoi continuare senza account.');
        url.search = ''; url.hash = '';
        if (!pending || pending.redirect !== url.href || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier) || !Number.isFinite(pending.createdAt) || now() - pending.createdAt > 600000 || now() < pending.createdAt) throw new Error('Accesso scaduto o aperto in un’altra scheda. Riprova con Google.');
        const current = ++revision;
        const value = normalize(await api('token?grant_type=pkce', { auth_code: code, code_verifier: pending.verifier }));
        if (current === revision) save(value);
        return true;
      },
      async requestCode(email) { await api('otp', { email, create_user: true }); },
      async verifyCode(email, token) {
        const current = ++revision;
        const value = normalize(await api('verify', { email, token, type: 'email' }));
        if (current === revision) save(value);
        return session;
      },
      async restore() {
        const current = revision;
        const run = async () => {
          // Read again inside the cross-tab lock: refresh tokens rotate.
          const value = persistent ? read() : session;
          if (!value) { session = null; return null; }
          try {
            let next;
            if (value.expires_at * 1000 <= now() + 60000) next = normalize(await api('token?grant_type=refresh_token', { refresh_token: value.refresh_token }));
            else { const user = await api('user', undefined, value.access_token); next = normalize({ ...value, user }); }
            // Another tab may have signed out while this request was in flight.
            if (current === revision) {
              if (persistent && !read()) session = null;
              else save(next);
            }
          } catch (error) {
            if (current === revision && [400, 401, 403].includes(error.status)) save(null);
            throw error;
          }
          return session;
        };
        return root.navigator?.locks ? root.navigator.locks.request(storageKey, run) : run();
      },
      async signOut() {
        const token = session?.access_token;
        // Keep the session on failure so that the user can retry revocation.
        if (token) await api('logout?scope=local', {}, token);
        ++revision;
        save(null);
      }
    };
  }
  root.createVeronaAuth = createVeronaAuth;
  if (!root.document) return;
  const $ = id => document.getElementById(id);
  const config = JSON.parse($('event-data').textContent).auth;
  const dialog = $('account-dialog');
  const pageUrl = root.location && new URL(root.location.href);
  const googleContextSupported = !pageUrl || Boolean(root.crypto?.subtle && (pageUrl.protocol === 'https:' || (pageUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(pageUrl.hostname))));
  let auth = null, busy = false, timer, restoreTask;
  try { if (config) auth = createVeronaAuth(config); } catch {}
  // Shared account accessor for features that require server-verified identity.
  root.veronaAccount = {
    async accessToken() {
      if (!auth || config.enabled === false) return null;
      if (restoreTask) await restoreTask;
      if (!auth.session || auth.session.expires_at * 1000 <= Date.now() + 60000) await restore();
      return auth.session?.access_token || null;
    }
  };
  const message = text => { $('account-message').textContent = text; };
  function render() {
    const user = auth?.session?.user;
    $('account-unavailable').hidden = Boolean(auth && config.enabled !== false);
    $('account-login').hidden = !auth || Boolean(user);
    $('account-profile').hidden = !user;
    $('account-email-value').textContent = user?.email || '';
    $('account-guest').textContent = user ? 'Torna a Verona' : 'Continua senza account';
    $('open-account').setAttribute('aria-label', user ? 'Il tuo account' : 'Accedi al tuo account');
    $('open-account').classList.toggle('account-connected', Boolean(user));
    $('account-google').disabled = busy || !auth || config.enabled === false || !googleContextSupported;
    $('account-context').hidden = !auth || config.enabled === false || Boolean(user) || googleContextSupported;
    $('account-signout').disabled = busy;
  }
  async function action(fn) {
    if (busy) return;
    busy = true; message(''); render();
    let focusTarget;
    try { focusTarget = await fn(); } catch (error) { message(error.message); }
    finally { busy = false; render(); if (dialog.open && focusTarget) $(focusTarget).focus(); }
  }
  function schedule() {
    clearTimeout(timer);
    if (auth?.session) timer = setTimeout(restore, Math.max(1000, auth.session.expires_at * 1000 - Date.now() - 60000));
  }
  function restore() {
    if (!auth || restoreTask) return restoreTask;
    restoreTask = auth.restore().then(() => { render(); schedule(); }).catch(error => {
      render(); message(error.message);
      clearTimeout(timer);
      if (auth.session) timer = setTimeout(restore, 30000);
    }).finally(() => { restoreTask = null; });
    return restoreTask;
  }
  $('open-account').onclick = () => { render(); dialog.showModal(); if (auth && !auth.session && config.enabled !== false) $('account-google').focus(); };
  $('close-account').onclick = () => dialog.close();
  dialog.addEventListener('close', () => $('open-account').focus());
  $('account-guest').onclick = () => dialog.close();
  $('account-google').onclick = () => {
    if (!auth || config.enabled === false || !googleContextSupported) return;
    action(async () => {
      const url = await auth.startGoogle(root.location.href);
      message('Apertura di Google…');
      root.location.assign(url);
    });
  };
  $('account-signout').onclick = () => action(async () => {
    await auth.signOut(); clearTimeout(timer);
    message('Sei uscito dal tuo account.');
    return 'account-google';
  });
  root.addEventListener('storage', event => { if (auth && (event.key === auth.storageKey || event.key === null)) restore(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') restore(); });
  async function initialize() {
    const href = root.location?.href;
    const callback = href && new URL(href);
    const hash = callback && new URLSearchParams(callback.hash.slice(1));
    if (callback && (callback.searchParams.has('code') || callback.searchParams.has('error') || hash.has('error'))) {
      // Remove OAuth parameters from browser history before exchanging the code.
      const clean = new URL(href);
      for (const key of ['code','error','error_code','error_description']) clean.searchParams.delete(key);
      if (hash.has('error')) clean.hash = '';
      root.history.replaceState(null, '', clean.href);
      if (!dialog.open) dialog.showModal();
      if (auth) await action(async () => {
        await auth.completeGoogle(href);
        message(auth.persistent ? 'Accesso con Google effettuato.' : 'Accesso effettuato per questa visita. Il browser non consente di ricordarlo.');
        schedule(); return 'account-signout';
      });
      else message('Accesso non configurato. Puoi continuare senza account.');
    }
    await restore();
  }
  render(); initialize();
})(globalThis);
