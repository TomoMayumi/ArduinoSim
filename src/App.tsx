import { useState, useEffect } from 'react';
import { useEmulator } from './emulator/useEmulator';
import { useToast } from './hooks/useToast';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useProgramLoader } from './hooks/useProgramLoader';
import { ToastNotification } from './components/ToastNotification';
import { HeaderToolbar } from './components/HeaderToolbar';
import { SettingsModal } from './components/SettingsModal';
import { ProgramLoadModal } from './components/ProgramLoadModal';
import { PanelContainer } from './components/PanelContainer';
import './index.css';

function App() {
  // トースト通知
  const { toast, showToast } = useToast();

  // プログラムロード
  const loader = useProgramLoader(showToast);

  // エミュレータ
  const {
    emulator, isRunning, breakpoints, sourceMapper, fileManager,
    watchExpressions, watchResults,
    start, stop, step, reset,
    toggleBreakpoint, toggleLineBreakpoint, removeBreakpoints, updateBreakpointCondition,
    addWatch, removeWatch, updateWatchExpression, updateWatchFormat,
    breakpointError, setBreakpointError
  } = useEmulator(loader.program, loader.lssInput, loader.sourceFiles, loader.debugVariables, loader.architecture);

  // パネルレイアウト
  const panelLayout = usePanelLayout();

  // ローカル状態
  const [noResetMode, setNoResetMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ pc: 0, cycles: 0 });
  const [viewMode, setViewMode] = useState<'disassembly' | 'source'>('source');
  const [showAsmInSource, setShowAsmInSource] = useState(false);

  // ブレークポイントエラー表示
  useEffect(() => {
    if (breakpointError) {
      showToast(breakpointError, 'error');
      setBreakpointError(null);
    }
  }, [breakpointError, showToast, setBreakpointError]);

  // デバッグ情報の定期更新
  useEffect(() => {
    const interval = setInterval(() => {
      if (emulator) {
        setDebugInfo({ pc: emulator.cpu.pc, cycles: emulator.cpu.cycles });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [emulator]);

  return (
    <div className="app-container">
      <ToastNotification toast={toast} />

      <HeaderToolbar
        emulator={emulator}
        isRunning={isRunning}
        debugInfo={debugInfo}
        onStart={start}
        onStop={stop}
        onStep={step}
        onReset={reset}
        onOpenSamples={() => setShowSamples(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <PanelContainer
        {...panelLayout}
        emulator={emulator}
        isRunning={isRunning}
        reset={reset}
        noResetMode={noResetMode}
        breakpoints={breakpoints}
        sourceMapper={sourceMapper}
        updateBreakpointCondition={updateBreakpointCondition}
        removeBreakpoints={removeBreakpoints}
        toggleBreakpoint={toggleBreakpoint}
        toggleLineBreakpoint={toggleLineBreakpoint}
        watchExpressions={watchExpressions}
        watchResults={watchResults}
        addWatch={addWatch}
        removeWatch={removeWatch}
        updateWatchExpression={updateWatchExpression}
        updateWatchFormat={updateWatchFormat}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showAsmInSource={showAsmInSource}
        setShowAsmInSource={setShowAsmInSource}
        debugInfo={debugInfo}
        program={loader.program}
        fileManager={fileManager}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        noResetMode={noResetMode}
        onNoResetModeChange={setNoResetMode}
      />

      <ProgramLoadModal
        isOpen={showSamples}
        onClose={() => setShowSamples(false)}
        loader={loader}
        onStop={stop}
        onReset={reset}
      />
    </div>
  );
}

export default App;
