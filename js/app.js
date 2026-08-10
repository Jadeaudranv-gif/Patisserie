
route('#/', renderCommandes);
route('#/commandes', renderCommandes);
route('#/commandes/:id', renderCommandeDetail);
route('#/gateaux', renderGateaux);
route('#/recettes', renderRecettes);
route('#/inventaire', renderInventaire);
route('#/parametres', renderParametres);
route('#/devis/:id', renderDevis);

startRouter('#/commandes');

// Enregistrement du service worker pour un fonctionnement hors-ligne (best effort)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* silencieux : l'app fonctionne aussi sans le service worker */
    });
  });
}
