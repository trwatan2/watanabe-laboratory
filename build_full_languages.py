from pathlib import Path
from lxml import html
from urllib.parse import urlsplit
import json,re,copy,base64,hashlib,argparse
from collections import Counter

PARSER=argparse.ArgumentParser()
PARSER.add_argument("--check",action="store_true",help="Verify generated pages without writing")
ARGS=PARSER.parse_args()

ROOT=Path(__file__).parent
SOURCE=ROOT
OUT=ROOT
OUT.mkdir(exist_ok=True)
TEXT=json.loads((ROOT/'source-text.json').read_text())
LANGS=['en','zh','ko','de','fr','es']
BASE='https://trwatan2.github.io/watanabe-laboratory/'
PAGES=list(TEXT)
def filename(page,lang):return lang+'.html' if page=='index' else page+'-'+lang+'.html'
def load_translation(lang):
    d={};section=None
    for line in (ROOT/(lang+'.txt')).read_text().splitlines():
        if line.startswith('['):section=line[1:-1]
        elif '|' in line:
            i,t=line.split('|',1);d[TEXT[section][int(i)]]=t
    return d
EN=load_translation('en')
PROPER={
 '新光電気工業':'Shinko Electric Industries','東レ':'Toray','矢崎総業':'Yazaki','ヤマハ発動機':'Yamaha Motor','トヨタ自動車':'Toyota Motor','日産自動車':'Nissan Motor','中部電力':'Chubu Electric Power','テルモ':'Terumo','エヌ・イー・ケムキャット':'N.E. Chemcat','東洋エンジニアリング':'Toyo Engineering','豊田合成':'Toyoda Gosei','山九':'Sankyu','ローム':'ROHM','三菱ケミカル':'Mitsubishi Chemical','日本ガイシ':'NGK Insulators','長瀬産業':'Nagase','アクセンチュア':'Accenture','越谷市役所':'Koshigaya City Office','ダイキン東海':'Daikin Tokai','関東電化工業':'Kanto Denka Kogyo','旭化成':'Asahi Kasei','グンゼ':'Gunze','キオクシア':'Kioxia','神鋼環境ソリューション':'Kobelco Eco-Solutions','日油':'NOF','日本液炭':'Nippon Ekitan','住友化学':'Sumitomo Chemical','信越化学工業':'Shin-Etsu Chemical','住友ケミカルエンジニアリング':'Sumitomo Chemical Engineering','広栄化学':'Koei Chemical','ニッカン工業':'Nikkan Industries','ダイキン工業':'Daikin Industries','日本合成化学':'Nippon Synthetic Chemical Industry','プライムアースEVエナジー':'Primearth EV Energy','三菱重工冷熱':'MHI Air-Conditioning & Refrigeration','ユニチカ':'Unitika','鹿島建設':'Kajima','日揮ユニバーサル':'JGC Catalysts and Chemicals','パーパス':'Purpose','中部プラントサービス':'Chubu Plant Service','共和レザー':'Kyowa Leather Cloth','川崎汽船':'Kawasaki Kisen Kaisha','福工房':'Fukukobo','三菱レイヨン':'Mitsubishi Rayon','東邦ガスエンジニアリング':'Toho Gas Engineering','富士鋼業':'Fuji Kogyo','三井・デュポンフロロケミカル':'Mitsui DuPont Fluorochemicals','臼井国際産業':'Usui Kokusai Sangyo','千代田テクノエース':'Chiyoda TechnoAce','オーエスジー':'OSG','総合車両製作所':'Japan Transport Engineering Company','ファーネスエンジニアリング':'Furnace Engineering','フジワラ':'Fujiwara','日本非破壊検査株式会社':'Japan Non-Destructive Inspection','日本ビニロン':'Nippon Vinylon','三菱化学':'Mitsubishi Chemical','大気社':'Taikisha','フタバ産業':'Futaba Industrial','トモエガワ製紙':'Tom oegawa'.replace(' ',''),'ハマネツ':'Hamanetsu','トヨタ車体':'Toyota Auto Body','関東自動車工業':'Kanto Auto Works','東海理化':'Tokai Rika','栗田工業':'Kurita Water Industries','日立造船':'Hitachi Zosen','ジェイテクト':'JTEKT','豊田紡織':'Toyota Boshoku','浜松消防署':'Hamamatsu Fire Department','三菱造船':'Mitsubishi Shipbuilding',
 '静岡大学大学院':'Shizuoka University — Graduate School','静岡大学大学院博士課程':'Shizuoka University — Doctoral Program','京都大学大学院':'Kyoto University — Graduate School','東京工業大学大学院':'Tokyo Institute of Technology — Graduate School','東京大学大学院':'The University of Tokyo — Graduate School',
 '渡部 綾':'Ryo Watanabe','渡部研究室 · Shizuoka University, Hamamatsu':'Watanabe Laboratory · Shizuoka University, Hamamatsu'
}
people=html.fromstring((SOURCE/'people.html').read_text())
for h in people.xpath('//h3[small]'):
    if h.text and h.xpath('string(./small)').strip():PROPER[h.text.strip()]=h.xpath('string(./small)').strip()
