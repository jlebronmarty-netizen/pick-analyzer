import names from '@/data/ncaab-team-display-names.json' with {type:'json'};

// Presentation aliases keyed by the original ESPN identity. Sourced from the
// archived scoreboards' explicit university/location field, never guessed by
// removing words. Unknown identities retain their original provider label.
export function ncaabTeamName(id:string,originalName:string|null|undefined){
 const label=(names as Record<string,string>)[id];
 return typeof label==='string'?label:originalName??id;
}
