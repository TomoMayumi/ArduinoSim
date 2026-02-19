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

const SEVEN_SEGMENT_HEX = `
:1000000001C00000209A219A229A239A539A549A66
:10001000559A569A579A289A299A2A9A2B9A5B980F
:1000200000E110912B001F70106110932B00289A93
:10003000299A2A9A2B9A28982CD0289A00E2109173
:100040002B001F70106210932B00289A299A2A9A6D
:100050002B9A29981ED0299A00E310912B001F702B
:10006000106310932B00289A299A2A9A2B9A2A987F
:1000700010D02A9A00E410912B001F701064109386
:100080002B00289A299A2A9A2B9A2B9802D02B9ADD
:10009000C7CF39E14AEF4A95F1F73A95D9F7089574
:00000001FF
`.trim();

const SEVEN_SEGMENT_COUNTUP_HEX = `
:1000000001C00000209A219A229A239A539A549A66
:10001000559A569A579A289A299A2A9A2B9A5B980F
:1000200050E060E070E080E090E0ADE7CAEF062FBE
:100030000295007F10912B001F70102B10932B0046
:10004000289A299A2A9A2B9A28985B98503019F066
:1000500057D0289A5B9A072F0295007F10912B00AA
:100060001F70102B10932B00289A299A2A9A2B9AEA
:1000700029985B98503019F043D0299A5B9A082F41
:100080000295007F10912B001F70102B10932B00F6
:10009000289A299A2A9A2B9A2A985B98503019F014
:1000A0002FD02A9A5B9A092F0295007F10912B007E
:1000B0001F70102B10932B00289A299A2A9A2B9A9A
:1000C0002B985B98503019F01BD02B9A5B9AA1505B
:1000D00019F401E05027ADE7C15081F46F5F6A3039
:1000E00001F460E07F5F7A3001F470E08F5F8A3066
:1000F00001F480E09F5F9A3009F490E0CAEF97CF57
:0E01000039E14AEF4A95F1F73A95D9F708959B
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
            <button onClick={() => setHexInput(SEVEN_SEGMENT_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              7-Segment (7セグ)
            </button>
            <button onClick={() => setHexInput(SEVEN_SEGMENT_COUNTUP_HEX)} style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              7-Segment Countup (7セグカウントアップ)
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
