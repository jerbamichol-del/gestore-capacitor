/* ====== Config ====== */
const APP_NAME = 'Gestore Spese';

// Pagina di “bridge” - non strettamente necessaria per OTP, ma utile per fallback
const DEFAULT_REDIRECT = 'https://jerbamichol-del.github.io/gestore/';

/* ====== Helpers ====== */
function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function respond_(e, payload) {
  const cb = e && e.parameter && e.parameter.callback;
  const body = cb ? cb + '(' + JSON.stringify(payload) + ')' : JSON.stringify(payload);
  const out = ContentService.createTextOutput(body);
  out.setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  return out;
}

function sendEmail_(to, subject, htmlBody, textBody) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    name: APP_NAME
  });
}

/* ====== Actions ====== */

// Gestione Reset Password (classico link)
function handleRequest_(e) {
  const email = normalizeEmail_(e.parameter.email);
  if (!email || email.indexOf('@') === -1) return respond_(e, { ok: false, error: 'BAD_EMAIL' });

  const token = Utilities.getUuid();
  const link = DEFAULT_REDIRECT + '?resetToken=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email);
  
  const text = 'Reimposta PIN: ' + link;
  const html = '<p>Clicca per reimpostare il PIN: <a href="' + link + '">Reimposta PIN</a></p>';

  try {
    sendEmail_(email, APP_NAME + ' — Reimposta PIN', html, text);
    return respond_(e, { ok: true, sent: true });
  } catch (err) {
    return respond_(e, { ok: false, error: String(err) });
  }
}

// Gestione Verifica Cambio Email (Con CODICE OTP)
function handleVerifyEmailChange_(e) {
  const newEmail = normalizeEmail_(e.parameter.new_email);
  const code = e.parameter.token; // Qui 'token' sarà il codice numerico (es. 123456)

  if (!newEmail || !code) {
    return respond_(e, { ok: false, error: 'MISSING_PARAMS' });
  }

  const text = [
    'Codice di verifica per il cambio email: ' + code,
    '',
    'Inserisci questo codice nell\'app per confermare.'
  ].join('\n');

  const html = [
    '<div style="font-family:sans-serif;line-height:1.5;text-align:center;">',
    '<h2>Conferma indirizzo Email</h2>',
    '<p>Usa il seguente codice per confermare il cambio email:</p>',
    '<div style="font-size:32px;font-weight:bold;letter-spacing:4px;color:#4f46e5;margin:24px 0;padding:16px;background:#f3f4f6;border-radius:12px;display:inline-block;">' + code + '</div>',
    '<p style="font-size:12px;color:#64748b">Se non hai richiesto questa modifica, ignora questa email.</p>',
    '</div>'
  ].join('');

  try {
    sendEmail_(newEmail, APP_NAME + ' — Codice ' + code, html, text);
    return respond_(e, { ok: true, sent: true });
  } catch (err) {
    return respond_(e, { ok: false, error: String(err) });
  }
}

function handlePing_(e) {
  return respond_(e, { ok: true, ts: new Date().toISOString() });
}

/* ====== Entrypoints ====== */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';
  switch (String(action).toLowerCase()) {
    case 'request': return handleRequest_(e);
    case 'verify_email_change': return handleVerifyEmailChange_(e);
    case 'ping': default: return handlePing_(e);
  }
}
