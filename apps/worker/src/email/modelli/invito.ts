import type { JobEmailInvito } from '@gestilab/shared';

export interface Messaggio {
  oggetto: string;
  testo: string;
  html: string;
}

function scappaHtml(valore: string): string {
  return valore.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Testo semplice + HTML minimo, nessuna immagine remota né CSS esterno
// (docs/CLAUDE.md: niente risorse online presupposte). La data di scadenza
// è formattata in italiano con il fuso di Roma: l'invitato la legge, non
// una macchina.
export function modelloInvito(job: JobEmailInvito): Messaggio {
  const scadenza = new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Rome',
  }).format(new Date(job.scadeIl));

  const oggetto = `Invito a GestiLab — ${job.istituto}`;
  const testo = [
    `Ciao ${job.nome},`,
    '',
    `sei stato invitato a usare GestiLab per ${job.istituto}.`,
    'Per impostare la tua password apri questo link:',
    '',
    job.link,
    '',
    `Il link vale fino al ${scadenza} e si può usare una sola volta.`,
    'Se non ti aspettavi questo invito puoi ignorare questa email.',
  ].join('\n');

  const html = [
    `<p>Ciao ${scappaHtml(job.nome)},</p>`,
    `<p>sei stato invitato a usare GestiLab per <strong>${scappaHtml(job.istituto)}</strong>.<br>`,
    `Per impostare la tua password apri questo link:</p>`,
    `<p><a href="${scappaHtml(job.link)}">${scappaHtml(job.link)}</a></p>`,
    `<p>Il link vale fino al ${scappaHtml(scadenza)} e si può usare una sola volta.<br>`,
    `Se non ti aspettavi questo invito puoi ignorare questa email.</p>`,
  ].join('\n');

  return { oggetto, testo, html };
}
