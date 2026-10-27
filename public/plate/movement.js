/* Movement figures: a simple side- or front-view figure that moves between the
   start and finish position of each exercise, with short form cues.
   General guidance only; the plan's sets, reps and rest come from fitness.js. */
const Movement = (() => {
  const STAND = { H: [100, 28], N: [100, 42], P: [100, 90], K: [100, 120], F: [100, 150], T: [112, 150] };
  const FRONT = { H: [100, 26], N: [100, 40], P: [100, 90], K: [92, 120], F: [90, 150], K2: [108, 120], F2: [110, 150] };
  const pose = (base, changes) => ({ ...base, ...changes });
  const up = (p, dy) => Object.fromEntries(Object.entries(p).map(([k, [x, y]]) => [k, ['F', 'T', 'F2'].includes(k) ? [x, y] : [x, y - dy]]));

  // Each pattern: start pose, end pose, equipment, static props, cues.
  // Joints: H head, N shoulders, E elbow, W hand, P hip, K knee, F ankle, T toe; *2 = other side.
  const P = {
    bench: {
      props: ['<rect x="40" y="110" width="110" height="7" rx="3"/><path d="M55 117V150M135 117V150"/>'],
      start: { H: [52, 100], N: [66, 104], E: [58, 118], W: [70, 98], P: [112, 104], K: [134, 118], F: [140, 150] },
      end: { H: [52, 100], N: [66, 104], E: [66, 82], W: [67, 60], P: [112, 104], K: [134, 118], F: [140, 150] },
      gear: 'bar',
      cues: ['Feet flat, shoulder blades pulled back and down.', 'Lower the bar to mid-chest with elbows about 45° from your body.', 'Press up and slightly back until arms are straight. Use a spotter for heavy sets.'],
    },
    incline: {
      props: ['<path d="M58 80L118 122" stroke-width="7"/><path d="M110 122V150M70 100V150"/>'],
      start: { H: [62, 82], N: [74, 92], E: [64, 110], W: [76, 90], P: [112, 116], K: [134, 122], F: [138, 150] },
      end: { H: [62, 82], N: [74, 92], E: [80, 72], W: [84, 50], P: [112, 116], K: [134, 122], F: [138, 150] },
      gear: 'db',
      cues: ['Bench at a low incline, about 30°.', 'Lower the dumbbells to upper-chest level with control.', 'Press up until arms are straight over your shoulders.'],
    },
    row: {
      start: { H: [138, 72], N: [126, 80], E: [127, 102], W: [128, 124], P: [85, 95], K: [100, 122], F: [104, 150], T: [116, 150] },
      end: { H: [138, 72], N: [126, 80], E: [106, 82], W: [112, 104], P: [85, 95], K: [100, 122], F: [104, 150], T: [116, 150] },
      gear: 'bar',
      cues: ['Hinge at the hips with a flat back; knees softly bent.', 'Pull the bar to your lower ribs, squeezing your shoulder blades together.', 'Lower slowly. Keep your back position fixed; don’t jerk the weight up.'],
    },
    supportedRow: {
      props: ['<path d="M78 124L128 84" stroke-width="7"/><path d="M84 124V150"/>'],
      start: { H: [134, 68], N: [122, 78], E: [124, 102], W: [125, 126], P: [88, 108], K: [76, 130], F: [82, 150], T: [94, 150] },
      end: { H: [134, 68], N: [122, 78], E: [102, 86], W: [112, 106], P: [88, 108], K: [76, 130], F: [82, 150], T: [94, 150] },
      gear: 'db',
      cues: ['Chest on the incline pad, arms hanging straight down.', 'Row the dumbbells up, driving elbows back past your sides.', 'Pause briefly at the top, then lower all the way.'],
    },
    overhead: {
      start: pose(STAND, { E: [112, 58], W: [109, 42] }),
      end: pose(STAND, { H: [97, 28], E: [103, 22], W: [102, 2] }),
      gear: 'bar',
      cues: ['Bar on the front of your shoulders, grip just outside shoulder width.', 'Brace your stomach and glutes; press straight up, moving your head back slightly.', 'Finish with the bar over the middle of your feet. Don’t lean back.'],
    },
    pullup: {
      props: ['<path d="M60 10H140" stroke-width="5"/>'],
      start: { H: [108, 38], N: [100, 46], E: [100, 29], W: [100, 12], P: [100, 94], K: [96, 120], F: [104, 142], T: [112, 146] },
      end: { H: [108, 8], N: [100, 20], E: [94, 36], W: [100, 12], P: [100, 68], K: [96, 94], F: [104, 116], T: [112, 120] },
      cues: ['Start from a full hang, hands slightly wider than shoulders.', 'Pull your chest toward the bar until your chin clears it.', 'Lower all the way under control. Use a band or assisted machine if needed.'],
    },
    pulldown: {
      props: ['<rect x="78" y="110" width="40" height="7" rx="3"/><path d="M98 117V150M108 100H132"/>'],
      start: { H: [90, 48], N: [88, 62], E: [92, 40], W: [96, 18], P: [92, 108], K: [122, 108], F: [122, 150], T: [134, 150] },
      end: { H: [90, 48], N: [88, 62], E: [80, 82], W: [96, 64], P: [92, 108], K: [122, 108], F: [122, 150], T: [134, 150] },
      gear: 'cable', anchor: [96, -6],
      cues: ['Thighs locked under the pad, wide grip.', 'Lean back slightly and pull the bar to your upper chest.', 'Let the bar rise slowly until your arms are straight.'],
    },
    fly: {
      view: 'front',
      start: pose(FRONT, { E: [72, 48], W: [52, 58], E2: [128, 48], W2: [148, 58] }),
      end: pose(FRONT, { E: [84, 56], W: [97, 68], E2: [116, 56], W2: [103, 68] }),
      gear: 'cable', anchor: [14, 30], anchor2: [186, 30],
      cues: ['Stand between the cables with a slight bend in your elbows.', 'Bring your hands together in front of your chest in a wide arc.', 'Open back slowly until you feel a stretch across your chest.'],
    },
    crossover: {
      view: 'front',
      start: pose(FRONT, { E: [72, 42], W: [52, 34], E2: [128, 42], W2: [148, 34] }),
      end: pose(FRONT, { E: [86, 62], W: [104, 80], E2: [114, 62], W2: [96, 80] }),
      gear: 'cable', anchor: [14, 4], anchor2: [186, 4],
      cues: ['Cables set high, one step forward, slight lean.', 'Sweep your hands down and together, crossing them slightly.', 'Return slowly with your elbows softly bent the whole time.'],
    },
    curl: {
      start: pose(STAND, { E: [105, 66], W: [108, 90] }),
      end: pose(STAND, { E: [105, 66], W: [115, 45] }),
      gear: 'bar',
      cues: ['Stand tall with your elbows at your sides.', 'Curl the weight up by bending only at the elbow.', 'Lower slowly. Don’t swing your body to lift it.'],
    },
    hammer: {
      start: pose(STAND, { E: [105, 66], W: [108, 90] }),
      end: pose(STAND, { E: [105, 66], W: [115, 45] }),
      gear: 'db',
      cues: ['Hold the dumbbells with palms facing each other.', 'Curl up keeping your thumbs pointing up and elbows still.', 'Lower all the way under control.'],
    },
    inclineCurl: {
      props: ['<path d="M70 62L92 118" stroke-width="7"/><path d="M92 118H124M100 118V150"/>'],
      start: { H: [76, 56], N: [80, 70], E: [78, 94], W: [76, 118], P: [96, 112], K: [124, 112], F: [126, 150], T: [138, 150] },
      end: { H: [76, 56], N: [80, 70], E: [78, 94], W: [97, 81], P: [96, 112], K: [124, 112], F: [126, 150], T: [138, 150] },
      gear: 'db',
      cues: ['Sit back on an incline bench and let your arms hang straight.', 'Curl up without moving your upper arms forward.', 'Lower fully for the stretch at the bottom.'],
    },
    pushdown: {
      start: pose(STAND, { H: [104, 28], N: [103, 42], E: [101, 66], W: [117, 56] }),
      end: pose(STAND, { H: [104, 28], N: [103, 42], E: [101, 66], W: [104, 90] }),
      gear: 'cable', anchor: [122, -6],
      cues: ['Elbows pinned at your sides, slight forward lean.', 'Push down until your arms are straight.', 'Let your forearms come back up to about parallel, slowly.'],
    },
    overheadExt: {
      start: pose(STAND, { E: [106, 16], W: [90, 30] }),
      end: pose(STAND, { E: [106, 16], W: [108, -6] }),
      gear: 'db',
      cues: ['Hold one dumbbell overhead with both hands, ribs down.', 'Lower it behind your head by bending only your elbows.', 'Straighten your arms back up; keep elbows pointing forward.'],
    },
    lateral: {
      view: 'front',
      start: pose(FRONT, { E: [86, 64], W: [84, 88], E2: [114, 64], W2: [116, 88] }),
      end: pose(FRONT, { E: [76, 44], W: [54, 46], E2: [124, 44], W2: [146, 46] }),
      gear: 'db',
      cues: ['Stand tall with a slight bend in your elbows.', 'Raise the dumbbells out to the side until about shoulder height.', 'Lower slowly. Use a light weight; no shrugging or swinging.'],
    },
    facePull: {
      start: pose(STAND, { E: [124, 40], W: [148, 38] }),
      end: pose(STAND, { E: [86, 34], W: [106, 22] }),
      gear: 'cable', anchor: [196, 32],
      cues: ['Rope at about face height, arms straight to start.', 'Pull toward your face, elbows high, hands finishing beside your ears.', 'Squeeze your upper back, then return slowly.'],
    },
    squat: {
      start: pose(STAND, { E: [90, 56], W: [98, 44] }),
      end: { H: [110, 58], N: [103, 72], E: [92, 82], W: [101, 74], P: [80, 111], K: [110, 121], F: [100, 150], T: [112, 150] },
      gear: 'barTop',
      cues: ['Bar on your upper back, feet about shoulder width.', 'Sit down and back, knees tracking over your toes, chest up.', 'Go as deep as you can keep a flat back, then drive up through your whole foot.'],
    },
    goblet: {
      start: pose(STAND, { E: [104, 66], W: [112, 52] }),
      end: { H: [110, 58], N: [103, 72], E: [106, 94], W: [114, 80], P: [80, 111], K: [110, 121], F: [100, 150], T: [112, 150] },
      gear: 'db',
      cues: ['Hold one dumbbell upright against your chest.', 'Squat down between your knees, keeping your chest tall.', 'Stand up by pushing the floor away.'],
    },
    hinge: {
      start: pose(STAND, { E: [105, 66], W: [108, 88] }),
      end: { H: [133, 56], N: [121, 62], E: [122, 84], W: [122, 107], P: [82, 92], K: [100, 121], F: [100, 150], T: [112, 150] },
      gear: 'bar',
      cues: ['Soft knees, bar close to your legs.', 'Push your hips back and lower the bar along your thighs with a flat back.', 'Stop when you feel a strong hamstring stretch, then drive your hips forward to stand.'],
    },
    legPress: {
      props: ['<path d="M30 70L58 118H90" stroke-width="7"/><path d="M60 118V150"/>'],
      start: { H: [38, 66], N: [46, 80], E: [60, 96], W: [72, 106], P: [72, 112], K: [86, 72], F: [112, 90], T: [118, 80] },
      end: { H: [38, 66], N: [46, 80], E: [60, 96], W: [72, 106], P: [72, 112], K: [104, 92], F: [130, 70], T: [136, 60] },
      gear: 'plate',
      cues: ['Back flat on the pad, feet shoulder width on the platform.', 'Lower until your knees are comfortably bent, without your lower back rounding.', 'Press back up without locking your knees hard.'],
    },
    lunge: {
      start: pose(STAND, { E: [105, 66], W: [107, 88], K2: [96, 120], F2: [94, 150] }),
      end: { H: [100, 44], N: [100, 58], E: [100, 82], W: [100, 104], P: [100, 104], K: [124, 120], F: [124, 150], T: [136, 150], K2: [88, 144], F2: [64, 148] },
      gear: 'db',
      cues: ['Take a long step forward and keep your torso upright.', 'Lower until your back knee nearly touches the floor.', 'Push through your front foot and step through into the next lunge.'],
    },
    splitSquat: {
      props: ['<rect x="30" y="112" width="34" height="7" rx="3"/><path d="M47 119V150"/>'],
      start: { H: [104, 30], N: [104, 44], E: [104, 68], W: [104, 90], P: [100, 92], K: [116, 120], F: [116, 150], T: [128, 150], K2: [84, 124], F2: [56, 112] },
      end: { H: [104, 52], N: [104, 66], E: [104, 90], W: [104, 112], P: [98, 112], K: [124, 126], F: [116, 150], T: [128, 150], K2: [82, 140], F2: [56, 112] },
      gear: 'db',
      cues: ['Back foot on a bench, front foot far enough forward to stay balanced.', 'Lower straight down until your front thigh is near parallel.', 'Drive up through your front foot. Do all reps, then switch legs.'],
    },
    calf: {
      start: pose(STAND, { E: [105, 66], W: [107, 88] }),
      end: { ...up(pose(STAND, { E: [105, 66], W: [107, 88] }), 9), F: [103, 142], T: [112, 150] },
      cues: ['Stand on the edge of a step if possible, legs straight.', 'Rise as high as you can onto your toes and pause.', 'Lower slowly below the step level for a full stretch.'],
    },
    seatedCalf: {
      props: ['<rect x="72" y="104" width="34" height="7" rx="3"/><path d="M88 111V150"/>'],
      start: { H: [90, 42], N: [88, 56], E: [100, 78], W: [116, 96], P: [90, 104], K: [122, 102], F: [124, 140], T: [136, 142] },
      end: { H: [90, 42], N: [88, 56], E: [100, 74], W: [116, 90], P: [90, 104], K: [122, 94], F: [122, 132], T: [136, 141] },
      gear: 'pad',
      cues: ['Pad resting on your thighs just above the knees, balls of your feet on the platform.', 'Push up onto your toes as high as you can.', 'Lower your heels slowly for a full stretch.'],
    },
    legCurl: {
      props: ['<rect x="26" y="106" width="120" height="7" rx="3"/><path d="M40 113V150M130 113V150"/>'],
      start: { H: [32, 94], N: [46, 100], E: [56, 116], W: [42, 118], P: [94, 100], K: [126, 100], F: [158, 100], T: [164, 108] },
      end: { H: [32, 94], N: [46, 100], E: [56, 116], W: [42, 118], P: [94, 100], K: [126, 100], F: [134, 70], T: [144, 66] },
      gear: 'padAnkle',
      cues: ['Lie face down with the pad just above your heels.', 'Curl your heels toward your glutes while keeping your hips down.', 'Lower slowly until your legs are almost straight.'],
    },
    legExt: {
      props: ['<rect x="72" y="106" width="40" height="7" rx="3"/><path d="M76 106L70 58" stroke-width="7"/><path d="M90 113V150"/>'],
      start: { H: [86, 44], N: [86, 58], E: [92, 82], W: [100, 104], P: [90, 106], K: [122, 106], F: [124, 140], T: [134, 144] },
      end: { H: [86, 44], N: [86, 58], E: [92, 82], W: [100, 104], P: [90, 106], K: [122, 106], F: [154, 102], T: [158, 92] },
      gear: 'padAnkle',
      cues: ['Sit back with the pad on the front of your lower shins.', 'Straighten your legs fully and squeeze your thighs.', 'Lower slowly to the start without letting the weight drop.'],
    },
  };

  const MAP = [
    [/bench press/i, 'bench'], [/incline dumbbell press/i, 'incline'], [/chest-supported/i, 'supportedRow'],
    [/bent-over row/i, 'row'], [/overhead press/i, 'overhead'], [/pull-ups?/i, 'pullup'], [/pulldown/i, 'pulldown'],
    [/cable flyes?/i, 'fly'], [/crossover/i, 'crossover'], [/incline DB biceps curl/i, 'inclineCurl'],
    [/hammer curl/i, 'hammer'], [/biceps curl/i, 'curl'], [/pushdown/i, 'pushdown'], [/overhead extension/i, 'overheadExt'],
    [/lateral raise/i, 'lateral'], [/face pull|reverse fly/i, 'facePull'], [/goblet/i, 'goblet'], [/back squat/i, 'squat'],
    [/Romanian/i, 'hinge'], [/leg press/i, 'legPress'], [/lunge/i, 'lunge'], [/Bulgarian/i, 'splitSquat'],
    [/seated calf/i, 'seatedCalf'], [/calf raise/i, 'calf'], [/leg curl/i, 'legCurl'], [/leg extension/i, 'legExt'],
  ];
  const patternFor = (name) => P[(MAP.find(([re]) => re.test(name)) || [])[1]] || null;

  const SEGMENTS = [['N', 'P'], ['N', 'E'], ['E', 'W'], ['P', 'K'], ['K', 'F'], ['F', 'T'], ['N', 'E2'], ['E2', 'W2'], ['P', 'K2'], ['K2', 'F2']];
  const DUR = '3.2s';
  const KEYS = '0;0.38;0.5;0.88;1';
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Attribute that moves from start to end and back, or a fixed value.
  function attr(name, a, b, animate) {
    if (!animate || a === b) return { fixed: `${name}="${a}"`, anim: '' };
    return { fixed: `${name}="${a}"`, anim: `<animate attributeName="${name}" values="${a};${b};${b};${a};${a}" keyTimes="${KEYS}" dur="${DUR}" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;0 0 1 1;.45 0 .55 1;0 0 1 1"/>` };
  }

  function line(a, b, A, B, animate, cls = 'limb') {
    const parts = [attr('x1', a[0], A[0], animate), attr('y1', a[1], A[1], animate), attr('x2', b[0], B[0], animate), attr('y2', b[1], B[1], animate)];
    return `<line class="${cls}" ${parts.map((p) => p.fixed).join(' ')}>${parts.map((p) => p.anim).join('')}</line>`;
  }

  function dot(a, A, r, cls, animate) {
    const cx = attr('cx', a[0], A[0], animate), cy = attr('cy', a[1], A[1], animate);
    return `<circle class="${cls}" r="${r}" ${cx.fixed} ${cy.fixed}>${cx.anim}${cy.anim}</circle>`;
  }

  /** One frame (animate=false, using `which`) or the looping animation. */
  function drawing(p, animate, which = 'start') {
    const s = which === 'end' && !animate ? p.end : p.start;
    const e = animate ? p.end : s;
    let out = `<g class="props">${(p.props || []).join('')}</g><line class="floor" x1="0" y1="152" x2="200" y2="152"/>`;
    if (p.gear === 'cable') {
      out += line(p.anchor, s.W, p.anchor, e.W, animate, 'cable');
      if (p.anchor2 && s.W2) out += line(p.anchor2, s.W2, p.anchor2, e.W2, animate, 'cable');
    }
    for (const [j1, j2] of SEGMENTS) {
      if (s[j1] && s[j2]) out += line(s[j1], s[j2], e[j1], e[j2], animate, j2.endsWith('2') && p.view !== 'front' ? 'limb far' : 'limb');
    }
    out += dot(s.H, e.H, 9, 'head', animate);
    const gear = { bar: [7, 'W'], barTop: [7, 'W'], db: [5, 'W'], plate: [8, 'F'], pad: [6, 'K'], padAnkle: [6, 'F'] }[p.gear];
    if (gear) {
      const [r, joint] = gear;
      out += dot(s[joint], e[joint], r, 'gear', animate);
      if (p.view === 'front' && s.W2 && joint === 'W') out += dot(s.W2, e.W2, r, 'gear', animate);
    }
    return out;
  }

  const svg = (inner, label, cls = '') =>
    `<svg class="movefig ${cls}" viewBox="0 -12 200 168" role="img" aria-label="${label}">${inner}</svg>`;

  /** Small always-visible figure for the exercise header. */
  function thumb(name) {
    const p = patternFor(name);
    if (!p) return '';
    const animate = !reduceMotion();
    return svg(drawing(p, animate), `${name}: ${animate ? 'animated' : 'start position'} movement figure`, 'thumb');
  }

  /** Larger figure plus start/finish frames, cues and demo links. */
  function guide(name) {
    const p = patternFor(name);
    if (!p) return '';
    const animate = !reduceMotion();
    const demo = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form`)}`;
    return `<div class="moveguide">
      <div class="moveframes">
        ${animate ? `<figure>${svg(drawing(p, true), `${name}: moving between start and finish`)}<figcaption>Moving: start ↔ finish</figcaption></figure>` : ''}
        <figure>${svg(drawing(p, false, 'start'), `${name}: start position`)}<figcaption>Start</figcaption></figure>
        <figure>${svg(drawing(p, false, 'end'), `${name}: finish position`)}<figcaption>Finish</figcaption></figure>
      </div>
      <ol class="movecues">${p.cues.map((c) => `<li>${c}</li>`).join('')}</ol>
      <p class="small">Simple figures show the path of the movement, not perfect technique. <a href="${demo}" target="_blank" rel="noopener">Watch a demonstration ↗</a></p>
    </div>`;
  }

  return { thumb, guide, has: (name) => Boolean(patternFor(name)), patterns: P, patternFor };
})();
globalThis.Movement = Movement;
