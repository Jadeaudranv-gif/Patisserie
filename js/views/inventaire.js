async function renderInventaire() {
  const view = document.getElementById('app-view');
  const [ingredients, categories] = await Promise.all([
    DB.getAll('ingredients'),
    DB.getCategories('ingredient'),
  ]);

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow">Atelier · Matières premières</span>
      <div class="page-head-row">
        <div>
          <h1>Inventaire</h1>
          <p class="page-desc">Chaque ingrédient utilisé dans vos recettes, avec son prix réel — au kilo, au litre ou à l'unité selon ce qui est le plus simple, classé par catégorie pour vous y retrouver.</p>
        </div>
        <button class="btn btn-primary" id="btn-nouvel-ingredient">+ Nouvel ingrédient</button>
      </div>
    </div>

    <div class="page-head-row" style="align-items:center; margin-bottom:2px;">
      <div class="search-bar" style="margin-bottom:0; flex:1;">
        <input type="text" id="recherche-ingredient" placeholder="Rechercher un ingrédient ou une catégorie...">
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-gerer-categories" style="white-space:nowrap;">Gérer les catégories</button>
    </div>

    <div id="ingredients-zone" style="margin-top:18px;"></div>
  `;

  document.getElementById('btn-nouvel-ingredient').addEventListener('click', () => ouvrirFormulaireIngredient(categories));
  document.getElementById('btn-gerer-categories').addEventListener('click', () => ouvrirGestionCategories(categories, ingredients));

  const zone = document.getElementById('ingredients-zone');
  const rechercheInput = document.getElementById('recherche-ingredient');
  const categoriesIndex = Object.fromEntries(categories.map((c) => [c.id, c]));

  function dessiner() {
    if (ingredients.length === 0) {
      zone.innerHTML = `
        <div class="empty-state">
          <h3>Aucun ingrédient pour l'instant</h3>
          <p>Ajoutez votre premier ingrédient — farine, œufs, beurre... — avec son prix réel.</p>
        </div>`;
      return;
    }

    const terme = rechercheInput.value.trim().toLowerCase();
    const filtres = ingredients.filter((i) => {
      if (!terme) return true;
      const nomCategorie = categoriesIndex[i.categorieId]?.nom || '';
      return i.nom.toLowerCase().includes(terme) || nomCategorie.toLowerCase().includes(terme);
    });

    if (filtres.length === 0) {
      zone.innerHTML = `
        <div class="empty-state">
          <h3>Aucun résultat</h3>
          <p>Aucun ingrédient ne correspond à « ${escapeHtml(rechercheInput.value.trim())} ».</p>
        </div>`;
      return;
    }

    // Groupement par catégorie, pour se repérer facilement.
    const groupes = new Map(); // categorieId (0 = sans catégorie) -> ingrédients
    filtres.forEach((i) => {
      const cle = i.categorieId || 0;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle).push(i);
    });

    const nomGroupe = (cle) => (cle === 0 ? 'Sans catégorie' : (categoriesIndex[cle]?.nom || 'Sans catégorie'));
    const ordreGroupes = Array.from(groupes.keys()).sort((a, b) => nomGroupe(a).localeCompare(nomGroupe(b)));

    zone.innerHTML = '';
    ordreGroupes.forEach((cle) => {
      const items = groupes.get(cle).sort((a, b) => a.nom.localeCompare(b.nom));

      const bloc = document.createElement('div');
      bloc.className = 'categorie-groupe';
      bloc.innerHTML = `
        <h3 class="categorie-groupe-titre">${escapeHtml(nomGroupe(cle))}</h3>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Ingrédient</th>
                <th>Type</th>
                <th class="num">Prix</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (i) => `
                <tr data-id="${i.id}">
                  <td>${escapeHtml(i.nom)}</td>
                  <td><span class="chip chip-${i.type}">${libelleType(i.type)}</span></td>
                  <td class="num">${formatPrixDetail(prixAffiche(i))} <span style="color:var(--color-ink-faint)">/ ${suffixeType(i.type)}</span></td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
                    <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      zone.appendChild(bloc);

      bloc.querySelectorAll('tr[data-id]').forEach((row) => {
        const id = Number(row.dataset.id);
        const ingredient = ingredients.find((i) => i.id === id);
        row.querySelector('[data-action="edit"]').addEventListener('click', () => ouvrirFormulaireIngredient(categories, ingredient));
        row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog(`Supprimer « ${ingredient.nom} » de l'inventaire ?`);
          if (ok) {
            await DB.delete('ingredients', id);
            showToast('Ingrédient supprimé');
            renderInventaire();
          }
        });
      });
    });
  }

  rechercheInput.addEventListener('input', dessiner);
  dessiner();
}

