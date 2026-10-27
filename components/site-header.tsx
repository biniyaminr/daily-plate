import Link from 'next/link';
import { Logo } from '@/components/logo';

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="siteheader">
      <Link href="/" className="brand">
        <Logo size={38} />
        <span className="brandname">Enjera</span>
      </Link>
      <nav aria-label="Site">
        <Link href="/#guide">Guide</Link>
        <Link href="/app">My plan</Link>
        {signedIn ? (
          <form action="/auth/signout" method="post">
            <button className="linkbtn">Sign out</button>
          </form>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
