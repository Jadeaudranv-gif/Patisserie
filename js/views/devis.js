
async function renderDevis(params) {
  const view = document.getElementById('app-view');
  const id = Number(params.id);
  const [commande, infos] = await Promise.all([DB.get('commandes', id), DB.getParametres()]);

  if (!commande) {
    view.innerHTML = `<div class="empty-state"><h3>Commande introuvable</h3></div>`;
    return;
  }

  const numero = `D-${String(commande.id).padStart(4, '0')}`;

  view.innerHTML = `
    <div class="page-head no-print">
      <span class="eyebrow"><a href="#/commandes/${commande.id}" style="color:var(--color-accent); text-decoration:none;">← Retour à la commande</a></span>
      <div class="page-head-row">
        <div>
          <h1>Devis ${numero}</h1>
          <p class="page-desc">Vérifiez les informations puis imprimez ou enregistrez en PDF depuis la fenêtre d'impression de votre navigateur.</p>
        </div>
        <button class="btn btn-primary" id="btn-print">Télécharger en PDF</button>
      </div>
    </div>

    <div class="devis-doc">
      <div class="devis-ruban">
        <div class="devis-titre">${escapeHtml(infos.societeNom || 'Devis')}</div>
        <div class="devis-num">Devis n° ${numero} — émis le ${formatDate(commande.dateCreation)}</div>
      </div>
      <div class="devis-body">
        <div class="devis-parties">
          <div class="devis-bloc">
            <h4>De</h4>
            <p>${escapeHtml(infos.societeNom || '—')}</p>
            <p>${escapeHtml(infos.societeContact || '')}</p>
          </div>
          <div class="devis-bloc">
            <h4>Pour</h4>
            <p>${escapeHtml(commande.clientNom || '—')}</p>
            <p>${escapeHtml(commande.clientContact || '')}</p>
            ${commande.dateEvenement ? `<p>Événement le ${formatDate(commande.dateEvenement)}</p>` : ''}
          </div>
        </div>

        <table class="devis-table">
          <thead>
            <tr><th>Gâteau</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr>
          </thead>
          <tbody>
            ${commande.lignes
              .map(
                (l) => `
              <tr>
                <td>${escapeHtml(l.nomGateauSnapshot)} <span style="color:var(--color-ink-faint);">(${l.nombrePartsSnapshot} parts)</span></td>
                <td class="num">${l.quantiteCommandee}</td>
                <td class="num">${formatPrix(l.prixVenteUnitaire)}</td>
                <td class="num">${formatPrix(l.prixVenteUnitaire * l.quantiteCommandee)}</td>
              </tr>`
              )
              .join('')}
            <tr class="devis-total-row">
              <td colspan="3">Total</td>
              <td class="num">${formatPrix(commande.prixClientTotal)}</td>
            </tr>
          </tbody>
        </table>

        <p class="devis-footnote">Statut actuel de la commande : ${LIBELLES_STATUT[commande.statut]}. Devis généré depuis l'atelier — sans valeur contractuelle automatique.</p>
      </div>
    </div>
  `;

  document.getElementById('btn-print').addEventListener('click', () => window.print());
}

