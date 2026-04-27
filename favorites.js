/**
 * favorites.js – Lieblingsorte verwalten (LocalStorage)
 *
 * Kein Backend, kein Login. Alle Daten bleiben auf dem Gerät.
 */

const Favorites = {

  _KEY: 'sonnencheck_favorites',

  /**
   * Gibt alle gespeicherten Favoriten zurück.
   * @returns {{ id: string, name: string, lat: number, lng: number }[]}
   */
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this._KEY) || '[]');
    } catch (_) {
      return [];
    }
  },

  /**
   * Speichert einen neuen Favorit.
   * @param {string} name
   * @param {number} lat
   * @param {number} lng
   * @returns {string} ID des neuen Favoriten
   */
  save(name, lat, lng) {
    const favs = this.getAll();
    const id = Date.now().toString(36);
    favs.push({ id, name, lat, lng });
    this._write(favs);
    return id;
  },

  /**
   * Löscht einen Favorit anhand seiner ID.
   * @param {string} id
   */
  delete(id) {
    const favs = this.getAll().filter(f => f.id !== id);
    this._write(favs);
  },

  /**
   * Prüft, ob an einem Ort (±0.001°) bereits ein Favorit existiert.
   * @param {number} lat
   * @param {number} lng
   * @returns {boolean}
   */
  exists(lat, lng) {
    return this.getAll().some(f =>
      Math.abs(f.lat - lat) < 0.001 && Math.abs(f.lng - lng) < 0.001
    );
  },

  _write(favs) {
    try {
      localStorage.setItem(this._KEY, JSON.stringify(favs));
    } catch (_) {}
  }
};