PUBLISHED=set(TEXT['publications'][i] for i in [6,7,9,10])
SUPPLEMENT=json.loads((ROOT/'translations-current.json').read_text())
UI=json.loads((ROOT/'ui.json').read_text())
CSS=(ROOT/'full-international.css').read_text()
# Reuse identical media bytes from the Japanese pages, including embedded portraits.
MEDIA={}
for path in sorted((ROOT/'assets').rglob('*')):
    if path.is_file():MEDIA[hashlib.sha256(path.read_bytes()).hexdigest()]=str(path.relative_to(ROOT))
def shared_media(value):
    if not value.startswith('data:') or ';base64,' not in value:return value
    header,payload=value.split(',',1)
    mime=header[5:].split(';')[0]
    if mime not in ['image/png','image/jpeg','image/webp','video/mp4']:return value
    raw=base64.b64decode(payload); digest=hashlib.sha256(raw).hexdigest()
    if digest not in MEDIA:
        ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4'}[mime]
        path=ROOT/'assets'/'international-shared'/(digest[:20]+'.'+ext)
        if not ARGS.check:
            path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        else:assert path.exists(),f'Missing shared media: {path}'
        MEDIA[digest]=str(path.relative_to(ROOT))
    return MEDIA[digest]
def visible_nodes(d):
    return d.xpath('//body//text()[normalize-space() and not(ancestor::script or ancestor::style)]')
def media_signature(d):
    return [(x.tag,attr,shared_media(x.get(attr))) for x in d.xpath('//img|//video|//source|//image') for attr in ['src','data-src','poster','href'] if x.get(attr)]
def elements(d):
    return [(x.tag,x.get('id'),x.get('class')) for x in d.xpath('//main//*') if isinstance(x.tag,str)]
