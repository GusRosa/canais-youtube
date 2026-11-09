#!/usr/bin/env python3
"""Radar do YouTube: acha vídeos viralizando em canais pequenos ou novos.

Uso:
  python3 radar.py                       # usa nichos.json, período do arquivo
  python3 radar.py --periodo semana      # hoje | semana | mes | ano
  python3 radar.py --termos "pov you" "old money"   # só esses termos
  python3 radar.py --checar "why rent got so expensive"  # vê a concorrência de um tema

Sem chave de API: lê a busca pública do YouTube (região e idioma do nichos.json) e o
Google Trends do país. Saídas em saidas/radar/: relatório .md e dados .json.
"""
import argparse, datetime, json, os, re, sys, time, urllib.parse, urllib.request
from collections import Counter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
SAIDA = os.path.join(RAIZ, 'saidas', 'radar')
CACHE_CANAIS = os.path.join(AQUI, 'cache-canais.json')
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9'}

# Filtro da busca do YouTube: ordenar por views + data de upload.
PERIODOS = {'hoje': 'CAMSAggC', 'semana': 'CAMSAggD', 'mes': 'CAMSAggE', 'ano': 'CAMSAggF'}
STOP = set('the a an of to in on for and or is are was were be your you i my we it this that with at by from as '
           'how why what who when not no do does did vs its his her their our they he she me can will just '
           'full new 2026 2025 shorts short video episode part'.split())
# Português: pro detector de clones não casar só pelas palavras do formato ("sua vida em cada").
STOP |= set('sua seu você voce em cada de do da dos das no na nos nas num numa o os as um uma e se que por pra para com ao'.split())


def get(url, tentativas=3):
    for n in range(tentativas):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode()
        except Exception:
            if n == tentativas - 1: raise
            time.sleep(2 * (n + 1))


def initial_data(html):
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    return json.loads(m.group(1)) if m else {}


def texto(o):
    if not o: return ''
    return o.get('simpleText') or ''.join(r.get('text', '') for r in o.get('runs', []))


def numero(s):
    """'1.2M' / '531K' / '1,234,567 views' -> int"""
    s = (s or '').split(' ')[0].replace(',', '')
    m = re.match(r'([\d.]+)([KMB]?)', s)
    if not m: return 0
    return int(float(m.group(1)) * {'': 1, 'K': 1e3, 'M': 1e6, 'B': 1e9}[m.group(2)])


def segundos(dur):
    p = [int(x) for x in dur.split(':') if x.isdigit()]
    t = 0
    for x in p: t = t * 60 + x
    return t


def buscar(termo, sp, gl, hl):
    url = f'https://www.youtube.com/results?search_query={urllib.parse.quote(termo)}&sp={sp}&hl={hl}&gl={gl}'
    dados, out = initial_data(get(url)), []
    def andar(o):
        if isinstance(o, dict):
            if 'videoRenderer' in o:
                v = o['videoRenderer']; ch = v.get('ownerText', {}).get('runs', [{}])[0]
                nav = ch.get('navigationEndpoint', {}).get('browseEndpoint', {})
                out.append(dict(id=v.get('videoId'), titulo=texto(v.get('title')), views=numero(texto(v.get('viewCountText'))),
                                publicado=texto(v.get('publishedTimeText')), duracao=texto(v.get('lengthText')),
                                canal=ch.get('text', ''), canal_id=nav.get('browseId', ''), termo=termo))
            for x in o.values(): andar(x)
        elif isinstance(o, list):
            for x in o: andar(x)
    andar(dados)
    return out


