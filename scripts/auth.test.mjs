import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { authConfig } from './auth-config.mjs';
import { webcrypto } from 'node:crypto';

const logic = await readFile(new URL('../public/auth.js', import.meta.url), 'utf8');
const config = { url: 'https://test.supabase.co', key: 'sb_publishable_test' };
function setup(responses = [], storage = new Map()) {
  const calls = [];
  const temporary = new Map();
  const context = createContext({ AbortSignal, setTimeout, clearTimeout, URL, URLSearchParams, Uint8Array, TextEncoder, btoa, crypto: webcrypto,
    sessionStorage: { getItem: key => temporary.get(key) ?? null, setItem: (key,value) => temporary.set(key,value), removeItem: key => temporary.delete(key) } });
  new Script(logic).runInContext(context);
  const auth = context.createVeronaAuth(config, {
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    now: () => 1000000,
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw new Error('Unexpected request');
      return { ok: response.status < 400, status: response.status, json: async () => response.body };
    }
  });
  return { auth, storage, calls, context, temporary };
}
const session = (overrides = {}) => ({ access_token: 'access', refresh_token: 'refresh', expires_at: 2000, user: { id: 'user-1', email: 'persona@example.org' }, ...overrides });
test('Configurazione opzionale e solo pubblica: rifiuta configurazioni incomplete e segreti', () => {
  assert.equal(authConfig({}), null);
  assert.throws(() => authConfig({ SUPABASE_URL: config.url }));
  assert.throws(() => authConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }));
  assert.throws(() => authConfig({ SUPABASE_URL: 'http://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: config.key }));
  assert.throws(() => authConfig({ SUPABASE_URL: config.url + '/wrong', SUPABASE_PUBLISHABLE_KEY: config.key }));
  assert.equal(authConfig({ SUPABASE_URL: config.url + '/', SUPABASE_PUBLISHABLE_KEY: config.key }).url, config.url);
  assert.equal(authConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: config.key, SUPABASE_AUTH_ENABLED: 'false' }), null);
  assert.equal(authConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: config.key, SUPABASE_AUTH_METHOD: 'google', SUPABASE_AUTH_ENABLED: 'false' }).enabled, false);
});
test('Invio codice: nessuna sessione prima della verifica, nessun codice salvato', async () => {
  const { auth, storage, calls } = setup([{ status: 200, body: {} }]);
  await auth.requestCode('persona@example.org');
  assert.equal(auth.session, null); assert.equal(storage.size, 0);
  assert.equal(calls[0].url, config.url + '/auth/v1/otp');
  assert.deepEqual(JSON.parse(calls[0].body), { email: 'persona@example.org', create_user: true });
  assert.equal(calls[0].headers.apikey, config.key);
});
test('Verifica OTP email e persistenza solo dei dati di sessione necessari', async () => {
  const { auth, storage, calls } = setup([{ status: 200, body: session({ user: { ...session().user, identities: ['unnecessary'] } }) }]);
  await auth.verifyCode('persona@example.org', '123456');
  assert.equal(auth.session.user.id, 'user-1');
  assert.equal(JSON.parse(calls[0].body).type, 'email');
  assert.equal(JSON.parse(calls[0].body).token, '123456');
  assert.doesNotMatch(storage.get(auth.storageKey), /123456|identities/);
});
test('Codice errato, troppe richieste e rete assente non creano sessioni', async () => {
  for (const response of [{ status: 403 }, { status: 429 }, new Error('offline')]) {
    const { auth, storage } = setup([response]);
    await assert.rejects(auth.verifyCode('persona@example.org', '123456'));
    assert.equal(auth.session, null); assert.equal(storage.size, 0);
  }
});
test('Rifiuta risposte prive di una sessione valida', async () => {
  const { auth } = setup([{ status: 200, body: { user: session().user } }]);
  await assert.rejects(auth.verifyCode('persona@example.org', '123456'), /non valida/);
  assert.equal(auth.session, null);
});
test('Ripristino: verifica identità lato server prima di mostrare account', async () => {
  const { auth, storage, calls } = setup([{ status: 200, body: session().user }]);
  storage.set(auth.storageKey, JSON.stringify(session()));
  await auth.restore();
  assert.equal(calls[0].url, config.url + '/auth/v1/user');
  assert.equal(calls[0].headers.Authorization, 'Bearer access');
  assert.equal(auth.session.user.id, 'user-1');
});
test('Rinnovo usa refresh token e conserva la nuova sessione', async () => {
  const { auth, storage, calls } = setup([{ status: 200, body: session({ refresh_token: 'rotated' }) }]);
  storage.set(auth.storageKey, JSON.stringify(session({ expires_at: 999 })));
  await auth.restore();
  assert.match(calls[0].url, /token\?grant_type=refresh_token$/);
  assert.equal(JSON.parse(calls[0].body).refresh_token, 'refresh');
  assert.equal(auth.session.refresh_token, 'rotated');
});
test('Sessione revocata rimossa; errore di rete conserva la possibilità di riprovare', async () => {
  for (const response of [{ status: 401 }, new Error('offline')]) {
    const { auth, storage } = setup([response]);
    storage.set(auth.storageKey, JSON.stringify(session()));
    await assert.rejects(auth.restore());
    assert.equal(storage.has(auth.storageKey), response instanceof Error);
    assert.equal(auth.session, null);
  }
});
test('Logout revoca la sessione corrente e conserva i preferiti locali', async () => {
  const { auth, storage, calls } = setup([{ status: 200, body: session() }, { status: 204 }]);
  storage.set('verona-events-v1', '{"evento":"going"}');
  await auth.verifyCode('persona@example.org', '123456');
  await auth.signOut();
  assert.match(calls[1].url, /logout\?scope=local$/);
  assert.equal(auth.session, null); assert.equal(storage.has(auth.storageKey), false);
  assert.equal(storage.get('verona-events-v1'), '{"evento":"going"}');
});
test('Logout fallito permette di riprovare senza dichiarare uscita riuscita', async () => {
  const { auth } = setup([{ status: 200, body: session() }, new Error('offline'), { status: 204 }]);
  await auth.verifyCode('persona@example.org', '123456');
  await assert.rejects(auth.signOut()); assert.ok(auth.session);
  await auth.signOut(); assert.equal(auth.session, null);
});
test('Memoria bloccata: sessione disponibile per la visita', async () => {
  const { context } = setup();
  const auth = context.createVeronaAuth(config, {
    storage: { getItem() { throw Error(); }, setItem() { throw Error(); } },
    now: () => 1000000,
    fetch: async () => ({ ok: true, status: 200, json: async () => session() })
  });
  await auth.verifyCode('persona@example.org', '123456');
  assert.ok(auth.session); assert.equal(auth.persistent, false);
});
test('Logout in un’altra scheda: non ripristina la sessione rimossa', async () => {
  const { auth, storage } = setup([{ status: 200, body: session() }]);
  await auth.verifyCode('persona@example.org', '123456');
  storage.delete(auth.storageKey);
  await auth.restore(); assert.equal(auth.session, null);
});

