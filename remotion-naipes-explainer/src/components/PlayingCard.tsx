import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Reveal} from '../data/script';

const SUIT_SYMBOL: Record<string, string> = {
  Pica: '♠',
  Trebol: '♣',
  Diamante: '♦',
  Corazon: '♥',
};

const pop = (frame: number, fps: number, delay = 0) =>
  spring({frame: frame - delay, fps, config: {damping: 14, mass: 0.6}});

export const PlayingCard: React.FC<{
  pinta: string;
  valor: string;
  color: string;
  colorGain: number;
  pintaGain: number;
  valueGain: number;
  reveal: Reveal;
}> = ({pinta, valor, color, colorGain, pintaGain, valueGain, reveal}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const isRed = color === 'Roja';
  const suit = SUIT_SYMBOL[pinta] ?? '?';

  const total =
    (reveal.color ? colorGain : 0) +
    (reveal.pintaGain ? pintaGain : 0) +
    (reveal.valueGain ? valueGain : 0);

  const cardScale = reveal.card ? pop(frame, fps) : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        width: '100%',
      }}
    >
      <div
        style={{
          transform: `scale(${cardScale}) rotate(${(1 - cardScale) * -8}deg)`,
          opacity: reveal.card ? 1 : 0,
          width: 260,
          height: 360,
          borderRadius: 20,
          background: '#fdfdfd',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          border: '2px solid #e2e2e2',
          position: 'relative',
          color: isRed ? '#d1263b' : '#1a1a1a',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{position: 'absolute', top: 16, left: 18, fontSize: 34, fontWeight: 700, lineHeight: 1}}>
          {valor}
          <div style={{fontSize: 30}}>{suit}</div>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 96,
          }}
        >
          {suit}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 18,
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1,
            transform: 'rotate(180deg)',
          }}
        >
          {valor}
          <div style={{fontSize: 30}}>{suit}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: 340,
          fontFamily: 'Inter, Helvetica, Arial, sans-serif',
          color: '#e6edf3',
        }}
      >
        <Row label="Color" value={reveal.color ? `${color} (+$${colorGain.toLocaleString('es-CO')})` : '—'} show={reveal.color} />
        <Row label="Ganancia por pinta" value={reveal.pintaGain ? `+$${pintaGain.toLocaleString('es-CO')}` : '—'} show={reveal.pintaGain} />
        <Row label="Ganancia por valor" value={reveal.valueGain ? `+$${valueGain.toLocaleString('es-CO')}` : '—'} show={reveal.valueGain} />
        <div
          style={{
            marginTop: 8,
            padding: '14px 18px',
            borderRadius: 12,
            background: reveal.total ? 'rgba(46, 160, 67, 0.18)' : 'rgba(255,255,255,0.05)',
            border: reveal.total ? '1px solid #2ea043' : '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          <span>Total</span>
          <span style={{color: reveal.total ? '#3fb950' : '#e6edf3'}}>
            ${total.toLocaleString('es-CO')}
          </span>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{label: string; value: string; show: boolean}> = ({label, value, show}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 20,
      opacity: show ? 1 : 0.35,
      transition: 'opacity 0.3s',
    }}
  >
    <span style={{color: '#8b949e'}}>{label}</span>
    <span style={{fontWeight: 600}}>{value}</span>
  </div>
);
