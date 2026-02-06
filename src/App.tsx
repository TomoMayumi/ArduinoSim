import React, { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import './index.css';

const BLINK_HEX = `
:100000000C9434000C943E000C943E000C943E0082
:100010000C943E000C943E000C943E000C943E0068
:100020000C943E000C943E000C943E000C943E0058
:100030000C943E000C943E000C943E000C943E0048
:100040000C943E000C943E000C943E000C943E0038
:100050000C943E000C943E000C943E000C943E0028
:100060000C943E000C943E0011241FBECF92CDB7B4
:10007000D192DDB70E9440000C945E000C940000F2
:1000800080916000882399F020E030E00E946E00D7
:100090008091600081E08093600010926000089531
:1000A00080916000882321F001E08093600000E06A
:1000B000089580916000882311F000E0089581E063
:1000C0000895CF93DF9300D00CD002D0F8CFEE24F4
:1000D000FF24870180818F25808308951F920F926B
:1000E0000FB60F9211242F933F934F935F936F93C9
:1000F0007F938F939F93AF93BF93EF93FF9380915B
:10010000000090910000A0910000B091000030E0DC
:100110000196A11DB11D3196A330B10728F080918C
:10012000000090910000A0910000B09100000196BF
:10013000A11DB11D8093000090930000A093000062
:10014000B0930000FF91EF91BF91AF919F918F9142
:100150007F916F915F914F913F912F910F900FBE14
:100160000F901F901895F894FFCF
:00000001FF
`.trim();

function App() {
  const [hexInput, setHexInput] = useState(BLINK_HEX);
  const [program, setProgram] = useState<Uint16Array | null>(null);
  const { emulator, isRunning, start, stop, reset } = useEmulator(program);
  const [noResetMode, setNoResetMode] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ pc: 0, cycles: 0 });

  useEffect(() => {
    try {
      setProgram(parseHex(hexInput));
    } catch (e) {
      console.error('HEX Parse Error:', e);
    }
  }, [hexInput]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (emulator) {
        setDebugInfo({
          pc: emulator.cpu.pc,
          cycles: emulator.cpu.cycles
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [emulator]);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Arduino/Atmega328P Simulator</h1>
        <div className="controls">
          <button onClick={isRunning ? stop : start}>
            {isRunning ? '一時停止' : '実行'}
          </button>
          <button onClick={reset} style={{ marginLeft: '0.5rem' }}>リセット</button>
        </div>
      </header>

      <main className="main-content">
        <div className="card">
          <h2>Arduino Board (Emulated)</h2>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', padding: '1rem' }}>
            <Pin13Led portB={emulator?.portB} />
            <div className="board-info">
              <p>MCU: ATmega328P</p>
              <p>Clock: 16MHz</p>
              <p>Status: {isRunning ? 'Running' : 'Stopped'}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#94a3b8' }}>
                PC: 0x{debugInfo.pc.toString(16).padStart(4, '0')} |
                Cycles: {debugInfo.cycles.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <SerialConsole
            uart={emulator?.uart}
            onReset={reset}
            noResetMode={noResetMode}
          />
        </div>
      </main>

      <aside className="sidebar">
        <div className="card">
          <h3>設定</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={noResetMode}
              onChange={(e) => setNoResetMode(e.target.checked)}
            />
            RESET EN 切断モード (リセットなし)
          </label>
        </div>

        <div className="card hex-upload">
          <h3>HEX プログラム</h3>
          <textarea
            rows={10}
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="ここにIntel HEXを貼り付けてください"
          />
          <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
            ※デフォルトはBlink（Lチカ）プログラムです。
          </p>
        </div>
      </aside>
    </div>
  );
}

export default App;
