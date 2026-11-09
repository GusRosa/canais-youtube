#!/usr/bin/env python3
"""Mais vistos + comentários: acha os vídeos mais vistos de um tema e puxa os comentários
mais curtidos de cada um, pra minerar desejos, dores e pedidos do público.

Uso:
  python3 comentarios.py --config termos-relacionamento-br.json --nome relacionamento
  python3 comentarios.py --termos "como conquistar um homem" "sedução feminina" --top 30
  python3 comentarios.py --de saidas/radar/comentarios-....json --ids ID1,ID2 --nome escolhidos
      (pula a busca: puxa comentários só dos vídeos escolhidos à mão, usando a busca já salva)

Config (.json): {"gl": "BR", "hl": "pt", "termos": [...], "excluir_palavras": [...],
                 "min_views": 100000, "top": 45, "max_comentarios": 300, "por_canal": 3}

Saída em saidas/radar/: comentarios-AAAA-MM-DD-<nome>.json (vídeos + comentários).
A leitura (desejos, dores, oportunidades) é feita em cima desse .json.
"""
import argparse, datetime, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import radar
from radar import buscar, get, initial_data, numero, segundos, SAIDA, PERIODOS

def numero_pt(s):
    """'8.787.152 visualizações' / '1,2 mi' / '531 mil' / '1.2M' -> int"""
    s = (s or '').replace('\xa0', ' ').strip().lower()
    m = re.match(r'([\d.,]+)\s*(mi|mil|bi|k|m|b)?\b', s)
    if not m: return 0
    n, mult = m.group(1), {'mil': 1e3, 'k': 1e3, 'mi': 1e6, 'm': 1e6, 'bi': 1e9, 'b': 1e9}.get(m.group(2) or '', 1)
    if mult == 1: n = n.replace('.', '').replace(',', '')
    else: n = n.replace('.', '').replace(',', '.') if ',' in n else n
    return int(float(n) * mult)


# A busca em português vem com número no formato brasileiro.
radar.numero = numero_pt
numero = numero_pt

TODOS_OS_TEMPOS = 'CAM%3D'  # ordenar por views, sem filtro de data


def achar(o, chave):
    """Todas as ocorrências de uma chave num JSON aninhado."""
    if isinstance(o, dict):
        for k, v in o.items():
            if k == chave: yield v
            yield from achar(v, chave)
    elif isinstance(o, list):
        for x in o: yield from achar(x, chave)


def proximo(dados):
    for c in achar(dados, 'continuationItemRenderer'):
        tok = (c.get('continuationEndpoint', {}).get('continuationCommand', {}).get('token')
               or c.get('button', {}).get('buttonRenderer', {}).get('command', {}).get('continuationCommand', {}).get('token'))
        if tok: return tok


