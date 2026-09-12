import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// Subtítulo/leyenda inferior: útil como referencia mientras no hay audio
// definitivo, y como subtítulo accesible una vez que sí lo haya.
export const Caption: React.FC<{title: string; text: string}> = ({title, text}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 12, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <div
      style={{
        opacity,
        position: 'absolute',
        bottom: 48,
        left: 64,
        right: 64,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'Inter, Helvetica, Arial, sans-serif',
      }}
    >
      <span
        style={{
          alignSelf: 'flex-start',
          background: '#58a6ff',
          color: '#0d1117',
          fontWeight: 700,
          fontSize: 18,
          padding: '4px 14px',
          borderRadius: 999,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 26,
          lineHeight: 1.4,
          color: '#f0f6fc',
          background: 'rgba(13,17,23,0.72)',
          padding: '14px 20px',
          borderRadius: 12,
          backdropFilter: 'blur(4px)',
        }}
      >
        {text}
      </p>
    </div>
  );
};
