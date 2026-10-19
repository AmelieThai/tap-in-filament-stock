from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sqlite3, json, ssl, socket, ipaddress, argparse, datetime, socketserver, threading
from urllib.parse import urlparse, parse_qs
from catalogue import normalize, remember, lookup
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
DB=DATA/'stock.sqlite3'
def local_addresses():
 addresses={"127.0.0.1"}
 try:
  with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as sock:
   sock.connect(("192.0.2.1",80)); addresses.add(sock.getsockname()[0])
 except OSError: pass
 return sorted(addresses)
class LocalServer(ThreadingHTTPServer):
 def server_bind(self):
  socketserver.TCPServer.server_bind(self)
  self.server_name="localhost"; self.server_port=self.server_address[1]
def connect():
 c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c
def init():
 with connect() as c:
  c.execute("CREATE TABLE IF NOT EXISTS spools(id INTEGER PRIMARY KEY, barcode TEXT NOT NULL, material TEXT NOT NULL, color TEXT NOT NULL, weight INTEGER NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL, created TEXT NOT NULL)")
  c.execute("CREATE TABLE IF NOT EXISTS products(code TEXT PRIMARY KEY, barcode TEXT NOT NULL, material TEXT NOT NULL, color TEXT NOT NULL, source TEXT NOT NULL)")
  for product in json.loads((ROOT/'catalogue.json').read_text()):
   for code in [product['barcode']]+product.get('aliases',[]):
    c.execute("INSERT OR IGNORE INTO products VALUES(?,?,?,?,?)",(normalize(code),code,product['material'],product['color'],product['source']))
  for row in c.execute('SELECT barcode,material,color FROM spools ORDER BY id').fetchall():
   if not c.execute('SELECT 1 FROM products WHERE code=?',(normalize(row['barcode']),)).fetchone(): remember(c,row['barcode'],row['material'],row['color'])
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT/'static'),**kw)
 def end_headers(self):
  self.send_header('Cache-Control','no-store, max-age=0')
  super().end_headers()
 def allowed(self):
  try: return ipaddress.ip_address(self.client_address[0]).is_private
  except ValueError: return False
 def reply(self,status,obj):
  raw=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(raw)
 def do_GET(self):
  if not self.allowed(): return self.reply(403,{'error':'Local network access only'})
  if urlparse(self.path).path=='/api/lookup':
   code=parse_qs(urlparse(self.path).query).get('code',[''])[0]
   if not code or len(code)>120: return self.reply(400,{'error':'Invalid barcode'})
   with connect() as c: result=lookup(c,code)
   return self.reply(200,result)
  if self.path=='/api/spools':
   with connect() as c: rows=[dict(r) for r in c.execute('SELECT * FROM spools ORDER BY id DESC')]
   return self.reply(200,rows)
  if self.path=='/api/backup':
   with connect() as c:
    rows=[dict(r) for r in c.execute('SELECT * FROM spools')]
    products=[dict(r) for r in c.execute('SELECT barcode,material,color,source FROM products')]
   self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Disposition','attachment; filename="stock-filaments.json"'); self.end_headers(); self.wfile.write(json.dumps({'version':2,'spools':rows,'products':products},ensure_ascii=False,indent=2).encode()); return
  if self.path=='/certificat.crt':
   raw=(DATA/'tap-in-root.cer').read_bytes(); self.send_response(200); self.send_header('Content-Type','application/x-x509-ca-cert'); self.end_headers(); self.wfile.write(raw); return
  if self.path.split('?')[0] not in ['/', '/index.html','/app.js','/inventory.js','/photo-reader.js','/vendor/zxing.min.js','/style.css','/vendor/html5-qrcode.min.js']:
   return self.reply(404,{'error':'Not found'})
  if 'If-Modified-Since' in self.headers: del self.headers['If-Modified-Since']
  if 'If-None-Match' in self.headers: del self.headers['If-None-Match']
  super().do_GET()
 def do_POST(self):
  if not self.allowed(): return self.reply(403,{'error':'Local network access only'})
  origin=self.headers.get('Origin')
  if origin and urlparse(origin).netloc != self.headers.get('Host'): return self.reply(403,{'error':'Origin rejected'})
  try:
   n=int(self.headers.get('Content-Length','0'))
   if not 0<n<2000000: raise ValueError('Request too large or empty')
   if self.headers.get('Content-Type','').split(';')[0]!='application/json': raise ValueError('JSON required')
   obj=json.loads(self.rfile.read(n))
   if self.path=='/api/save':
    row=validate(obj)
    quantity=obj.get('quantity',1)
    if isinstance(quantity,bool) or not isinstance(quantity,int) or not 1<=quantity<=100: raise ValueError('Quantity must be a whole number from 1 to 100')
    if obj.get('id') and quantity!=1: raise ValueError('An existing spool must be edited individually')
    with connect() as c:
     if obj.get('id'):
      cur=c.execute('UPDATE spools SET barcode=?,material=?,color=?,weight=?,location=?,status=? WHERE id=?',row+[int(obj['id'])])
      if not cur.rowcount: raise ValueError('Spool not found')
     else:
      c.executemany('INSERT INTO spools(barcode,material,color,weight,location,status,created) VALUES(?,?,?,?,?,?,?)',[row+[datetime.datetime.now(datetime.timezone.utc).isoformat()] for _ in range(quantity)])
     remember(c,row[0],row[1],row[2])
    return self.reply(200,{'ok':True})
   if self.path=='/api/delete':
    with connect() as c: c.execute('DELETE FROM spools WHERE id=?',(int(obj['id']),))
    return self.reply(200,{'ok':True})
   if self.path=='/api/import':
    if obj.get('version') not in (1,2) or not isinstance(obj.get('spools'),list): raise ValueError('Incompatible backup')
    rows=[validate(r) for r in obj['spools']]
    products=obj.get('products',[])
    if not isinstance(products,list): raise ValueError('Invalid product catalogue')
    learned=[validate({**r,'weight':0,'location':'','status':'Neuve'})[:3] for r in products]
    with connect() as c:
     c.execute('DELETE FROM spools')
     c.executemany('INSERT INTO spools(barcode,material,color,weight,location,status,created) VALUES(?,?,?,?,?,?,?)',[r+[datetime.datetime.now(datetime.timezone.utc).isoformat()] for r in rows])
     for r in learned+[r[:3] for r in rows]: remember(c,*r)
    return self.reply(200,{'ok':True})
   return self.reply(404,{'error':'Not found'})
  except (ValueError,TypeError,KeyError) as e: return self.reply(400,{'error':str(e)})