def puxar_comentarios(vid, maximo, gl='BR', hl='pt'):
    """Comentários do vídeo pela API interna do YouTube (ordem padrão: mais relevantes)."""
    try:
        html = get(f'https://www.youtube.com/watch?v={vid}&hl={hl}&gl={gl}')
        versao = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html).group(1)
        dados = initial_data(html)
        desc = re.search(r'"shortDescription":"((?:[^"\\]|\\.)*)"', html)
        tok = None
        for sec in achar(dados, 'itemSectionRenderer'):
            if sec.get('sectionIdentifier') == 'comment-item-section':
                tok = proximo(sec)
        coms = []
        while tok and len(coms) < maximo:
            corpo = json.dumps({'context': {'client': {'clientName': 'WEB', 'clientVersion': versao, 'hl': hl, 'gl': gl}},
                                'continuation': tok}).encode()
            req = urllib.request.Request('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', data=corpo,
                                         headers={**radar.UA, 'Content-Type': 'application/json'})
            r = json.loads(urllib.request.urlopen(req, timeout=30).read())
            novos = [p for p in achar(r, 'commentEntityPayload')]
            for p in novos:
                pr, tb = p.get('properties', {}), p.get('toolbar', {})
                coms.append(dict(texto=pr.get('content', {}).get('content', ''),
                                 curtidas=numero(tb.get('likeCountNotliked') or '0'),
                                 respostas=numero(tb.get('replyCount') or '0')))
            ultimo = tok
            tok = None
            for acao in list(achar(r, 'appendContinuationItemsAction')) + list(achar(r, 'reloadContinuationItemsCommand')):
                for item in acao.get('continuationItems', []):
                    if 'continuationItemRenderer' in item: tok = proximo(item)
            if tok == ultimo or (not novos and tok): break
        return dict(descricao=json.loads('"' + desc.group(1) + '"')[:600] if desc else '', comentarios=coms[:maximo])
    except Exception as e:
        return dict(erro=str(e)[:200], comentarios=[])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--config')
    ap.add_argument('--termos', nargs='*')
    ap.add_argument('--top', type=int)
    ap.add_argument('--nome', default='tema')
    ap.add_argument('--de', help='.json de uma rodada anterior (reaproveita a busca)')
    ap.add_argument('--ids', help='vídeos escolhidos à mão, separados por vírgula (exige --de)')
    a = ap.parse_args()
    cfg = json.load(open(a.config)) if a.config else {}
    termos = a.termos or cfg.get('termos', [])
    gl, hl = cfg.get('gl', 'BR'), cfg.get('hl', 'pt')
    # Sem isso o YouTube devolve os títulos traduzidos automaticamente pro inglês.
    radar.UA['Accept-Language'] = f'{hl}-{gl},{hl};q=0.9'
    excluir = [w.lower() for w in cfg.get('excluir_palavras', [])]
    top, maximo = a.top or cfg.get('top', 45), cfg.get('max_comentarios', 300)
    min_views, por_canal = cfg.get('min_views', 100000), cfg.get('por_canal', 3)

    vistos = {}
    if a.de:
        anterior = json.load(open(a.de))
        vistos = {v['id']: {k: x for k, x in v.items() if k not in ('comentarios', 'descricao', 'erro')} for v in anterior['todos']}
        termos = anterior['termos']
    for t in ([] if a.de else termos):
        for sp in (PERIODOS['ano'], TODOS_OS_TEMPOS):
            try:
                for v in buscar(t, sp, gl, hl):
                    if v['id'] and v['views'] >= min_views and not any(w in v['titulo'].lower() for w in excluir):
                        vistos.setdefault(v['id'], v)
            except Exception as e:
                print(f'  erro em "{t}": {e}', file=sys.stderr)
        print(f'{t}: {len(vistos)} vídeos acumulados', file=sys.stderr)

    # Vídeo curto demais (Short) tem comentário raso: fica de fora da mineração.
    ranking = sorted((v for v in vistos.values() if segundos(v['duracao'] or '0') >= 90),
                     key=lambda v: -v['views'])
    escolhidos, conta = [], {}
    if a.ids:
        escolhidos = [vistos[i] for i in a.ids.split(',') if i in vistos]
        ranking = []
    for v in ranking:
        if conta.get(v['canal'], 0) >= por_canal: continue
        conta[v['canal']] = conta.get(v['canal'], 0) + 1
        escolhidos.append(v)
        if len(escolhidos) >= top: break

    print(f'puxando comentários de {len(escolhidos)} vídeos...', file=sys.stderr)
    with ThreadPoolExecutor(4) as ex:
        for v, r in zip(escolhidos, ex.map(lambda v: puxar_comentarios(v['id'], maximo, gl, hl), escolhidos)):
            v.update(r)
            print(f'  {len(r["comentarios"]):>4} · {v["titulo"][:70]}', file=sys.stderr)

    os.makedirs(SAIDA, exist_ok=True)
    out = os.path.join(SAIDA, f'comentarios-{datetime.date.today().isoformat()}-{a.nome}.json')
    json.dump(dict(gerado=datetime.datetime.now().isoformat(timespec='minutes'), gl=gl, hl=hl, termos=termos,
                   todos=sorted(vistos.values(), key=lambda v: -v['views']), videos=escolhidos),
              open(out, 'w'), ensure_ascii=False, indent=1)
    print(out)


if __name__ == '__main__':
    main()
