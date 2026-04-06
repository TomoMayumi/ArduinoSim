import React from 'react';
import { Pin13Led } from './Pin13Led';
import type { Emulator } from '../emulator/Emulator';

interface Props {
  emulator: Emulator | null;
  isRunning: boolean;
  debugInfo: { pc: number; cycles: number };
  onStart: () => void;
  onStop: () => void;
  onStep: () => void;
  onReset: () => void;
  onOpenSamples: () => void;
  onOpenSettings: () => void;
}

export const HeaderToolbar: React.FC<Props> = ({
  emulator,
  isRunning,
  debugInfo,
  onStart,
  onStop,
  onStep,
  onReset,
  onOpenSamples,
  onOpenSettings,
}) => {
  return (
    <header className="header" style={{ padding: '0.5rem 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: '0', fontSize: '1.2rem' }}>Arduino Simulator</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', background: '#1e293b', padding: '0.2rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Pin13Led portB={emulator?.portB} /> <span>D13</span>
          </div>
          <div style={{ color: '#cbd5e1', borderLeft: '1px solid #334155', paddingLeft: '0.75rem' }}>
            16MHz | {isRunning ? '実行中' : '停止中'}
          </div>
          <div style={{ fontFamily: 'monospace', color: '#94a3b8', borderLeft: '1px solid #334155', paddingLeft: '0.75rem' }}>
            PC: 0x{debugInfo.pc.toString(16).padStart(4, '0')} | Cyc: {debugInfo.cycles.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="controls" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button onClick={isRunning ? onStop : onStart} title={isRunning ? '一時停止' : '実行'} style={{ padding: '0.4rem 0.75rem' }}>
          {isRunning ? '⏸' : '▶'}
        </button>
        <button
          onClick={onStep}
          title="ステップ"
          disabled={isRunning}
          style={{
            padding: '0.4rem 0.75rem',
            opacity: isRunning ? 0.4 : 1,
            cursor: isRunning ? 'not-allowed' : 'pointer',
            pointerEvents: isRunning ? 'none' : 'auto'
          }}
        >
          ⏭
        </button>
        <button onClick={onReset} title="リセット" style={{ padding: '0.4rem 0.75rem' }}>🔄</button>
        <div style={{ width: '1px', height: '20px', background: '#334155', margin: '0 0.25rem' }}></div>
        <button className="header-icon-btn" onClick={onOpenSamples}>📁 プログラム読込</button>
        <button className="header-icon-btn" onClick={onOpenSettings}>⚙️ 設定</button>
      </div>
    </header>
  );
};
