/**
 * weather.js – Wetterdaten via Open-Meteo · MeteoSchweiz ICON-CH1-EPS
 *
 * Kein API-Key erforderlich. Cache: 1 Stunde im localStorage.
 * Modell: MeteoSchweiz ICON-CH1-EPS – 1 km Auflösung, 33 h Vorhersage
 * Doku: https://open-meteo.com/en/docs/meteoswiss-api
 */

const Weather = {

  /**
   * Ruft Stundenwerte für den aktuellen Tag ab.
   * @returns {Promise<{ cloudCoverByHour, temperatureByHour, weatherCodeByHour }>}
   */
  async get(lat, lng) {
    const cacheKey = `msw_${Math.round(lat * 100)}_${Math.round(lng * 100)}`;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < 60 * 60 * 1000) return data;
      }
    } catch (_) {}

    const url = 'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      '&hourly=cloud_cover,temperature_2m,weather_code' +
      '&models=meteoswiss_icon_ch1' +
      '&forecast_days=1&timezone=Europe%2FZurich';

    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 6000);
      const res  = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      const h = json.hourly ?? {};
      const result = {
        cloudCoverByHour:  h.cloud_cover    ?? new Array(24).fill(0),
        temperatureByHour: h.temperature_2m ?? new Array(24).fill(null),
        weatherCodeByHour: h.weather_code   ?? new Array(24).fill(0),
      };

      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: result }));
      return result;
    } catch (err) {
      console.warn('Wetterdaten nicht verfügbar:', err.message);
      return {
        cloudCoverByHour:  new Array(24).fill(null),
        temperatureByHour: new Array(24).fill(null),
        weatherCodeByHour: new Array(24).fill(null),
      };
    }
  },

  /**
   * WMO-Wetterkode → Emoji + Kurztext
   * @param {number|null} code
   */
  describeCode(code) {
    if (code === null || code === undefined) return { icon: '🌤️', text: '—' };
    if (code === 0)                 return { icon: '☀️',  text: 'Klar' };
    if (code === 1)                 return { icon: '🌤️', text: 'Überwiegend klar' };
    if (code === 2)                 return { icon: '⛅',  text: 'Wechselnd bewölkt' };
    if (code === 3)                 return { icon: '☁️',  text: 'Bedeckt' };
    if (code === 45 || code === 48) return { icon: '🌫️', text: 'Nebel' };
    if (code >= 51 && code <= 55)   return { icon: '🌦️', text: 'Nieselregen' };
    if (code >= 61 && code <= 65)   return { icon: '🌧️', text: 'Regen' };
    if (code >= 71 && code <= 77)   return { icon: '🌨️', text: 'Schnee' };
    if (code >= 80 && code <= 82)   return { icon: '🌦️', text: 'Schauer' };
    if (code >= 85 && code <= 86)   return { icon: '🌨️', text: 'Schneeschauer' };
    if (code === 95)                return { icon: '⛈️',  text: 'Gewitter' };
    if (code === 96 || code === 99) return { icon: '⛈️',  text: 'Hagel' };
    return { icon: '🌤️', text: '—' };
  },

  /** Wert eines Arrays für eine bestimmte Stunde. */
  atHour(arr, hour) {
    return arr?.[Math.min(Math.max(0, hour), 23)] ?? null;
  },

  // Legacy-Kompatibilität (für alten Code der cloud_cover nutzt)
  describe(pct) {
    if (pct === null || pct === undefined) return { icon: '🌤️', text: '—' };
    if (pct < 15)  return { icon: '☀️',  text: 'Klar' };
    if (pct < 35)  return { icon: '🌤️', text: 'Leicht bewölkt' };
    if (pct < 65)  return { icon: '⛅',  text: 'Bewölkt' };
    if (pct < 85)  return { icon: '🌥️', text: 'Stark bewölkt' };
    return           { icon: '☁️',  text: 'Bedeckt' };
  },

  cloudAtHour(hourly, hour) {
    return hourly?.[Math.min(Math.max(0, hour), 23)] ?? 0;
  }
};
