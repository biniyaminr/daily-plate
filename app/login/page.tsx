import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { SiteHeader } from '@/components/site-header';
import { resendConfirmation, signIn } from '@/app/auth/actions';
import { safeNextPath } from '@/lib/supabase/env';
import { getVerifiedUser } from '@/lib/supabase/server';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const NOTICES: Record<string, string> = {
  link_expired: 'That email link has expired or was already used. Sign in, or request a new link.',
  link_other_device:
    'That link must be opened in the browser where you asked for it. Request a new link, or sign in.',
  link_invalid: 'That email link is not valid. Request a new one.',
  not_configured: 'Sign-in is not configured yet.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const { user } = await getVerifiedUser();
  if (user) redirect(next);

  const notice = params.error ? NOTICES[params.error] : undefined;

  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="authpage">
        <div className="authcard">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Sign in</h1>
          {params.signed_out && <p className="alert ok">You are signed out.</p>}
          {notice && <p className="alert error">{notice}</p>}
          <AuthForm
            action={signIn}
            hidden={{ next }}
            submit="Sign in"
            pending="Signing in…"
            fields={[
              { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
              { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
            ]}
          />
          <p className="authlinks">
            <Link href="/forgot-password">Forgot your password?</Link>
            <Link href={`/signup${next !== '/app' ? `?next=${encodeURIComponent(next)}` : ''}`}>
              Create an account
            </Link>
          </p>
          <details className="resend">
            <summary>Didn’t get your confirmation email?</summary>
            <AuthForm
              action={resendConfirmation}
              submit="Resend confirmation"
              pending="Sending…"
              fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
            />
          </details>
        </div>
      </main>
    </>
  );
}