report={}
for lang in LANGS:
    native=load_translation(lang)
    missing=set(EN)-set(native)
    assert not missing,(lang,missing)
    ui={k:v[LANGS.index(lang)] for k,v in UI.items()}
    trans={**PROPER,**native,**ui,**{k:v[lang] for k,v in SUPPLEMENT.items()}}
    def translated(s):
        t=s.strip()
        if t in trans:return s.replace(t,trans[t])
        if t.endswith(' のWebサイトを開く'):
            name=t.removesuffix(' のWebサイトを開く')
            label=trans.get(name,name)
            return {'en':'Open the website of '+label,'zh':'打开'+label+'网站','ko':label+' 웹사이트 열기','de':'Website von '+label+' öffnen','fr':'Ouvrir le site de '+label,'es':'Abrir el sitio de '+label}[lang]
        match=re.match(r'^(.*)（(\d+)）$',t)
        if match and match[1] in PROPER:return PROPER[match[1]]+' ('+match[2]+')'
        return s
    for page in PAGES:
        source=(SOURCE/(page+'.html')).read_text()
        source=re.sub(r'&lt;!--.*?--&gt;','',source,flags=re.S)
        original=html.fromstring(source)
        d=html.fromstring(source)
        d.set('lang','zh-CN' if lang=='zh' else lang)
        source_hash=hashlib.sha256(source.encode()).hexdigest()
        body=d.xpath('//body')[0];body.set('class',(body.get('class','')+' international-full').strip())
        # Preserve the source layout and all substantive content; localize text nodes.
        for el in d.xpath('//body//*[not(self::script or self::style)]'):
            if el.text and el.tag not in ['script','style']:el.text=translated(el.text)
            if el.tail:el.tail=translated(el.tail)
        # Keep each person's Japanese and Latin-script name, as in the source.
        for source_heading,heading in zip(original.xpath('//h2[small]|//h3[small]'),d.xpath('//h2[small]|//h3[small]')):
            if heading.text and heading.text.strip()==heading.find('small').text_content().strip():
                heading.find('small').text=(source_heading.text or '').strip()
        for el in d.xpath('//*[@aria-label]'):
            old=el.get('aria-label')
            el.set('aria-label',translated(old))
        for attr in ['alt','placeholder','title']:
            for el in d.xpath('//*[@'+attr+']'):
                el.set(attr,translated(el.get(attr)))
        # Every internal content link stays in the selected language.
        for a in d.xpath('//a[@href]'):
            href=a.get('href');parts=urlsplit(href)
            if parts.scheme or href.startswith(('#','//')):continue
            target=parts.path.removesuffix('.html')
            if target in PAGES:
                a.set('href',filename(target,lang)+('?' + parts.query if parts.query else '')+('#'+parts.fragment if parts.fragment else ''))
            elif target in LANGS:
                a.set('href',filename(page,target))
            # Existing Playground apps and help pages remain at their established URLs.
        for menu in d.xpath('//*[contains(concat(" ",@class," ")," language-menu-panel ")]'):
            for a in menu.xpath('.//a'):
                code=a.get('lang')
                if code=='ja':a.set('href',page+'.html')
                elif code:
                    code='zh' if code=='zh-CN' else code
                    if code in LANGS:a.set('href',filename(page,code))
                if code==lang:a.set('aria-current','page')
        # The logo returns to this language's home, even on detail pages.
        for a in d.xpath('//a[contains(concat(" ",@class," ")," brand ")]'):a.set('href',filename('index',lang))
        for nav in d.xpath('//nav[contains(@class,"global-nav")]'):
            for a in nav.xpath('./a'):
                if a.get('href','').split('#')[0]==filename(page,lang):a.set('aria-current','page')
        # Metadata and language alternatives refer to the same original host.
        for x in d.xpath('//link[@rel="canonical" or @rel="alternate"]'):x.getparent().remove(x)
        head=d.xpath('//head')[0]
        head.append(html.Element('link',rel='canonical',href=BASE+filename(page,lang)))
        for code in ['ja']+LANGS:
            head.append(html.Element('link',rel='alternate',hreflang='zh-CN' if code=='zh' else code,href=BASE+(page+'.html' if code=='ja' else filename(page,code))))
        head.append(html.Element('link',rel='alternate',hreflang='x-default',href=BASE+filename(page,'en')))
        title=(ui.get(page.capitalize(),page.capitalize())+' | ' if page!='index' else '')+'Watanabe Laboratory'
        d.xpath('//title')[0].text=title
        desc=d.xpath('//meta[@name="description"]')
        if desc:desc[0].set('content',translated(desc[0].get('content','')))
        for meta in d.xpath('//meta[starts-with(@property,"og:")]'):
            if meta.get('property')=='og:url':meta.set('content',BASE+filename(page,lang))
            else:meta.set('content',translated(meta.get('content','')))
        head.append(html.Element('meta',name='translation-source-sha256',content=source_hash))
        head.append(html.Element('meta',name='translation-version',content='20260912-complete-1'))
        for id in ['biz-udpgothic-force','vision-line-fix','sulfur-title-line-fix','heading-font-restore']:
            for x in d.xpath('//*[@id="'+id+'"]'):x.getparent().remove(x)
        style=html.Element('style',id='full-international-style');style.text=CSS;head.append(style)
        for el in d.xpath('//*[@src or @poster or @href]'):
            for attr in ['src','poster','href']:
                if el.get(attr):el.set(attr,shared_media(el.get(attr)))
        for script in d.xpath('//script[not(@src)]'):
            if script.text and 'gvTotal' in script.text:
                script.text=script.text.replace('取得できません',ui['Unavailable']).replace('記録なし',ui['No records']).replace("'更新 '",json.dumps(ui['Updated']+' (JST) ')).replace("'ja-JP'",json.dumps(d.get('lang')))
        # International callers can use the Japanese telephone number directly.
        if page=='contact':
            for h in d.xpath('//h3'):
                if h.text and h.text.strip()=='053-478-1172':h.text='+81 53 478 1172'
            for a in d.xpath('//a[starts-with(@href,"tel:")]'):
                value=a.get('href')[4:]
                if value.startswith('0'):a.set('href','tel:+81'+value[1:])
        text='<!doctype html>\n'+html.tostring(d,encoding='unicode',method='html')+'\n'
        text=re.sub(r'[ \t]+(?=\n)','',text)
        # Structural and byte-level media parity with the current Japanese page.
        assert elements(original)==elements(d),(lang,page,'structure differs')
        assert media_signature(original)==media_signature(d),(lang,page,'media differs')
        assert len(visible_nodes(original))==len(visible_nodes(d)),(lang,page,'text nodes differ')
        assert [a.get('href') for a in original.xpath('//a[contains(@href,"doi.org")]')]==[a.get('href') for a in d.xpath('//a[contains(@href,"doi.org")]')],(lang,page,'DOIs differ')
        leftovers=[]
        vals=list(visible_nodes(original))+original.xpath('//@aria-label|//@alt|//@placeholder|//@title|//meta[@name="description"]/@content')
        for val in vals:
            t=val.strip()
            if not re.search('[\u3040-\u30ff\u3400-\u9fff]',t):continue
            if t in ['日本語','中文'] or t in PUBLISHED or t in PROPER:continue
            if t not in trans and translated(t)==t:leftovers.append(t)
        assert not leftovers,(lang,page,'untranslated source',sorted(set(leftovers)))
        output=OUT/filename(page,lang)
        if ARGS.check:
            assert output.read_text()==text, f'Outdated translated page: {output.name}; rebuild translations.'
        else:output.write_text(text)
        report[filename(page,lang)]={'source_sha256':source_hash,'articles':len(d.xpath('//article')),'images':len(d.xpath('//img')),'videos':len(d.xpath('//video')),'text_nodes':len(visible_nodes(d)),'doi_links':len(d.xpath('//a[contains(@href,"doi.org")]'))}
if not ARGS.check:(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(('Verified' if ARGS.check else 'Built'),len(report),'complete localized pages against current Japanese sources.')
