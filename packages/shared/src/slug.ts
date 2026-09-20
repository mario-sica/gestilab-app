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

/**
 * Valida uno slug di istituto: `docs/01-dominio.md` — `[a-z0-9-]{3,40}`, non
 * uno slug riservato, non inizia né finisce con un trattino, niente trattini
 * doppi. Usata sia dal provisioning tenant sia dal middleware di
 * risoluzione tenant.
 */
export function slugValido(slug: string): boolean {
  if (!REGEX_SLUG.test(slug)) {
    return false;
  }
  if ((SLUG_RISERVATI as readonly string[]).includes(slug)) {
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
