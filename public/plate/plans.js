// Personal targets and a seven-day Ethiopian meal plan for each goal.
// Targets use the Mifflin-St Jeor equation; meals are fixed templates whose
// portions are scaled so each day lands near the person's calories and protein.
// Nutrition values are estimates per 100 g (home recipes and oil vary).
(() => {
  // key: [name, kcal, protein, carbs, fat per 100 g, grams per unit, [unit one, unit many], role]
  // role p = protein source (scaled to protein), e = energy (scaled to calories), v = vegetables (fixed)
  const FOODS = {
    injera: ['injera', 166, 5, 34, 1, 130, ['injera', 'injera'], 'e'],
    egg: ['boiled egg', 155, 12.6, 1.1, 10.6, 50, ['boiled egg', 'boiled eggs'], 'p'],
    eggWhite: ['egg whites', 52, 11, 0.7, 0.2, null, null, 'p'],
    doro: ['Doro (chicken breast)', 165, 31, 0, 3.6, null, null, 'p'],
    tibs: ['lean Siga Tibs (beef)', 200, 27, 1, 10, null, null, 'p'],
    asa: ['Asa Tibs (fish)', 150, 24, 2, 5, null, null, 'p'],
    ayib: ['Ayib', 98, 11, 3.4, 4.3, null, null, 'p'],
    ergo: ['Ergo', 61, 3.5, 4.7, 3.3, null, null, 'p'],
    shiro: ['Shiro wot', 140, 6, 16, 6, null, null, 'p'],
    misir: ['Misir wot (red lentils)', 120, 7, 16, 3, null, null, 'p'],
    kik: ['Kik alicha (split peas)', 110, 7, 17, 2, null, null, 'p'],
    ful: ['Ful (fava beans)', 130, 7, 16, 4, null, null, 'p'],
    shimbra: ['boiled chickpeas (shimbra)', 164, 8.9, 27.4, 2.6, null, null, 'p'],
    gomen: ['Gomen (collard greens)', 50, 3, 7, 2, null, null, 'v'],
    atkilt: ['Atkilt wot (cabbage, potato & carrot)', 70, 1.5, 10, 3, null, null, 'v'],
    salata: ['salata (tomato & cucumber)', 20, 1, 4, 0.2, null, null, 'v'],
    kinche: ['kinche or oats (dry)', 360, 12, 68, 4, null, null, 'e'],
    dabo: ['Dabo (bread)', 265, 9, 49, 3.2, 35, ['slice Dabo', 'slices Dabo'], 'e'],
    potato: ['boiled potato', 87, 1.9, 20, 0.1, null, null, 'e'],
    sweetPotato: ['boiled sweet potato', 76, 1.4, 17.7, 0.1, null, null, 'e'],
    banana: ['banana', 89, 1.1, 22.8, 0.3, 120, ['banana', 'bananas'], 'e'],
    orange: ['orange', 47, 0.9, 12, 0.1, 150, ['orange', 'oranges'], 'e'],
    apple: ['apple', 52, 0.3, 13.8, 0.2, 180, ['apple', 'apples'], 'e'],
    mango: ['mango', 60, 0.8, 15, 0.4, 200, ['mango', 'mangoes'], 'e'],
    peanuts: ['roasted peanuts (lewz)', 567, 26, 16, 49, null, null, 'e'],
    pb: ['peanut butter', 588, 25, 20, 50, 16, ['tbsp peanut butter', 'tbsp peanut butter'], 'e'],
    avocado: ['avocado', 160, 2, 8.5, 14.7, null, null, 'e'],
    kolo: ['Kolo (roasted barley)', 400, 12, 70, 6, null, null, 'e'],
  };

  // Five meals a day: breakfast, lunch, afternoon / pre-workout, dinner, night snack.
  // Amounts are units for foods with a unit size, grams otherwise. Built around ~2,000 kcal.
  const REGULAR = [
    [[['egg', 3], ['kinche', 50], ['banana', 1]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['eggWhite', 150], ['apple', 1], ['pb', 1]], [['asa', 180], ['potato', 150], ['gomen', 150]], [['ergo', 200], ['peanuts', 15]]],
    [[['ayib', 150], ['dabo', 2], ['orange', 1]], [['tibs', 170], ['sweetPotato', 150], ['gomen', 150]], [['ergo', 200], ['banana', 1], ['pb', 1]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['eggWhite', 120], ['egg', 1]]],
    [[['egg', 2], ['eggWhite', 120], ['kinche', 50]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['ayib', 150], ['apple', 1], ['peanuts', 15]], [['tibs', 170], ['potato', 150], ['gomen', 150]], [['ergo', 200], ['pb', 1]]],
    [[['ergo', 250], ['banana', 1], ['kinche', 40]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['eggWhite', 120], ['apple', 1]], [['asa', 180], ['sweetPotato', 130], ['atkilt', 150]], [['ayib', 150], ['orange', 1]]],
    [[['egg', 3], ['dabo', 2], ['avocado', 50]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['ayib', 150], ['kinche', 40]], [['tibs', 170], ['potato', 180], ['atkilt', 150]], [['ergo', 200], ['peanuts', 15]]],
    [[['kinche', 50], ['eggWhite', 150], ['pb', 1]], [['asa', 180], ['injera', 1.5], ['gomen', 150]], [['ergo', 200], ['banana', 1]], [['doro', 180], ['sweetPotato', 150], ['salata', 150]], [['eggWhite', 120], ['peanuts', 20]]],
    [[['egg', 3], ['dabo', 2], ['banana', 1]], [['doro', 180], ['injera', 1.5], ['salata', 150]], [['doro', 120], ['orange', 1], ['peanuts', 15]], [['tibs', 170], ['injera', 1], ['gomen', 150]], [['ayib', 150], ['pb', 1]]],
  ];

  // Fasting (tsom) days: no meat, eggs or dairy.
  const FASTING = [
    [[['ful', 200], ['dabo', 2], ['salata', 100]], [['shiro', 200], ['injera', 1.5], ['gomen', 150]], [['shimbra', 100], ['orange', 1]], [['misir', 200], ['injera', 1], ['atkilt', 150]], [['peanuts', 25], ['banana', 1]]],
    [[['kinche', 60], ['pb', 1], ['banana', 1]], [['misir', 200], ['injera', 1.5], ['salata', 150]], [['kolo', 30], ['mango', 1]], [['kik', 200], ['injera', 1], ['gomen', 150]], [['shimbra', 100], ['apple', 1]]],
    [[['ful', 200], ['dabo', 2], ['avocado', 50]], [['shiro', 200], ['injera', 1.5], ['atkilt', 150]], [['peanuts', 25], ['orange', 1]], [['misir', 200], ['potato', 150], ['gomen', 150]], [['shimbra', 100], ['banana', 1]]],
    [[['kinche', 60], ['peanuts', 15], ['apple', 1]], [['kik', 200], ['injera', 1.5], ['salata', 150]], [['shimbra', 120], ['orange', 1]], [['shiro', 200], ['injera', 1], ['gomen', 150]], [['pb', 1], ['banana', 1]]],
    [[['ful', 200], ['dabo', 2], ['salata', 100]], [['misir', 200], ['injera', 1.5], ['gomen', 150]], [['kolo', 30], ['banana', 1]], [['shiro', 200], ['sweetPotato', 150], ['atkilt', 150]], [['shimbra', 100], ['apple', 1]]],
    [[['kinche', 60], ['pb', 1], ['orange', 1]], [['shiro', 200], ['injera', 1.5], ['salata', 150]], [['shimbra', 120], ['mango', 1]], [['kik', 200], ['injera', 1], ['gomen', 150]], [['peanuts', 25], ['banana', 1]]],
    [[['ful', 200], ['dabo', 2], ['avocado', 50]], [['misir', 200], ['injera', 1.5], ['atkilt', 150]], [['kolo', 30], ['orange', 1]], [['shiro', 200], ['injera', 1], ['gomen', 150]], [['shimbra', 100], ['banana', 1]]],
  ];

  const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };
  const GOALS = {
    lose: { label: 'Lose weight', protein: 1.8 },
    gain: { label: 'Build muscle', protein: 1.8 },
    recomp: { label: 'Lose fat and build muscle', protein: 2.0 },
    maintain: { label: 'Stay healthy at my weight', protein: 1.6 },
  };
  const round = (n, step) => Math.round(n / step) * step;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /** Daily calories and macros from body size, activity and goal. */
  function targets({ sex, age, height, weight, activity, goal }) {
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
    const tdee = bmr * (ACTIVITY[activity] || 1.375);
    const adjust = { lose: tdee * -0.2, gain: 300, recomp: -200, maintain: 0 }[goal] ?? 0;
    const kcal = round(Math.max(sex === 'male' ? 1500 : 1200, tdee + adjust), 50);
    // Protein from a healthy reference weight, so it stays sensible at higher body weights.
    const ref = Math.min(weight, 27 * (height / 100) ** 2);
    const protein = round(ref * (GOALS[goal]?.protein ?? 1.6), 5);
    const fat = round(Math.max(0.6 * ref, (kcal * 0.25) / 9), 5);
    const carbs = Math.max(50, round((kcal - protein * 4 - fat * 9) / 4, 5));
    return { kcal, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee) };
  }

  const fastingDay = (fasting, weekday) => fasting === 'all' || (fasting === 'wedfri' && (weekday === 2 || weekday === 4));

  function nutrients(key, amount) {
    const f = FOODS[key], grams = f[5] ? amount * f[5] : amount;
    return [1, 2, 3, 4].map((i) => (f[i] * grams) / 100);
  }
  const sum = (rows) => rows.reduce((t, r) => t.map((x, i) => x + r[i]), [0, 0, 0, 0]);

  function roundAmount(key, amount) {
    const f = FOODS[key];
    if (key === 'injera') return clamp(round(amount, 0.5), 0.5, 4);
    if (f[7] === 'v') return amount;
    if (f[5]) return clamp(Math.round(amount), 1, 6);
    return amount < 60 ? clamp(round(amount, 5), 5, 60) : clamp(round(amount, 10), 60, 600);
  }

  function describe(key, amount) {
    const f = FOODS[key];
    if (!f[6]) return `${amount} g ${f[0]}`;
    return `${amount} ${amount === 1 ? f[6][0] : f[6][1]}`;
  }

  /**
   * One day of meals for a weekday (Monday = 0), scaled to the targets:
   * protein sources toward the protein target, energy foods toward calories.
 * Fasting days (no animal foods) are scaled to calories only and run lower in protein.
   */
  function day(weekday, goals, fasting = 'none') {
    const fast = fastingDay(fasting, weekday);
    const template = (fast ? FASTING : REGULAR)[weekday];
    const all = template.flat();
    const part = (role) => sum(all.filter(([k]) => FOODS[k][7] === role).map(([k, a]) => nutrients(k, a)));
    const [p, e, v] = ['p', 'e', 'v'].map(part);
    let fp = 1, fe = 1;
    if (fast) {
      // Plant proteins come with plenty of energy, so fasting days scale everything to calories.
      fp = fe = clamp((goals.kcal - v[0]) / (p[0] + e[0]), 0.4, 2.5);
    } else {
      for (let i = 0; i < 4; i++) {
        fp = clamp((goals.protein - v[1] - fe * e[1]) / p[1], 0.6, 2);
        fe = clamp((goals.kcal - v[0] - fp * p[0]) / e[0], 0.4, 2.5);
      }
    }
    const meals = template.map((items) => {
      const scaled = items.map(([k, a]) => {
        const role = FOODS[k][7];
        const amount = roundAmount(k, role === 'p' ? a * fp : role === 'e' ? a * fe : a);
        return { key: k, amount, text: describe(k, amount), totals: nutrients(k, amount) };
      });
      return { text: scaled.map((s) => s.text).join(' + '), items: scaled, totals: sum(scaled.map((s) => s.totals)) };
    });
    return { fasting: fast, meals, totals: sum(meals.map((m) => m.totals)) };
  }

  globalThis.Plans = { FOODS, GOALS, ACTIVITY, targets, day, fastingDay };
})();
