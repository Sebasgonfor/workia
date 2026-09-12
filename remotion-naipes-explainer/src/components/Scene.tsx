import React from 'react';
import {Audio, staticFile} from 'remotion';
import type {Section} from '../data/script';
import {EXAMPLE_CARD} from '../data/script';
import {CodeBlock} from './CodeBlock';
import {PlayingCard} from './PlayingCard';
import {Caption} from './Caption';

// Marca aquí (o mejor, en public/audio/audio-manifest.ts si prefieres
// generarlo con un script) qué locuciones ya existen como .mp3 real.
// Mientras un id no esté en este set, la escena no intenta reproducir
// audio y simplemente usa la duración estimada por palabras.
export const AVAILABLE_AUDIO_IDS = new Set<string>([
  // 'import', 'listas', 'elegir', ...
]);

export const Scene: React.FC<{section: Section}> = ({section}) => {
  const hasAudio = AVAILABLE_AUDIO_IDS.has(section.id);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #05070d 0%, #0d1117 55%, #05070d 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 90px',
        position: 'relative',
      }}
    >
      {hasAudio ? <Audio src={staticFile(section.audioFile)} /> : null}

      <div style={{display: 'flex', gap: 70, alignItems: 'center', width: '100%'}}>
        <div style={{flex: 1.35, height: 780}}>
          <CodeBlock highlightLines={section.highlightLines} />
        </div>
        <div style={{flex: 0.65, display: 'flex', justifyContent: 'center'}}>
          <PlayingCard
            pinta={EXAMPLE_CARD.pinta}
            valor={EXAMPLE_CARD.valor}
            color={EXAMPLE_CARD.color}
            colorGain={EXAMPLE_CARD.colorGain}
            pintaGain={EXAMPLE_CARD.pintaGain}
            valueGain={EXAMPLE_CARD.valueGain}
            reveal={section.reveal}
          />
        </div>
      </div>

      <Caption title={section.title} text={section.narration} />
    </div>
  );
};
