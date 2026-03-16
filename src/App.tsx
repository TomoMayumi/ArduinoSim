import { useState, useEffect } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import { DisassemblyPanel } from './components/DisassemblyPanel';
import { SourceViewer } from './components/SourceViewer';
import { CpuStatePanel } from './components/CpuStatePanel';
import './index.css';

// サンプルデータの定数は public/samples/ 配下の JSON ファイルに移行しました

function App() {
  const [hexInput, setHexInput] = useState('');
  const [lssInput, setLssInput] = useState('');
  const [sourceFiles, setSourceFiles] = useState<{ name: string, content: string }[]>([]);
  const [program, setProgram] = useState<Uint16Array | null>(null);
  const { emulator, isRunning, breakpoints, sourceMapper, fileManager, start, stop, step, reset, toggleBreakpoint, toggleLineBreakpoint } = useEmulator(program, lssInput, sourceFiles);
  const [noResetMode, setNoResetMode] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ pc: 0, cycles: 0 });
  const [viewMode, setViewMode] = useState<'disassembly' | 'source'>('source');
  const [showAsmInSource, setShowAsmInSource] = useState(false);

  const [activeTabFilename, setActiveTabFilename] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (hexInput) {
        setProgram(parseHex(hexInput));
      } else {
        setProgram(null);
      }
    } catch (e) {
      console.error('HEX Parse Error:', e);
    }
  }, [hexInput]);

  useEffect(() => {
    // 初回ロード時に Blink を読み込む
    loadSample('blink.json');
  }, []);

  const loadSample = async (filename: string, isPreset = false) => {
    try {
      const response = await fetch(`/samples/${filename}`);
      const data = await response.json();
      setHexInput(data.hex || '');
      setLssInput(data.lss || '');
      setSourceFiles(data.sourceFiles || []);
      
      if (data.sourceFiles && data.sourceFiles.length > 0) {
        setActiveTabFilename(data.sourceFiles[0].name);
      } else {
        setActiveTabFilename(null);
      }

      if (data.hardwareConfigs) {
        localStorage.setItem('arduino_sim_hardware_config', JSON.stringify(data.hardwareConfigs));
        window.dispatchEvent(new Event('hardwareConfigChanged'));
      } else if (isPreset) {
         // プリセットかつ設定がない場合は初期化しないでおくか、初期化するかの判断になるが
         // 互換性のため一旦そのままにする
      }

      if (isPreset) {
        alert(`${filename.replace('.json', '')} プリセットをロードしました`);
      }
    } catch (e) {
      console.error('Sample Load Error:', e);
      alert('サンプルのロードに失敗しました');
    }
  };

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

  const addSourceFile = () => {
    const name = prompt('ファイル名を入力してください (例: main.c):');
    if (name) {
      if (sourceFiles.find(f => f.name === name)) {
        alert('そのファイル名は既に存在します');
        return;
      }
      setSourceFiles([...sourceFiles, { name, content: '' }]);
      setActiveTabFilename(name);
    }
  };

  const removeSourceFile = (name: string) => {
    setSourceFiles(sourceFiles.filter(f => f.name !== name));
    if (activeTabFilename === name) {
      setActiveTabFilename(null);
    }
  };

  const updateSourceFileContent = (content: string) => {
    if (activeTabFilename) {
      setSourceFiles(sourceFiles.map(f => f.name === activeTabFilename ? { ...f, content } : f));
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newSourceFiles: { name: string; content: string }[] = [];
    const validSourceExtensions = ['.c', '.h', '.cpp', '.hpp', '.s', '.asm'];
    let detectedHex: string | null = null;
    let detectedLss: string | null = null;

    // デコード用の関数
    const decodeFile = async (file: File): Promise<string> => {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(uint8Array);
      } catch (e) {
        const sjisDecoder = new TextDecoder('windows-31j');
        return sjisDecoder.decode(uint8Array);
      }
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = (file as any).webkitRelativePath || file.name;
        // プロジェクトルート名（一番上のフォルダ名）を削る
        const parts = fileName.split('/');
        const relativeName = parts.length > 1 ? parts.slice(1).join('/') : fileName;

        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (validSourceExtensions.includes(ext)) {
            const content = await decodeFile(file);
            newSourceFiles.push({ name: relativeName, content });
        } else if (ext === '.hex') {
            detectedHex = await decodeFile(file);
        } else if (ext === '.lss') {
            detectedLss = await decodeFile(file);
        }
    }

    if (newSourceFiles.length > 0 || detectedHex || detectedLss) {
      let msg = '';
      if (newSourceFiles.length > 0) msg += `${newSourceFiles.length} 個のソースファイル`;
      if (detectedHex) msg += (msg ? '、' : '') + 'HEXファイル';
      if (detectedLss) msg += (msg ? '、' : '') + 'LSSファイル';
      msg += 'が見つかりました。\n\n「OK」を押すと現在のリストに追加・上書きします。\n「キャンセル」を押すとクリアして新しく読み込みます。';

      const isAppend = window.confirm(msg);

      if (isAppend) {
        setSourceFiles(prev => {
          const merged = [...prev];
          newSourceFiles.forEach(newFile => {
            const idx = merged.findIndex(f => f.name === newFile.name);
            if (idx >= 0) {
              merged[idx] = newFile;
            } else {
              merged.push(newFile);
            }
          });
          return merged;
        });
      } else {
        setSourceFiles(newSourceFiles);
      }

      if (detectedHex) setHexInput(detectedHex);
      if (detectedLss) setLssInput(detectedLss);

      if (newSourceFiles.length > 0 && !activeTabFilename) {
        setActiveTabFilename(newSourceFiles[0].name);
      } else if (detectedHex && !activeTabFilename) {
          // ソースがない場合でも何か表示させるためのケア
      }
    } else {
      alert('有効なファイル（.c, .h, .hex, .lss 等）が見つかりませんでした。');
    }

    e.target.value = '';
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 style={{ margin: '0' }}>Arduino/Atmega328P Simulator</h1>
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

      <div className="main-layout">
        <main className="main-content">
          <div className="card" style={{ padding: '0.5rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Arduino (ATmega328P)</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <Pin13Led portB={emulator?.portB} />
                  <span>D13</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <span>Clock: 16MHz</span>
                <span>Status: {isRunning ? 'Running' : 'Stopped'}</span>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                  PC: 0x{debugInfo.pc.toString(16).padStart(4, '0')} | Cycles: {debugInfo.cycles.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <HardwarePanel emulator={emulator} isRunning={isRunning} />
          </div>

          <div className="card" style={{ padding: '0.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SerialConsole
              uart={emulator?.uart}
              onReset={reset}
              noResetMode={noResetMode}
            />
          </div>
        </main>

        <aside className="register-sidebar">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <CpuStatePanel emulator={emulator} isRunning={isRunning} />
          </div>
        </aside>

        <aside className="disassembly-sidebar">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="radio" value="source" checked={viewMode === 'source'} onChange={(e) => setViewMode(e.target.value as any)} /> Source
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="radio" value="disassembly" checked={viewMode === 'disassembly'} onChange={(e) => setViewMode(e.target.value as any)} /> Disassembly
                </label>
              </div>
              {viewMode === 'source' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <input type="checkbox" checked={showAsmInSource} onChange={(e) => setShowAsmInSource(e.target.checked)} /> Show ASM
                </label>
              )}
            </div>
            {viewMode === 'source' ? (
              <SourceViewer
                sourceMapper={sourceMapper}
                fileManager={fileManager}
                pc={isRunning ? -1 : debugInfo.pc}
                isRunning={isRunning}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
                onToggleLineBreakpoint={toggleLineBreakpoint}
                showAssembly={showAsmInSource}
              />
            ) : (
              <DisassemblyPanel
                program={program}
                pc={isRunning ? -1 : debugInfo.pc}
                isRunning={isRunning}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
              />
            )}
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
            <h3>HEX & LSS プログラム</h3>
            <div className="buttons">
              <button onClick={() => loadSample('blink.json')}>
                Blink (Lチカ)
              </button>
              <button onClick={() => loadSample('serial_echo.json')}>
                Serial Echo (エコーバック)
              </button>
              <button onClick={() => loadSample('blink2.json')}>
                Blink2 (Lチカ)
              </button>
              <button onClick={() => loadSample('push_switch.json')}>
                Push Switch (プッシュスイッチ)
              </button>
              <button onClick={() => loadSample('pot_blink.json')}>
                Potentiometer (可変抵抗)
              </button>
              <button onClick={() => loadSample('seven_segment.json')}>
                7-Segment (7セグ)
              </button>
              <button onClick={() => loadSample('seven_segment_countup.json')}>
                7-Segment Countup (7セグカウントアップ)
              </button>
              <button onClick={() => loadSample('motor_pwm.json')}>
                DC Motor PWM (モーター)
              </button>
              <button onClick={() => loadSample('lcd_hello.json')}>
                LCD 1602 Hello (液晶)
              </button>
              <button onClick={() => loadSample('analog_a0_to_7seg.json')}>
                Analog A0 to 7-Segment (アナログA0から7セグ)
              </button>
              <button onClick={() => loadSample('c_sample.json')} style={{ background: '#059669' }}>
                C Sample (Lチカ) ★NEW
              </button>
              <button onClick={() => loadSample('hybrid_system.json', true)} style={{ background: '#7c3aed' }}>
                Hybrid System ★PRESET
              </button>
              <button onClick={() => loadSample('lcd_test.json', true)} style={{ background: '#ec4899', marginLeft: '0.2rem' }}>
                LCD Debug ★PRESET
              </button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Intel HEX:</label>
              <textarea
                rows={3}
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="Intel HEX"
              />
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>LSSファイル:</label>
              <textarea
                rows={3}
                value={lssInput}
                onChange={(e) => setLssInput(e.target.value)}
                placeholder="LSSファイル"
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cソースコード群:</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={addSourceFile} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#3b82f6' }}>追加</button>
                  <button
                    onClick={() => document.getElementById('folder-upload')?.click()}
                    style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#10b981' }}
                  >
                    フォルダを追加
                  </button>
                  <input
                    id="folder-upload"
                    type="file"
                    onChange={handleFolderUpload}
                    style={{ display: 'none' }}
                    {...({ webkitdirectory: "", directory: "" } as any)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {sourceFiles.map(file => (
                  <div
                    key={file.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: activeTabFilename === file.name ? '#3b82f6' : '#334155',
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveTabFilename(file.name)}
                  >
                    <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSourceFile(file.name); }}
                      style={{ background: 'transparent', border: 'none', color: '#fff', marginLeft: '4px', padding: '0 2px', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {activeTabFilename && (
                <textarea
                  rows={10}
                  value={sourceFiles.find(f => f.name === activeTabFilename)?.content || ''}
                  onChange={(e) => updateSourceFileContent(e.target.value)}
                  placeholder={`${activeTabFilename} の内容を入力...`}
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                />
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
