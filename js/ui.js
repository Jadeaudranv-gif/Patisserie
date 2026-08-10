// ui.js — toast + confirmation, utilisés par toutes les vues

function showToast(message, duree = 2400) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duree);
}

function promptDialog(message, placeholder = '', valeurInitiale = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:380px;">
        <p style="color:var(--color-ink); margin-bottom:14px;">${message}</p>
        <div class="field" style="margin-bottom:20px;">
          <input type="text" id="prompt-input" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(valeurInitiale)}">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-ghost" data-choice="cancel">Annuler</button>
          <button class="btn btn-primary" data-choice="ok">${valeurInitiale ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#prompt-input');
    setTimeout(() => { input.focus(); input.select(); }, 0);

    const finir = (valeur) => { overlay.remove(); resolve(valeur); };

    overlay.addEventListener('click', (e) => {
      const choix = e.target.getAttribute?.('data-choice');
      if (choix === 'ok') finir(input.value.trim() || null);
      else if (choix === 'cancel') finir(null);
      else if (e.target === overlay) finir(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finir(input.value.trim() || null); }
      if (e.key === 'Escape') finir(null);
    });
  });
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:380px;">
        <p style="color:var(--color-ink); margin-bottom:20px;">${message}</p>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-ghost" data-choice="false">Annuler</button>
          <button class="btn btn-primary" data-choice="true">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      const choice = e.target.getAttribute?.('data-choice');
      if (choice !== null && choice !== undefined) {
        overlay.remove();
        resolve(choice === 'true');
      } else if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}