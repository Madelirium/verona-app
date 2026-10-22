from pathlib import Path
import pdfplumber,json,calendar,datetime,hashlib,re
ROOT=Path(__file__).resolve().parents[1]
SPECS=[('ARANCIO','arancio','Zona Arancio','San Massimo',0,'19:00–21:00'),('BLU','blu','Zona Blu','Basse San Michele · San Felice · Valpantena',-1,'dalle 19:00'),('AZZURRO','azzurra','Zona Azzurra','Basson · La Sorte · Torricelle',-1,'19:00–21:00'),('VERDE','verde','Zona Verde','Mizzole · Montorio · Pigozzo · ZAI Montorio · Ponte Florio',-1,'dalle 19:00'),('VIOLA','viola','Zona Viola','Marangona · Parona · Quinzano · ZAI Bassona',0,'19:00–21:00')]
def extract(path):
 with pdfplumber.open(path) as doc:
  if len(doc.pages)!=2:raise ValueError('Numero pagine inatteso')
  from pdfplumber.page import PDFPageAggregatorWithMarkedContent,PDFPageInterpreter
  from pdfminer.layout import LTChar,LTRect,LTCurve
  class PaintOrder(PDFPageAggregatorWithMarkedContent):
   def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.order=0;self.painted=[]
   def stamp(self,before):
    for obj in self.cur_item._objs[before:]:
     obj.paint_order=self.order;self.order+=1;self.painted.append(obj)
   def render_char(self,*args,**kwargs):
    before=len(self.cur_item._objs);value=super().render_char(*args,**kwargs);self.stamp(before);return value
   def paint_path(self,*args,**kwargs):
    before=len(self.cur_item._objs);super().paint_path(*args,**kwargs);self.stamp(before)
  original=doc.pages[1];device=PaintOrder(doc.rsrcmgr,pageno=2,laparams=doc.laparams)
  PDFPageInterpreter(doc.rsrcmgr,device).process_page(original.page_obj)
  masks=[o for o in device.painted if isinstance(o,(LTRect,LTCurve)) and o.fill and o.width>4 and o.height>4]
  def visible(char):
   x,y=(char.x0+char.x1)/2,(char.y0+char.y1)/2
   return not any(mask.paint_order>char.paint_order and mask.x0<x<mask.x1 and mask.y0<y<mask.y1 for mask in masks)
  def prune(obj):
   if hasattr(obj,'_objs'):
    obj._objs=[child for child in obj._objs if not isinstance(child,LTChar) or visible(child)]
    for child in obj._objs:prune(child)
  layout=device.get_result();prune(layout);original._layout=layout
  page=original.dedupe_chars(extra_attrs=());words=page.extract_words()
  starts=sorted(w['x0'] for w in words if w['text']=='1' and 51<w['top']<57)
  if len(starts)!=7:raise ValueError('Colonne calendario non riconosciute')
  result=[]
  for month in range(1,13):
   col=(month-1)%7; low,high=(51,420) if month<=7 else (455,825)
   left=starts[col]-12;right=(starts[col+1]-8 if col<6 else page.width-30)
   cells=[w for w in words if left<=w['x0']<right and low<w['top']<high]
   days=[w for w in cells if w['text'].isdigit() and w['x0']<left+25]
   expected=list(range(1,calendar.monthrange(2026,month)[1]+1))
   if [int(w['text']) for w in days]!=expected:raise ValueError(f'Giorni mancanti o duplicati: {path.name}, mese {month}')
   for w in days:
    tokens=[t['text'] for t in cells if t['x0']>left+65 and abs(t['top']-w['top'])<3]
    raw=''.join(tokens)
    labels=re.findall(r'UMIDO|CARTA|SECCO|PLASTICA/METALLI',raw)
    if ''.join(labels)!=raw:raise ValueError(f'Testo di raccolta non riconosciuto: {path.name} mese {month} giorno {w['text']}: {raw}')
    materials=[{'UMIDO':'Umido','CARTA':'Carta','SECCO':'Secco non riciclabile','PLASTICA/METALLI':'Plastica e metalli'}[label] for label in labels]
    result.append({'day':f'2026-{month:02}-{int(w["text"]):02}','materials':materials})
  if len(result)!=365:raise ValueError('Copertura annuale incompleta')
  return result
if __name__=='__main__':
 zones=[]
 for color,key,name,area,offset,time in SPECS:
  path=ROOT/'.local/waste'/f'{color}.pdf'
  dates=extract(path)
  zones.append({'id':'amia-'+key,'name':name,'area':area,'sourceUrl':f'https://www.amiavr.it/Portals/0/Documenti/Calendari/2026/AMIA_CALENDARIO_{color}_2026.pdf','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'validFrom':'2026-01-01','validTo':'2026-12-31','exposureDayOffset':offset,'exposureTime':time,'dates':dates,'rules':[]})
  print(f'{name}: {len(dates)} giorni verificati, {sum(bool(d["materials"]) for d in dates)} con raccolta')
 data={'source':'AMIA Verona','sourceUrl':'https://www.amiavr.it/Raccolta-differenziata/I-calendari-del-porta-a-porta','checkedOn':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'parserVersion':1,'zones':zones}
 (ROOT/'data/waste-calendars.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
