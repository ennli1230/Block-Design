from pathlib import Path
from html import escape as e
from urllib.parse import urljoin,urlsplit
import json,re,posixpath,math
ROOT=Path(__file__).resolve().parents[1]
articles=json.loads((ROOT/'content/guides.json').read_text(encoding='utf-8-sig'))
routes=json.loads((ROOT/'content/routes.json').read_text(encoding='utf-8'))
U={
 'tr':{'base':'/tr/rehber/','nav':'Blog','title':'Ege’yi keşfetmeden önce.','intro':'Kuşadası, antik kentler ve size özel yolculuklar için seyahat notları. Daha çok yer görmekten önce, size uygun günü planlayın.','blog':'Seyahat rehberi','home':'Ana sayfa','all':'Tümü','routes':'Rota fikirleri','culture':'Kültür & tarih','cruise':'Kruvaziyer','search':'Rehberde ara','placeholder':'Yer veya konu arayın','read':'Yazıyı oku','minutes':'dk okuma','empty':'Aramanıza uygun bir yazı bulunamadı.','reset':'Filtreleri temizle','toc':'Bu yazıda','faq':'Merak edilenler','related':'Okumaya devam edin.','date':'30 Eylül 2026','cta':'Okuduklarınızı bir yolculuğa dönüştürün.','ctaText':'Tarihinizi, başlangıç noktanızı ve merak ettiklerinizi paylaşın. Rotayı birlikte şekillendirelim.','plan':'Yolculuğunuzu planlayın','allLink':'Tüm yazılar','homeTitle':'Yola çıkmadan önce birkaç not.','homeIntro':'Gününüzü planlamaya yardımcı olacak yerel rotalar ve pratik öneriler.','destination':'Kuşadası rehberini inceleyin','tour':'Efes turunu inceleyin','shore':'Liman turlarını inceleyin','result':'yazı'},
 'en':{'base':'/en/guides/','nav':'Blog','title':'Before you explore the Aegean.','intro':'Travel notes for Kuşadası, ancient cities and personal journeys. Start by planning a day that feels right for you.','blog':'Travel journal','home':'Home','all':'All','routes':'Route ideas','culture':'Culture & history','cruise':'Cruise travel','search':'Search the journal','placeholder':'Search a place or topic','read':'Read the story','minutes':'min read','empty':'No stories match your search.','reset':'Clear filters','toc':'In this story','faq':'Useful answers','related':'Keep exploring.','date':'30 September 2026','cta':'Turn an idea into a journey.','ctaText':'Share your dates, starting point and interests. We will shape the route together.','plan':'Plan your journey','allLink':'All stories','homeTitle':'A few notes before you go.','homeIntro':'Thoughtful routes and practical ideas to help you plan your day.','destination':'Explore the Kuşadası guide','tour':'Explore the Ephesus tour','shore':'Explore shore excursions','result':'stories'},
 'es':{'base':'/es/guias/','nav':'Blog','title':'Antes de descubrir el Egeo.','intro':'Notas de viaje para Kuşadası, ciudades antiguas y rutas personales. Empieza por planificar un día a tu medida.','blog':'Guía de viaje','home':'Inicio','all':'Todo','routes':'Ideas de rutas','culture':'Cultura e historia','cruise':'Cruceros','search':'Buscar en la guía','placeholder':'Busca un lugar o un tema','read':'Leer el artículo','minutes':'min de lectura','empty':'No hay artículos para esta búsqueda.','reset':'Borrar filtros','toc':'En este artículo','faq':'Preguntas útiles','related':'Sigue explorando.','date':'30 de septiembre de 2026','cta':'Convierte una idea en un viaje.','ctaText':'Comparte las fechas, el punto de partida y tus intereses. Diseñaremos juntos la ruta.','plan':'Planifica tu viaje','allLink':'Todos los artículos','homeTitle':'Unas notas antes de salir.','homeIntro':'Rutas y consejos prácticos para ayudarte a planificar tu día.','destination':'Ver la guía de Kuşadası','tour':'Ver el tour de Éfeso','shore':'Ver excursiones de crucero','result':'artículos'}}
