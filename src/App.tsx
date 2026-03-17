import { useState, useEffect, useCallback } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import { DisassemblyPanel } from './components/DisassemblyPanel';
import { SourceViewer } from './components/SourceViewer';
import { CpuStatePanel } from './components/CpuStatePanel';
import './index.css';

// サンプル一覧の型定義
interface SampleInfo {
  filename: string;
  name: string;
  category: string;
  description: string;
}

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

  // サンプル一覧
  const [sampleList, setSampleList] = useState<SampleInfo[]>([]);
  const [selectedSample, setSelectedSample] = useState('blink.json');

  // 折りたたみ
  const [showHexLss, setShowHexLss] = useState(false);

  // トースト通知
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  // サンプル一覧を読み込む
  useEffect(() => {
    fetch('/samples/sample_index.json')
      .then(res => res.json())
      .then(data => {
        setSampleList(data.samples || []);
      })
      .catch(e => console.error('サンプル一覧の読み込みに失敗:', e));
  }, []);

  useEffect(() => {
    // 初回ロード時に Blink を読み込む
    loadSample('blink.json');
  }, []);

  const loadSample = async (filename: string) => {
    const sampleInfo = sampleList.find(s => s.filename === filename);

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
      }

      setSelectedSample(filename);
      const displayName = sampleInfo?.name || filename.replace('.json', '');
      showToast(`${displayName} をロードしました`);
    } catch (e) {
      console.error('Sample Load Error:', e);
      showToast('サンプルのロードに失敗しました', 'error');
    }
  };

  // 現在の状態をサンプルJSONとしてエクスポート
  const exportCurrentState = () => {
    const hwConfig = localStorage.getItem('arduino_sim_hardware_config');
    const data: Record<string, unknown> = {
      hex: hexInput,
      lss: lssInput,
      sourceFiles: sourceFiles,
    };
    if (hwConfig) {
      data.hardwareConfigs = JSON.parse(hwConfig);
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedSample || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('現在の状態をエクスポートしました');
  };

  // サンプルをカテゴリ別にグループ化
  const samplesByCategory = sampleList.reduce<Record<string, SampleInfo[]>>((acc, sample) => {
    if (!acc[sample.category]) acc[sample.category] = [];
    acc[sample.category].push(sample);
    return acc;
  }, {});

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
        showToast('そのファイル名は既に存在します', 'error');
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
      }

      showToast(`${msg.split('が見つかりました')[0]}を読み込みました`);
    } else {
      showToast('有効なファイル（.c, .h, .hex, .lss 等）が見つかりませんでした。', 'error');
    }

    e.target.value = '';
  };

  return (
    <div className="app-container">
      {/* トースト通知 */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <header className="header">
        <h1 style={{ margin: '0' }}>Arduino/Atmega328P Simulator</h1>
        <div className="controls">
          <button onClick={isRunning ? stop : start}>
            {isRunning ? '⏸ 一時停止' : '▶ 実行'}
          </button>
          {!isRunning && (
            <button onClick={step} style={{ marginLeft: '0.5rem' }}>⏭ ステップ</button>
          )}
          <button onClick={reset} style={{ marginLeft: '0.5rem' }}>🔄 リセット</button>
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
                <span>クロック: 16MHz</span>
                <span>状態: {isRunning ? '実行中' : '停止中'}</span>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                  PC: 0x{debugInfo.pc.toString(16).padStart(4, '0')} | サイクル: {debugInfo.cycles.toLocaleString()}
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
                  <input type="radio" value="source" checked={viewMode === 'source'} onChange={(e) => setViewMode(e.target.value as any)} /> ソース
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                  <input type="radio" value="disassembly" checked={viewMode === 'disassembly'} onChange={(e) => setViewMode(e.target.value as any)} /> 逆アセンブリ
                </label>
              </div>
              {viewMode === 'source' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <input type="checkbox" checked={showAsmInSource} onChange={(e) => setShowAsmInSource(e.target.checked)} /> ASM表示
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
            <h3>サンプルプログラム</h3>
            
            {/* サンプル選択ドロップダウン */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  className="sample-select"
                  value={selectedSample}
                  onChange={(e) => {
                    const filename = e.target.value;
                    if (filename) {
                      loadSample(filename);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  {Object.entries(samplesByCategory).map(([category, samples]) => (
                    <optgroup label={`── ${category} ──`} key={category}>
                      {samples.map(sample => (
                        <option key={sample.filename} value={sample.filename}>
                          {sample.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={exportCurrentState}
                  title="現在の状態をJSONファイルとしてエクスポート"
                  style={{ background: '#6366f1', fontSize: '0.75rem', padding: '0.5rem 0.6rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  📤
                </button>
              </div>
              {/* 選択中のサンプルの説明 */}
              {sampleList.find(s => s.filename === selectedSample) && (
                <div className="sample-description">
                  📝 {sampleList.find(s => s.filename === selectedSample)?.description}
                </div>
              )}
            </div>

            {/* HEX/LSSの折りたたみセクション */}
            <div className="collapsible-section">
              <button
                className="collapsible-toggle"
                onClick={() => setShowHexLss(!showHexLss)}
              >
                <span>{showHexLss ? '▼' : '▶'} HEX / LSS データ（上級者向け）</span>
              </button>
              {showHexLss && (
                <div className="collapsible-content">
                  <div style={{ marginTop: '0.5rem' }}>
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
                </div>
              )}
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
                    title={file.name}
                  >
                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
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
