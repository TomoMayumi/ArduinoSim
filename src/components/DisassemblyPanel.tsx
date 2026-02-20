import React, { useEffect, useState, useRef } from 'react';
import { Disassembler } from '../emulator/Disassembler';
import type { DisassembledInstruction } from '../emulator/Disassembler';

interface DisassemblyPanelProps {
    program: Uint16Array | null;
    pc: number;
}

export const DisassemblyPanel: React.FC<DisassemblyPanelProps> = ({ program, pc }) => {
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
        if (listRef.current) {
            // Find the active element
            const activeElement = listRef.current.querySelector('.active-pc');
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [pc]);

    if (!program) {
        return <div className="disassembly-panel">プログラムがロードされていません</div>;
    }

    return (
        <div className="disassembly-panel" style={{ height: '300px', display: 'flex', flexDirection: 'column' }}>
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
                {instructions.map((inst) => {
                    // PC in avr8js is word address, instruction.address is byte address.
                    // Wait, avr8js pc is word address, and our disassembler produces address as word address as well?
                    // Let's check Disassembler.ts: `result.push({ address: pc * 2, ... }); pc += wordCount;`
                    // So our disassembler produces BYTE addresses.
                    // avr8js cpu.pc is WORD address. So we compare `inst.address === pc * 2`.
                    const isActive = inst.address === pc * 2;

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
                })}
            </div>
        </div>
    );
};