def dados_canal(cid, cache):
    if cid in cache: return cache[cid]
    try:
        h = get(f'https://www.youtube.com/channel/{cid}/about?hl=en&gl=US')
        def r(p, g=1):
            m = re.search(p, h); return m.group(g) if m else ''
        handle = r(r'"displayCanonicalChannelUrl":"www\.youtube\.com/([^"]+)"')
        # A página também lista canais recomendados com seus próprios inscritos: pega o número que vem
        # junto do @ do próprio canal no cabeçalho ("@canal • 2.09M subscribers").
        # Painel "Sobre" (texto simples) primeiro; canais recomendados usam objeto, então não casam aqui.
        subs = (r(r'"subscriberCountText":"([\d.,]+[KMB]?) subscribers?"')
                or (r(re.escape(handle) + r'[^"]{0,20}?•[^\d"]{0,10}([\d.,]+[KMB]?) subscribers') if handle else ''))
        info = dict(inscritos=numero(subs), videos=numero(r(r'"videoCountText":"([\d,.K]+) videos?"')),
                    criado=r(r'Joined ([A-Z][a-z]{2} \d{1,2}, \d{4})'), pais=r(r'"country":"([^"]+)"'),
                    handle=handle,
                    views_total=numero(r(r'"viewCountText":"([\d,]+) views')), lido=datetime.date.today().isoformat())
    except Exception as e:
        info = dict(erro=str(e))
    cache[cid] = info
    return info


def idade_dias(criado):
    try: return (datetime.date.today() - datetime.datetime.strptime(criado, '%b %d, %Y').date()).days
    except Exception: return None


def google_trends(geo):
    try:
        x = get(f'https://trends.google.com/trending/rss?geo={geo}')
        return re.findall(r'<item>\s*<title>(.*?)</title>.*?<ht:approx_traffic>(.*?)</ht:approx_traffic>', x, re.S)
    except Exception:
        return []


def formula(titulo):
    """Troca números, valores e nomes próprios por marcadores pra achar estruturas repetidas."""
    t = re.sub(r'\$[\d,.]+\s*(billion|million|trillion|[KMB])?', '$[VALOR]', titulo, flags=re.I)
    t = re.sub(r'\b\d[\d,.]*\b', '[N]', t)
    t = re.sub(r'[^\w\s\[\]$:?!…\-]', ' ', t)
    palavras = t.split()
    return ' '.join(palavras[:6]).lower()


def ngrams(titulos, n):
    c = Counter()
    for t in titulos:
        w = [x for x in re.findall(r"[a-z']+", t.lower()) if x not in STOP and len(x) > 2]
        c.update(set(' '.join(w[i:i + n]) for i in range(len(w) - n + 1)))
    return c


# Filtro de data de upload da busca (sem ordenar por views): pega os clones pequenos que a relevância esconde.
RECENTES = {'mes': 'EgIIBA%3D%3D', 'ano': 'EgIIBQ%3D%3D'}


