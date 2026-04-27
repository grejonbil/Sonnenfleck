/**
 * sun.js – Sonnenberechnung (SunCalc-Wrapper)
 *
 * SunCalc-Azimuth-Konvention: 0 = Süden, positive Werte = westwärts,
 * negative Werte = ostwärts (gemessen im Uhrzeigersinn vom Süden aus).
 */

const Sun = {

  /**
   * Berechnet Azimut und Elevation der Sonne für Ort und Zeit.
   * @param {Date}   date  – Zeitpunkt
   * @param {number} lat   – Breitengrad (Grad)
   * @param {number} lng   – Längengrad (Grad)
   * @returns {{ azimuth: number, altitude: number }}
   *   azimuth  : Radianten (0=Süd, +π/2=West, -π/2=Ost)
   *   altitude : Radianten über dem Horizont
   */
  getPosition(date, lat, lng) {
    const pos = SunCalc.getPosition(date, lat, lng);
    return { azimuth: pos.azimuth, altitude: pos.altitude };
  },

  /**
   * Gibt Sonnenaufgang und -untergang zurück.
   * @param {Date}   date
   * @param {number} lat
   * @param {number} lng
   * @returns {{ sunrise: Date, sunset: Date }}
   */
  getDaylight(date, lat, lng) {
    const times = SunCalc.getTimes(date, lat, lng);
    return { sunrise: times.sunrise, sunset: times.sunset };
  },

  /**
   * Ist die Sonne gerade über dem Horizont?
   * @param {Date}   date
   * @param {number} lat
   * @param {number} lng
   * @returns {boolean}
   */
  isUp(date, lat, lng) {
    return this.getPosition(date, lat, lng).altitude > 0;
  },

  /**
   * Findet (ab einem Startzeit) den nächsten Wechsel von Sonne ↔ Schatten
   * an einem Punkt, basierend auf einer Prüffunktion.
   *
   * @param {Date}     startDate    – Startzeit der Suche
   * @param {Function} isInShadow   – (date) => boolean
   * @param {number}   lat
   * @param {number}   lng
   * @param {boolean}  currentState – aktueller Schattenzustand
   * @returns {Date|null} Zeitpunkt des nächsten Wechsels oder null
   */
  findNextChange(startDate, isInShadow, lat, lng, currentState) {
    const STEP_MS = 5 * 60 * 1000; // 5-Minuten-Schritte
    const MAX_MS  = 12 * 60 * 60 * 1000; // max. 12 Stunden vorausschauen

    let t = new Date(startDate.getTime() + STEP_MS);
    const end = new Date(startDate.getTime() + MAX_MS);

    // Sonne muss oben sein – sonst kein Wechsel möglich
    if (!this.isUp(startDate, lat, lng)) return null;

    while (t < end) {
      if (!this.isUp(t, lat, lng)) return null; // Sonnenuntergang
      const shadow = isInShadow(t);
      if (shadow !== currentState) return t;
      t = new Date(t.getTime() + STEP_MS);
    }
    return null;
  },

  /**
   * Formatiert eine Date-Instanz als "HH:MM".
   * @param {Date} date
   * @returns {string}
   */
  formatTime(date) {
    if (!date || isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  },

  /**
   * Erstellt ein Date-Objekt mit Datum aus `base` und Uhrzeit in Minuten.
   * @param {Date}   base
   * @param {number} minutes – Minuten seit Mitternacht
   * @returns {Date}
   */
  dateAtMinutes(base, minutes) {
    const d = new Date(base);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
  }
};
