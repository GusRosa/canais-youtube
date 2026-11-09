import {interpolate} from 'remotion';

// Pseudo-aleatório estável por cena, pra rotação e direção do movimento não mudarem entre renders.
export const semente = (i: number, salt = 1) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Movimento lento de câmera sobre foto parada (Ken Burns), alternando zoom e direção.
export const kenBurns = (frame: number, total: number, i: number) => {
  const p = interpolate(frame, [0, total], [0, 1], {extrapolateRight: 'clamp'});
  const entrando = i % 2 === 0;
  const escala = entrando ? 1.05 + p * 0.12 : 1.17 - p * 0.12;
  const dx = (semente(i, 2) - 0.5) * 60 * (entrando ? p : 1 - p);
  const dy = (semente(i, 3) - 0.5) * 40 * (entrando ? p : 1 - p);
  return `scale(${escala}) translate(${dx}px, ${dy}px)`;
};

export const fadeEntrada = (frame: number, duracao = 8) =>
  interpolate(frame, [0, duracao], [0, 1], {extrapolateRight: 'clamp'});