def clones(tema, gl, hl):
    """Vídeos do último ano com quase todas as palavras do tema no título, mesmo com poucas views."""
    alvo = {w for w in re.findall(r'\w+', tema.lower()) if w not in STOP}
    vistos, out = set(), []
    for sp in RECENTES.values():
        for v in buscar(tema, sp, gl, hl):
            if v['id'] in vistos or re.search(r'\d+\s*y', v['publicado'] or ''): continue
            vistos.add(v['id'])
            tit = set(re.findall(r'\w+', v['titulo'].lower()))
            if alvo and len(alvo & tit) / len(alvo) >= 0.8: out.append(v)
        time.sleep(1)
    return sorted(out, key=lambda v: -v['views'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--periodo', choices=PERIODOS)
    ap.add_argument('--termos', nargs='+')
    ap.add_argument('--checar', nargs='+', help='temas pra ver concorrência (sem filtro de data)')
    ap.add_argument('--config', default=os.path.join(AQUI, 'nichos.json'))
    ap.add_argument('--nome', help='sufixo do arquivo de saída (ex.: financas)')
    a = ap.parse_args()
    cfg = json.load(open(a.config))
    gl, hl = cfg.get('regiao', 'US'), cfg.get('idioma', 'en')
    os.makedirs(SAIDA, exist_ok=True)
    cache = json.load(open(CACHE_CANAIS)) if os.path.exists(CACHE_CANAIS) else {}
    hoje = datetime.date.today().isoformat()

    if a.checar:
        linhas = [f'# Checagem de concorrência · {hoje}', '']
        for tema in a.checar:
            r = buscar(tema, '', gl, hl)[:10]
            fortes = [v for v in r if v['views'] >= 1_000_000]
            linhas += [f'## "{tema}"', f'{len(fortes)}/10 com 1M+ · maior: {max((v["views"] for v in r), default=0):,}', '',
                       '| Views | Publicado | Canal | Título |', '|---|---|---|---|']
            linhas += [f'| {v["views"]:,} | {v["publicado"]} | {v["canal"]} | [{v["titulo"]}](https://youtu.be/{v["id"]}) |' for v in r]
            c = clones(tema, gl, hl)
            pequenos = [v for v in c if v['views'] < 1_000]
            aviso = ' · ⚠ formato clonado' if len(c) >= 3 else ''
            linhas += ['', f'**Clones no último ano:** {len(c)} vídeos com o mesmo título, {len(pequenos)} com menos de '
                           f'1 mil views, {len({v["canal"] for v in c})} canais{aviso}']
            linhas += [f'- {v["views"]:,} · {v["publicado"]} · {v["canal"]} · [{v["titulo"]}](https://youtu.be/{v["id"]})' for v in c[:8]]
            linhas.append('')
            time.sleep(1)
        caminho = os.path.join(SAIDA, f'checagem-{hoje}' + (f'-{a.nome}' if a.nome else '') + '.md')
        open(caminho, 'w').write('\n'.join(linhas))
        print('\n'.join(linhas)); print(f'\n✓ {caminho}')
        return

    periodo = a.periodo or cfg.get('periodo', 'mes')
    f = cfg.get('filtros', {})
    min_views, max_inscritos = f.get('min_views', 500_000), f.get('max_inscritos', 300_000)
    max_idade, min_razao = f.get('canal_novo_dias', 365), f.get('min_views_por_inscrito', 5)
    so_ingles = f.get('so_titulos_latinos', True)
    termos = a.termos or [t for grupo in cfg['nichos'].values() for t in grupo]
    nicho_do_termo = {t: n for n, grupo in cfg['nichos'].items() for t in grupo}

    print(f'▶ Radar · {len(termos)} termos · período: {periodo} · {gl}/{hl}', file=sys.stderr)
    videos = {}
    for i, t in enumerate(termos, 1):
        try:
            for v in buscar(t, PERIODOS[periodo], gl, hl):
                videos.setdefault(v['id'], v)
            print(f'  {i}/{len(termos)} {t}', file=sys.stderr)
        except Exception as e:
            print(f'  ! {t}: {e}', file=sys.stderr)
        time.sleep(1)

    candidatos = [v for v in videos.values() if v['views'] >= min_views and v['canal_id']]
    print(f'  {len(videos)} vídeos, {len(candidatos)} acima de {min_views:,} views; lendo canais…', file=sys.stderr)
    for v in candidatos:
        v.update(canal_info=dados_canal(v['canal_id'], cache))
        time.sleep(0.3)
    json.dump(cache, open(CACHE_CANAIS, 'w'), indent=1)

    achados = []
    for v in candidatos:
        c = v['canal_info']
        if 'erro' in c or not c.get('inscritos'): continue  # sem contagem confiável: fica de fora
        if any(x.lower() in v['titulo'].lower() for x in f.get('excluir_palavras', [])): continue
        if so_ingles and sum(ch.isascii() for ch in v['titulo']) / max(1, len(v['titulo'])) < 0.9: continue
        idade = idade_dias(c['criado'])
        novo = idade is not None and idade <= max_idade
        pequeno = 0 < c['inscritos'] <= max_inscritos
        razao = v['views'] / max(c['inscritos'], 1)
        if not (novo or pequeno) or razao < min_razao: continue
        # Canal com milhares de vídeos é redação/empresa grande: a contagem de inscritos costuma vir errada.
        if c['videos'] > f.get('max_videos_canal', 3000): continue
        v.update(nicho=nicho_do_termo.get(v['termo'], '—'), razao=round(razao, 1), novo=novo, idade_dias=idade,
                 formato='Short' if segundos(v['duracao']) <= 180 else 'Longo', formula=formula(v['titulo']))
        achados.append(v)
    achados.sort(key=lambda v: -v['razao'])

    # Histórico: marca o que já apareceu em radares anteriores.
    hist_path = os.path.join(SAIDA, 'historico.json')
    hist = json.load(open(hist_path)) if os.path.exists(hist_path) else {}
    for v in achados:
        v['ja_visto'] = v['id'] in hist
        hist.setdefault(v['id'], hoje)
    json.dump(hist, open(hist_path, 'w'))

    longos = [v for v in achados if v['formato'] == 'Longo']
    shorts = [v for v in achados if v['formato'] == 'Short']
    titulos = [v['titulo'] for v in achados]
    temas = [(g, n) for g, n in ngrams(titulos, 2).most_common(25) if n >= 2]
    formulas = Counter(v['formula'] for v in achados if v['formula']).most_common(12)
    trends = google_trends(gl)

    def linha(v):
        c = v['canal_info']
        tag = ' 🆕' if v['novo'] else ''
        visto = '' if not v['ja_visto'] else ' (já visto)'
        canal = f'[{v["canal"]}](https://www.youtube.com/{c["handle"]})' if c.get('handle') else v['canal']
        return (f'| {v["views"]:,} | **{v["razao"]}×** | {v["publicado"]} | {v["duracao"]} | {canal}{tag} | '
                f'{c["inscritos"]:,} · {c["videos"]} víd · {c["criado"]} | {v["nicho"]} | '
                f'[{v["titulo"]}](https://youtu.be/{v["id"]}){visto} |')

    cab = ['| Views | Views/inscrito | Publicado | Duração | Canal | Inscritos · vídeos · criado | Nicho | Título |',
           '|---|---|---|---|---|---|---|---|']
    md = [f'# Radar YouTube · {hoje}', '',
          f'Período: **{periodo}** · região {gl}, idioma {hl} · {len(termos)} termos · {len(videos)} vídeos lidos.',
          f'Critério: ≥ {min_views:,} views, canal com ≤ {max_inscritos:,} inscritos **ou** criado há ≤ {max_idade} dias, '
          f'e ≥ {min_razao} views por inscrito. 🆕 = canal novo.', '',
          f'## Vídeos longos ({len(longos)})', '', *cab, *[linha(v) for v in longos[:40]], '',
          f'## Shorts ({len(shorts)})', '', *cab, *[linha(v) for v in shorts[:20]], '',
          '## Temas que se repetem entre os vencedores', '',
          ', '.join(f'**{g}** ({n})' for g, n in temas) or '_Nenhum tema repetido._', '',
          '## Estruturas de título repetidas', '',
          *[f'- `{fm}…` ({n}×)' for fm, n in formulas if n >= 2], '',
          f'## Em alta no Google ({gl}, hoje)', '',
          ', '.join(f'{t} ({n})' for t, n in trends) or '_Sem dados._', '',
          '---', 'Views/inscrito alto = o vídeo foi além da base do canal (o algoritmo empurrou). '
          'Inscritos e data de criação vêm da página do canal; a data é da conta, não do primeiro vídeo.']
    base = os.path.join(SAIDA, f'radar-{hoje}-{periodo}' + (f'-{a.nome}' if a.nome else ''))
    open(base + '.md', 'w').write('\n'.join(md))
    json.dump(achados, open(base + '.json', 'w'), indent=1, ensure_ascii=False)
    print(f'\n✓ {len(longos)} longos, {len(shorts)} shorts\n✓ {base}.md', file=sys.stderr)


if __name__ == '__main__':
    main()