def validate(o):
 fields=[]
 for key in ['barcode','material','color']:
  v=o.get(key)
  if not isinstance(v,str) or not v.strip() or len(v)>120: raise ValueError('Barcode, material and color required (maximum 120 characters)')
  fields.append(v.strip())
 weight=o.get('weight')
 if isinstance(weight,bool) or not isinstance(weight,int) or not 0<=weight<=10000: raise ValueError('Invalid weight: enter 0 to 10,000 g')
 location=o.get('location','')
 if not isinstance(location,str) or len(location)>120: raise ValueError('Invalid location')
 status=o.get('status')
 if status not in ['Neuve','Ouverte','Terminée']: raise ValueError('Invalid status')
 return fields+[weight,location.strip(),status]
def certificate():
 from cryptography import x509
 from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
 from cryptography.hazmat.primitives import hashes, serialization
 from cryptography.hazmat.primitives.asymmetric import rsa
 cert=DATA/'cert.pem'; key=DATA/'key.pem'; ca_file=DATA/'tap-in-root.cer'; ca_key=DATA/'root-key.pem'
 now=datetime.datetime.now(datetime.timezone.utc)
 def save_key(path,value):
  path.write_bytes(value.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())); path.chmod(0o600)
 if ca_file.exists() and ca_key.exists():
  root=x509.load_der_x509_certificate(ca_file.read_bytes())
  root_key=serialization.load_pem_private_key(ca_key.read_bytes(),password=None)
 else:
  root_key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
  root_name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'TAP IN Local CA')])
  root=(x509.CertificateBuilder().subject_name(root_name).issuer_name(root_name).public_key(root_key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(days=1)).not_valid_after(now+datetime.timedelta(days=3650)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True).add_extension(x509.KeyUsage(digital_signature=True,content_commitment=False,key_encipherment=False,data_encipherment=False,key_agreement=False,key_cert_sign=True,crl_sign=True,encipher_only=False,decipher_only=False),critical=True).add_extension(x509.SubjectKeyIdentifier.from_public_key(root_key.public_key()),critical=False).sign(root_key,hashes.SHA256()))
  ca_file.write_bytes(root.public_bytes(serialization.Encoding.DER)); save_key(ca_key,root_key)
 ips=[ipaddress.ip_address(a) for a in local_addresses()]
 if cert.exists() and key.exists():
  try:
   current=x509.load_pem_x509_certificate(cert.read_bytes())
   stored=current.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress)
   if current.issuer==root.subject and set(ips)<=set(stored) and current.not_valid_after_utc>now+datetime.timedelta(days=1): return cert,key
  except (ValueError,x509.ExtensionNotFound): pass
 private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
 name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'TAP IN Filament Local')])
 leaf=(x509.CertificateBuilder().subject_name(name).issuer_name(root.subject).public_key(private.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-datetime.timedelta(days=1)).not_valid_after(now+datetime.timedelta(days=365)).add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True).add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(root_key.public_key()),critical=False).add_extension(x509.SubjectKeyIdentifier.from_public_key(private.public_key()),critical=False).add_extension(x509.KeyUsage(digital_signature=True,content_commitment=False,key_encipherment=True,data_encipherment=False,key_agreement=False,key_cert_sign=False,crl_sign=False,encipher_only=False,decipher_only=False),critical=True).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),critical=False).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]+[x509.IPAddress(ip) for ip in ips]),critical=False).sign(root_key,hashes.SHA256()))
 cert.write_bytes(leaf.public_bytes(serialization.Encoding.PEM)+root.public_bytes(serialization.Encoding.PEM)); save_key(key,private)
 return cert,key
