import React, { useEffect, useState, useRef, useMemo, memo, useCallback } from 'react';

export const DisassemblyPanelTitle = '逆アセンブリ';
import { Disassembler } from '../emulator/Disassembler';
import type { DisassembledInstruction } from '../emulator/Disassembler';
import type { BreakpointInfo } from '../emulator/DebugTypes';

interface DisassemblyPanelProps {
    program: Uint16Array | null;
    pc: number;
    isRunning: boolean;
    breakpoints: Map<number, BreakpointInfo>;
    onToggleBreakpoint: (address: number) => void;
}

export const DisassemblyPanel: React.FC<DisassemblyPanelProps> = memo(({ program, pc, isRunning, breakpoints, onToggleBreakpoint }) => {
    const [instructions, setInstructions] = useState<DisassembledInstruction[]>([]);
    const listRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(400);

    const ROW_HEIGHT = 24;

    useEffect(() => {
        if (program) {
            setInstructions(Disassembler.disassemble(program));
        } else {
            setInstructions([]);
        }
    }, [program]);

    const activePc = isRunning ? -1 : pc * 2;

    // Use ResizeObserver to update viewport height
    useEffect(() => {
        if (!listRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setViewportHeight(entries[0].contentRect.height);
            }
        });
        observer.observe(listRef.current);
        return () => observer.disconnect();
    }, []);

    // Handle scroll
    const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Scroll to active PC when it changes and not running
    useEffect(() => {
        if (!isRunning && listRef.current && instructions.length > 0) {
            const index = instructions.findIndex(inst => inst.address === activePc);
            if (index !== -1) {
                const itemScroll = index * ROW_HEIGHT;
                const targetScroll = Math.max(0, itemScroll - viewportHeight / 2 + ROW_HEIGHT / 2);
                listRef.current.scrollTop = targetScroll;
                // scrollTop state is updated via onScroll event natively
            }
        }
    }, [activePc, isRunning, instructions.length, viewportHeight]);

    const totalHeight = instructions.length * ROW_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 10;
    const endIndex = Math.min(instructions.length - 1, startIndex + visibleCount);

    const renderedInstructions = useMemo(() => {
        if (instructions.length === 0) return null;
        const visibleInstructions = instructions.slice(startIndex, endIndex + 1);

        return visibleInstructions.map((inst, idx) => {
            const isActive = inst.address === activePc;
            const bpInfo = breakpoints.get(inst.address);
            const hasBreakpoint = bpInfo !== undefined;
            const hasCondition = bpInfo?.condition ? true : false;
            const actualIndex = startIndex + idx;

            return (
                <div
                    key={inst.address}
                    className={isActive ? 'active-pc' : ''}
                    style={{
                        position: 'absolute',
                        top: actualIndex * ROW_HEIGHT,
                        left: 0,
                        right: 0,
                        height: ROW_HEIGHT,
                        display: 'flex',
                        gap: '0.5rem',
                        padding: '2px 4px',
                        backgroundColor: isActive ? '#3b82f6' : 'transparent',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        alignItems: 'center'
                    }}
                    onClick={() => onToggleBreakpoint(inst.address)}
                >
                    <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                        {hasBreakpoint && (
                            <div
                                className={hasCondition ? 'bp-marker conditional' : 'bp-marker'}
                                title={hasCondition ? `条件: ${bpInfo?.condition}` : ''}
                            >
                                {hasCondition && <span className="bp-condition-icon">?</span>}
                            </div>
                        )}
                    </div>
                    <div style={{ width: '40px', textAlign: 'right', color: isActive ? '#e0e7ff' : '#64748b' }}>
                        {inst.address.toString(16).padStart(4, '0').toUpperCase()}
                    </div>
                    <div style={{ width: '80px', color: isActive ? '#e0e7ff' : '#475569' }}>
                        {inst.hex}
                    </div>
                    <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {inst.instruction}
                    </div>
                </div>
            );
        });
    }, [instructions, startIndex, endIndex, activePc, breakpoints, onToggleBreakpoint]);

    if (!program) {
        return <div className="disassembly-panel" style={{ color: 'white' }}>プログラムがロードされていません</div>;
    }

    return (
        <div className="disassembly-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div
                ref={listRef}
                onScroll={onScroll}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    background: '#1e293b',
                    borderRadius: '4px',
                    position: 'relative'
                }}
            >
                <div style={{ height: totalHeight, position: 'relative' }}>
                    {renderedInstructions}
                </div>
            </div>
        </div>
    );
});
