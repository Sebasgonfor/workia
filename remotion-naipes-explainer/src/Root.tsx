import React from 'react';
import {Composition, staticFile} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {NaipesExplainer} from './NaipesExplainer';
import {SECTIONS, estimateSeconds} from './data/script';
import {AVAILABLE_AUDIO_IDS} from './components/Scene';

const FPS = 30;

// Duración por sección: si el .mp3 correspondiente ya existe (su id está en
// AVAILABLE_AUDIO_IDS), usamos su duración real; si no, usamos la
// estimación por conteo de palabras. Así el video se re-sincroniza solo en
// cuanto vayas agregando los audios definitivos a public/audio/.
const resolveFrames = async (): Promise<number[]> => {
  const durations = await Promise.all(
    SECTIONS.map(async (section) => {
      if (AVAILABLE_AUDIO_IDS.has(section.id)) {
        try {
          const seconds = await getAudioDurationInSeconds(staticFile(section.audioFile));
          if (seconds && seconds > 0) return seconds + 0.5; // pequeño colchón final
        } catch (err) {
          console.warn(`No se pudo leer la duración de ${section.audioFile}, usando estimación.`, err);
        }
      }
      return estimateSeconds(section.narration);
    })
  );
  return durations.map((seconds) => Math.round(seconds * FPS));
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NaipesExplainer"
        component={NaipesExplainer}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={Math.round(
          SECTIONS.reduce((acc, s) => acc + estimateSeconds(s.narration), 0) * FPS
        )}
        defaultProps={{framesPerSection: SECTIONS.map(() => FPS * 5)}}
        calculateMetadata={async ({props}) => {
          const framesPerSection = await resolveFrames();
          return {
            durationInFrames: framesPerSection.reduce((a, b) => a + b, 0),
            props: {...props, framesPerSection},
          };
        }}
      />
    </>
  );
};
