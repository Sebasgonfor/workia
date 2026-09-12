import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {CODE_LINES} from '../data/code';

const COMMENT = '#7d8590';
const KEYWORD = '#ff7b72';
const STRING = '#a5d6ff';
const NUMBER = '#79c0ff';
const DEFAULT = '#e6edf3';

// Resaltado de sintaxis muy simple, suficiente para este script concreto:
// separa comentarios, strings, palabras clave y números por color.
const tokenize = (line: string): {text: string; color: string}[] => {
  if (line.trim().startsWith('#')) {
    return [{text: line, color: COMMENT}];
  }
  const tokens: {text: string; color: string}[] = [];
  const regex = /("[^"]*"|'[^']*')|(\b(?:import|if|else|elif|in|for|range|str|print)\b)|(\b\d+\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({text: line.slice(lastIndex, match.index), color: DEFAULT});
    }
    if (match[1]) tokens.push({text: match[1], color: STRING});
    else if (match[2]) tokens.push({text: match[2], color: KEYWORD});
    else if (match[3]) tokens.push({text: match[3], color: NUMBER});
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    tokens.push({text: line.slice(lastIndex), color: DEFAULT});
  }
  return tokens.length ? tokens : [{text: line || ' ', color: DEFAULT}];
};

export const CodeBlock: React.FC<{highlightLines: number[]}> = ({highlightLines}) => {
  const frame = useCurrentFrame();
  const highlightSet = new Set(highlightLines);
  const pulse = interpolate(frame % 40, [0, 20, 40], [0.75, 1, 0.75]);

  return (
    <div
      style={{
        fontFamily: 'Menlo, Consolas, monospace',
        fontSize: 26,
        lineHeight: 1.55,
        background: '#0d1117',
        borderRadius: 18,
        padding: '28px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        border: '1px solid #21262d',
      }}
    >
      {CODE_LINES.map((line, i) => {
        const lineNumber = i + 1;
        const isActive = highlightSet.has(lineNumber);
        return (
          <div
            key={lineNumber}
            style={{
              display: 'flex',
              background: isActive
                ? `rgba(56, 139, 253, ${0.16 * pulse})`
                : 'transparent',
              borderLeft: isActive ? '4px solid #58a6ff' : '4px solid transparent',
              paddingLeft: 10,
              opacity: highlightSet.size === 0 || isActive ? 1 : 0.35,
              transition: 'opacity 0.2s',
              whiteSpace: 'pre',
            }}
          >
            <span style={{color: '#484f58', width: 34, display: 'inline-block', userSelect: 'none'}}>
              {lineNumber}
            </span>
            <span>
              {tokenize(line).map((t, j) => (
                <span key={j} style={{color: t.color}}>
                  {t.text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
};
