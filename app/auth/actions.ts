'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/supabase/env';

export type FormState = { error?: string; message?: string; email?: string };

const MIN_PASSWORD = 8;
const NOT_CONFIGURED: FormState = {
  error: 'Sign-in is not configured yet. Add the Supabase environment variables.',
};

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/** Origin of this deployment, for links in auth emails. Supabase only accepts allow-listed URLs. */
async function siteOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  if (origin) return origin;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = field(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!validEmail(email) || !password) return { error: 'Enter your email and password.', email };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { error: 'Confirm your email first. Check your inbox, or resend the link below.', email };
    }
    if (error.status === 429) return { error: 'Too many attempts. Wait a minute and try again.', email };
    return { error: 'That email and password do not match.', email };
  }
  redirect(safeNextPath(field(form, 'next')));
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const email = field(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (!validEmail(email)) return { error: 'Enter a valid email address.', email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters for your password.`, email };
  }
  if (password.length > 72) return { error: 'Use 72 characters or fewer.', email };
  if (password !== confirm) return { error: 'The two passwords do not match.', email };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/app` },
  });
  if (error) {
    if (error.code === 'weak_password') {
      return { error: 'Choose a stronger password (mix letters, numbers and symbols).', email };
    }
    if (error.code === 'signup_disabled') return { error: 'New sign-ups are closed.', email };
    if (error.status === 429) return { error: 'Too many attempts. Wait a minute and try again.', email };
    return { error: 'Could not create the account. Try again.', email };
  }
  // With email confirmation turned off, Supabase signs the user in right away.
  if (data.session) redirect('/app');
  return {
    message: `Check ${email} for a confirmation link. Open it on any device to finish signing up.`,
    email,
  };
}

export async function resendConfirmation(_prev: FormState, form: FormData): Promise<FormState> {
  const email = field(form, 'email').toLowerCase();
  if (!validEmail(email)) return { error: 'Enter your email address first.', email };
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/app` },
  });
  if (error?.status === 429) return { error: 'Please wait a minute before asking for another email.', email };
  return { message: 'If that account is waiting for confirmation, a new link is on its way.', email };
}

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const email = field(form, 'email').toLowerCase();
  if (!validEmail(email)) return { error: 'Enter a valid email address.', email };
  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { error: 'Please wait a minute before asking for another email.', email };
  // Same answer whether or not the account exists.
  return { message: 'If an account uses that email, a reset link is on its way.', email };
}

export async function updatePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (password.length > 72) return { error: 'Use 72 characters or fewer.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') return { error: 'Choose a password you have not used here before.' };
    if (error.code === 'weak_password') return { error: 'Choose a stronger password.' };
    return { error: 'Your reset link has expired. Request a new one.' };
  }
  redirect('/app?password=updated');
}
