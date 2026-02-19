import { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import './index.css';

const BLINK_HEX = `
:1000000001C00000259A2D9A29E23FEF4FEF4A9553
:10001000F1F73A95D9F72A95C1F72D9829E23FEFE4
:100020004FEF4A95F1F73A95D9F72A95C1F7EBCFFB
:00000001FF
`.trim();

const SERIAL_ECHO_HEX = `
:1000000007E60093C40000E00093C50008E10093F8
:10001000C10006E00093C2001091C00017FFFCCFA2
:100020000091C6001091C00015FFFCCF0093C600E0
:02003000F3CF0C
:00000001FF
`.trim();

const BLINK2_HEX = `
:1000000001C00000249A2C9A29E23FEF4FEF4A9555
:10001000F1F73A95D9F72A95C1F72C9829E23FEFE5
:100020004FEF4A95F1F73A95D9F72A95C1F7EBCFFB
:00000001FF
`.trim();

const PUSH_SWITCH_HEX = `
:1000000001C00000259A52985A9A4A9902C02D9A26
:06001000FCCF2D98FACF91
:00000001FF
`.trim();

const POT_BLINK_HEX = `
:1000000001C00000259A389880E680937C0087E83C
:1000100080937A0081E080937E0087EC80937A0061
:1000200040E44A95F1F7209179002D9A0BD087ECA6
:1000300080937A0040E44A95F1F7209179002D9859
:1000400001D0EBCF3FEF4FEF4A95F1F73A95D9F753
:060050002A95C1F7089596
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

        <div className="card">
          <HardwarePanel emulator={emulator} />
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
            <button onClick={() => setHexInput(SERIAL_ECHO_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Serial Echo (エコーバック)
            </button>
            <button onClick={() => setHexInput(BLINK2_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Blink2 (Lチカ)
            </button>
            <button onClick={() => setHexInput(PUSH_SWITCH_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Push Switch (プッシュスイッチ)
            </button>
            <button onClick={() => setHexInput(POT_BLINK_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              Potentiometer (可変抵抗)
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
