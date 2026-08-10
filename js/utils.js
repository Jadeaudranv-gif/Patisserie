// utils.js — formatage & calculs partagés entre les vues

function formatPrix(valeur) {
  const n = Number(valeur) || 0;
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

// Prix avec décimales étendues, pour les prix unitaires très petits
// (ex. coût d'1 gramme d'un ingrédient acheté au kilo : 0,00002 €).
// On affiche juste assez de décimales pour voir un chiffre significatif,
// avec un plafond raisonnable pour rester lisible.
function formatPrixDetail(valeur) {
  const n = Number(valeur) || 0;
  if (n === 0) return (0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  let decimales = 2;
  let abs = Math.abs(n);
  while (abs < 1 && decimales < 6) {
    abs *= 10;
    if (abs >= 1) break;
    decimales++;
  }
  return n.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

// Nombre avec un nombre de décimales adapté (utile pour les conversions kg/L),
// sans zéros inutiles à la fin.
function formatNombre(valeur, maxDecimales = 3) {
  const n = Number(valeur) || 0;
  const facteur = 10 ** maxDecimales;
  const arrondi = Math.round(n * facteur) / facteur;
  return arrondi.toLocaleString('fr-FR', { maximumFractionDigits: maxDecimales });
}

// Affiche une quantité stockée en unité de base (gramme, millilitre ou unité)
// en la remettant à l'échelle la plus lisible (kg / L au-delà de 1000).
function formatQuantite(valeur, type) {
  const n = Number(valeur) || 0;
  if (type === 'unite') {
    const arrondi = Math.round(n * 100) / 100;
    return `${arrondi} ${arrondi > 1 ? 'unités' : 'unité'}`;
  }
  if (type === 'volume') {
    return n >= 1000 ? `${formatNombre(n / 1000, 3)} L` : `${formatNombre(n, 2)} ml`;
  }
  // poids (par défaut)
  return n >= 1000 ? `${formatNombre(n / 1000, 3)} kg` : `${formatNombre(n, 2)} g`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

/**
 * Calcule le coût matière première d'une recette pour un nombre de personnes donné,
 * en utilisant le facteur d'échelle (personnesVoulues / recette.nombrePersonnes).
 * Retourne aussi le détail des ingrédients mis à l'échelle.
 */
function calculerCoutRecette(recette, ingredientsIndex, personnesVoulues) {
  const facteur = personnesVoulues && recette.nombrePersonnes
    ? personnesVoulues / recette.nombrePersonnes
    : 1;

  const lignes = (recette.ingredients || []).map((ligne) => {
    const ingredient = ingredientsIndex[ligne.ingredientId];
    const quantiteAjustee = (Number(ligne.quantite) || 0) * facteur;
    const prixUnitaire = ingredient ? Number(ingredient.prixUnitaire) || 0 : 0;
    const cout = quantiteAjustee * prixUnitaire;
    return {
      ingredientId: ligne.ingredientId,
      nom: ingredient ? ingredient.nom : 'Ingrédient supprimé',
      type: ingredient ? ingredient.type : 'poids',
      quantite: quantiteAjustee,
      prixUnitaire,
      cout,
    };
  });

  const coutTotal = lignes.reduce((acc, l) => acc + l.cout, 0);
  return { facteur, lignes, coutTotal };
}

/**
 * Calcule le récapitulatif complet d'un gâteau : pour chaque recette qui le compose,
 * met à l'échelle selon le nombre de parts du gâteau, puis fusionne les ingrédients
 * identiques pour une liste d'achat propre.
 */
function calculerCoutGateau(gateau, recettesIndex, ingredientsIndex) {
  const detailParRecette = [];
  const fusion = new Map(); // ingredientId -> { nom, type, quantite, prixUnitaire, cout }

  (gateau.composants || []).forEach((comp) => {
    const recette = recettesIndex[comp.recetteId];
    if (!recette) return;
    const { facteur, lignes, coutTotal } = calculerCoutRecette(
      recette,
      ingredientsIndex,
      gateau.nombreParts
    );
    detailParRecette.push({ recetteId: recette.id, nom: recette.nom, facteur, lignes, coutTotal });

    lignes.forEach((l) => {
      if (!l.ingredientId) return;
      if (fusion.has(l.ingredientId)) {
        const existant = fusion.get(l.ingredientId);
        existant.quantite += l.quantite;
        existant.cout += l.cout;
      } else {
        fusion.set(l.ingredientId, { ...l });
      }
    });
  });

  const ingredientsRecap = Array.from(fusion.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  const coutMatierePremiere = ingredientsRecap.reduce((acc, l) => acc + l.cout, 0);
  const poidsEstime = gateau.nombreParts ? gateau.nombreParts : 0;

  return { detailParRecette, ingredientsRecap, coutMatierePremiere, poidsEstime };
}

function calculerPrixVente(coutMatierePremiere, coefficientMarge) {
  return coutMatierePremiere * (Number(coefficientMarge) || 1);
}

const LIBELLES_STATUT = {
  attente: 'En attente',
  valide: 'Validé',
  en_cours: 'En cours',
  termine: 'Terminé',
};