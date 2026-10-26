import Link from 'next/link';
import { AuthForm } from '@/components/auth-form';
import { SiteHeader } from '@/components/site-header';
import { requestPasswordReset } from '@/app/auth/actions';

export const metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="authpage">
        <div className="authcard">
          <p className="eyebrow">PASSWORD HELP</p>
          <h1>Reset your password</h1>
          <p className="muted">We’ll email you a link to choose a new password.</p>
          <AuthForm
            action={requestPasswordReset}
            submit="Send reset link"
            pending="Sending…"
            fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
          />
          <p className="authlinks">
            <Link href="/login">Back to sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
