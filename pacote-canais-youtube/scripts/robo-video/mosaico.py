#!/usr/bin/env python3
"""Monta os PNGs de build/conferir em mosaicos de 24 (4×6, 320×180 cada) pra conferência rápida.
Uso: python3 mosaico.py <pasta-conferir> <pasta-saida>"""
import sys, os
from PIL import Image, ImageDraw
pasta, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
fs = sorted(f for f in os.listdir(pasta) if f.endswith('.png'))
W, H, T = 320, 180, 14
for k in range(0, len(fs), 24):
    lote = fs[k:k + 24]
    m = Image.new('RGB', (W * 4, (H + T) * -(-len(lote) // 4)), 'black'); d = ImageDraw.Draw(m)
    for i, f in enumerate(lote):
        x, y = (i % 4) * W, (i // 4) * (H + T)
        m.paste(Image.open(os.path.join(pasta, f)).convert('RGB').resize((W, H)), (x, y + T))
        d.text((x + 3, y + 1), f.replace('.png', ''), fill='yellow')
    m.save(os.path.join(saida, f'mosaico-{k // 24 + 1}.png'))
print(len(fs), 'quadros')
