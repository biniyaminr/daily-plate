'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/auth/actions';

type Field = {
  name: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  hint?: string;
};

export function AuthForm({
  action,
  fields,
  submit,
  pending,
  hidden,
  initialEmail,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  pending: string;
  hidden?: Record<string, string>;
  initialEmail?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { email: initialEmail });

  return (
    <form action={formAction} className="authform" noValidate={false}>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {fields.map((f) => (
        <label key={f.name}>
          {f.label}
          <input
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            required
            minLength={f.type === 'password' && f.autoComplete === 'new-password' ? 8 : undefined}
            maxLength={f.type === 'password' ? 72 : 254}
            defaultValue={f.type === 'email' ? state.email : undefined}
            aria-describedby={f.hint ? `${f.name}-hint` : undefined}
          />
          {f.hint && (
            <small id={`${f.name}-hint`} className="hint">
              {f.hint}
            </small>
          )}
        </label>
      ))}
      <div aria-live="polite">
        {state.error && <p className="alert error">{state.error}</p>}
        {state.message && <p className="alert ok">{state.message}</p>}
      </div>
      <button className="primary" disabled={isPending}>
        {isPending ? pending : submit}
      </button>
    </form>
  );
}
