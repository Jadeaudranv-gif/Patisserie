// router.js — routage minimal basé sur location.hash

const routes = [];

function route(pattern, handler) {
  // pattern du type "#/recettes/:id"
  const parts = pattern.split('/');
  routes.push({ parts, handler });
}

function matchRoute(hash) {
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashParts = cleanHash.split('/').filter((p) => p !== '' || cleanHash === '/');
  const normalizedHashParts = cleanHash === '' || cleanHash === '/' ? [''] : hashParts;

  for (const r of routes) {
    const patternParts = r.parts.filter((p) => p !== '#');
    if (patternParts.length !== normalizedHashParts.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i];
      const hp = normalizedHashParts[i];
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = hp;
      } else if (pp !== hp) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler: r.handler, params };
  }
  return null;
}

function startRouter(defaultHash = '#/commandes') {
  function render() {
    if (!location.hash) {
      location.hash = defaultHash;
      return;
    }
    const match = matchRoute(location.hash);
    document.querySelectorAll('.nav-link').forEach((a) => {
      a.classList.remove('active');
      const prefix = a.getAttribute('data-hash-prefix');
      if (prefix && location.hash.startsWith(prefix)) a.classList.add('active');
    });

    if (match) {
      match.handler(match.params);
    } else {
      document.getElementById('app-view').innerHTML =
        '<div class="empty-state"><p>Page introuvable.</p></div>';
    }
  }

  window.addEventListener('hashchange', render);
  render();
}
