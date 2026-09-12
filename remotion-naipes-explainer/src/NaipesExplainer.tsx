import React from 'react';
import {Series} from 'remotion';
import {SECTIONS} from './data/script';
import {Scene} from './components/Scene';
import {DemoScene} from './components/DemoScene';

// framesPerSection: array de duraciones (en frames) resuelto por
// calculateMetadata en Root.tsx — a partir del audio real cuando existe,
// o de la estimación por palabras cuando no.
export const NaipesExplainer: React.FC<{framesPerSection: number[]}> = ({
  framesPerSection,
}) => {
  return (
    <Series>
      {SECTIONS.map((section, i) => (
        <Series.Sequence key={section.id} durationInFrames={framesPerSection[i]}>
          {section.id === 'demo' ? (
            <DemoScene section={section} />
          ) : (
            <Scene section={section} />
          )}
        </Series.Sequence>
      ))}
    </Series>
  );
};
