#!/usr/bin/env python3
"""Junta cartelas de 2 em 2 (empilhadas) pra revisão mais rápida do juiz visual.
Uso: python3 juntar_cartelas.py <pasta-cartelas> <pasta-saida>"""
import sys, glob, os
from PIL import Image
pasta, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
fs = sorted(glob.glob(os.path.join(pasta, 'cena-*.png')))
for i in range(0, len(fs), 2):
    par = fs[i:i+2]
    ims = [Image.open(f).resize((1280, 720)) for f in par]
    out = Image.new('RGB', (1280, 720 * len(ims)), 'white')
    for k, im in enumerate(ims): out.paste(im, (0, 720 * k))
    nome = '_'.join(os.path.basename(f).split('-')[1].split('.')[0] for f in par)
    out.save(os.path.join(saida, f'par-{nome}.png'))
print(len(fs), 'cartelas')
