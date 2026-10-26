import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { getVerifiedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Public page: describes the site only. No logs, weights or backups appear here.
export default async function Home() {
  const { user } = await getVerifiedUser();

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main className="sitemain">
        <section className="landing">
          <p className="eyebrow">BENJI — MEALS, TRAINING &amp; PROGRESS</p>
          <h1>Food. Strength. Consistency.</h1>
          <p className="lead">
            My personal place for a seven-day Ethiopian meal plan, a five-day training schedule,
            and an honest record of how the weeks are going.
          </p>
          <div className="actions">
            <Link className="primary" href="/app">
              {user ? 'Open today’s plan' : 'Sign in to my plan'}
            </Link>
          </div>
        </section>

        <section className="cards" aria-label="What is here">
          <article className="card">
            <h2>Meals</h2>
            <p>Seven days of Ethiopian whole foods with set portions, plus a food log with macro totals. No tuna.</p>
          </article>
          <article className="card">
            <h2>Training</h2>
            <p>Five training days and two recovery days, with sets, reps, rest times and a rest timer.</p>
          </article>
          <article className="card">
            <h2>Progress</h2>
            <p>Weigh-ins, walking and sleep check-ins. Records are private and only visible after sign-in.</p>
          </article>
        </section>
      </main>
      <footer className="sitefooter">
        <span>Small steps. Stronger every day.</span>
        <span>This site does not give medical advice.</span>
      </footer>
    </>
  );
}
