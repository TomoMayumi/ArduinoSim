import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { Disassembler } from '../emulator/Disassembler';
import type { DisassembledInstruction } from '../emulator/Disassembler';

interface DisassemblyPanelProps {
    program: Uint16Array | null;
    pc: number;
    isRunning: boolean;
}

export const DisassemblyPanel: React.FC<DisassemblyPanelProps> = memo(({ program, pc, isRunning }) => {
    const [instructions, setInstructions] = useState<DisassembledInstruction[]>([]);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (program) {
            setInstructions(Disassembler.disassemble(program));
        } else {
            setInstructions([]);
        }
    }, [program]);

    useEffect(() => {
        // Scroll the current PC into view
        if (!isRunning && listRef.current) {
            // Find the active element
            const activeElement = listRef.current.querySelector('.active-pc');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, [pc, isRunning]);

    const activePc = isRunning ? -1 : pc * 2;

    const renderedInstructions = useMemo(() => {
        return instructions.map((inst) => {
            const isActive = inst.address === activePc;

            return (
                <div
                    key={inst.address}
                    className={isActive ? 'active-pc' : ''}
                    style={{
                        display: 'flex',
                        gap: '1rem',
                        padding: '2px 4px',
                        backgroundColor: isActive ? '#3b82f6' : 'transparent',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        borderRadius: '3px'
                    }}
                >
                    <div style={{ width: '40px', textAlign: 'right', color: isActive ? '#e0e7ff' : '#64748b' }}>
                        {inst.address.toString(16).padStart(4, '0').toUpperCase()}
                    </div>
                    <div style={{ width: '80px', color: isActive ? '#e0e7ff' : '#475569' }}>
                        {inst.hex}
                    </div>
                    <div style={{ flex: 1 }}>
                        {inst.instruction}
                    </div>
                </div>
            );
        });
    }, [instructions, activePc]);

    if (!program) {
        return <div className="disassembly-panel">プログラムがロードされていません</div>;
    }

    return (
        <div className="disassembly-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Disassembly</h3>
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    background: '#1e293b',
                    padding: '0.5rem',
                    borderRadius: '4px'
                }}
            >
                {renderedInstructions}
            </div>
        </div>
    );
});
