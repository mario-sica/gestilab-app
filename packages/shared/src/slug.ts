// Unica fonte di verità per lo slug di un istituto: usata dal provisioning
// tenant (creazione) e dal middleware Next.js (risoluzione da host). Prima
// di questo refactor la stessa lista era scritta due volte nella
// documentazione (docs/01-dominio.md e docs/02-architettura.md) e una terza
// volta qui come costante mai collegata a nessuna validazione: le tre copie
// erano già disallineate. Ora c'è un solo posto da cui tutto dipende.
//
// Aggiungere uno slug è sempre sicuro. Rimuoverne uno NO: uno slug già
// assegnato a un istituto è immutabile (docs/01-dominio.md) e stampato sulle
// etichette QR — toglierlo da questa lista permetterebbe in teoria a un
// nuovo istituto di registrarsi con quello slug, in conflitto con etichette
// già stampate e distribuite.
export const SLUG_RISERVATI = [
  'www',
  'app',
  'console',
  'api',
  'static',
  'cdn',
  'assets',
  'admin',
  'status',
  'docs',
  'mail',
  'auth',
  'login',
  'help',
  'support',
  'blog',
  'dev',
  'staging',
  'test',
  'files',
  'img',
  'ws',
] as const;

const REGEX_SLUG = /^[a-z0-9-]{3,40}$/;

export function eSlugRiservato(slug: string): boolean {
  return (SLUG_RISERVATI as readonly string[]).includes(slug);
}

/**
 * Solo il formato — `[a-z0-9-]{3,40}`, non inizia né finisce con un
 * trattino, niente trattini doppi — senza controllare se è riservato.
 * Usata da chi ha già escluso i riservati per conto proprio (es. il
 * middleware web, che li tratta diversamente: passthrough, non 404) e
 * ricontrollarli qui sarebbe un lavoro ripetuto a vuoto. Quando serve il
 * controllo completo in un colpo solo, usare `slugValido`.
 */
export function formatoSlugValido(slug: string): boolean {
  if (!REGEX_SLUG.test(slug)) {
    return false;
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return false;
  }
  if (slug.includes('--')) {
    return false;
  }
  return true;
}

/**
 * Valida uno slug di istituto: `docs/01-dominio.md` — formato più non
 * riservato, in un solo controllo. Usata dal provisioning tenant e dal
 * plugin tenant dell'API (task 0.7), dove non serve distinguere i due casi.
 */
export function slugValido(slug: string): boolean {
  return formatoSlugValido(slug) && !eSlugRiservato(slug);
}
