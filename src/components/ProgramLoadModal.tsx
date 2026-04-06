import React from 'react';
import type { useProgramLoader } from '../hooks/useProgramLoader';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loader: ReturnType<typeof useProgramLoader>;
  onStop: () => void;
  onReset: () => void;
}

export const ProgramLoadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  loader,
  onStop,
  onReset,
}) => {
  if (!isOpen) return null;

  const {
    samplesByCategory,
    selectedSample,
    sampleList,
    loadSample,
    handleFolderUpload,
    clearProgram,
    exportCurrentState,
    showHexLss,
    setShowHexLss,
    hexInput,
    setHexInput,
    setProgramSourceType,
    programSourceType,
    lssInput,
    sourceFiles,
    activeTabFilename,
    setActiveTabFilename,
    addSourceFile,
    removeSourceFile,
    updateSourceFileContent,
  } = loader;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', height: '90vh' }}>
        <div className="modal-header">
          <h2>📁 プログラムの読み込み (ファイル・サンプル)</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
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
                  <input
                    id="folder-upload-main"
                    type="file"
                    onChange={(e) => handleFolderUpload(e, onStop, onReset)}
                    style={{ display: 'none' }}
                    {...({ webkitdirectory: "", directory: "" } as any)}
                  />
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
                  <button onClick={() => clearProgram(onStop, onReset)} style={{ background: '#ef4444', width: '100%' }}>
                    🗑️ クリア
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 区切り線と現在のソースコード/HEX情報 */}
          <div style={{ borderTop: '1px solid #334155', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ margin: 0, fontSize: '1rem' }}>📄 ロード済みファイル</div>
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
                      readOnly
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
  );
};
