import { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import './index.css';

const BLINK_HEX = `
:1000000001C00000259A2D9A29E23FEF4FEF4A9553
:10001000F1F73A95D9F72A95C1F72D9829E23FEFE4
:100020004FEF4A95F1F73A95D9F72A95C1F7EBCFFB
:00000001FF
`.trim();

const SERIAL_TEST_HEX = `
:1000000007E60093C40000E00093C50008E10093C6
:10001000C10006E00093C2001091C00015FFFCCF1D
:0800200005E50093C600F7CF2D
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
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button onClick={() => setHexInput(BLINK_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Blink (Lチカ)
            </button>
            <button onClick={() => setHexInput(SERIAL_TEST_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Serial Test ('U')
            </button>
          </div>
          <textarea
            rows={10}
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="ここにIntel HEXを貼り付けてください"
          />
        </div>
      </aside>
    </div>
  );
}

export default App;
