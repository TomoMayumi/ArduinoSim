import { useState, useEffect, useCallback } from 'react';
import { parseHex } from './emulator/intelhex';
import { useEmulator } from './emulator/useEmulator';
import { ElfParser } from './emulator/ElfParser';
import { DwarfParser } from './emulator/DwarfParser';
import { Pin13Led } from './components/Pin13Led';
import { SerialConsole } from './components/SerialConsole';
import { HardwarePanel } from './components/HardwarePanel';
import { DisassemblyPanel } from './components/DisassemblyPanel';
import { SourceViewer } from './components/SourceViewer';
import { CpuStatePanel } from './components/CpuStatePanel';
import { WatchPanel } from './components/WatchPanel';
import type { DebugVariable } from './emulator/DebugTypes';
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
  const [programSourceType, setProgramSourceType] = useState<'none' | 'hex' | 'elf'>('none');
  const [debugVariables, setDebugVariables] = useState<DebugVariable[]>([]);
  const {
    emulator, isRunning, breakpoints, sourceMapper, fileManager,
    watchExpressions, watchResults,
    start, stop, step, reset,
    toggleBreakpoint, toggleLineBreakpoint, updateBreakpointCondition,
    addWatch, removeWatch, updateWatchExpression, updateWatchFormat
  } = useEmulator(program, lssInput, sourceFiles, debugVariables);
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

  // モーダル
  const [showSettings, setShowSettings] = useState(false);
  const [showSamples, setShowSamples] = useState(false);

  // トースト通知
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    try {
      if (programSourceType === 'elf') {
        // ELFからの読み込み時はすでにprogramが設定されているためHEXのパースはスキップする
        return;
      }
      
      if (hexInput) {
        setProgram(parseHex(hexInput));
      } else {
        setProgram(null);
      }
    } catch (e) {
      console.error('HEX Parse Error:', e);
    }
  }, [hexInput, programSourceType]);

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
      setProgramSourceType('hex');
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
    let detectedElf: ArrayBuffer | null = null;

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
        } else if (ext === '.elf') {
            detectedElf = await file.arrayBuffer();
        }
    }

    if (newSourceFiles.length > 0 || detectedHex || detectedLss || detectedElf) {
      let msg = '';
      if (newSourceFiles.length > 0) msg += `${newSourceFiles.length} 個のソースファイル`;
      if (detectedElf) msg += (msg ? '、' : '') + 'ELFファイル';
      else if (detectedHex) msg += (msg ? '、' : '') + 'HEXファイル';
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
        stop();
        setHexInput('');
        setLssInput('');
        setSourceFiles(newSourceFiles);
        setActiveTabFilename(null);
        setSelectedSample('');
        setProgram(null);
        setDebugVariables([]);
        reset();
        setDebugInfo({ pc: 0, cycles: 0 });
      }

      if (detectedElf) {
        // ELFファイルからHEXデータと変数情報を抽出（HEXより優先）
        try {
          const elfParser = new ElfParser(detectedElf);
          const rawResult = elfParser.parse();
          const elfProgram = ElfParser.toProgram(rawResult.programData);
          
          setProgramSourceType('elf');
          setProgram(elfProgram);
          if (detectedHex) {
            setHexInput(detectedHex);
          } else {
            setHexInput('');
          }

          // DWARF変数情報を抽出
          try {
            const dwarfParser = new DwarfParser(rawResult);
            const vars = dwarfParser.extractVariables();
            setDebugVariables(vars);
            if (vars.length > 0) {
              msg += ` (${vars.length}個のデバッグ変数を検出)`;
            }
          } catch (dwarfErr) {
            console.warn('DWARF解析エラー（変数情報なしで続行）:', dwarfErr);
            setDebugVariables([]);
          }
        } catch (elfErr) {
          console.error('ELF解析エラー:', elfErr);
          showToast('ELFファイルの解析に失敗しました', 'error');
          // フォールバック：HEXがあればそちらを使う
          if (detectedHex) {
            setProgramSourceType('hex');
            setHexInput(detectedHex);
          }
        }
      } else if (detectedHex) {
        setProgramSourceType('hex');
        setHexInput(detectedHex);
        setDebugVariables([]);
      }
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

  const clearProgram = () => {
    stop();
    setProgramSourceType('none');
    setHexInput('');
    setLssInput('');
    setSourceFiles([]);
    setActiveTabFilename(null);
    setSelectedSample('');
    setProgram(null);
    setDebugVariables([]);
    reset();
    setDebugInfo({ pc: 0, cycles: 0 });
    showToast('プログラムをクリアしました');
  };

  return (
    <div className="app-container">
      {/* トースト通知 */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}

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
          <button onClick={isRunning ? stop : start} title={isRunning ? '一時停止' : '実行'} style={{ padding: '0.4rem 0.75rem' }}>
            {isRunning ? '⏸' : '▶'}
          </button>
          <button
            onClick={step}
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
          <button onClick={reset} title="リセット" style={{ padding: '0.4rem 0.75rem' }}>🔄</button>
          <div style={{ width: '1px', height: '20px', background: '#334155', margin: '0 0.25rem' }}></div>
          <button className="header-icon-btn" onClick={() => setShowSamples(true)}>📁 プログラム読込</button>
          <button className="header-icon-btn" onClick={() => setShowSettings(true)}>⚙️ 設定</button>
        </div>
      </header>

      <div className="main-layout">
        <main className="main-content">
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
          <div className="card" style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <WatchPanel
              watchExpressions={watchExpressions}
              watchResults={watchResults}
              onAddWatch={addWatch}
              onRemoveWatch={removeWatch}
              onUpdateExpression={updateWatchExpression}
              onUpdateFormat={updateWatchFormat}
            />
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
                onUpdateCondition={updateBreakpointCondition}
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

      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ 設定</h2>
              <button className="modal-close-btn" onClick={() => setShowSettings(false)}>&times;</button>
            </div>
            <div className="modal-body">
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
          </div>
        </div>
      )}

      {showSamples && (
        <div className="modal-overlay" onClick={() => setShowSamples(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', height: '90vh' }}>
            <div className="modal-header">
              <h2>📁 プログラムの読み込み (ファイル・サンプル)</h2>
              <button className="modal-close-btn" onClick={() => setShowSamples(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ flex: 1, padding: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* 1. サンプルから読み込み */}
                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.75rem' }}>
                    📚 サンプルから読み込み
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    <select
                      className="sample-select"
                      value={selectedSample}
                      onChange={(e) => {
                        const filename = e.target.value;
                        if (filename) {
                          loadSample(filename);
                        }
                      }}
                    >
                      <option value="">(サンプルを選択)</option>
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
                    {sampleList.find(s => s.filename === selectedSample) && (
                      <div className="sample-description" style={{ margin: 0, fontSize: '0.75rem', flex: 1 }}>
                        📝 {sampleList.find(s => s.filename === selectedSample)?.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. フォルダから読み込み */}
                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                   <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#10b981', marginBottom: '0.75rem' }}>
                    📁 フォルダから読み込み
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      ローカルのプロジェクトフォルダ（.c, .h, .hex など）を一括で読み込みます。
                    </p>
                    <div style={{ marginTop: 'auto' }}>
                      <button onClick={() => document.getElementById('folder-upload-main')?.click()} style={{ background: '#10b981', width: '100%' }}>
                        📁 フォルダを選択
                      </button>
                      <input id="folder-upload-main" type="file" onChange={handleFolderUpload} style={{ display: 'none' }} {...({ webkitdirectory: "", directory: "" } as any)} />
                    </div>
                  </div>
                </div>

                {/* 3. クリア */}
                <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                   <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#ef4444', marginBottom: '0.75rem' }}>
                    🗑️ 読み込んだ内容のクリア
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                      現在読み込まれているHEXやソースコードファイルをすべて破棄して初期状態に戻します。
                    </p>
                    <div style={{ marginTop: 'auto' }}>
                      <button onClick={clearProgram} style={{ background: '#ef4444', width: '100%' }}>
                        🗑️ クリア
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 区切り線と現在のソースコード/HEX情報 */}
              <div style={{ borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>📄 ロード済みファイル</h3>
                  <button
                    onClick={exportCurrentState}
                    title="現在のプロジェクト状態をJSONファイルとして保存"
                    style={{ background: '#6366f1', fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  >
                    📤 プロジェクトを保存
                  </button>
                </div>

                <div className="collapsible-section" style={{ marginBottom: '1rem' }}>
                  <button className="collapsible-toggle" onClick={() => setShowHexLss(!showHexLss)}>
                    <span>{showHexLss ? '▼' : '▶'} HEX / LSS データ（コンパイルされたバイナリ）</span>
                  </button>
                  {showHexLss && (
                    <div className="collapsible-content">
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Intel HEX:</label>
                        <textarea
                          rows={3}
                          value={hexInput}
                          onChange={(e) => {
                            setHexInput(e.target.value);
                            setProgramSourceType('hex');
                          }}
                          placeholder={programSourceType === 'elf' ? 'ELFデータ優先。入力でHEX上書き。' : 'Intel HEX'}
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

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Cソースコード・ヘッダファイル</label>
                    <button onClick={addSourceFile} style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#3b82f6' }}>+ 新規ファイル</button>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {sourceFiles.length === 0 && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ファイルはありません</span>}
                    {sourceFiles.map(file => (
                      <div
                        key={file.name}
                        style={{ display: 'flex', alignItems: 'center', background: activeTabFilename === file.name ? '#3b82f6' : '#334155', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => setActiveTabFilename(file.name)}
                        title={file.name}
                      >
                        <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeSourceFile(file.name); }} style={{ background: 'transparent', border: 'none', color: '#fff', marginLeft: '6px', padding: '0 2px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>&times;</button>
                      </div>
                    ))}
                  </div>

                  {activeTabFilename && (
                    <textarea
                      style={{ flex: 1, fontSize: '0.85rem', fontFamily: 'monospace', minHeight: '200px', resize: 'vertical', background: '#000', padding: '0.75rem' }}
                      value={sourceFiles.find(f => f.name === activeTabFilename)?.content || ''}
                      onChange={(e) => updateSourceFileContent(e.target.value)}
                      placeholder={`${activeTabFilename} の内容を入力...`}
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
