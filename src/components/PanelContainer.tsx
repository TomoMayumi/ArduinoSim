import React from 'react';
import { HardwarePanel, HardwarePanelTitle } from './HardwarePanel';
import { SerialConsole, SerialConsoleTitle } from './SerialConsole';
import { CpuStatePanel, CpuStatePanelTitle } from './CpuStatePanel';
import { BreakpointPanel, BreakpointPanelTitle } from './BreakpointPanel';
import { WatchPanel, WatchPanelTitle } from './WatchPanel';
import { ViewPanel } from './ViewPanel';
import { SourceViewerTitle } from './SourceViewer';
import { DisassemblyPanelTitle } from './DisassemblyPanel';
import { OscilloscopePanel, OscilloscopePanelTitle } from './OscilloscopePanel';
import { OscilloscopeComponent } from '../emulator/hardware/OscilloscopeComponent';
import type { PanelId } from '../hooks/usePanelLayout';
import type { Emulator } from '../emulator/Emulator';
import type { SourceMapper } from '../emulator/SourceMapper';
import type { SourceFileManager } from '../emulator/SourceFileManager';
import type { BreakpointInfo, WatchExpression, WatchResult } from '../emulator/DebugTypes';

interface Props {
  // レイアウト
  panelLayout: { [key: string]: PanelId[] };
  draggingPanel: PanelId | null;
  leftWidth: number;
  middleWidth: number;
  isResizingLeft: boolean;
  isResizingMiddle: boolean;
  handleDragStart: (e: React.DragEvent, panelId: PanelId) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, columnId: string, targetIndex: number) => void;
  startResizeLeft: () => void;
  startResizeMiddle: () => void;

  // エミュレータ
  emulator: Emulator | null;
  isRunning: boolean;
  reset: () => void;
  noResetMode: boolean;

  // ブレークポイント
  breakpoints: Map<number, BreakpointInfo>;
  sourceMapper: SourceMapper;
  updateBreakpointCondition: (addresses: number[], condition: string) => void;
  removeBreakpoints: (addresses: number[]) => void;
  toggleBreakpoint: (address: number) => void;
  toggleLineBreakpoint: (addresses: number[]) => void;

  // ウォッチ
  watchExpressions: WatchExpression[];
  watchResults: WatchResult[];
  addWatch: (expression: string) => void;
  removeWatch: (id: string) => void;
  updateWatchExpression: (id: string, expression: string) => void;
  updateWatchFormat: (id: string, format: 'hex' | 'dec' | 'bin') => void;

  // ビュー
  viewMode: 'disassembly' | 'source';
  setViewMode: (mode: 'disassembly' | 'source') => void;
  showAsmInSource: boolean;
  setShowAsmInSource: (show: boolean) => void;
  debugInfo: { pc: number; cycles: number };
  program: Uint16Array | null;
  fileManager: SourceFileManager;
}

// パネルレジストリの各エントリの型
interface PanelDefinition {
  title: string | (() => string);
  extraStyle?: React.CSSProperties;
  render: () => React.ReactNode;
}

