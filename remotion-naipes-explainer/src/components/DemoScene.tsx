import React from 'react';
import {Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Section} from '../data/script';
import {DEMO_RUNS} from '../data/script';
import {Caption} from './Caption';
import {AVAILABLE_AUDIO_IDS} from './Scene';

const RUN_GAP = 8; // frames de transición entre corridas

// Escena final: simula ejecutar el script tres veces, mostrando una
// terminal con el resultado de cada corrida apareciendo en secuencia.
export const DemoScene: React.FC<{section: Section}> = ({section}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const hasAudio = AVAILABLE_AUDIO_IDS.has(section.id);

  const perRun = durationInFrames / DEMO_RUNS.length;
  const visibleRuns = Math.min(
    DEMO_RUNS.length,
    Math.floor(frame / perRun) + 1
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #05070d 0%, #0d1117 55%, #05070d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 120px',
        position: 'relative',
      }}
    >
      {hasAudio ? <Audio src={staticFile(section.audioFile)} /> : null}

      <div
        style={{
          width: 1100,
          background: '#0d1117',
          border: '1px solid #21262d',
          borderRadius: 18,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 28,
          color: '#e6edf3',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 18px',
            background: '#161b22',
            borderBottom: '1px solid #21262d',
          }}
        >
          <div style={{width: 14, height: 14, borderRadius: 999, background: '#ff5f56'}} />
          <div style={{width: 14, height: 14, borderRadius: 999, background: '#ffbd2e'}} />
          <div style={{width: 14, height: 14, borderRadius: 999, background: '#27c93f'}} />
          <span style={{marginLeft: 12, color: '#8b949e', fontSize: 18}}>python naipes.py</span>
        </div>
        <div style={{padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 26}}>
          {DEMO_RUNS.slice(0, visibleRuns).map((run, i) => {
            const startFrame = i * perRun;
            const localFrame = frame - startFrame;
            const opacity = interpolate(localFrame, [0, RUN_GAP], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={i} style={{opacity}}>
                <div style={{color: '#7d8590'}}>$ python naipes.py</div>
                <div>
                  Naipe: <span style={{color: '#a5d6ff'}}>{run.valor}</span> de{' '}
                  <span style={{color: '#a5d6ff'}}>{run.pinta}</span> (
                  <span style={{color: run.color === 'Roja' ? '#ff7b72' : '#e6edf3'}}>{run.color}</span>)
                </div>
                <div>
                  Ganancia total:{' '}
                  <span style={{color: '#3fb950', fontWeight: 700}}>
                    ${run.total.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Caption title={section.title} text={section.narration} />
    </div>
  );
};
