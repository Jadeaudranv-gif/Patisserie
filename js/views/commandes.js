const STATUTS = ['attente', 'valide', 'en_cours', 'termine'];

async function renderCommandes() {
  const view = document.getElementById('app-view');
  const [commandes, gateaux] = await Promise.all([DB.getAll('commandes'), DB.getAll('gateaux')]);

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow">Atelier · Ventes</span>
      <div class="page-head-row">
        <div>
          <h1>Commandes</h1>
          <p class="page-desc">Composez une commande à partir de vos gâteaux, suivez son statut, générez le devis.</p>
        </div>
        <button class="btn btn-primary" id="btn-nouvelle-commande" ${gateaux.length === 0 ? 'disabled' : ''}>+ Nouvelle commande</button>
      </div>
      ${gateaux.length === 0 ? '<p class="field-hint" style="color:var(--color-accent);">Composez d\'abord un gâteau dans « Création gâteau ».</p>' : ''}
    </div>

    <div class="search-bar">
      <input type="text" id="recherche-commande" placeholder="Rechercher par client ou par gâteau...">
    </div>

    <div id="commandes-zone"></div>
  `;

  document.getElementById('btn-nouvelle-commande').addEventListener('click', () => ouvrirFormulaireCommande());

  const zone = document.getElementById('commandes-zone');
  const rechercheInput = document.getElementById('recherche-commande');

  function dessiner() {
    if (commandes.length === 0) {
      zone.innerHTML = `
        <div class="empty-state">
          <h3>Aucune commande pour l'instant</h3>
          <p>Créez votre première commande depuis les gâteaux déjà composés.</p>
        </div>`;
      return;
    }

    const terme = rechercheInput.value.trim().toLowerCase();
    const filtrees = commandes.filter((c) => {
      if (!terme) return true;
      const nomsGateaux = (c.lignes || []).map((l) => l.nomGateauSnapshot).join(' ').toLowerCase();
      return (c.clientNom || '').toLowerCase().includes(terme) || nomsGateaux.includes(terme);
    });

    if (filtrees.length === 0) {
      zone.innerHTML = `
        <div class="empty-state">
          <h3>Aucun résultat</h3>
          <p>Aucune commande ne correspond à « ${escapeHtml(rechercheInput.value.trim())} ».</p>
        </div>`;
      return;
    }

    const table = document.createElement('div');
    table.className = 'card';
    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Créée le</th>
            <th>Gâteaux</th>
            <th class="num">Prix client</th>
            <th class="num">Résultat net</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filtrees
            .sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation))
            .map(
              (c) => `
            <tr data-id="${c.id}" style="cursor:pointer;">
              <td>${escapeHtml(c.clientNom || 'Sans nom')}</td>
              <td>${formatDate(c.dateCreation)}</td>
              <td>${(c.lignes || []).map((l) => `${l.quantiteCommandee}× ${escapeHtml(l.nomGateauSnapshot)}`).join(', ')}</td>
              <td class="num">${formatPrix(c.prixClientTotal)}</td>
              <td class="num">${formatPrix(c.resultatNet)}</td>
              <td><span class="status-badge status-${c.statut}">${LIBELLES_STATUT[c.statut]}</span></td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" data-action="voir">Ouvrir</button>
                <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
    zone.innerHTML = '';
    zone.appendChild(table);

    table.querySelectorAll('tr[data-id]').forEach((row) => {
      const id = Number(row.dataset.id);
      const commande = commandes.find((c) => c.id === id);
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="delete"]')) return;
        location.hash = `#/commandes/${id}`;
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog(`Supprimer la commande de « ${commande.clientNom || 'ce client'} » ? Cette action est définitive.`);
        if (ok) {
          await DB.delete('commandes', id);
          showToast('Commande supprimée');
          renderCommandes();
        }
      });
    });
  }

  rechercheInput.addEventListener('input', dessiner);
  dessiner();
}