export const PanelContainer: React.FC<Props> = (props) => {
  const {
    panelLayout, draggingPanel, leftWidth, middleWidth,
    isResizingLeft, isResizingMiddle,
    handleDragStart, handleDragOver, handleDrop,
    startResizeLeft, startResizeMiddle,
    emulator, isRunning, reset, noResetMode,
    breakpoints, sourceMapper, updateBreakpointCondition, removeBreakpoints,
    toggleBreakpoint, toggleLineBreakpoint,
    watchExpressions, watchResults, addWatch, removeWatch,
    updateWatchExpression, updateWatchFormat,
    viewMode, setViewMode, showAsmInSource, setShowAsmInSource,
    debugInfo, program, fileManager,
  } = props;

  // パネルレジストリ定義
  const createPanelRegistry = (): Record<string, PanelDefinition> => ({
    hardware: {
      title: HardwarePanelTitle,
      render: () => <HardwarePanel emulator={emulator as any} isRunning={isRunning} />
    },
    serial: {
      title: SerialConsoleTitle,
      extraStyle: { flex: 1, display: 'flex', flexDirection: 'column' as const },
      render: () => <SerialConsole uart={emulator?.uart} onReset={reset} noResetMode={noResetMode} />
    },
    cpu: {
      title: CpuStatePanelTitle,
      render: () => <CpuStatePanel emulator={emulator as any} isRunning={isRunning} />
    },
    breakpoints: {
      title: BreakpointPanelTitle,
      render: () => (
        <BreakpointPanel
          breakpoints={breakpoints}
          sourceMapper={sourceMapper}
          onUpdateCondition={updateBreakpointCondition}
          onRemoveBreakpoints={removeBreakpoints}
        />
      )
    },
    watch: {
      title: WatchPanelTitle,
      render: () => (
        <WatchPanel
          watchExpressions={watchExpressions}
          watchResults={watchResults}
          onAddWatch={addWatch}
          onRemoveWatch={removeWatch}
          onUpdateExpression={updateWatchExpression}
          onUpdateFormat={updateWatchFormat}
        />
      )
    },
    oscilloscope: {
      title: OscilloscopePanelTitle,
      render: () => {
        const comp = emulator?.hardware.getComponent('scope-1') as OscilloscopeComponent;
        if (!comp) return <div>オシロスコープがロードされていません</div>;
        return (
          <OscilloscopePanel
            state={comp.getState()}
            isRunning={!!isRunning}
            onPinChange={(chIdx, pin) => comp.setChannelPin(chIdx, pin)}
            onModeChange={(chIdx, mode) => comp.setChannelMode(chIdx, mode)}
          />
        );
      }
    },
    view: {
      title: () => viewMode === 'source' ? SourceViewerTitle : DisassemblyPanelTitle,
      extraStyle: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const },
      render: () => (
        <ViewPanel
          viewMode={viewMode}
          setViewMode={setViewMode}
          showAsmInSource={showAsmInSource}
          setShowAsmInSource={setShowAsmInSource}
          sourceMapper={sourceMapper}
          fileManager={fileManager}
          pc={isRunning ? -1 : debugInfo.pc}
          isRunning={isRunning}
          breakpoints={breakpoints}
          program={program}
          onToggleBreakpoint={toggleBreakpoint}
          onToggleLineBreakpoint={toggleLineBreakpoint}
          onUpdateCondition={updateBreakpointCondition}
        />
      )
    }
  });

  const panelRegistry = createPanelRegistry();

  return (
    <div className="main-layout" style={{ gridTemplateColumns: `${leftWidth}px 8px ${middleWidth}px 8px 1fr`, gap: 0 }}>
      {Object.entries(panelLayout).map(([columnId, panelIds], colIndex) => (
        <React.Fragment key={columnId}>
          {colIndex > 0 && (
            <div
              className={`resizer-v ${colIndex === 1 ? (isResizingLeft ? 'resizing' : '') : (isResizingMiddle ? 'resizing' : '')}`}
              onMouseDown={() => colIndex === 1 ? startResizeLeft() : startResizeMiddle()}
            />
          )}
          <div
            className={columnId === 'left' ? 'main-content' : (columnId === 'middle' ? 'register-sidebar' : 'disassembly-sidebar')}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, columnId, panelIds.length)}
          >
            {panelIds.map((panelId, index) => {
              const panelDef = panelRegistry[panelId];
              if (!panelDef) return null;

              const title = typeof panelDef.title === 'function' ? panelDef.title() : panelDef.title;
              const content = panelDef.render();
              const extraStyle = panelDef.extraStyle || {};

              return (
                <div
                  key={panelId}
                  className={`card ${draggingPanel === panelId ? 'dragging' : ''}`}
                  style={{ ...extraStyle, position: 'relative' }}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, columnId, index);
                  }}
                >
                  <div
                    className="card-drag-handle"
                    title="ドラッグして移動"
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, panelId)}
                  >
                    <span style={{ fontSize: '10px', opacity: 0.5, marginRight: '6px' }}>⠿</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
                  </div>
                  {content}
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
