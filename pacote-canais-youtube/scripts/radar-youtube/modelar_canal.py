#!/usr/bin/env python3
"""Modelar canal: lê os vídeos mais vistos de um canal, vê se já tem dublagem em português e
procura no YouTube Brasil quem já copiou (tradução literal) ou adaptou cada vídeo.

Uso:
  python3 modelar_canal.py @ThinkScienceHD                  # passo 1: ranking + dublagem
  python3 modelar_canal.py @ThinkScienceHD --top 15
  python3 modelar_canal.py @ThinkScienceHD --copias busca.json   # passo 2: cópias no Brasil

busca.json = {"<id do vídeo original>": ["termo em português", "outro termo"], ...}
(o Claude escreve os termos a partir dos títulos do passo 1).

Sem chave de API: lista os vídeos com yt-dlp (lista plana) e lê as páginas públicas.
Saídas em saidas/radar/canais/: relatório .md e dados .json.
"""
import argparse, datetime, difflib, json, os, re, subprocess, sys, urllib.parse, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import radar  # reaproveita get, buscar, dados_canal, idade_dias, numero

SAIDA = os.path.join(radar.RAIZ, 'saidas', 'radar', 'canais')


def url_canal(c):
    if c.startswith('http'): return c.split('/videos')[0].rstrip('/')
    return 'https://www.youtube.com/' + (c if c.startswith(('@', 'channel/')) else '@' + c)


