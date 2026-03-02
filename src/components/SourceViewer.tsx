import React, { useEffect, useRef, useMemo, memo } from 'react';
import { SourceMapper } from '../emulator/SourceMapper';

interface SourceViewerProps {
    sourceMapper: SourceMapper;
    pc: number; // word address
    isRunning: boolean;
    breakpoints: Set<number>;
    onToggleBreakpoint: (address: number) => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = memo(({ sourceMapper, pc, isRunning, breakpoints, onToggleBreakpoint }) => {
    const listRef = useRef<HTMLDivElement>(null);

    const activeAddress = isRunning ? -1 : pc * 2;
    const activeLineNumber = useMemo(() => {
        if (!sourceMapper.hasSource || activeAddress === -1) return -1;
        // Exact match
        let line = sourceMapper.getLineForAddress(activeAddress);
        return line ?? -1;
    }, [activeAddress, sourceMapper]);

    useEffect(() => {
        if (!isRunning && listRef.current && activeLineNumber !== -1) {
            const activeElement = listRef.current.querySelector('.active-source-line');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, [activeLineNumber, isRunning]);

    if (!sourceMapper.hasSource) {
        return <div className="source-viewer">LSSファイルがロードされていません。<br />右側のパネルから貼り付けてください。</div>;
    }

    return (
        <div className="source-viewer" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>C Source (LSS)</h3>
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    background: '#1e293b',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    whiteSpace: 'pre'
                }}
            >
                {sourceMapper.sourceLines.map((line) => {
                    const isActive = line.lineNumber === activeLineNumber;
                    // Check if *any* address in this line has a breakpoint
                    const hasBreakpoint = line.addresses.some(addr => breakpoints.has(addr));
                    // Does this line actually map to code?
                    const isCodeLine = line.addresses.length > 0;

                    return (
                        <div
                            key={line.lineNumber}
                            className={isActive ? 'active-source-line' : ''}
                            style={{
                                display: 'flex',
                                padding: '2px 4px',
                                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                                color: isActive ? '#ffffff' : (isCodeLine ? '#94a3b8' : '#64748b'),
                                borderRadius: '3px',
                                cursor: isCodeLine ? 'pointer' : 'default',
                                alignItems: 'center'
                            }}
                            onClick={() => {
                                if (isCodeLine) {
                                    onToggleBreakpoint(line.addresses[0]);
                                }
                            }}
                        >
                            <div style={{ width: '30px', textAlign: 'right', paddingRight: '10px', color: '#475569', userSelect: 'none' }}>
                                {line.lineNumber}
                            </div>
                            <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                {hasBreakpoint && (
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        backgroundColor: '#ef4444',
                                        border: '1px solid #fca5a1'
                                    }} />
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                {line.text}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
