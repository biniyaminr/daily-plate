import Link from 'next/link';
import { redirect } from 'next/navigation';
import { InjeraPlatter } from '@/components/injera-platter';
import { Logo } from '@/components/logo';
import { SiteHeader } from '@/components/site-header';
import { getVerifiedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GOALS = [
  {
    key: 'lose',
    title: 'Lose weight',
    tone: 'Eat about 20% less than you burn',
    plate: ['1 injera instead of 2', 'Half the platter gomen, atkilt or salata', 'Tibs, doro or asa for protein', 'Less niter kibbeh and oil'],
    day: 'Eggs and kinche · doro wot with 1 injera and salata · ergo · asa tibs with gomen',
  },
  {
    key: 'gain',
    title: 'Build muscle',
    tone: 'Eat about 300 kcal more, and lift',
    plate: ['1½ to 2 injera with every main meal', 'Protein at each of five meals', 'Ergo, ayib and peanuts as snacks', 'Train 5 days with progressive weights'],
    day: 'Ful with dabo and eggs · siga tibs with 2 injera · ergo, banana, peanuts · doro with potato',
  },
  {
    key: 'recomp',
    title: 'Lose fat, keep strength',
    tone: 'A small calorie cut and the most protein',
    plate: ['1 to 1½ injera', 'Lean protein the size of your palm, twice', 'Egg whites and ayib between meals', 'Walk every day'],
    day: 'Egg whites and kinche · doro with injera · ayib and fruit · tibs with sweet potato',
  },
];

const SWAPS = [
  ['Kitfo in niter kibbeh', 'Lean siga tibs or doro, lightly cooked', 'Much less fat'],
  ['Firfir every morning', 'Eggs with kinche or ful with one slice of dabo', 'More protein, steadier energy'],
  ['Shai with three sugars', 'Buna or shai with little or no sugar', 'Fewer empty calories'],
  ['Soda with lunch', 'Water or sparkling water', 'Fewer empty calories'],
  ['Kolo by the handful', 'A measured 30 g of kolo or peanuts', 'Same taste, controlled portion'],
];

const FASTING = ['Shiro wot', 'Misir wot', 'Kik alicha', 'Ful', 'Shimbra (chickpeas)', 'Gomen', 'Atkilt wot', 'Salata', 'Peanuts', 'Fruit'];

const FEATURES = [
  ['Meal plan for your goal', 'Seven days of Ethiopian meals, with portions scaled to your calories and protein.'],
  ['Food log with Ethiopian foods', 'Injera, shiro, tibs and more. Recent foods, and copy yesterday’s meal.'],
  ['Training with guidance', 'A 5-day plan with animated movement guides, a rest timer, personal records and the next weight to try.'],
  ['Honest progress', 'A smoothed weight trend, a weekly check-in and streaks. Private to your account.'],
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // Supabase falls back to the Site URL (this page) when an email link's
  // redirect isn't allow-listed. Finish the sign-in instead of ignoring it.
  const { code, token_hash: tokenHash, type } = await searchParams;
  if (code || (tokenHash && type)) {
    const params = new URLSearchParams({ next: '/app' });
    if (code) params.set('code', code);
    if (tokenHash && type) {
      params.set('token_hash', tokenHash);
      params.set('type', type);
    }
    redirect(`/auth/confirm?${params}`);
  }

  const { user } = await getVerifiedUser();
  const start = user
    ? { href: '/app', label: 'Open my plan' }
    : { href: '/signup', label: 'Create my free plan' };

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main className="home">
        <section className="hero">
          <div className="herocopy">
            <p className="eyebrow">
              ETHIOPIAN FOOD · REAL RESULTS · <span lang="am">እንጀራ</span>
            </p>
            <h1>
              Eat the food you love.
              <br />
              <em>Reach the body you want.</em>
            </h1>
            <p className="lead">
              Enjera builds you a weekly meal plan from injera, wot, tibs and shiro, sized for your goal: losing weight,
              building muscle, or both. You don’t need imported diet food.
            </p>
            <div className="actions">
              <Link className="primary big" href={start.href}>
                {start.label} →
              </Link>
              <a className="ghost big" href="#guide">
                Read the guide
              </a>
            </div>
            <ul className="trust">
              <li>Fasting days planned for</li>
              <li>Free to use</li>
              <li>Your records stay private</li>
            </ul>
          </div>
          <div className="heroart">
            <div className="platterwrap">
              <InjeraPlatter className="platter" />
              <span className="chip c1">Misir wot · 7 g protein / 100 g</span>
              <span className="chip c2">Tibs · 27 g protein</span>
              <span className="chip c3">Gomen · 50 kcal</span>
              <span className="chip c4">1 injera ≈ 215 kcal</span>
            </div>
          </div>
        </section>

        <section className="band" aria-label="What you get">
          <div><strong>7-day</strong><span>meal plan</span></div>
          <div><strong>4</strong><span>goals to choose from</span></div>
          <div><strong>26</strong><span>guided exercises</span></div>
          <div><strong>Wed &amp; Fri</strong><span>fasting meals included</span></div>
        </section>

        <section className="section" id="goals">
          <p className="eyebrow">CHOOSE YOUR GOAL</p>
          <h2 className="title">Same food, different portions.</h2>
          <p className="sectionlead">
            Losing weight and building muscle start from the same Ethiopian table. What changes is how much injera you
            eat, how much protein, and how you train.
          </p>
          <div className="goalgrid">
            {GOALS.map((g) => (
              <article key={g.key} className={`goal goal-${g.key}`}>
                <div className="goaltop">
                  <h3>{g.title}</h3>
                  <p>{g.tone}</p>
                </div>
                <ul>
                  {g.plate.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="sampleday">
                  <b>A day might look like:</b> {g.day}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section split" id="guide">
          <div>
            <p className="eyebrow">THE GUIDE</p>
            <h2 className="title">Build your plate the Ethiopian way.</h2>
            <p className="sectionlead">Use this at home, at a restaurant or at a family meal.</p>
            <ol className="steps">
              <li>
                <b>Start with protein.</b> A palm-sized portion of tibs, doro, asa, eggs or ayib at every meal. On fasting days
                use shiro, misir, kik or ful.
              </li>
              <li>
                <b>Fill half with vegetables.</b> Gomen, atkilt wot, salata and timatim are filling and light.
              </li>
              <li>
                <b>Choose your injera.</b> Teff injera is a good carbohydrate. Eat 1 piece to lose weight, 1½ to keep
                steady, and 2 to build muscle.
              </li>
              <li>
                <b>Watch the fat.</b> Niter kibbeh and oil add up fast. Ask for less, and choose alicha over heavy wot
                sometimes.
              </li>
              <li>
                <b>Move every day.</b> Walk after meals, and lift weights 3 to 5 days a week so the weight you lose is fat,
                not muscle.
              </li>
            </ol>
          </div>
          <div className="platemodel" aria-label="A balanced plate: half vegetables, a quarter protein, a quarter injera">
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r="104" fill="#fff" stroke="#e3e7db" strokeWidth="4" />
              <path d="M110 110V10A100 100 0 0 0 110 210Z" fill="#7da35f" />
              <path d="M110 110V10A100 100 0 0 1 210 110Z" fill="#b5422b" />
              <path d="M110 110H210A100 100 0 0 1 110 210Z" fill="#e7cf9c" />
              <text x="60" y="114" textAnchor="middle">Vegetables</text>
              <text x="152" y="72" textAnchor="middle">Protein</text>
              <text x="152" y="158" textAnchor="middle">Injera</text>
            </svg>
            <div className="legend">
              <span><i style={{ background: '#7da35f' }} />Half: gomen, salata, atkilt</span>
              <span><i style={{ background: '#b5422b' }} />Quarter: tibs, doro, asa, shiro</span>
              <span><i style={{ background: '#e7cf9c' }} />Quarter: injera or dabo</span>
            </div>
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">SMART SWAPS</p>
          <h2 className="title">Small changes that add up.</h2>
          <div className="swaps">
            {SWAPS.map(([from, to, why]) => (
              <div key={from} className="swap">
                <span className="from">{from}</span>
                <span className="arrow" aria-hidden="true">→</span>
                <span className="to">{to}</span>
                <small>{why}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="fastband">
          <div>
            <p className="eyebrow light">FASTING (TSOM)</p>
            <h2 className="title">Fasting on Wednesdays and Fridays? Your plan fasts with you.</h2>
            <p>
              Choose your fasting days and those days switch to meals with no meat, eggs or dairy, sized to your
              calories. Those days are lower in protein than the rest of the week, which is normal while fasting.
            </p>
          </div>
          <ul className="fastfoods">
            {FASTING.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section className="section">
          <p className="eyebrow">INSIDE THE APP</p>
          <h2 className="title">Everything for the day, in one place.</h2>
          <div className="featuregrid">
            {FEATURES.map(([title, text], i) => (
              <article key={title} className="feature">
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section how">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2 className="title">Start in a minute.</h2>
          <div className="howgrid">
            <div><span>1</span><h3>Create an account</h3><p>Just an email and a password.</p></div>
            <div><span>2</span><h3>Tell us about you</h3><p>Your goal, height, weight, activity and fasting days.</p></div>
            <div><span>3</span><h3>Follow your plan</h3><p>Tick off meals, log sets and weigh in. Your targets update with you.</p></div>
          </div>
        </section>

        <section className="cta">
          <Logo size={72} />
          <h2>Your goal, on your own food.</h2>
          <Link className="primary big light" href={start.href}>
            {start.label} →
          </Link>
        </section>
      </main>
      <footer className="sitefooter">
        <span>
          Enjera · <span lang="am">እንጀራ</span> · Ethiopian food, real goals.
        </span>
        <span>
          General guidance, not medical advice. If you are pregnant, under 18 or managing a health condition, talk to a
          doctor first.
        </span>
      </footer>
    </>
  );
}
