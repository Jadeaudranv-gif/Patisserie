async function renderRecettes() {
  const view = document.getElementById('app-view');
  const [recettes, ingredients, categories] = await Promise.all([
    DB.getAll('recettes'),
    DB.getAll('ingredients'),
    DB.getCategories('recette'),
  ]);
  const ingredientsIndex = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const categoriesIndex = Object.fromEntries(categories.map((c) => [c.id, c]));

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow">Atelier · Fiches de base</span>
      <div class="page-head-row">
        <div>
          <h1>Recettes</h1>
          <p class="page-desc">Une recette de base, pour un nombre de personnes donné. Elle sera automatiquement mise à l'échelle plus tard, selon le nombre de parts du gâteau.</p>
        </div>
        <button class="btn btn-primary" id="btn-nouvelle-recette" ${ingredients.length === 0 ? 'disabled' : ''}>+ Nouvelle recette</button>
      </div>
      ${ingredients.length === 0 ? '<p class="field-hint" style="color:var(--color-accent);">Ajoutez d\'abord des ingrédients dans l\'Inventaire.</p>' : ''}
    </div>

    <div class="page-head-row" style="align-items:center; margin-bottom:2px;">
      <div class="search-bar" style="margin-bottom:0; flex:1;">
        <input type="text" id="recherche-recette" placeholder="Rechercher une recette ou un type...">
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-gerer-types" style="white-space:nowrap;">Gérer les types</button>
    </div>

    <div class="grid-cards" id="recettes-zone" style="margin-top:18px;"></div>
  `;

  document.getElementById('btn-nouvelle-recette').addEventListener('click', () => ouvrirFormulaireRecette(ingredients, categories));
  document.getElementById('btn-gerer-types').addEventListener('click', () => ouvrirGestionTypesRecette(categories, recettes));

  const zone = document.getElementById('recettes-zone');
  const rechercheInput = document.getElementById('recherche-recette');

  function dessiner() {
    if (recettes.length === 0) {
      zone.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Aucune recette pour l'instant</h3>
          <p>Créez votre première fiche recette de base.</p>
        </div>`;
      return;
    }

    const terme = rechercheInput.value.trim().toLowerCase();
    const filtrees = recettes.filter((r) => {
      if (!terme) return true;
      const nomType = categoriesIndex[r.categorieId]?.nom || '';
      return r.nom.toLowerCase().includes(terme) || nomType.toLowerCase().includes(terme);
    });

    if (filtrees.length === 0) {
      zone.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h3>Aucun résultat</h3>
          <p>Aucune recette ne correspond à « ${escapeHtml(rechercheInput.value.trim())} ».</p>
        </div>`;
      return;
    }

    zone.innerHTML = '';
    filtrees
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .forEach((recette) => {
        const { coutTotal } = calculerCoutRecette(recette, ingredientsIndex, recette.nombrePersonnes);
        const nomType = categoriesIndex[recette.categorieId]?.nom;
        const card = document.createElement('div');
        card.className = 'card scallop-card';
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <h3>${escapeHtml(recette.nom)}</h3>
            ${nomType ? `<span class="chip chip-categorie" style="flex-shrink:0;">${escapeHtml(nomType)}</span>` : ''}
          </div>
          <p style="margin-top:4px;">Pour ${recette.nombrePersonnes} personne${recette.nombrePersonnes > 1 ? 's' : ''} — ${(recette.ingredients || []).length} ingrédient${(recette.ingredients || []).length > 1 ? 's' : ''}</p>
          <ul class="list-plain" style="margin:12px 0;">
            ${(recette.ingredients || [])
              .slice(0, 4)
              .map((l) => `<li><span>${ingredientsIndex[l.ingredientId] ? escapeHtml(ingredientsIndex[l.ingredientId].nom) : '—'}</span><span>${formatQuantite(l.quantite, ingredientsIndex[l.ingredientId]?.type)}</span></li>`)
              .join('')}
            ${(recette.ingredients || []).length > 4 ? `<li style="color:var(--color-ink-faint);">+ ${recette.ingredients.length - 4} autre(s)</li>` : ''}
          </ul>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
            <span class="price-tag">${formatPrix(coutTotal)} <span style="font-weight:400; color:var(--color-ink-faint); font-family:var(--font-body);">coût de base</span></span>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px;">
            <button class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
            <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
          </div>
        `;
        card.querySelector('[data-action="edit"]').addEventListener('click', () => ouvrirFormulaireRecette(ingredients, categories, recette));
        card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog(`Supprimer la recette « ${recette.nom} » ?`);
          if (ok) {
            await DB.delete('recettes', recette.id);
            showToast('Recette supprimée');
            renderRecettes();
          }
        });
        zone.appendChild(card);
      });
  }

  rechercheInput.addEventListener('input', dessiner);
  dessiner();
}

