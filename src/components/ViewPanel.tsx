import React, { memo } from 'react';
import { SourceViewer } from './SourceViewer';
import { DisassemblyPanel } from './DisassemblyPanel';
import type { SourceMapper } from '../emulator/SourceMapper';
import type { SourceFileManager } from '../emulator/SourceFileManager';
import type { BreakpointInfo } from '../emulator/DebugTypes';

interface ViewPanelProps {
    viewMode: 'source' | 'disassembly';
    setViewMode: (mode: 'source' | 'disassembly') => void;
    showAsmInSource: boolean;
    setShowAsmInSource: (show: boolean) => void;
    sourceMapper: SourceMapper;
    fileManager: SourceFileManager;
    pc: number;
    isRunning: boolean;
    breakpoints: Map<number, BreakpointInfo>;
    program: Uint16Array | null;
    onToggleBreakpoint: (address: number) => void;
    onToggleLineBreakpoint: (addresses: number[]) => void;
    onUpdateCondition: (addresses: number[], condition: string) => void;
}

export const ViewPanel: React.FC<ViewPanelProps> = memo(({
    viewMode, setViewMode, showAsmInSource, setShowAsmInSource,
    sourceMapper, fileManager, pc, isRunning, breakpoints, program,
    onToggleBreakpoint, onToggleLineBreakpoint, onUpdateCondition
}) => {
    return (
        <>
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
                    pc={pc}
                    isRunning={isRunning}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={onToggleBreakpoint}
                    onToggleLineBreakpoint={onToggleLineBreakpoint}
                    onUpdateCondition={onUpdateCondition}
                    showAssembly={showAsmInSource}
                />
            ) : (
                <DisassemblyPanel
                    program={program}
                    pc={pc}
                    isRunning={isRunning}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={onToggleBreakpoint}
                />
            )}
        </>
    );
});
