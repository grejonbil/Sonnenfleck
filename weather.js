/**
 * weather.js – Wetterdaten via Open-Meteo API
 *
 * Kein API-Key erforderlich. Ergebnisse werden 1 Stunde in localStorage gecacht.
 * Quelle: https://open-meteo.com/
 */

const Weather = {

  /**
   * Ruft den Bewölkungsgrad für den aktuellen Tag und Ort ab.
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<{ cloudCoverByHour: number[], current: number }>}
   *   cloudCoverByHour : Bewölkung (%) pro Stunde 0–23
   *   current          : aktueller Wert (%)
   */
  async get(lat, lng) {
    const cacheKey = `weather_${Math.round(lat * 100)}_${Math.round(lng * 100)}`;

    // localStorage-Cache (1 Stunde)
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < 60 * 60 * 1000) return data;
      }
    } catch (_) {}

    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&hourly=cloud_cover&forecast_days=1&timezone=Europe%2FZurich`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      const cloudCoverByHour = json.hourly?.cloud_cover ?? new Array(24).fill(0);
      const now = new Date();
      const current = cloudCoverByHour[now.getHours()] ?? 0;
      const result = { cloudCoverByHour, current };

      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: result }));
      return result;
    } catch (err) {
      console.warn('Wetterdaten nicht verfügbar:', err.message);
      return { cloudCoverByHour: new Array(24).fill(null), current: null };
    }
  },

  /**
   * Gibt ein passendes Emoji und einen kurzen Text für einen Bewölkungsgrad zurück.
   * @param {number|null} pct – Bewölkung in Prozent (0–100) oder null
   * @returns {{ icon: string, text: string }}
   */
  describe(pct) {
    if (pct === null || pct === undefined) return { icon: '🌤️', text: '—' };
    if (pct < 15)  return { icon: '☀️',  text: 'Klar' };
    if (pct < 35)  return { icon: '🌤️', text: 'Leicht bewölkt' };
    if (pct < 65)  return { icon: '⛅',  text: 'Bewölkt' };
    if (pct < 85)  return { icon: '🌥️', text: 'Stark bewölkt' };
    return           { icon: '☁️',  text: 'Bedeckt' };
  },

  /**
   * Gibt den Bewölkungsgrad für eine bestimmte Stunde zurück.
   * @param {number[]} hourly – Array mit 24 Werten
   * @param {number}   hour   – Stunde (0–23)
   * @returns {number}
   */
  cloudAtHour(hourly, hour) {
    return hourly?.[Math.min(Math.max(0, hour), 23)] ?? 0;
  }
};
