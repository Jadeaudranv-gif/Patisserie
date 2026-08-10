
async function renderGateaux() {
  const view = document.getElementById('app-view');
  const [gateaux, recettes, ingredients, params] = await Promise.all([
    DB.getAll('gateaux'),
    DB.getAll('recettes'),
    DB.getAll('ingredients'),
    DB.getParametres(),
  ]);
  const recettesIndex = Object.fromEntries(recettes.map((r) => [r.id, r]));
  const ingredientsIndex = Object.fromEntries(ingredients.map((i) => [i.id, i]));

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow">Atelier · Compositions</span>
      <div class="page-head-row">
        <div>
          <h1>Création gâteau</h1>
          <p class="page-desc">Assemblez une ou plusieurs recettes pour composer un gâteau, précisez son nombre de parts : les quantités et le coût s'ajustent automatiquement.</p>
        </div>
        <button class="btn btn-primary" id="btn-nouveau-gateau" ${recettes.length === 0 ? 'disabled' : ''}>+ Nouveau gâteau</button>
      </div>
      ${recettes.length === 0 ? '<p class="field-hint" style="color:var(--color-accent);">Créez d\'abord au moins une recette.</p>' : ''}
    </div>

    <div class="grid-cards" id="gateaux-zone"></div>
  `;

  document.getElementById('btn-nouveau-gateau').addEventListener('click', () => ouvrirFormulaireGateau(recettes));

  const zone = document.getElementById('gateaux-zone');
  if (gateaux.length === 0) {
    zone.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>Aucun gâteau composé pour l'instant</h3>
        <p>Combinez vos recettes pour créer votre premier modèle de gâteau.</p>
      </div>`;
    return;
  }

  gateaux
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .forEach((gateau) => {
      const { ingredientsRecap, coutMatierePremiere } = calculerCoutGateau(gateau, recettesIndex, ingredientsIndex);
      const prixVente = calculerPrixVente(coutMatierePremiere, params.coefficientMarge);
      const poidsEstime = gateau.nombreParts * params.grammesParPart;
      const nomsRecettes = (gateau.composants || [])
        .map((c) => recettesIndex[c.recetteId]?.nom)
        .filter(Boolean)
        .join(', ');

      const card = document.createElement('div');
      card.className = 'card scallop-card';
      card.innerHTML = `
        <h3>${escapeHtml(gateau.nom)}</h3>
        <p style="margin-top:4px;">${gateau.nombreParts} parts · ≈ ${(poidsEstime / 1000).toFixed(2)} kg · ${escapeHtml(nomsRecettes)}</p>
        <ul class="list-plain" style="margin:12px 0;">
          ${ingredientsRecap
            .slice(0, 4)
            .map((l) => `<li><span>${escapeHtml(l.nom)}</span><span>${formatQuantite(l.quantite, l.type)}</span></li>`)
            .join('')}
          ${ingredientsRecap.length > 4 ? `<li style="color:var(--color-ink-faint);">+ ${ingredientsRecap.length - 4} autre(s)</li>` : ''}
        </ul>
        <div class="form-row" style="margin-top:8px;">
          <div>
            <div class="field-hint">Coût matière</div>
            <span class="price-tag">${formatPrix(coutMatierePremiere)}</span>
          </div>
          <div>
            <div class="field-hint">Prix de vente suggéré</div>
            <span class="price-tag" style="color:var(--color-accent);">${formatPrix(prixVente)}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:16px;">
          <button class="btn btn-ghost btn-sm" data-action="edit">Modifier</button>
          <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener('click', () => ouvrirFormulaireGateau(recettes, gateau));
      card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const ok = await confirmDialog(`Supprimer le gâteau « ${gateau.nom} » ?`);
        if (ok) {
          await DB.delete('gateaux', gateau.id);
          showToast('Gâteau supprimé');
          renderGateaux();
        }
      });
      zone.appendChild(card);
    });
}

function ouvrirFormulaireGateau(recettes, gateau = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const composantsInitiaux = gateau ? gateau.composants : [{ recetteId: recettes[0]?.id }];

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:600px;">
      <div class="modal-head">
        <h2>${gateau ? 'Modifier le gâteau' : 'Nouveau gâteau'}</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <form id="form-gateau">
        <div class="form-row">
          <div class="field">
            <label for="nom">Nom du gâteau</label>
            <input type="text" id="nom" required placeholder="Ex. Fraisier signature" value="${gateau ? escapeAttr(gateau.nom) : ''}">
          </div>
          <div class="field" style="max-width:160px;">
            <label for="nombreParts">Nombre de parts</label>
            <input type="number" id="nombreParts" min="1" step="1" required value="${gateau ? gateau.nombreParts : 8}">
          </div>
        </div>

        <div class="section-title" style="margin:20px 0 8px;">
          <h3 style="font-size:1rem;">Recettes utilisées</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-add-composant">+ Ajouter une recette</button>
        </div>
        <p class="field-hint">Chaque recette est automatiquement mise à l'échelle sur le nombre de parts du gâteau.</p>
        <div id="composants-zone" style="margin-top:10px;"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button type="button" class="btn btn-ghost" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const zoneComposants = overlay.querySelector('#composants-zone');

  function ajouterComposant(comp = { recetteId: recettes[0]?.id }) {
    const row = document.createElement('div');
    row.className = 'repeatable-row';
    row.innerHTML = `
      <div class="field" style="flex:1; margin-bottom:0;">
        <select class="select-recette">
          ${recettes.map((r) => `<option value="${r.id}" ${r.id === comp.recetteId ? 'selected' : ''}>${escapeHtml(r.nom)} (pour ${r.nombrePersonnes})</option>`).join('')}
        </select>
      </div>
      <button type="button" class="btn btn-icon btn-ghost btn-remove" aria-label="Retirer">✕</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => row.remove());
    zoneComposants.appendChild(row);
  }

  composantsInitiaux.forEach((c) => ajouterComposant(c));
  overlay.querySelector('#btn-add-composant').addEventListener('click', () => ajouterComposant());

  const closeAll = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  overlay.querySelector('#form-gateau').addEventListener('submit', async (e) => {
    e.preventDefault();
    const composants = Array.from(zoneComposants.querySelectorAll('.repeatable-row')).map((row) => ({
      recetteId: Number(row.querySelector('.select-recette').value),
    }));
    const data = {
      nom: overlay.querySelector('#nom').value.trim(),
      nombreParts: parseFloat(overlay.querySelector('#nombreParts').value) || 1,
      composants,
    };
    if (gateau) data.id = gateau.id;
    await DB.put('gateaux', data);
    closeAll();
    showToast(gateau ? 'Gâteau modifié' : 'Gâteau créé');
    renderGateaux();
  });
}

