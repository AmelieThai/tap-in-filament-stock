(function(root){
function available(s){return s.status!=='Terminée'&&s.weight>0}
function groupStock(rows){
 const map=new Map();
 for(const row of rows){const key=JSON.stringify([row.material.trim().toLowerCase(),row.color.trim().toLowerCase()]);if(!map.has(key))map.set(key,{material:row.material,color:row.color,rows:[],weight:0,count:0,opened:0,sealed:0});const g=map.get(key);g.rows.push(row);if(available(row)){g.weight+=row.weight;g.count++;if(row.status==='Neuve')g.sealed++;else g.opened++}}
 return [...map.values()].map(g=>({...g,low:g.count>0&&g.count<=2,empty:g.count===0}));
}
function normalizeBarcode(code){code=String(code??'').trim();if(/^[0-9\s-]+$/.test(code)){code=code.replace(/[\s-]/g,'');if([12,13,14].includes(code.length))return code.padStart(14,'0')}return code.toUpperCase()}
function matchingSpools(rows,code){const key=normalizeBarcode(code);return key?rows.filter(s=>normalizeBarcode(s.barcode)===key):[]}
root.Stock={available,groupStock,normalizeBarcode,matchingSpools};
})(typeof module!=='undefined'?module.exports:window);
