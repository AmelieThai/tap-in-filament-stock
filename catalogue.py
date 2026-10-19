import re

def normalize(code):
 code=str(code).strip()
 if re.fullmatch(r"[0-9\s-]+",code):
  code=re.sub(r"[\s-]","",code)
  if len(code) in (12,13,14): return code.zfill(14)
 return code.upper()

def remember(c,barcode,material,color,source='Your saved product'):
 c.execute("INSERT INTO products(code,barcode,material,color,source) VALUES(?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET barcode=excluded.barcode,material=excluded.material,color=excluded.color,source=excluded.source",(normalize(barcode),barcode,material,color,source))

def lookup(c,code):
 key=normalize(code)
 # Detect conflicting legacy inventory entries instead of choosing an arbitrary spool.
 rows=[dict(r) for r in c.execute('SELECT barcode,material,color FROM spools ORDER BY id DESC') if normalize(r['barcode'])==key]
 choices={(r['material'].casefold(),r['color'].casefold()) for r in rows}
 if len(choices)>1: return {'found':False,'conflict':True}
 if rows: return {'found':True,**rows[0],'source':'Your stock'}
 row=c.execute('SELECT barcode,material,color,source FROM products WHERE code=?',(key,)).fetchone()
 return {'found':True,**dict(row)} if row else {'found':False,'conflict':False}
