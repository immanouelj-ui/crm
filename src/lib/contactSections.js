const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const ASSIGNMENT = new Set(['installateur_nom','installateur_telephone','installation_date','installation_heure','installation_rdv_id']);
export function groupContactFields(fields) {
  const groups = { contact:[], address:[], project:[], extra:[], assignment:[] };
  for (const field of fields) {
    const key=normalize(field.name), label=normalize(field.label), value=key+'_'+label;
    if(ASSIGNMENT.has(key))groups.assignment.push(field);
    else if(['email','phone','tel'].includes(field.type)||/^(nom|name|prenom|first_name|last_name|firstname|lastname|email|phone|telephone|tel|mobile|statut|status|source|company|entreprise|societe|assigne_a|poste)$/.test(key)||/^(nom|prenom|nom_de_l_entreprise|adresse_e_mail|email|telephone|numero_de_telephone|statut|source|entreprise)$/.test(label))groups.contact.push(field);
    else if(/logement|statut_du_bien|statut_bien|proprietaire|vehicule|marque|puissance|compteur|distance|delai|borne|chantier|installation/.test(value))groups.project.push(field);
    else if(/^(cp|zip|pays|country|ville|city|rue|commune)$/.test(key)||/^(cp|pays|ville|rue|commune)$/.test(label)||/adresse|address|code_postal|codepostal|postal_code|localite/.test(value))groups.address.push(field);
    else groups.extra.push(field);
  }
  return groups;
}
export function contactDisplayName(data,id) {
  const last=String(data.nom||data.name||data.last_name||'').trim();
  const first=String(data.prenom||data.first_name||data.firstname||'').trim();
  return [first&& !(' '+last.toLocaleLowerCase('fr')+' ').includes(' '+first.toLocaleLowerCase('fr')+' ')?first:'',last].filter(Boolean).join(' ')||first||`Contact #${id}`;
}
