import React, { memo, useState, useEffect } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { PERIPHERAL_GROUPS } from './RegisterDefinitions';

interface CpuStatePanelProps {
    emulator: Atmega328P | null;
    isRunning: boolean;
}

export const CpuStatePanel: React.FC<CpuStatePanelProps> = memo(({ emulator, isRunning }) => {
    const [selectedGroups, setSelectedGroups] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('arduinoSim_selectedRegGroups');
            return saved ? JSON.parse(saved) : ['portb', 'portc', 'portd'];
        } catch {
            return ['portb', 'portc', 'portd'];
        }
    });

    useEffect(() => {
        localStorage.setItem('arduinoSim_selectedRegGroups', JSON.stringify(selectedGroups));
    }, [selectedGroups]);

    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
    };

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
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>ステータスレジスタ SREG (0x5F)</h4>
                <div style={{ fontFamily: 'monospace', background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                    {sregRender}
                </div>
            </div>

            <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>汎用レジスタ</h4>
                <div style={{ background: '#0f172a', padding: '0.5rem', borderRadius: '4px' }}>
                    {regBlocks}
                </div>
            </div>

            <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>ペリフェラル レジスタ</h4>
                <div className="sfr-tree">
                    {PERIPHERAL_GROUPS.map(group => {
                        const isExpanded = selectedGroups.includes(group.id);
                        return (
                            <div key={group.id} className="sfr-tree-group">
                                <div
                                    className={`sfr-tree-header ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleGroup(group.id)}
                                >
                                    <span className="sfr-tree-arrow">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="sfr-tree-label">{group.label}</span>
                                    <span className="sfr-tree-count">{group.registers.length}</span>
                                </div>
                                {isExpanded && (
                                    <div className="sfr-tree-registers">
                                        {group.registers.map(reg => {
                                            const val = cpu.data[reg.addr];
                                            return (
                                                <div key={reg.name} className="sfr-tree-reg-row">
                                                    <span className="sfr-reg-name">{reg.name}</span>
                                                    <span className="sfr-reg-addr">0x{reg.addr.toString(16).toUpperCase().padStart(2, '0')}</span>
                                                    <span className="sfr-reg-hex" title="Hexadecimal">0x{val.toString(16).toUpperCase().padStart(2, '0')}</span>
                                                    <span className="sfr-reg-dec" title="Decimal">{val.toString(10).padStart(3, ' ')}</span>
                                                    <span className="sfr-reg-bin" title="Binary">0b{val.toString(2).padStart(8, '0')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
