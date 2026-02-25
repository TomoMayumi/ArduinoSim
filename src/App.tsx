import { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import { DisassemblyPanel } from './components/DisassemblyPanel';
import { CpuStatePanel } from './components/CpuStatePanel';
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

const MOTOR_PWM_HEX = `
:1000000001C00000259A489A21982D9A20918000A3
:10001000213009F42DEC16C02F5F209380002091D5
:1000200080002093800088ED93E0A0E0B0E0DFCF93
:1000300088ED93E0A0E0B0E0DFCF2D9820918000A0
:10004000213009F42DEC0BC02F5F209380002091D8
:1000500080002093800088ED93E0A0E0B0E0DFCF8B
:10006000E7CF3FEF4FEF4A95F1F73A95D9F70895E2
:00000001FF
`.trim();

const LCD_HELLO_HEX = `
:1000000001C00000249A2B9A229A239A249A259A03
:100010002C9A22982398249825982B982C9838E251
:100020003BD038E039D038E037D032E035D032E273
:1000300033D03CE031D031E02FD036D048E44AD0DD
:1000400045E648D04CE646D04CE644D04FE642D0EA
:1000500020E040D057E73ED06FE63CD072E73AD04A
:100060006CE638D064E636D021E234D0FBCF1A88FD
:10007000198888ED93E0A0E0B0E0A12CB12CA10C4E
:10008000B10C81509040A040B04011F4EBCF08956F
:100090001000E5CF1A88198808CF00E00093000104
:1000A00008950895319830FD07C0219820FD03C0D6
:1000B000229801C0229A239822FD01C0239A2498CE
:1000C00024FD01C0249A259826FD01C0259A30E0EF
:1000D00039D0219A0895319A30FD07C0219820FDD5
:1000E00003C0229801C0229A239822FD01C0239ABD
:1000F000249824FD01C0249A259826FD01C0259ADA
:1001000030E039D0219A08952C9A08952C9808959C
:100110003BE036D02B982A9803D02B9A2A9811C083
:1001200033FB12C02B982AFD0DC02B9A0BC032FBBC
:100130000AC0229A18C0229816C031FB14C0239AE6
:1001400012C0239810C030FB0EC0249A0CC02498A9
:100150000AC037FB08C0259A06C0259804C036FBC9
:1001600002C0269A08952698089539E33BD033E03E
:0801700039D018D008951ED033
:00000001FF
`.trim();

function App() {
  const [hexInput, setHexInput] = useState(BLINK_HEX);
  const [program, setProgram] = useState<Uint16Array | null>(null);
  const { emulator, isRunning, start, stop, step, reset } = useEmulator(program);
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
          {!isRunning && (
            <button onClick={step} style={{ marginLeft: '0.5rem' }}>ステップ</button>
          )}
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
          <HardwarePanel emulator={emulator} isRunning={isRunning} />
        </div>
      </main>

      <aside className="disassembly-sidebar">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
          <CpuStatePanel emulator={emulator} isRunning={isRunning} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', flex: 1, minHeight: 0 }}>
          <DisassemblyPanel program={program} pc={isRunning ? -1 : debugInfo.pc} isRunning={isRunning} />
        </div>
      </aside>

      <aside className="sidebar">
        <div className="card">
          <h3>設定</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={noResetMode}
                onChange={(e) => setNoResetMode(e.target.checked)}
              />
              RESET EN 切断モード (リセットなし)
            </label>
            <button
              onClick={() => {
                localStorage.removeItem('arduino_sim_hardware_config');
                window.location.reload();
              }}
              style={{ background: '#475569', fontSize: '0.8rem', padding: '0.5rem' }}
            >
              ハードウェア設定を初期化
            </button>
          </div>
        </div>

        <div className="card hex-upload">
          <h3>HEX プログラム</h3>
          <div className="buttons">
            <button onClick={() => setHexInput(BLINK_HEX)}>
              Blink (Lチカ)
            </button>
            <button onClick={() => setHexInput(SERIAL_ECHO_HEX)}>
              Serial Echo (エコーバック)
            </button>
            <button onClick={() => setHexInput(BLINK2_HEX)}>
              Blink2 (Lチカ)
            </button>
            <button onClick={() => setHexInput(PUSH_SWITCH_HEX)}>
              Push Switch (プッシュスイッチ)
            </button>
            <button onClick={() => setHexInput(POT_BLINK_HEX)}>
              Potentiometer (可変抵抗)
            </button>
            <button onClick={() => setHexInput(SEVEN_SEGMENT_HEX)}>
              7-Segment (7セグ)
            </button>
            <button onClick={() => setHexInput(SEVEN_SEGMENT_COUNTUP_HEX)}>
              7-Segment Countup (7セグカウントアップ)
            </button>
            <button onClick={() => setHexInput(MOTOR_PWM_HEX)}>
              DC Motor PWM (モーター)
            </button>
            <button onClick={() => setHexInput(LCD_HELLO_HEX)}>
              LCD 1602 Hello (液晶)
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
