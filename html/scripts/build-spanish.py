from pathlib import Path
from html.parser import HTMLParser
from html import escape
from urllib.parse import urljoin, urlsplit
import json,re,posixpath
root=Path(__file__).resolve().parents[1]
translations=json.loads((root/'content/es.json').read_text(encoding='utf-8'))
all_routes=json.loads((root/'content/routes.json').read_text(encoding='utf-8'))
routes={r['en']:r for r in all_routes if not r['en'].startswith('/en/guides/')}
class Translate(HTMLParser):
 def __init__(self,old,new):super().__init__(convert_charrefs=True);self.old=old;self.new=new;self.out=[];self.script=False;self.json=False
 def trans(self,v):
  stripped=v.strip()
  return v.replace(stripped,translations[stripped]) if stripped in translations else v
 def url(self,v):
  if not v or v.startswith(('#','data:','mailto:','tel:','http:','https:')):return v
  resolved=urljoin('https://local'+self.old,v);u=urlsplit(resolved);p=u.path.removesuffix('index.html');p=p if p.endswith('/') else p
  if p in routes:
   new=routes[p]['es'];rel=posixpath.relpath(new.strip('/')+'/index.html',self.new.strip('/'))
   if v.startswith('/'):rel=new
   else:rel=rel.removesuffix('index.html') or './'
   return rel+('?' + u.query if u.query else '')+('#'+u.fragment if u.fragment else '')
  return v
 def handle_decl(self,d):self.out.append('<!'+d+'>')
 def handle_comment(self,d):self.out.append('<!--'+d+'-->')
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script':self.script=True;self.json=a.get('type')=='application/ld+json'
  arr=[]
  for k,v in attrs:
   if v is not None:
    if k in ('alt','aria-label','placeholder','title') or (tag=='meta' and k=='content'):v=self.trans(v)
    if k=='lang':v='es'
    if k=='content' and a.get('property')=='og:locale':v='es_ES'
    if k in ('href','action') or (tag=='option' and k=='value' and ('/' in v)):v=self.url(v)
   arr.append(k if v is None else k+'="'+escape(v,quote=True)+'"')
  self.out.append('<'+tag+(' '+' '.join(arr) if arr else '')+'>')
 def handle_startendtag(self,t,a):
  self.handle_starttag(t,a);self.out[-1]=self.out[-1][:-1]+"/>"
 def handle_endtag(self,t):
  self.out.append('</'+t+'>')
  if t=='script':self.script=False;self.json=False
 def handle_data(self,d):
  if self.json:
   def walk(v):
    if isinstance(v,dict):return {k:('es' if k=='inLanguage' else walk(x)) for k,x in v.items()}
    if isinstance(v,list):return [walk(x) for x in v]
    if isinstance(v,str):return self.url(v) if v.startswith('/en/') else self.trans(v)
    return v
   self.out.append(json.dumps(walk(json.loads(d)),ensure_ascii=False))
  elif self.script:self.out.append(d)
  else:self.out.append(escape(self.trans(d),quote=False))
for old,langs in routes.items():
 src=(root/old.strip('/')/'index.html').read_text(encoding='utf-8-sig');p=Translate(old,langs['es']);p.feed(src)
 dest=root/langs['es'].strip('/')/'index.html';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(''.join(p.out),encoding='utf-8')
print('Spanish pages:',len(routes),'translated strings:',len(translations))
