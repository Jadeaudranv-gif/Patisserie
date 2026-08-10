
async function renderParametres() {
  const view = document.getElementById('app-view');
  const params = await DB.getParametres();

  view.innerHTML = `
    <div class="page-head">
      <span class="eyebrow">Atelier · Réglages</span>
      <h1>Paramètres</h1>
      <p class="page-desc">Ces réglages servent de base à tous les calculs : le poids d'une part et la marge appliquée pour fixer vos prix de vente.</p>
    </div>

    <div class="card">
      <h3>Calcul des parts</h3>
      <p style="margin-top:4px;">Utilisé pour estimer le poids d'un gâteau selon son nombre de parts.</p>
      <div class="field" style="max-width:240px; margin-top:14px;">
        <label for="grammesParPart">Poids d'une part</label>
        <div class="input-group">
          <input type="number" id="grammesParPart" min="1" step="1" value="${params.grammesParPart}">
          <span class="input-suffix">g / part</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Coefficient de marge</h3>
      <p style="margin-top:4px;">Le coût matière première de chaque gâteau est multiplié par ce coefficient pour obtenir le prix de vente.</p>
      <div class="field" style="max-width:240px; margin-top:14px;">
        <label for="coefficientMarge">Coefficient</label>
        <div class="input-group">
          <input type="number" id="coefficientMarge" min="1" step="0.1" value="${params.coefficientMarge}">
          <span class="input-suffix">× coût matière</span>
        </div>
        <p class="field-hint">Ex. coefficient 3 → un gâteau à 8 € de matière première se vend 24 €.</p>
      </div>
    </div>

    <div class="card">
      <h3>Informations pour le devis</h3>
      <p style="margin-top:4px;">Affichées en haut de chaque devis généré.</p>
      <div class="form-row" style="margin-top:14px;">
        <div class="field">
          <label for="societeNom">Nom / enseigne</label>
          <input type="text" id="societeNom" placeholder="Ex. Les Douceurs de Camille" value="${escapeAttr(params.societeNom || '')}">
        </div>
        <div class="field">
          <label for="societeContact">Contact</label>
          <input type="text" id="societeContact" placeholder="Téléphone, Instagram, e-mail..." value="${escapeAttr(params.societeContact || '')}">
        </div>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; margin-top:22px;">
      <button class="btn btn-primary" id="btn-save-params">Enregistrer les paramètres</button>
    </div>
  `;

  document.getElementById('btn-save-params').addEventListener('click', async () => {
    const data = {
      grammesParPart: parseFloat(document.getElementById('grammesParPart').value) || 1,
      coefficientMarge: parseFloat(document.getElementById('coefficientMarge').value) || 1,
      societeNom: document.getElementById('societeNom').value.trim(),
      societeContact: document.getElementById('societeContact').value.trim(),
    };
    await DB.saveParametres(data);
    showToast('Paramètres enregistrés');
  });
}
