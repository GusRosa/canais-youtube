import json, urllib.request, urllib.parse, sys, collections
from concurrent.futures import ThreadPoolExecutor
seeds = ["ele sumiu","como fazer ele","como saber se ele","por que ele","ele visualizou","ele não","homem que","como esquecer","como conquistar","como deixar ele","o que fazer quando ele","sinais que ele","frases para ele","mensagem para ele","como reconquistar","ele me bloqueou","ele esfriou","ele só me procura","ele voltou","meu ex","ficante","crush","namorado","apego","homem evitativo","dependência emocional","como parar de","por que os homens","o que os homens","o que mandar para"]
def q(term, ds):
    url = "https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=br"+("&ds=yt" if ds else "")+"&q="+urllib.parse.quote(term)
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"}), timeout=10).read()
        return json.loads(r.decode("latin-1" if ds else "utf-8", errors="ignore"))[1]
    except Exception as e: return []
jobs = []
for s in seeds:
    for suf in ["", " a", " e", " m", " s", " c", " p", " q", " d", " n"]:
        jobs += [(s+suf, True), (s+suf, False)]
res = collections.defaultdict(lambda: collections.Counter())
with ThreadPoolExecutor(16) as ex:
    for (t, ds), out in zip(jobs, ex.map(lambda j: q(*j), jobs)):
        seed = t.rsplit(" ",1)[0] if t.split(" ")[-1] in list("aemscpqdn") else t
        for o in out: res[seed][(o, "YT" if ds else "G")] += 1
for s in seeds:
    print("\n## "+s)
    seen=set()
    for (o,src),n in res[s].most_common():
        if o in seen: continue
        seen.add(o); print(f"- [{src}] {o}")