function libelleType(type) {
  if (type === 'unite') return 'à l’unité';
  if (type === 'volume') return 'au litre';
  return 'au kilo';
}

function suffixeType(type) {
  if (type === 'unite') return 'unité';
  if (type === 'volume') return 'L';
  return 'kg';
}

// En base, le prix est stocké par gramme ou par millilitre (unité de calcul des recettes).
// On le remet à l'échelle kilo/litre uniquement pour l'affichage et la saisie.
function prixAffiche(ingredient) {
  if (ingredient.type === 'unite') return ingredient.prixUnitaire;
  return ingredient.prixUnitaire * 1000;
}

function ouvrirFormulaireIngredient(categories, ingredient = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const prixInitial = ingredient ? prixAffiche(ingredient) : '';

  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h2>${ingredient ? 'Modifier l’ingrédient' : 'Nouvel ingrédient'}</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <form id="form-ingredient">
        <div class="field">
          <label for="nom">Nom</label>
          <input type="text" id="nom" required placeholder="Ex. Farine T55, Œuf, Beurre doux..." value="${ingredient ? escapeAttr(ingredient.nom) : ''}">
        </div>

        <div class="field">
          <label for="categorieId">Catégorie</label>
          <div class="input-group">
            <select id="categorieId" required style="flex:1;">
              <option value="" disabled ${!ingredient ? 'selected' : ''}>Choisir une catégorie</option>
              ${categories.map((c) => `<option value="${c.id}" ${ingredient?.categorieId === c.id ? 'selected' : ''}>${escapeHtml(c.nom)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-nouvelle-categorie" style="white-space:nowrap;">+ Catégorie</button>
          </div>
          <p class="field-hint" id="hint-pas-de-categorie" style="${categories.length === 0 ? '' : 'display:none;'} color:var(--color-accent);">Créez une première catégorie avec le bouton ci-dessus (ex. Farines, Produits laitiers, Sucres...).</p>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="type">Comptabilisé</label>
            <select id="type">
              <option value="poids" ${!ingredient || ingredient?.type === 'poids' ? 'selected' : ''}>Au poids (kilo)</option>
              <option value="volume" ${ingredient?.type === 'volume' ? 'selected' : ''}>Au volume (litre)</option>
              <option value="unite" ${ingredient?.type === 'unite' ? 'selected' : ''}>À l’unité</option>
            </select>
          </div>
          <div class="field">
            <label for="prix" id="prix-label">Prix au kilo</label>
            <div class="input-group">
              <input type="number" id="prix" min="0" step="0.0001" required value="${prixInitial}">
              <span class="input-suffix" id="prix-suffix">/ kg</span>
            </div>
            <p class="field-hint" id="prix-hint">Ex. le prix d'1 kg de farine (prix du paquet ramené au kilo).</p>
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
          <button type="button" class="btn btn-ghost" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeAll = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  const typeSelect = overlay.querySelector('#type');
  const prixLabel = overlay.querySelector('#prix-label');
  const prixSuffix = overlay.querySelector('#prix-suffix');
  const prixHint = overlay.querySelector('#prix-hint');

  function majLibellesPrix() {
    if (typeSelect.value === 'unite') {
      prixLabel.textContent = 'Prix à l’unité';
      prixSuffix.textContent = '/ unité';
      prixHint.textContent = "Ex. le prix d'1 œuf, d'1 sachet de levure...";
    } else if (typeSelect.value === 'volume') {
      prixLabel.textContent = 'Prix au litre';
      prixSuffix.textContent = '/ L';
      prixHint.textContent = "Ex. le prix d'1 litre de lait ou de crème (prix de la bouteille ramené au litre).";
    } else {
      prixLabel.textContent = 'Prix au kilo';
      prixSuffix.textContent = '/ kg';
      prixHint.textContent = "Ex. le prix d'1 kg de farine (prix du paquet ramené au kilo).";
    }
  }
  typeSelect.addEventListener('change', majLibellesPrix);
  majLibellesPrix();

  overlay.querySelector('#btn-nouvelle-categorie').addEventListener('click', async () => {
    const nom = await promptDialog('Nom de la nouvelle catégorie', 'Ex. Farines, Produits laitiers, Sucres...');
    if (!nom) return;
    const nouvelle = await DB.ajouterCategorie('ingredient', nom);
    categories.push(nouvelle);
    categories.sort((a, b) => a.nom.localeCompare(b.nom));
    const select = overlay.querySelector('#categorieId');
    select.innerHTML = `
      <option value="" disabled>Choisir une catégorie</option>
      ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.nom)}</option>`).join('')}
    `;
    select.value = String(nouvelle.id);
    overlay.querySelector('#hint-pas-de-categorie').style.display = 'none';
  });

  overlay.querySelector('#form-ingredient').addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = typeSelect.value;
    const prixSaisi = parseFloat(overlay.querySelector('#prix').value) || 0;
    const prixUnitaire = type === 'unite' ? prixSaisi : prixSaisi / 1000;
    const data = {
      nom: overlay.querySelector('#nom').value.trim(),
      categorieId: Number(overlay.querySelector('#categorieId').value),
      type,
      prixUnitaire,
    };
    if (ingredient) data.id = ingredient.id;
    await DB.put('ingredients', data);
    closeAll();
    showToast(ingredient ? 'Ingrédient modifié' : 'Ingrédient ajouté');
    renderInventaire();
  });
}