function ui(authConfig = config, responses = [], initial = {}) {
  const elements = new Map(), storage = new Map(), calls = [], timers = [], events = {};
  let focused;
  function get(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', hidden: false, disabled: false, open: false,
      classList: { toggle() {} }, attributes: {}, listeners: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      focus() { if (!this.disabled) focused = id; },
      showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); }
    });
    return elements.get(id);
  }
  get('event-data').textContent = JSON.stringify({ auth: authConfig });
  const temporary = new Map(initial.temporary || []), navigation = [];
  const context = createContext({ AbortSignal, Date, JSON, URL, URLSearchParams, Uint8Array, TextEncoder, btoa, crypto: webcrypto,
    ...(initial.href ? { location: { href: initial.href, assign: url => navigation.push(url) }, history: { replaceState: (_state, _title, url) => navigation.push(url) } } : {}),
    sessionStorage: { getItem: key => temporary.get(key) ?? null, setItem: (key,value) => temporary.set(key,value), removeItem: key => temporary.delete(key) },
    document: { getElementById: get, addEventListener() {} },
    addEventListener: (type, fn) => { events[type] = fn; },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (!response) throw Error('Unexpected request');
      return { ok: response.status < 400, status: response.status, json: async () => response.body };
    }
  });
  new Script(logic).runInContext(context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { get, storage, calls, timers, events, settle, navigation, focused: () => focused,
    async submit(id) { get(id).onsubmit({ preventDefault() {} }); await settle(); } };
}
test('Pannello senza configurazione: nessun invio e annullamento con ritorno al pulsante', async () => {
  const app = ui(null); await app.settle();
  app.get('open-account').onclick();
  assert.equal(app.get('account-dialog').open, true);
  assert.equal(app.get('account-unavailable').hidden, false);
  assert.equal(app.get('account-login').hidden, true);
  app.get('close-account').onclick();
  assert.equal(app.get('account-dialog').open, false);
  assert.equal(app.focused(), 'open-account'); assert.equal(app.calls.length, 0);
});
test('UI Google facoltativa: focus, continua senza account, nessuna richiesta automatica', async () => {
  const app = ui({ ...config, method: 'google', enabled: true }); await app.settle();
  app.storage.set('verona-events-v1', '{"evento":"going"}');
  app.get('open-account').onclick();
  assert.equal(app.focused(), 'account-google');
  assert.equal(app.get('account-google').disabled, false);
  app.get('account-guest').onclick();
  assert.equal(app.get('account-dialog').open, false);
  assert.equal(app.calls.length, 0);
  assert.equal(app.storage.get('verona-events-v1'), '{"evento":"going"}');
});
test('UI Google non configurata: pulsante disattivo, uso senza account possibile', async () => {
  const app = ui({ ...config, method: 'google', enabled: false }); await app.settle();
  app.get('open-account').onclick();
  assert.equal(app.get('account-google').disabled, true);
  assert.equal(app.get('account-unavailable').hidden, false);
  app.get('account-google').onclick(); await app.settle();
  assert.equal(app.calls.length, 0);
  app.get('account-guest').onclick(); assert.equal(app.get('account-dialog').open, false);
});
test('HTTP su Wi-Fi: spiega il requisito HTTPS prima del clic e consente uso senza account', async () => {
  const app = ui({ ...config, method: 'google', enabled: true }, [], { href: 'http://192.168.1.27:4173/' });
  await app.settle(); app.get('open-account').onclick();
  assert.equal(app.get('account-google').disabled, true);
  assert.equal(app.get('account-context').hidden, false);
  app.get('account-google').onclick(); await app.settle();
  assert.equal(app.calls.length, 0); assert.equal(app.navigation.length, 0);
  app.get('account-guest').onclick(); assert.equal(app.get('account-dialog').open, false);
});
test('Rimozione sessione durante ripristino non ricrea accesso da una risposta tardiva', async () => {
  const { context, storage } = setup();
  let respond;
  const auth = context.createVeronaAuth(config, {
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    now: () => 1000000,
    fetch: () => new Promise(resolve => { respond = resolve; })
  });
  storage.set(auth.storageKey, JSON.stringify(session()));
  const pending = auth.restore(); storage.delete(auth.storageKey);
  respond({ ok: true, status: 200, json: async () => session().user });
  await pending; assert.equal(auth.session, null); assert.equal(storage.size, 0);
});