related={l:{'destination':next(r[l] for r in routes if r['en']=='/en/destinations/kusadasi/'),'tour':next(r[l] for r in routes if r['en']=='/en/tours/ephesus-private-tour/'),'shore':next(r[l] for r in routes if r['en']=='/en/shore-excursions/'),'plan':next(r[l] for r in routes if r['en']=='/en/tailor-made/')} for l in U}
blogroutes=[{l:u['base'] for l,u in U.items()}]+[{l:U[l]['base']+a['locales'][l]['slug']+'/' for l in U} for a in articles]
routes=[r for r in routes if r['en'] not in {b['en'] for b in blogroutes}]+blogroutes
(ROOT/'content/routes.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2),encoding='utf-8')
def rel(current,target):
 u=urlsplit(target)
 if u.scheme or target.startswith(('#','data:','mailto:','tel:')):return target
 path=u.path
 if path.endswith('/'):path+='index.html'
 return posixpath.relpath(path.strip('/'),current.strip('/'))+('?' + u.query if u.query else '')+('#'+u.fragment if u.fragment else '')
def rebase(fragment,old,current):
 return re.sub(r'(href|src|value)="([^"]*)"',lambda m:m.group(0) if not m[2] or m[2].startswith(('#','data:','http','mailto:','tel:')) else m[1]+'="'+e(rel(current,urljoin('https://local'+old,m[2]).removeprefix('https://local')),quote=True)+'"',fragment)
def link(current,target,label,cls=''):return f'<a'+(f' class="{cls}"' if cls else '')+f' href="{rel(current,target)}">{e(label)}</a>'
def card(a,l,current,featured=False,level=2):
 d=a['locales'][l];u=U[l];url=u['base']+d['slug']+'/';words=len(' '.join(p for s in d['sections'] for p in s['paragraphs']).split());mins=max(2,math.ceil(words/200))
 return f'<article class="journal-card{" journal-card--featured" if featured else ""}" data-guide-card data-category="{a["category"]}"><a class="journal-card-image" href="{rel(current,url)}" tabindex="-1" aria-hidden="true"><img src="{rel(current,"/assets/images/"+a["image"])}" alt="" width="1100" height="735" loading="{"eager" if featured else "lazy"}"></a><div class="journal-card-body"><p class="journal-meta"><span>{u[a["category"]]}</span><span>{mins} {u["minutes"]}</span></p><h{level}>{link(current,url,d["title"])}</h{level}><p>{e(d["description"])}</p><a class="journal-read" href="{rel(current,url)}">{u["read"]}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a></div></article>'
def shell(l,current,title,desc,body,schema,img,article=False):
 source=(ROOT/l/'index.html').read_text(encoding='utf-8-sig')
 header=re.search(r'<header\b.*?</header>',source,re.S)[0];footer=re.search(r'<footer\b.*?</footer>',source,re.S)[0]
 header=rebase(header,'/'+l+'/',current);footer=rebase(footer,'/'+l+'/',current)
 html=f'''<!doctype html>
<html lang="{l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)} | Scala Nova</title><meta name="description" content="{e(desc,quote=True)}"><meta name="robots" content="index,follow"><link rel="icon" href="data:,"><link rel="stylesheet" href="{rel(current,'/assets/css/styles.css')}"><link rel="canonical" href="{current}"><meta property="og:type" content="{'article' if article else 'website'}"><meta property="og:locale" content="{ {'tr':'tr_TR','en':'en_US','es':'es_ES'}[l]}"><meta property="og:title" content="{e(title,quote=True)}"><meta property="og:description" content="{e(desc,quote=True)}"><meta property="og:image" content="/assets/images/{img}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace('</','<\\/')}</script></head><body class="journal-page">{header}<main id="main-content">{body}</main>{footer}<script src="{rel(current,'/assets/js/app.js')}"></script></body></html>'''
 dest=ROOT/current.strip('/')/'index.html';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(html,encoding='utf-8')
for l,u in U.items():
 current=u['base']
 controls=f'<div class="journal-filters" data-guide-filters hidden><div class="journal-categories" role="group" aria-label="{u["allLink"]}">'+''.join(f'<button type="button" data-guide-filter="{k}" aria-pressed="{str(k=="all").lower()}">{u[k]}</button>' for k in ('all','routes','culture','cruise'))+f'</div><label class="journal-search"><span>{u["search"]}</span><input type="search" data-guide-search placeholder="{u["placeholder"]}" autocomplete="off"></label></div>'
 body=f'<div class="container journal-index" data-guide-index><header class="journal-heading"><nav class="journal-breadcrumb" aria-label="{u["blog"]}">{link(current,"/"+l+"/",u["home"])}<span aria-hidden="true">/</span><span aria-current="page">{u["blog"]}</span></nav><h1>{u["title"]}</h1><p>{u["intro"]}</p></header>{controls}<p class="journal-results" data-guide-count role="status" data-result-label="{u["result"]}" hidden></p><div class="journal-grid">'+''.join(card(a,l,current,i==0) for i,a in enumerate(articles))+f'</div><div class="journal-empty" data-guide-empty hidden><h2>{u["empty"]}</h2><button type="button" class="button" data-guide-reset>{u["reset"]}</button></div></div>'
 schema={'@context':'https://schema.org','@type':'CollectionPage','name':u['blog'],'description':u['intro'],'url':current,'inLanguage':l,'mainEntity':{'@type':'ItemList','itemListElement':[{'@type':'ListItem','position':i+1,'url':current+a['locales'][l]['slug']+'/','name':a['locales'][l]['title']} for i,a in enumerate(articles)]}}
 shell(l,current,u['blog'],u['intro'],body,schema,'ephesus-celsus.jpg')
 for a in articles:
  d=a['locales'][l];current=u['base']+d['slug']+'/';mins=max(2,math.ceil(len(' '.join(p for s in d['sections'] for p in s['paragraphs']).split())/200))
  crumbs=f'<nav class="journal-breadcrumb" aria-label="{ {"tr":"Sayfa yolu","en":"Breadcrumb","es":"Ruta de navegación"}[l]}">{link(current,"/"+l+"/",u["home"])}<span aria-hidden="true">/</span>{link(current,u["base"],u["blog"])}</nav>'
  body=f'<article class="journal-article"><header class="container journal-article-header">{crumbs}<p class="journal-meta"><span>{u[a["category"]]}</span><span>{mins} {u["minutes"]}</span></p><h1>{e(d["title"])}</h1><p class="journal-deck">{e(d["description"])}</p><p class="journal-byline">Scala Nova <span aria-hidden="true">·</span> <time datetime="2026-09-30">{u["date"]}</time></p></header><figure class="container journal-cover"><img src="{rel(current,"/assets/images/"+a["image"])}" alt="{e(d["alt"],quote=True)}" width="1500" height="850" fetchpriority="high"><figcaption>{e(d["alt"])}</figcaption></figure><div class="container journal-reading"><aside class="journal-toc"><nav aria-label="{u["toc"]}"><p>{u["toc"]}</p><ol>'+''.join(f'<li><a href="#section-{i+1}">{e(s["title"])}</a></li>' for i,s in enumerate(d['sections']))+f'</ol></nav>{link(current,related[l][a["related"]],u[a["related"]],"journal-related-link")}</aside><div class="journal-prose">'
  for i,s in enumerate(d['sections']):body+=f'<section id="section-{i+1}"><h2>{e(s["title"])}</h2>'+''.join('<p>'+e(p)+'</p>' for p in s['paragraphs'])+'</section>'
  body+=f'<section class="journal-faq"><h2>{u["faq"]}</h2><div class="faq-list">'+''.join(f'<details><summary>{e(q)}</summary><p>{e(ans)}</p></details>' for q,ans in d['faq'])+'</div></section></div></div></article>'
  body+=f'<section class="journal-cta"><div class="container"><div><h2>{u["cta"]}</h2><p>{u["ctaText"]}</p></div>{link(current,related[l]["plan"],u["plan"],"button button--bronze")}</div></section>'
  body+=f'<section class="container journal-more"><div class="journal-section-heading"><h2>{u["related"]}</h2>{link(current,u["base"],u["allLink"],"text-link")}</div><div class="journal-grid">'+''.join(card(b,l,current,level=3) for b in articles if b['id']!=a['id'])+'</div></section>'
  schema={'@context':'https://schema.org','@graph':[{'@type':'BlogPosting','headline':d['title'],'description':d['description'],'datePublished':'2026-09-30','dateModified':'2026-09-30','inLanguage':l,'mainEntityOfPage':current,'image':'/assets/images/'+a['image'],'author':{'@type':'Organization','name':'Scala Nova'},'publisher':{'@type':'Organization','name':'Scala Nova'}},{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':u['home'],'item':'/'+l+'/'},{'@type':'ListItem','position':2,'name':u['blog'],'item':u['base']},{'@type':'ListItem','position':3,'name':d['title'],'item':current}]}]}
  shell(l,current,d['title'],d['description'],body,schema,a['image'],True)
 # Shared home preview, generated from the same content.
 home=ROOT/l/'index.html';text=home.read_text(encoding='utf-8-sig');text=re.sub(r'<section\b[^>]*data-home-journal.*?</section>','',text,flags=re.S)
 preview=f'<section class="section home-journal" data-home-journal><div class="container"><div class="journal-section-heading"><div><h2>{u["homeTitle"]}</h2><p>{u["homeIntro"]}</p></div>{link("/"+l+"/",u["base"],u["allLink"],"text-link")}</div><div class="journal-grid journal-grid--three">'+''.join(card(a,l,'/'+l+'/',level=3) for a in articles)+'</div></div></section>'
 text=text.replace('</main>',preview+'</main>');home.write_text(text,encoding='utf-8')
# Navigation, exact language counterparts and reciprocal hreflang on every route.
for mapping in routes:
 for l,current in mapping.items():
  f=ROOT/current.strip('/')/'index.html';text=f.read_text(encoding='utf-8-sig');u=U[l]
  text=re.sub(r'<div\b[^>]*data-lang-notice[^>]*>.*?</div>','',text,flags=re.S)
  text=re.sub(r'<link\b[^>]*rel="alternate"[^>]*>','',text)
  hreflangs=''.join(f'<link rel="alternate" hreflang="{x}" href="{url}">' for x,url in mapping.items())+f'<link rel="alternate" hreflang="x-default" href="{mapping["tr"]}">'
  text=text.replace('</head>',hreflangs+'</head>')
  def picker(m):
   return m[1]+''.join(f'<option value="{e(rel(current,mapping[x]),quote=True)}"'+(' selected' if x==l else '')+'>'+x.upper()+'</option>' for x in ('tr','en','es'))+'</select>'
  text=re.sub(r'(<select\b[^>]*data-language-select[^>]*>).*?</select>',picker,text,flags=re.S)
  # Insert blog into shared navigation once; the home link remains the logo.
  def nav(m):
   n=re.sub(r'<a\b[^>]*data-blog-nav[^>]*>.*?</a>','',m[0],flags=re.S)
   blog=f'<a href="{rel(current,u["base"])}" data-blog-nav'+(' aria-current="page"' if current==u['base'] else '')+f'>{u["nav"]}</a>'
   return n.replace('</nav>',blog+'</nav>')
  text=re.sub(r'<nav\b[^>]*data-nav-links[^>]*>.*?</nav>',nav,text,flags=re.S)
  def foot(m):
   v=re.sub(r'<a\b[^>]*data-blog-footer[^>]*>.*?</a>','',m[0],flags=re.S)
   return v.replace('<div class="footer-bottom">',f'<div class="footer-journal"><a href="{rel(current,u["base"])}" data-blog-footer>{u["blog"]}</a></div><div class="footer-bottom">').replace('<div class="footer-journal"></div>','')
  text=re.sub(r'<footer\b.*?</footer>',foot,text,flags=re.S)
  f.write_text(text,encoding='utf-8')
# XML uses actual newlines; a verified production origin is still required before deployment.
origin='https://YOUR-PRODUCTION-DOMAIN.example'
xml='<?xml version="1.0" encoding="UTF-8"?>\n<!-- Set the production origin before publishing this template. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('  <url><loc>'+origin+p+'</loc></url>\n' for p in sorted({p for r in routes for p in r.values() if 'noindex' not in (ROOT/p.strip('/')/'index.html').read_text(encoding='utf-8-sig').split('</head>')[0]}))+'</urlset>\n'
(ROOT/'sitemap.template.xml').write_text(xml,encoding='utf-8')
print('Built 12 blog pages; integrated',len(routes)*3,'localized routes.')

