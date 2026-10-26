import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { SiteHeader } from '@/components/site-header';
import { signUp } from '@/app/auth/actions';
import { getVerifiedUser } from '@/lib/supabase/server';

export const metadata = { title: 'Create account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const { user } = await getVerifiedUser();
  if (user) redirect('/app');

  return (
    <>
      <SiteHeader signedIn={false} />
      <main className="authpage">
        <div className="authcard">
          <p className="eyebrow">PRIVATE ACCOUNT</p>
          <h1>Create your account</h1>
          <p className="muted">Your meals, workouts and weigh-ins are visible only to you.</p>
          <AuthForm
            action={signUp}
            submit="Create account"
            pending="Creating account…"
            fields={[
              { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
              {
                name: 'password',
                label: 'Password',
                type: 'password',
                autoComplete: 'new-password',
                hint: 'At least 8 characters.',
              },
              { name: 'confirm', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
            ]}
          />
          <p className="authlinks">
            <Link href="/login">I already have an account</Link>
          </p>
        </div>
      </main>
    </>
  );
}