test('Google PKCE: challenge SHA256, ritorno allo stesso percorso, nessun verifier nell’URL', async () => {
  const { auth, temporary, calls } = setup();
  const url = new URL(await auth.startGoogle('https://example.org/verona/?filter=test#calendar'));
  assert.equal(url.origin, config.url);
  assert.equal(url.pathname, '/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), 'https://example.org/verona/');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  const pending = JSON.parse([...temporary.values()][0]);
  const expected = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier))).toString('base64url');
  assert.equal(url.searchParams.get('code_challenge'), expected);
  assert.ok(!url.href.includes(pending.verifier)); assert.equal(calls.length, 0);
});
test('Google: scambio codice monouso, sessione e cancellazione del verifier', async () => {
  const { auth, temporary, calls } = setup([{ status: 200, body: session() }]);
  await auth.startGoogle('http://localhost:4173/');
  assert.equal(await auth.completeGoogle('http://localhost:4173/?code=single-use-code'), true);
  assert.equal(auth.session.user.id, 'user-1'); assert.equal(temporary.size, 0);
  assert.match(calls[0].url, /token\?grant_type=pkce$/);
  assert.equal(JSON.parse(calls[0].body).auth_code, 'single-use-code');
  await assert.rejects(auth.completeGoogle('http://localhost:4173/?code=single-use-code'), /scaduto/);
  assert.equal(calls.length, 1);
});
test('Google: callback estranea, scaduta o annullata non crea sessioni', async () => {
  for (const kind of ['missing', 'expired', 'origin', 'cancel']) {
    const { auth, temporary, calls } = setup();
    if (kind !== 'missing') await auth.startGoogle('https://example.org/app/');
    if (kind === 'expired') for (const [key, json] of temporary) temporary.set(key, JSON.stringify({ ...JSON.parse(json), createdAt: 1 }));
    const callback = kind === 'origin' ? 'https://other.org/?code=test' : kind === 'cancel' ? 'https://example.org/app/#error=access_denied' : 'https://example.org/app/?code=test';
    await assert.rejects(auth.completeGoogle(callback));
    assert.equal(auth.session, null); assert.equal(calls.length, 0); assert.equal(temporary.size, 0);
  }
});
test('Google: redirect insicuri e memoria temporanea bloccata impediscono l’avvio', async () => {
  const { auth, context } = setup();
  await assert.rejects(auth.startGoogle('http://192.168.1.2:4173/'), /HTTPS/);
  await assert.rejects(auth.startGoogle('file:///index.html'), /HTTPS/);
  const blocked = context.createVeronaAuth(config, { fetch: async () => {}, crypto: webcrypto, temporaryStorage: { setItem() { throw Error(); } } });
  await assert.rejects(blocked.startGoogle('https://example.org/'), /memoria di sessione/);
});

