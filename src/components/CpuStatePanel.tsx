import React, { memo } from 'react';
import { Atmega328P } from '../emulator/atmega328p';

interface CpuStatePanelProps {
    emulator: Atmega328P | null;
    isRunning: boolean;
}

export const CpuStatePanel: React.FC<CpuStatePanelProps> = memo(({ emulator, isRunning }) => {
    if (!emulator || isRunning) {
        return (
            <div className="cpu-state-panel" style={{ color: '#94a3b8', fontSize: '0.8rem', padding: '0.5rem' }}>
                {isRunning ? '実行中...' : 'エミュレータ未接続'}
            </div>
        );
    }

    const cpu = emulator.cpu;

    // Registers R0-R31
    const regBlocks = [];
    for (let i = 0; i < 32; i += 8) {
        const row = [];
        for (let j = 0; j < 8; j++) {
            const val = cpu.data[i + j];
            row.push(
                <div key={i + j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>R{i + j}</span>
                    <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                        {val.toString(16).padStart(2, '0').toUpperCase()}
                    </span>
                </div>
            );
        }
        regBlocks.push(
            <div key={`rgrp-${i}`} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                {row}
            </div>
        );
    }

    // SFRs for Ports
    const renderPort = (name: string, pinAddr: number, ddrAddr: number, portAddr: number) => {
        return (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem' }}>
                <span style={{ width: '40px', fontWeight: 'bold', color: '#e2e8f0' }}>{name}</span>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>PIN:{cpu.data[pinAddr].toString(2).padStart(8, '0')}</span>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>DDR:{cpu.data[ddrAddr].toString(2).padStart(8, '0')}</span>
                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>PORT:{cpu.data[portAddr].toString(2).padStart(8, '0')}</span>
            </div>
        );
    }

    // SREG
    const sreg = cpu.data[95]; // 0x5F
    const sregFlags = ['I', 'T', 'H', 'S', 'V', 'N', 'Z', 'C'];
    const sregRender = sregFlags.map((flag, idx) => {
        const bit = 7 - idx;
        const isSet = (sreg & (1 << bit)) !== 0;
        return (
            <span key={flag} style={{
                marginRight: '4px',
                color: isSet ? '#22c55e' : '#475569',
                fontWeight: isSet ? 'bold' : 'normal'
            }}>
                {flag}
            </span>
        );
    });

    return (
        <div className="cpu-state-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
            <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>SREG (0x5F)</h4>
                <div style={{ fontFamily: 'monospace', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                    {sregRender}
                </div>
            </div>

            <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>General Purpose Registers</h4>
                <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                    {regBlocks}
                </div>
            </div>

            <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>I/O Ports</h4>
                <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                    {/* Atmega328P I/O addresses in data space (add 0x20 to I/O address) */}
                    {renderPort('PORTB', 0x23, 0x24, 0x25)}
                    {renderPort('PORTC', 0x26, 0x27, 0x28)}
                    {renderPort('PORTD', 0x29, 0x2A, 0x2B)}
                </div>
            </div>
        </div>
    );
});
