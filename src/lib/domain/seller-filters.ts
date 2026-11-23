/** Include active sellers even before their first order; retain historical names in this queue. */
export function sellerFilterNames(sellers:{name:string;active:boolean}[],assigned:(string|null)[]){
 return [...new Set([...sellers.filter(seller=>seller.active).map(seller=>seller.name),...assigned.map(name=>name||"Sem vendedora")])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
}