test('Ritorno Google nella UI: pulisce URL, apre account e conserva la sessione verificata', async () => {
  const pendingKey = 'verona-auth-v1:' + config.url + ':pkce';
  const app = ui({ ...config, method: 'google', enabled: true }, [
    { status: 200, body: session({ expires_at: Math.floor(Date.now() / 1000) + 3600 }) },
    { status: 200, body: session().user }
  ], { href: 'https://example.org/app/?code=single-use', temporary: [[pendingKey, JSON.stringify({ verifier: 'A'.repeat(43), redirect: 'https://example.org/app/', createdAt: Date.now() })]] });
  await app.settle();
  assert.deepEqual(app.navigation, ['https://example.org/app/']);
  assert.equal(app.get('account-dialog').open, true);
  assert.equal(app.get('account-profile').hidden, false);
  assert.match(app.get('account-message').textContent, /Google effettuato/);
  assert.equal(app.calls.length, 2);
});
test('Annullamento Google nella UI: messaggio comprensibile, nessun blocco alla consultazione', async () => {
  const app = ui({ ...config, method: 'google', enabled: true }, [], { href: 'https://example.org/?error=access_denied&error_description=private-detail' });
  await app.settle();
  assert.deepEqual(app.navigation, ['https://example.org/']);
  assert.match(app.get('account-message').textContent, /annullato/);
  assert.doesNotMatch(app.get('account-message').textContent, /private-detail/);
  assert.equal(app.calls.length, 0);
  app.get('account-guest').onclick(); assert.equal(app.get('account-dialog').open, false);
});