class SetupHandler(Handler):
 def do_GET(self):
  if not self.allowed(): return self.reply(403,{'error':'Local access only'})
  if self.path=='/tap-in-root.cer':
   raw=(DATA/'tap-in-root.cer').read_bytes(); self.send_response(200); self.send_header('Content-Type','application/x-x509-ca-cert'); self.send_header('Content-Disposition','attachment; filename="tap-in-root.cer"'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw); return
  self.reply(404,{'error':'This port only serves the public setup certificate at /tap-in-root.cer'})
 def do_POST(self): self.reply(405,{'error':'Read only'})
if __name__=='__main__':
 parser=argparse.ArgumentParser(); parser.add_argument('--http',action='store_true',help='Développement sur cet ordinateur uniquement'); args=parser.parse_args(); init()
 server=LocalServer(('127.0.0.1' if args.http else '0.0.0.0',8080 if args.http else 8443),Handler)
 if not args.http:
  cert,key=certificate(); setup=LocalServer(('0.0.0.0',8081),SetupHandler); threading.Thread(target=setup.serve_forever,daemon=True).start(); ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cert,key); server.socket=ctx.wrap_socket(server.socket,server_side=True)
 scheme='http' if args.http else 'https'; port=8080 if args.http else 8443
 print(f'Filament Local : {scheme}://localhost:{port}',flush=True)
 for addr in local_addresses(): print(f'Adresse réseau : {scheme}://{addr}:{port}',flush=True)
 server.serve_forever()
