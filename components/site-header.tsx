import Link from 'next/link';

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="siteheader">
      <Link href="/" className="brand">
        <span aria-hidden="true">◒</span> <span className="brandname" lang="am">እንጀራ</span>
      </Link>
      <nav aria-label="Site">
        <Link href="/">Home</Link>
        <Link href="/app">Meals &amp; training</Link>
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
