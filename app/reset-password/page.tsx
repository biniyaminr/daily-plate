import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { SiteHeader } from '@/components/site-header';
import { updatePassword } from '@/app/auth/actions';
import { getVerifiedUser } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password' };
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const { user } = await getVerifiedUser();
  if (!user) redirect('/login?next=/reset-password');

  return (
    <>
      <SiteHeader signedIn />
      <main className="authpage">
        <div className="authcard">
          <p className="eyebrow">SIGNED IN AS {user.email?.toUpperCase()}</p>
          <h1>Choose a new password</h1>
          <AuthForm
            action={updatePassword}
            submit="Save new password"
            pending="Saving…"
            fields={[
              {
                name: 'password',
                label: 'New password',
                type: 'password',
                autoComplete: 'new-password',
                hint: 'At least 8 characters.',
              },
              { name: 'confirm', label: 'Confirm new password', type: 'password', autoComplete: 'new-password' },
            ]}
          />
        </div>
      </main>
    </>
  );
}
