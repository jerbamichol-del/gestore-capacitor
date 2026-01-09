import React from 'react';

type Props = {
  onSubmit?: (email: string) => void;
};

const isValidEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function LoginEmail({ onSubmit }: Props) {
  const edRef = React.useRef<HTMLDivElement>(null);
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const [err, setErr] = React.useState<string>('');

  // evita salti in iframe/mobile: niente scroll sul form
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const email = (edRef.current?.textContent || '').trim();
    if (!isValidEmail(email)) {
      setErr('Inserisci un’email valida');
      return;
    }
    if (hiddenRef.current) hiddenRef.current.value = email;
    setErr('');
    onSubmit?.(email);
    // fai il tuo login qui
    console.log('LOGIN email:', email);
  };

  const plainPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const t = e.clipboardData?.getData('text') || '';
    document.execCommand('insertText', false, t);
  };

  return (
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      data-lpignore="true"
      data-form-type="other"
      style={{ overflow: 'visible' }}
    >
      {/* decoy: assorbe eventuali heuristics di autofill */}
      <input
        type="text"
        autoComplete="off"
        tabIndex={-1}
        readOnly
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, top: -9999, height: 0, width: 0, opacity: 0 }}
      />

      {/* hidden “vero” per compatibilità con eventuale lettura DOM */}
      <input ref={hiddenRef} type="hidden" name="email" />

      <label htmlFor="ed-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 transition-colors">
        Email
      </label>

      {/* Campo VISIBILE senza autofill del browser */}
      <div
        id="ed-email"
        ref={edRef}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        inputMode="email"
        aria-label="Email"
        spellCheck={false}
        // evita autocompletamento/auto-capitalize
        // (non servono su contenteditable ma non fanno male)
        // @ts-ignore
        autoCapitalize="off"
        autoCorrect="off"
        onPaste={plainPaste}
        onKeyDown={(e) => {
          // invia con Enter
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget.closest('form') as HTMLFormElement)?.requestSubmit();
          }
        }}
        className="block w-full min-h-[44px] text-base px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors"
        style={{
          // evita formattazione ricca su mobile webkit
          WebkitUserModify: 'read-write-plaintext-only' as any,
        }}
        // placeholder “soft”
        data-placeholder="nome@dominio.it"
        onFocus={(e) => {
          // scroll “pulito” senza transform (se servisse)
          e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }}
      />

      {/* placeholder CSS per contenteditable */}
      <style>{`
        #ed-email:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8; /* slate-400 */
        }
        .dark #ed-email:empty:before {
          color: #64748b; /* slate-500 */
        }
      `}</style>

      {err && <p className="text-red-600 dark:text-red-400 text-sm mt-2 transition-colors">{err}</p>}

      <button
        type="submit"
        className="mt-4 w-full min-h-[44px] rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-md"
      >
        Continua
      </button>

      {/* Note di sicurezza UI: niente transform/overflow sugli antenati */}
    </form>
  );
}