// Convertit une quantité en unité de base (g, ml, unité) vers l'unité affichée
// dans le formulaire (kg, L, unité) — c'est cette valeur affichée que la pâtissière saisit.
function valeurAffichee(ingredient, quantiteBase) {
  if (!ingredient || ingredient.type === 'unite') return quantiteBase;
  return quantiteBase / 1000;
}

function suffixeSaisie(ingredient) {
  if (!ingredient || ingredient.type === 'unite') return 'unité(s)';
  return ingredient.type === 'volume' ? 'L' : 'kg';
}

// Texte de conversion en direct, affiché sous le champ (ex. « = 250 g »).
function texteConversion(ingredient, valeurSaisie) {
  if (!ingredient || ingredient.type === 'unite') return '';
  const base = (Number(valeurSaisie) || 0) * 1000;
  const uniteBase = ingredient.type === 'volume' ? 'ml' : 'g';
  return `= ${formatNombre(base, 5)} ${uniteBase}`;
}

function ouvrirFormulaireRecette(ingredients, categories, recette = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const lignesInitiales = recette ? recette.ingredients : [{ ingredientId: ingredients[0]?.id, quantite: '' }];

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:640px;">
      <div class="modal-head">
        <h2>${recette ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <form id="form-recette">
        <div class="form-row">
          <div class="field">
            <label for="nom">Nom de la recette</label>
            <input type="text" id="nom" required placeholder="Ex. Génoise vanille" value="${recette ? escapeAttr(recette.nom) : ''}">
          </div>
          <div class="field" style="max-width:180px;">
            <label for="nombrePersonnes">Pour combien de personnes</label>
            <input type="number" id="nombrePersonnes" min="1" step="1" required value="${recette ? recette.nombrePersonnes : 1}">
          </div>
        </div>

        <div class="field">
          <label for="categorieId">Type de recette</label>
          <div class="input-group">
            <select id="categorieId" required style="flex:1;">
              <option value="" disabled ${!recette ? 'selected' : ''}>Choisir un type</option>
              ${categories.map((c) => `<option value="${c.id}" ${recette?.categorieId === c.id ? 'selected' : ''}>${escapeHtml(c.nom)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-nouvelle-categorie" style="white-space:nowrap;">+ Type</button>
          </div>
          <p class="field-hint" id="hint-pas-de-categorie" style="${categories.length === 0 ? '' : 'display:none;'} color:var(--color-accent);">Créez un premier type avec le bouton ci-dessus (ex. Base, Crème, Glaçage, Décor...).</p>
        </div>

        <div class="section-title" style="margin:20px 0 8px;">
          <h3 style="font-size:1rem;">Ingrédients</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-add-ligne">+ Ajouter un ingrédient</button>
        </div>
        <div id="lignes-ingredients"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-ghost" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const lignesZone = overlay.querySelector('#lignes-ingredients');

  function ajouterLigne(ligne = { ingredientId: ingredients[0]?.id, quantite: '' }) {
    const rowId = 'ligne-' + uid();
    const row = document.createElement('div');
    row.className = 'repeatable-row';
    row.dataset.rowId = rowId;
    const ingredientCourant = ingredients.find((i) => i.id === ligne.ingredientId) || ingredients[0];
    const valeurInitiale = ligne.quantite === '' ? '' : valeurAffichee(ingredientCourant, ligne.quantite);
    row.innerHTML = `
      <div class="field" style="flex:2; margin-bottom:0;">
        <label>Ingrédient</label>
        <select class="select-ingredient">
          ${ingredients.map((i) => `<option value="${i.id}" ${i.id === ligne.ingredientId ? 'selected' : ''}>${escapeHtml(i.nom)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="flex:1; margin-bottom:0;">
        <label>Quantité</label>
        <div class="input-group">
          <input type="number" class="input-quantite" min="0" step="0.00001" value="${valeurInitiale}">
          <span class="input-suffix suffix-unite">${suffixeSaisie(ingredientCourant)}</span>
        </div>
        <p class="hint-conversion"></p>
      </div>
      <button type="button" class="btn btn-icon btn-ghost btn-remove-ligne" aria-label="Supprimer la ligne">✕</button>
    `;
    const select = row.querySelector('.select-ingredient');
    const suffix = row.querySelector('.suffix-unite');
    const input = row.querySelector('.input-quantite');
    const hint = row.querySelector('.hint-conversion');

    function majConversion() {
      const ing = ingredients.find((i) => i.id === Number(select.value));
      hint.textContent = texteConversion(ing, input.value);
    }

    select.addEventListener('change', () => {
      const ing = ingredients.find((i) => i.id === Number(select.value));
      suffix.textContent = suffixeSaisie(ing);
      majConversion();
    });
    input.addEventListener('input', majConversion);
    row.querySelector('.btn-remove-ligne').addEventListener('click', () => row.remove());
    lignesZone.appendChild(row);
    majConversion();
  }

  lignesInitiales.forEach((l) => ajouterLigne(l));
  overlay.querySelector('#btn-add-ligne').addEventListener('click', () => ajouterLigne());

  const closeAll = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  overlay.querySelector('#btn-nouvelle-categorie').addEventListener('click', async () => {
    const nom = await promptDialog('Nom du nouveau type de recette', 'Ex. Base, Crème, Glaçage, Décor...');
    if (!nom) return;
    const nouvelle = await DB.ajouterCategorie('recette', nom);
    categories.push(nouvelle);
    categories.sort((a, b) => a.nom.localeCompare(b.nom));
    const select = overlay.querySelector('#categorieId');
    select.innerHTML = `
      <option value="" disabled>Choisir un type</option>
      ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.nom)}</option>`).join('')}
    `;
    select.value = String(nouvelle.id);
    overlay.querySelector('#hint-pas-de-categorie').style.display = 'none';
  });

  overlay.querySelector('#form-recette').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lignes = Array.from(lignesZone.querySelectorAll('.repeatable-row')).map((row) => {
      const ingredientId = Number(row.querySelector('.select-ingredient').value);
      const ingredient = ingredients.find((i) => i.id === ingredientId);
      const valeurSaisie = parseFloat(row.querySelector('.input-quantite').value) || 0;
      const quantite = ingredient && ingredient.type !== 'unite' ? valeurSaisie * 1000 : valeurSaisie;
      return { ingredientId, quantite };
    });
    const data = {
      nom: overlay.querySelector('#nom').value.trim(),
      nombrePersonnes: parseFloat(overlay.querySelector('#nombrePersonnes').value) || 1,
      categorieId: Number(overlay.querySelector('#categorieId').value),
      ingredients: lignes,
    };
    if (recette) data.id = recette.id;
    await DB.put('recettes', data);
    closeAll();
    showToast(recette ? 'Recette modifiée' : 'Recette créée');
    renderRecettes();
  });
}

function ouvrirGestionTypesRecette(categories, recettes) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-head">
        <h2>Types de recette</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <div id="liste-types"></div>
      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <button type="button" class="btn btn-ghost" data-close>Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeAll = () => { overlay.remove(); renderRecettes(); };
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  const liste = overlay.querySelector('#liste-types');

  function compteUsage(categorieId) {
    return recettes.filter((r) => r.categorieId === categorieId).length;
  }

  function dessinerListe() {
    if (categories.length === 0) {
      liste.innerHTML = `<p class="field-hint">Aucun type pour l'instant — créez-en un depuis le formulaire d'une recette.</p>`;
      return;
    }
    liste.innerHTML = `
      <ul class="list-plain">
        ${categories
          .map((c) => {
            const nb = compteUsage(c.id);
            return `
          <li data-id="${c.id}" style="align-items:center;">
            <span>${escapeHtml(c.nom)} <span style="color:var(--color-ink-faint); font-size:0.82rem;">(${nb} recette${nb > 1 ? 's' : ''})</span></span>
            <span style="display:flex; gap:6px;">
              <button type="button" class="btn btn-ghost btn-sm" data-action="renommer">Modifier</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="supprimer">Supprimer</button>
            </span>
          </li>`;
          })
          .join('')}
      </ul>
    `;

    liste.querySelectorAll('li[data-id]').forEach((li) => {
      const id = Number(li.dataset.id);
      const categorie = categories.find((c) => c.id === id);

      li.querySelector('[data-action="renommer"]').addEventListener('click', async () => {
        const nouveauNom = await promptDialog('Renommer le type', '', categorie.nom);
        if (!nouveauNom || nouveauNom === categorie.nom) return;
        categorie.nom = nouveauNom;
        await DB.put('categories', categorie);
        categories.sort((a, b) => a.nom.localeCompare(b.nom));
        showToast('Type renommé');
        dessinerListe();
      });

      li.querySelector('[data-action="supprimer"]').addEventListener('click', async () => {
        const nb = compteUsage(id);
        const message = nb > 0
          ? `Supprimer le type « ${categorie.nom} » ? ${nb} recette${nb > 1 ? 's' : ''} actuellement dans ce type repasseront en « Sans type ».`
          : `Supprimer le type « ${categorie.nom} » ?`;
        const ok = await confirmDialog(message);
        if (!ok) return;

        const affectees = recettes.filter((r) => r.categorieId === id);
        for (const r of affectees) {
          r.categorieId = null;
          await DB.put('recettes', r);
        }
        await DB.delete('categories', id);
        const index = categories.findIndex((c) => c.id === id);
        if (index !== -1) categories.splice(index, 1);
        showToast('Type supprimé');
        dessinerListe();
      });
    });
  }

  dessinerListe();
}