function ouvrirGestionCategories(categories, ingredients) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-head">
        <h2>Catégories d'ingrédients</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <div id="liste-categories"></div>
      <div style="display:flex; justify-content:flex-end; margin-top:18px;">
        <button type="button" class="btn btn-ghost" data-close>Fermer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeAll = () => { overlay.remove(); renderInventaire(); };
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  const liste = overlay.querySelector('#liste-categories');

  function compteUsage(categorieId) {
    return ingredients.filter((i) => i.categorieId === categorieId).length;
  }

  function dessinerListe() {
    if (categories.length === 0) {
      liste.innerHTML = `<p class="field-hint">Aucune catégorie pour l'instant — créez-en une depuis le formulaire d'un ingrédient.</p>`;
      return;
    }
    liste.innerHTML = `
      <ul class="list-plain">
        ${categories
          .map((c) => {
            const nb = compteUsage(c.id);
            return `
          <li data-id="${c.id}" style="align-items:center;">
            <span>${escapeHtml(c.nom)} <span style="color:var(--color-ink-faint); font-size:0.82rem;">(${nb} ingrédient${nb > 1 ? 's' : ''})</span></span>
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
        const nouveauNom = await promptDialog('Renommer la catégorie', '', categorie.nom);
        if (!nouveauNom || nouveauNom === categorie.nom) return;
        categorie.nom = nouveauNom;
        await DB.put('categories', categorie);
        categories.sort((a, b) => a.nom.localeCompare(b.nom));
        showToast('Catégorie renommée');
        dessinerListe();
      });

      li.querySelector('[data-action="supprimer"]').addEventListener('click', async () => {
        const nb = compteUsage(id);
        const message = nb > 0
          ? `Supprimer la catégorie « ${categorie.nom} » ? ${nb} ingrédient${nb > 1 ? 's' : ''} actuellement dans cette catégorie repasseront en « Sans catégorie ».`
          : `Supprimer la catégorie « ${categorie.nom} » ?`;
        const ok = await confirmDialog(message);
        if (!ok) return;

        const affectes = ingredients.filter((i) => i.categorieId === id);
        for (const ing of affectes) {
          ing.categorieId = null;
          await DB.put('ingredients', ing);
        }
        await DB.delete('categories', id);
        const index = categories.findIndex((c) => c.id === id);
        if (index !== -1) categories.splice(index, 1);
        showToast('Catégorie supprimée');
        dessinerListe();
      });
    });
  }

  dessinerListe();
}