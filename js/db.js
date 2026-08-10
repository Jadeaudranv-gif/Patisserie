// db.js — petite couche au-dessus d'IndexedDB, pas de dépendance externe.
// Toutes les fonctions renvoient des Promises pour rester simple à consommer.

const DB_NAME = 'atelier-patisserie';
const DB_VERSION = 2;

const STORES = {
  ingredients: 'id',
  parametres: 'id',
  recettes: 'id',
  gateaux: 'id',
  commandes: 'id',
  categories: 'id',
};

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.entries(STORES).forEach(([storeName, keyPath]) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath, autoIncrement: true });
        }
      });
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  // ---- CRUD générique ----
  getAll(storeName) {
    return tx(storeName).then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  },

  get(storeName, id) {
    return tx(storeName).then(
      (store) =>
        new Promise((resolve, reject) => {
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  },

  put(storeName, value) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
          const req = store.put(value);
          req.onsuccess = () => resolve(req.result); // renvoie l'id
          req.onerror = () => reject(req.error);
        })
    );
  },

  delete(storeName, id) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
          const req = store.delete(id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    );
  },

  // ---- Paramètres : enregistrement unique (id = 1) ----
  async getParametres() {
    const p = await this.get('parametres', 1);
    return (
      p || {
        id: 1,
        grammesParPart: 100,
        coefficientMarge: 3,
        societeNom: '',
        societeContact: '',
      }
    );
  },

  saveParametres(data) {
    return this.put('parametres', { ...data, id: 1 });
  },

  // ---- Catégories : partagées par « ingredient » (Inventaire) et « recette » (Recettes) ----
  async getCategories(type) {
    const toutes = await this.getAll('categories');
    return toutes.filter((c) => c.type === type).sort((a, b) => a.nom.localeCompare(b.nom));
  },

  async ajouterCategorie(type, nom) {
    const id = await this.put('categories', { type, nom });
    return { id, type, nom };
  },
};