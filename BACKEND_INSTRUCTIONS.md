/* ====== Config ====== */
const APP_NAME = 'Gestore Spese';

// Pagina di “bridge” (https) che poi apre l’app
const DEFAULT_REDIRECT = 'https://jerbamichol-del.github.io/gestore/open-app.html';

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

// Helper email generico
function sendEmail_(to, subject, htmlBody, textBody) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: htmlBody,
    body: textBody,
    name: APP_NAME
  });
}

function buildResetLink_(email) {
  const em = normalizeEmail_(email);
  const token = Utilities.getUuid();

  return (
    DEFAULT_REDIRECT +
    (DEFAULT_REDIRECT.indexOf('?') === -1 ? '?' : '&') +
    'resetToken=' + encodeURIComponent(token) +
    '&email=' + encodeURIComponent(em)
  );
}

function buildVerifyLink_(newEmail, token) {
  const em = normalizeEmail_(newEmail);
  // action=verify_email viene passato come parametro all'app
  return (
    DEFAULT_REDIRECT +
    (DEFAULT_REDIRECT.indexOf('?') === -1 ? '?' : '&') +
    'action=verify_email' +
    '&token=' + encodeURIComponent(token) +
    '&email=' + encodeURIComponent(em)
  );
}

/* ====== Actions ====== */
function handleRequest_(e) {
  const email = normalizeEmail_(e.parameter.email);

  if (!email || email.indexOf('@') === -1) {
    return respond_(e, { ok: false, error: 'BAD_EMAIL' });
  }

  const link = buildResetLink_(email);
  
  const text = [
    'Hai richiesto il reset del PIN per ' + APP_NAME + '.',
    'Apri questo link (apre l’app):',
    link,
    '',
    'Se non hai richiesto tu questo reset, ignora questa email.'
  ].join('\n');

  const html = [
    '<div style="font-family:sans-serif;line-height:1.5">',
    '<h2>' + APP_NAME + ' — Reimposta PIN</h2>',
    '<p>Hai richiesto il reset del PIN. Clicca il pulsante qui sotto:</p>',
    '<p><a href="' + link + '" style="display:inline-block;background:#4f46e5;color:#fff;',
    ' padding:10px 16px;border-radius:8px;text-decoration:none;">Apri l’app e reimposta PIN</a></p>',
    '<p style="font-size:12px;color:#64748b">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>',
    '<p style="font-size:12px"><a href="' + link + '">' + link + '</a></p>',
    '</div>'
  ].join('');

  try {
    sendEmail_(email, APP_NAME + ' — Reimposta PIN', html, text);
    return respond_(e, { ok: true, sent: true });
  } catch (err) {
    return respond_(e, { ok: false, error: String(err) });
  }
}

function handleVerifyEmailChange_(e) {
  const newEmail = normalizeEmail_(e.parameter.new_email);
  const token = e.parameter.token;

  if (!newEmail || !token) {
    return respond_(e, { ok: false, error: 'MISSING_PARAMS' });
  }

  const link = buildVerifyLink_(newEmail, token);

  const text = [
    'Conferma il nuovo indirizzo email per ' + APP_NAME + '.',
    'Apri questo link:',
    link,
    '',
    'Se non hai richiesto tu questa modifica, ignora questa email.'
  ].join('\n');

  const html = [
    '<div style="font-family:sans-serif;line-height:1.5">',
    '<h2>Conferma Cambio Email</h2>',
    '<p>È stato richiesto di cambiare l\'indirizzo email del tuo account in <strong>' + newEmail + '</strong>.</p>',
    '<p><a href="' + link + '" style="display:inline-block;background:#4f46e5;color:#fff;',
    ' padding:10px 16px;border-radius:8px;text-decoration:none;">Conferma Email</a></p>',
    '<p style="font-size:12px;color:#64748b">Se non sei stato tu, ignora questa email.</p>',
    '</div>'
  ].join('');

  try {
    sendEmail_(newEmail, APP_NAME + ' — Conferma Email', html, text);
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
    case 'request': // Reset Password
      return handleRequest_(e);
    case 'verify_email_change': // Nuovo: Conferma Cambio Email
      return handleVerifyEmailChange_(e);
    case 'ping':
    default:
      return handlePing_(e);
  }
}

function doPost(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, message: 'NO_POST' }))
    .setMimeType(ContentService.MimeType.JSON);
}