async function renderCommandeDetail(params) {
  const view = document.getElementById('app-view');
  const id = Number(params.id);
  const commande = await DB.get('commandes', id);

  if (!commande) {
    view.innerHTML = `<div class="empty-state"><h3>Commande introuvable</h3></div>`;
    return;
  }

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow"><a href="#/commandes" style="color:var(--color-accent); text-decoration:none;">← Commandes</a></span>
      <div class="page-head-row">
        <div>
          <h1>${escapeHtml(commande.clientNom || 'Commande sans nom')}</h1>
          <p class="page-desc">Créée le ${formatDate(commande.dateCreation)}${commande.dateEvenement ? ` · Événement le ${formatDate(commande.dateEvenement)}` : ''}</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-ghost" id="btn-modifier-commande">Modifier</button>
          <a class="btn btn-brass" href="#/devis/${commande.id}">Voir le devis</a>
          <button class="btn btn-danger" id="btn-supprimer-commande">Supprimer</button>
        </div>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Coût matière première</div><div class="kpi-value">${formatPrix(commande.coutMatierePremiereTotal)}</div></div>
      <div class="kpi accent"><div class="kpi-label">Prix total client</div><div class="kpi-value">${formatPrix(commande.prixClientTotal)}</div></div>
      <div class="kpi sage"><div class="kpi-label">Résultat net</div><div class="kpi-value">${formatPrix(commande.resultatNet)}</div></div>
    </div>

    <div class="card">
      <h3>Statut de la commande</h3>
      <div class="field" style="max-width:220px; margin-top:12px;">
        <select id="select-statut">
          ${STATUTS.map((s) => `<option value="${s}" ${s === commande.statut ? 'selected' : ''}>${LIBELLES_STATUT[s]}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <h3>Détail des gâteaux</h3>
      <table style="margin-top:12px;">
        <thead>
          <tr><th>Gâteau</th><th class="num">Qté</th><th class="num">Coût matière (unit.)</th><th class="num">Prix vente (unit.)</th><th class="num">Total</th></tr>
        </thead>
        <tbody>
          ${commande.lignes
            .map(
              (l) => `
            <tr>
              <td>${escapeHtml(l.nomGateauSnapshot)} <span style="color:var(--color-ink-faint);">(${l.nombrePartsSnapshot} parts)</span></td>
              <td class="num">${l.quantiteCommandee}</td>
              <td class="num">${formatPrix(l.coutMatierePremiereUnitaire)}</td>
              <td class="num">${formatPrix(l.prixVenteUnitaire)}</td>
              <td class="num">${formatPrix(l.prixVenteUnitaire * l.quantiteCommandee)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    ${commande.clientContact ? `
    <div class="card">
      <h3>Contact client</h3>
      <p style="margin-top:8px;">${escapeHtml(commande.clientContact)}</p>
    </div>` : ''}
  `;

  document.getElementById('select-statut').addEventListener('change', async (e) => {
    commande.statut = e.target.value;
    await DB.put('commandes', commande);
    showToast('Statut mis à jour');
  });

  document.getElementById('btn-modifier-commande').addEventListener('click', async () => {
    const [gateaux, recettes, ingredients, params] = await Promise.all([
      DB.getAll('gateaux'), DB.getAll('recettes'), DB.getAll('ingredients'), DB.getParametres(),
    ]);
    ouvrirFormulaireCommande(commande, { gateaux, recettes, ingredients, params });
  });

  document.getElementById('btn-supprimer-commande').addEventListener('click', async () => {
    const ok = await confirmDialog(`Supprimer la commande de « ${commande.clientNom || 'ce client'} » ? Cette action est définitive.`);
    if (ok) {
      await DB.delete('commandes', commande.id);
      showToast('Commande supprimée');
      location.hash = '#/commandes';
    }
  });
}

async function ouvrirFormulaireCommande(commande = null, preload = null) {
  const { gateaux, recettes, ingredients, params } = preload || {
    gateaux: await DB.getAll('gateaux'),
    recettes: await DB.getAll('recettes'),
    ingredients: await DB.getAll('ingredients'),
    params: await DB.getParametres(),
  };
  const recettesIndex = Object.fromEntries(recettes.map((r) => [r.id, r]));
  const ingredientsIndex = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const gateauxAvecCout = Object.fromEntries(
    gateaux.map((g) => [g.id, calculerCoutGateau(g, recettesIndex, ingredientsIndex)])
  );

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const lignesInitiales = commande
    ? commande.lignes.map((l) => ({ gateauId: l.gateauId, quantite: l.quantiteCommandee }))
    : [{ gateauId: gateaux[0]?.id, quantite: 1 }];

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:640px;">
      <div class="modal-head">
        <h2>${commande ? 'Modifier la commande' : 'Nouvelle commande'}</h2>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Fermer">✕</button>
      </div>
      <form id="form-commande">
        <div class="form-row">
          <div class="field">
            <label for="clientNom">Client</label>
            <input type="text" id="clientNom" placeholder="Nom du client" value="${commande ? escapeAttr(commande.clientNom || '') : ''}">
          </div>
          <div class="field">
            <label for="dateEvenement">Date de l'événement</label>
            <input type="date" id="dateEvenement" value="${commande?.dateEvenement ? commande.dateEvenement.slice(0, 10) : ''}">
          </div>
        </div>
        <div class="field">
          <label for="clientContact">Contact</label>
          <input type="text" id="clientContact" placeholder="Téléphone, Instagram..." value="${commande ? escapeAttr(commande.clientContact || '') : ''}">
        </div>

        <div class="section-title" style="margin:20px 0 8px;">
          <h3 style="font-size:1rem;">Gâteaux commandés</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-add-ligne">+ Ajouter un gâteau</button>
        </div>
        <div id="lignes-zone"></div>

        <div class="divider"></div>
        <div id="recap-zone" class="kpi-row" style="margin-bottom:6px;"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
          <button type="button" class="btn btn-ghost" data-close>Annuler</button>
          <button type="submit" class="btn btn-primary">Enregistrer la commande</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const lignesZone = overlay.querySelector('#lignes-zone');
  const recapZone = overlay.querySelector('#recap-zone');

  function majRecap() {
    let coutTotal = 0;
    let venteTotal = 0;
    lignesZone.querySelectorAll('.repeatable-row').forEach((row) => {
      const gateauId = Number(row.querySelector('.select-gateau').value);
      const qte = parseFloat(row.querySelector('.input-quantite').value) || 0;
      const cout = gateauxAvecCout[gateauId]?.coutMatierePremiere || 0;
      const vente = calculerPrixVente(cout, params.coefficientMarge);
      coutTotal += cout * qte;
      venteTotal += vente * qte;
    });
    recapZone.innerHTML = `
      <div class="kpi"><div class="kpi-label">Coût matière</div><div class="kpi-value">${formatPrix(coutTotal)}</div></div>
      <div class="kpi accent"><div class="kpi-label">Prix client (auto)</div><div class="kpi-value">${formatPrix(venteTotal)}</div></div>
      <div class="kpi sage"><div class="kpi-label">Résultat net</div><div class="kpi-value">${formatPrix(venteTotal - coutTotal)}</div></div>
    `;
  }

  function ajouterLigne(ligne = { gateauId: gateaux[0]?.id, quantite: 1 }) {
    const row = document.createElement('div');
    row.className = 'repeatable-row';
    row.innerHTML = `
      <div class="field" style="flex:2; margin-bottom:0;">
        <select class="select-gateau">
          ${gateaux.map((g) => `<option value="${g.id}" ${g.id === ligne.gateauId ? 'selected' : ''}>${escapeHtml(g.nom)} (${g.nombreParts} parts)</option>`).join('')}
        </select>
      </div>
      <div class="field" style="flex:1; margin-bottom:0;">
        <label>Quantité</label>
        <input type="number" class="input-quantite" min="1" step="1" value="${ligne.quantite}">
      </div>
      <button type="button" class="btn btn-icon btn-ghost btn-remove" aria-label="Retirer">✕</button>
    `;
    row.querySelector('.select-gateau').addEventListener('change', majRecap);
    row.querySelector('.input-quantite').addEventListener('input', majRecap);
    row.querySelector('.btn-remove').addEventListener('click', () => { row.remove(); majRecap(); });
    lignesZone.appendChild(row);
  }

  lignesInitiales.forEach((l) => ajouterLigne(l));
  overlay.querySelector('#btn-add-ligne').addEventListener('click', () => { ajouterLigne(); majRecap(); });
  majRecap();

  const closeAll = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  overlay.querySelector('#form-commande').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lignes = Array.from(lignesZone.querySelectorAll('.repeatable-row')).map((row) => {
      const gateauId = Number(row.querySelector('.select-gateau').value);
      const gateau = gateaux.find((g) => g.id === gateauId);
      const cout = gateauxAvecCout[gateauId]?.coutMatierePremiere || 0;
      const prixVenteUnitaire = calculerPrixVente(cout, params.coefficientMarge);
      return {
        gateauId,
        nomGateauSnapshot: gateau?.nom || 'Gâteau supprimé',
        nombrePartsSnapshot: gateau?.nombreParts || 0,
        quantiteCommandee: parseFloat(row.querySelector('.input-quantite').value) || 1,
        coutMatierePremiereUnitaire: cout,
        prixVenteUnitaire,
      };
    });

    const coutMatierePremiereTotal = lignes.reduce((acc, l) => acc + l.coutMatierePremiereUnitaire * l.quantiteCommandee, 0);
    const prixClientTotal = lignes.reduce((acc, l) => acc + l.prixVenteUnitaire * l.quantiteCommandee, 0);

    const data = {
      clientNom: overlay.querySelector('#clientNom').value.trim(),
      clientContact: overlay.querySelector('#clientContact').value.trim(),
      dateEvenement: overlay.querySelector('#dateEvenement').value || null,
      dateCreation: commande ? commande.dateCreation : new Date().toISOString(),
      statut: commande ? commande.statut : 'attente',
      coefficientMargeUtilise: params.coefficientMarge,
      lignes,
      coutMatierePremiereTotal,
      prixClientTotal,
      resultatNet: prixClientTotal - coutMatierePremiereTotal,
    };
    if (commande) data.id = commande.id;
    const id = await DB.put('commandes', data);
    closeAll();
    showToast(commande ? 'Commande modifiée' : 'Commande créée');
    const cibleId = commande ? commande.id : id;
    if (location.hash === `#/commandes/${cibleId}`) {
      // le hash ne change pas (édition depuis la fiche déjà ouverte) : on force le rafraîchissement
      renderCommandeDetail({ id: String(cibleId) });
    } else {
      location.hash = `#/commandes/${cibleId}`;
    }
  });
}