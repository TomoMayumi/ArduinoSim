import React, { useEffect, useRef, useMemo, memo, useState } from 'react';
import { SourceMapper } from '../emulator/SourceMapper';
import type { SourceFileManager } from '../emulator/SourceFileManager';

interface SourceViewerProps {
    sourceMapper: SourceMapper;
    fileManager: SourceFileManager;
    pc: number; // word address
    isRunning: boolean;
    breakpoints: Set<number>;
    onToggleBreakpoint: (address: number) => void;
    showAssembly?: boolean;
}

export const SourceViewer: React.FC<SourceViewerProps> = memo(({ sourceMapper, fileManager, pc, isRunning, breakpoints, onToggleBreakpoint, showAssembly = false }) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

    const activeByteAddress = isRunning ? -1 : pc * 2;
    const currentLocation = useMemo(() => {
        return sourceMapper.getLocationForAddress(activeByteAddress);
    }, [activeByteAddress, sourceMapper]);

    // PCが変わったら、自動的にファイルを選択する (Auto-follow)
    useEffect(() => {
        if (currentLocation && currentLocation.fileName !== selectedFileName) {
            setSelectedFileName(currentLocation.fileName);
        }
    }, [currentLocation, selectedFileName]);

    // 初回ロード時に最初のファイルを選択する
    useEffect(() => {
        if (!selectedFileName) {
            const allFiles = fileManager.getAllFiles();
            if (allFiles.length > 0) {
                setSelectedFileName(allFiles[0].name);
            }
        }
    }, [fileManager, selectedFileName]);

    const files = useMemo(() => fileManager.getAllFiles(), [fileManager]);
    const selectedFile = useMemo(() =>
        selectedFileName ? fileManager.getFile(selectedFileName) : null
        , [fileManager, selectedFileName]);

    useEffect(() => {
        if (!isRunning && listRef.current && currentLocation && currentLocation.fileName === selectedFileName) {
            const activeElement = listRef.current.querySelector('.active-source-line');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, [currentLocation, selectedFileName, isRunning]);

    if (files.length === 0) {
        return <div className="source-viewer">Cソースコードがロードされていません。<br />右側のパネルから貼り付けてください。</div>;
    }

    return (
        <div className="source-viewer-container" style={{ display: 'flex', height: '100%', gap: '1px', background: '#334155' }}>
            {/* File Explorer */}
            <div className="file-explorer" style={{ width: '150px', background: '#1e293b', overflowY: 'auto', padding: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase' }}>Files</h4>
                {files.map(file => (
                    <div
                        key={file.name}
                        onClick={() => setSelectedFileName(file.name)}
                        style={{
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            borderRadius: '3px',
                            color: file.name === selectedFileName ? '#fff' : '#94a3b8',
                            background: file.name === selectedFileName ? '#3b82f6' : 'transparent',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {file.name}
                    </div>
                ))}
            </div>

            {/* Editor Area */}
            <div className="editor-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e293b', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #334155' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{selectedFileName}</h3>
                </div>

                <div
                    ref={listRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        padding: '0.5rem',
                        whiteSpace: 'pre'
                    }}
                >
                    {selectedFile?.lines.map((text, index) => {
                        const lineNumber = index + 1;
                        const isActive = currentLocation?.fileName === selectedFileName && currentLocation?.lineNumber === lineNumber;
                        const lineAddresses = sourceMapper.getAddressesForLocation(selectedFileName!, lineNumber);
                        const hasBreakpoint = lineAddresses.some(addr => breakpoints.has(addr));
                        const isCodeLine = lineAddresses.length > 0;
                        const asmLines = showAssembly ? sourceMapper.getAsmForLocation(selectedFileName!, lineNumber) : [];

                        return (
                            <React.Fragment key={lineNumber}>
                                <div
                                    className={isActive ? 'active-source-line' : ''}
                                    style={{
                                        display: 'flex',
                                        padding: '1px 4px',
                                        backgroundColor: isActive ? '#3b82f6' : 'transparent',
                                        color: isActive ? '#ffffff' : (isCodeLine ? '#cbd5e1' : '#64748b'),
                                        borderRadius: '2px',
                                        cursor: isCodeLine ? 'pointer' : 'default',
                                        alignItems: 'center'
                                    }}
                                    onClick={() => {
                                        if (isCodeLine) {
                                            onToggleBreakpoint(lineAddresses[0]);
                                        }
                                    }}
                                >
                                    <div style={{ width: '30px', textAlign: 'right', paddingRight: '10px', color: '#475569', userSelect: 'none' }}>
                                        {lineNumber}
                                    </div>
                                    <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                                        {hasBreakpoint && (
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: '#ef4444',
                                                border: '1px solid #fca5a1'
                                            }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {text || ' '}
                                    </div>
                                </div>
                                {asmLines.map((asmLine, asmIdx) => {
                                    // アドレス部分を抽出して、現在のPCと一致するか確認
                                    const addrMatch = asmLine.match(/^\s*([0-9a-fA-F]+):/);
                                    const asmByteAddr = addrMatch ? parseInt(addrMatch[1], 16) : -1;
                                    const isAsmActive = activeByteAddress === asmByteAddr;

                                    return (
                                        <div
                                            key={`asm-${lineNumber}-${asmIdx}`}
                                            style={{
                                                display: 'flex',
                                                padding: '0 4px 0 54px',
                                                fontSize: '0.75rem',
                                                color: isAsmActive ? '#fbbf24' : '#64748b',
                                                backgroundColor: isAsmActive ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            {asmLine}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

