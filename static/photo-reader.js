(function(root){
const z=typeof module!=='undefined'?require('./vendor/zxing.min.js'):root.ZXing;
async function decodeGray(gray,w,h,progress=()=>{},cancel=()=>false){
 const hints=new Map([[z.DecodeHintType.TRY_HARDER,true],[z.DecodeHintType.POSSIBLE_FORMATS,[z.BarcodeFormat.EAN_13,z.BarcodeFormat.UPC_A,z.BarcodeFormat.EAN_8,z.BarcodeFormat.UPC_E,z.BarcodeFormat.CODE_128,z.BarcodeFormat.CODE_39,z.BarcodeFormat.ITF,z.BarcodeFormat.QR_CODE]]]);
 const reader=new z.MultiFormatReader();reader.setHints(hints);
 for(const contrast of [false,true])for(const angle of [0,90,180,270]){
  if(cancel())throw Error('Cancelled');progress('Reading photo… '+(contrast?'enhanced contrast · ':'')+angle+'°');
  await new Promise(resolve=>setTimeout(resolve,0));
  const rotated=new Uint8ClampedArray(w*h),rw=angle%180?h:w,rh=angle%180?w:h;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const dx=angle===90?h-1-y:angle===180?w-1-x:angle===270?y:x;
   const dy=angle===90?x:angle===180?h-1-y:angle===270?w-1-x:y;
   const value=gray[y*w+x];rotated[dy*rw+dx]=contrast?Math.max(0,Math.min(255,(value-128)*1.8+128)):value;
  }
  try{return reader.decode(new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(rotated,rw,rh))),hints).getText()}catch{}finally{reader.reset()}
 }
 throw Error('No readable barcode');
}
async function read(canvas,progress,cancel){
 const scale=Math.min(1,2200/Math.max(canvas.width,canvas.height)),c=document.createElement('canvas');c.width=Math.round(canvas.width*scale);c.height=Math.round(canvas.height*scale);
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height).data,gray=new Uint8ClampedArray(c.width*c.height);
 for(let i=0;i<gray.length;i++)gray[i]=(pixels[i*4]*77+pixels[i*4+1]*150+pixels[i*4+2]*29)>>8;
 return decodeGray(gray,c.width,c.height,progress,cancel);
}
const api={read,decodeGray};if(typeof module!=='undefined')module.exports=api;else root.PhotoBarcode=api;
})(typeof window!=='undefined'?window:globalThis);