def listar(canal):
    """Lista plana dos vídeos longos via yt-dlp (traz id e título, sem views)."""
    r = subprocess.run([sys.executable, '-m', 'yt_dlp', '--flat-playlist', '-J', canal + '/videos'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('yt-dlp falhou ao listar o canal:\n' + r.stderr[-800:])
    d = json.loads(r.stdout)
    return d, [dict(id=e['id'], titulo=e.get('title', '')) for e in d.get('entries', []) if e.get('id')]


def detalhes(vid):
    h = radar.get(f'https://www.youtube.com/watch?v={vid}&hl=en&gl=US')
    m = re.search(r'ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var|</script>)', h)
    p = json.loads(m.group(1)) if m else {}
    vd = p.get('videoDetails', {})
    mf = p.get('microformat', {}).get('playerMicroformatRenderer', {})
    audio = sorted({f['audioTrack'].get('displayName', '') for f in p.get('streamingData', {}).get('adaptiveFormats', [])
                    if f.get('audioTrack')})
    caps = [c.get('languageCode') for c in
            p.get('captions', {}).get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [])]
    return dict(views=int(vd.get('viewCount', 0) or 0), minutos=int(vd.get('lengthSeconds', 0) or 0) // 60,
                publicado=mf.get('publishDate', '')[:10], audio=audio,
                dub_pt=any('Portuguese' in a for a in audio), legenda_pt=any(c.startswith('pt') for c in caps))


def similaridade(a, b):
    lim = lambda s: re.sub(r'[^\w\s]', '', s.lower()).split()
    return difflib.SequenceMatcher(None, lim(a), lim(b)).ratio()


def tipo_copia(sim):
    # A busca com hl=en mostra o título autotraduzido pro inglês: cópia literal fica quase igual ao original.
    if sim >= 0.7: return 'tradução literal'
    if sim >= 0.4: return 'adaptação'
    return 'mesmo tema'


PT = {'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': radar.UA['User-Agent']}
STOP_PT = set('a o as os um uma uns umas de da do das dos e é em no na nos nas por pra para com sem que se seu sua '
              'seus suas te você vc voce ao à mais como o que qual quando porque por que isso esse essa este esta '
              'ou já não sim muito tem ter seu meu minha é são está estão foi vai veja'.split())
# Validação em inglês (--hl en): mesmas regras, com stopwords e "years ago".
STOP_PT |= set('the a an of in on at to for and or is are was were you your if what had have has be as by with '
               'from how why this that it its do does'.split())
HL = 'pt'


def palavras(s):
    return {w for w in re.findall(r'\w+', s.lower()) if w not in STOP_PT and len(w) > 2}


def autocomplete(termo, gl):
    u = ('https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&hl=' + HL + '&gl=' + gl.lower()
         + '&q=' + urllib.parse.quote(termo))
    return re.findall(r'\["([^"]+)",0', radar.get(u))[:10]


def busca_pt(q, gl, sp=''):
    """Busca com interface em português (título real, sem autotradução pro inglês)."""
    u = f'https://www.youtube.com/results?search_query={urllib.parse.quote(q)}&hl={"pt-BR" if HL == "pt" else HL}&gl={gl}' + (f'&sp={sp}' if sp else '')
    html = urllib.request.urlopen(urllib.request.Request(u, headers=PT if HL == 'pt' else {'Accept-Language': HL, 'User-Agent': radar.UA['User-Agent']}), timeout=30).read().decode()
    out = []
    def andar(o):
        if isinstance(o, dict):
            if 'videoRenderer' in o:
                v = o['videoRenderer']
                out.append(dict(id=v.get('videoId'), titulo=radar.texto(v.get('title')),
                                views=int(re.sub(r'\D', '', radar.texto(v.get('viewCountText'))) or 0),
                                publicado=radar.texto(v.get('publishedTimeText')),
                                canal=v.get('ownerText', {}).get('runs', [{}])[0].get('text', '')))
            for x in o.values(): andar(x)
        elif isinstance(o, list):
            for x in o: andar(x)
    andar(radar.initial_data(html))
    return out[:20]


def recente(publicado):
    # "há 3 meses" conta como recente; "há 2 anos" não.
    return publicado and not re.search(r'\d+\s*(anos?|y)', publicado)


def validar(titulos, gl):
    """Para cada título sugerido: demanda (autocomplete), concorrência e se já existe algo igual."""
    res = []
    for t in titulos:
        sug = autocomplete(t['busca'], gl)
        # Título exato, termo curto e título só no último ano (pega o concorrente recente que a busca geral esconde).
        vs = busca_pt(t['titulo'], gl) + busca_pt(t['busca'], gl) + busca_pt(t['titulo'], gl, 'EgIIBQ%3D%3D')
        vistos, lista = set(), []
        for v in vs:
            if v['id'] in vistos: continue
            vistos.add(v['id'])
            a, b = palavras(t['titulo']), palavras(v['titulo'])
            v['sim'] = round(len(a & b) / len(a | b), 2) if a | b else 0
            lista.append(v)
        fortes = [v for v in lista if v['views'] >= 500_000 and recente(v['publicado'])]
        parecidos = sorted([v for v in lista if v['sim'] >= 0.35], key=lambda v: -v['sim'])
        demanda = 'forte' if len(sug) >= 5 and sum(v['views'] for v in lista) >= 1_000_000 else \
                  'fraca' if len(sug) < 3 else 'média'
        novidade = 'já existe' if parecidos and parecidos[0]['sim'] >= 0.5 else \
                   'parecido' if parecidos else 'novo'
        res.append(dict(t, autocomplete=sug, demanda=demanda, novidade=novidade,
                        concorrentes_fortes=len(fortes), parecidos=parecidos[:4],
                        topo=sorted(lista, key=lambda v: -v['views'])[:4]))
        print(f"  {t['titulo'][:60]}: demanda {demanda}, {novidade}", file=sys.stderr)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('canal')
    ap.add_argument('--top', type=int, default=10)
    ap.add_argument('--copias', help='JSON {id_original: [termos em PT]} pra buscar cópias no Brasil')
    ap.add_argument('--validar', help='JSON [{"titulo": ..., "busca": "termo curto"}] com os títulos sugeridos')
    ap.add_argument('--gl', default='BR')
    ap.add_argument('--hl', default='pt', help='idioma da validação (pt ou en)')
    a = ap.parse_args()
    global HL
    HL = a.hl

    canal = url_canal(a.canal)
    handle = canal.rsplit('/', 1)[-1].lstrip('@')
    os.makedirs(SAIDA, exist_ok=True)
    base = os.path.join(SAIDA, f'canal-{handle}-{datetime.date.today().isoformat()}')

    if os.path.exists(base + '.json'):
        dados = json.load(open(base + '.json'))
    else:
        info, lista = listar(canal)
        print(f'{len(lista)} vídeos em {canal}. Lendo views e faixas de áudio...', file=sys.stderr)
        for v in lista:
            try: v.update(detalhes(v['id']))
            except Exception as e: v.update(views=0, erro=str(e))
        lista.sort(key=lambda v: -v.get('views', 0))
        dados = dict(canal=canal, nome=info.get('channel'), inscritos=info.get('channel_follower_count'),
                     canal_id=info.get('channel_id'), lido=datetime.date.today().isoformat(), videos=lista)
        if dados['canal_id']:
            dados['sobre'] = radar.dados_canal(dados['canal_id'], {})

    if a.copias:
        termos, cache, achados = json.load(open(a.copias)), {}, {}
        originais = {v['id']: v for v in dados['videos']}
        for vid, qs in termos.items():
            orig, vistos, lista = originais.get(vid, {}), set(), []
            for q in qs:
                for r in radar.buscar(q, '', a.gl, 'en')[:15]:
                    if r['id'] in vistos or r['canal_id'] == dados.get('canal_id'): continue
                    vistos.add(r['id'])
                    r.update(radar.dados_canal(r['canal_id'], cache) if r['canal_id'] else {})
                    r['sim'] = round(similaridade(r['titulo'], orig.get('titulo', '')), 2)
                    r['tipo'] = tipo_copia(r['sim'])
                    lista.append(r)
            lista.sort(key=lambda r: (-r['sim'], -r['views']))
            achados[vid] = lista
            print(f'  {orig.get("titulo", vid)[:60]}: {len(lista)} resultados', file=sys.stderr)
        dados['copias'] = achados

    if a.validar:
        dados['validacao'] = validar(json.load(open(a.validar)), a.gl)

    json.dump(dados, open(base + '.json', 'w'), ensure_ascii=False, indent=1)

    sobre = dados.get('sobre', {})
    L = [f"# Canal {dados.get('nome') or handle}", '',
         f"{canal} · {dados.get('inscritos') or 0:,} inscritos · criado em {sobre.get('criado', '?')} · "
         f"{len(dados['videos'])} vídeos longos · lido em {dados['lido']}", '']
    com_dub = sum(v.get('dub_pt', False) for v in dados['videos'])
    L += [f"**Dublagem em português:** {com_dub} de {len(dados['videos'])} vídeos têm faixa de áudio PT-BR.", '',
          f"## Top {a.top} por views", '', '| Views | Data | Min | Dub PT | Título | ID |', '|---|---|---|---|---|---|']
    for v in dados['videos'][:a.top]:
        L.append(f"| {v.get('views', 0):,} | {v.get('publicado', '')} | {v.get('minutos', '')} | "
                 f"{'sim' if v.get('dub_pt') else 'não'} | {v['titulo']} | {v['id']} |")
    for vid, lista in dados.get('copias', {}).items():
        orig = next((v for v in dados['videos'] if v['id'] == vid), {})
        L += ['', f"## Cópias de: {orig.get('titulo', vid)}", '',
              '| Tipo | Sim | Views | Publicado | Canal | Inscritos | Criado | Título | Link |', '|---|---|---|---|---|---|---|---|---|']
        for r in [r for r in lista if r['tipo'] != 'mesmo tema'][:10] + [r for r in lista if r['tipo'] == 'mesmo tema'][:5]:
            L.append(f"| {r['tipo']} | {r['sim']} | {r['views']:,} | {r['publicado']} | {r['canal']} | "
                     f"{r.get('inscritos', 0):,} | {r.get('criado', '')} | {r['titulo']} | https://youtu.be/{r['id']} |")
    if dados.get('validacao'):
        L += ['', '## Validação dos títulos sugeridos', '']
        for t in dados['validacao']:
            L += [f"### {t['titulo']}", '',
                  f"- **Demanda:** {t['demanda']} · autocomplete de \"{t['busca']}\": {', '.join(t['autocomplete']) or 'nada'}",
                  f"- **Novidade:** {t['novidade']} · concorrentes com 500 mil+ views no último ano: {t['concorrentes_fortes']}"]
            for v in t['parecidos']:
                L.append(f"  - parecido ({v['sim']}): {v['titulo']} · {v['canal']} · {v['views']:,} views · {v['publicado']}")
            for v in t['topo']:
                L.append(f"  - topo: {v['titulo']} · {v['canal']} · {v['views']:,} views · {v['publicado']}")
            L.append('')
    open(base + '.md', 'w').write('\n'.join(L) + '\n')
    print(base + '.md')


if __name__ == '__main__':
    main()
