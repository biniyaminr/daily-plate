// Calendar-day helpers. Benji's days follow Africa/Addis_Ababa (UTC+3, no DST),
// whatever timezone the device is set to. Dates are plain 'YYYY-MM-DD' strings;
// arithmetic happens in UTC so it can never shift a day.
(() => {
  const TIME_ZONE = 'Africa/Addis_Ababa';
  const pattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

  function today(now = new Date()) {
    return formatter.format(now);
  }

  function parse(ymd) {
    const match = pattern.exec(ymd);
    if (!match) return null;
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3] ? date : null;
  }

  function isValid(ymd) {
    return typeof ymd === 'string' && parse(ymd) !== null;
  }

  function addDays(ymd, days) {
    const date = parse(ymd);
    if (!date) return ymd;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  /** Monday = 0 … Sunday = 6, matching the meal and training plan order. */
  function weekday(ymd) {
    const date = parse(ymd);
    return date ? (date.getUTCDay() + 6) % 7 : 0;
  }

  /** Whole days from a to b (b - a). */
  function daysBetween(a, b) {
    const from = parse(a), to = parse(b);
    return from && to ? Math.round((to - from) / 86400000) : 0;
  }

  globalThis.PlateDate = { TIME_ZONE, today, isValid, addDays, weekday, daysBetween };
})();
