import React, { memo, useState, useEffect } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { PERIPHERAL_GROUPS, extractBitFieldValue } from './RegisterDefinitions';

interface CpuStatePanelProps {
    emulator: Atmega328P | null;
    isRunning: boolean;
}

type DisplayFormat = 'hex' | 'dec' | 'bin';
const FORMAT_CYCLE: DisplayFormat[] = ['hex', 'dec', 'bin'];

const formatValue = (val: number, fmt: DisplayFormat, bitWidth: number = 8): string => {
    switch (fmt) {
        case 'hex': {
            const hexDigits = Math.ceil(bitWidth / 4);
            return '0x' + val.toString(16).toUpperCase().padStart(hexDigits, '0');
        }
        case 'dec': return val.toString(10);
        case 'bin': return '0b' + val.toString(2).padStart(bitWidth, '0');
    }
};

const formatLabel = (fmt: DisplayFormat): string => {
    switch (fmt) {
        case 'hex': return 'HEX';
        case 'dec': return 'DEC';
        case 'bin': return 'BIN';
    }
};

export const CpuStatePanel: React.FC<CpuStatePanelProps> = memo(({ emulator, isRunning }) => {
    const [selectedGroups, setSelectedGroups] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('arduinoSim_selectedRegGroups');
            return saved ? JSON.parse(saved) : ['portb', 'portc', 'portd'];
        } catch {
            return ['portb', 'portc', 'portd'];
        }
    });

    const [displayFormat, setDisplayFormat] = useState<DisplayFormat>(() => {
        const saved = localStorage.getItem('arduinoSim_regDisplayFormat');
        return (saved === 'hex' || saved === 'dec' || saved === 'bin') ? saved : 'hex';
    });

    useEffect(() => {
        localStorage.setItem('arduinoSim_selectedRegGroups', JSON.stringify(selectedGroups));
    }, [selectedGroups]);

    useEffect(() => {
        localStorage.setItem('arduinoSim_regDisplayFormat', displayFormat);
    }, [displayFormat]);

    const cycleFormat = () => {
        setDisplayFormat(prev => FORMAT_CYCLE[(FORMAT_CYCLE.indexOf(prev) + 1) % FORMAT_CYCLE.length]);
    };

    const [expandedRegs, setExpandedRegs] = useState<Set<string>>(new Set());

    const toggleGroup = (groupId: string) => {
        setSelectedGroups(prev => prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]);
    };

    const toggleReg = (regName: string) => {
        setExpandedRegs(prev => {
            const next = new Set(prev);
            if (next.has(regName)) next.delete(regName);
            else next.add(regName);
            return next;
        });
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 0.5rem 0' }}>
                    <h4 style={{ margin: 0, color: '#cbd5e1' }}>ペリフェラル レジスタ</h4>
                    <span className="sfr-format-toggle" onClick={cycleFormat} title="クリックで表示形式を切り替え">{formatLabel(displayFormat)}</span>
                </div>
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
                                            const hasBitFields = reg.bitFields && reg.bitFields.length > 0;
                                            const isRegExpanded = expandedRegs.has(reg.name);
                                            return (
                                                <div key={reg.name}>
                                                    <div className={`sfr-tree-reg-row ${hasBitFields ? 'expandable' : ''}`}>
                                                        {hasBitFields ? (
                                                            <span className="sfr-reg-name" onClick={() => toggleReg(reg.name)} style={{ cursor: 'pointer' }}>
                                                                <span className="sfr-tree-arrow" style={{ marginRight: '2px' }}>{isRegExpanded ? '▼' : '▶'}</span>
                                                                {reg.name}
                                                            </span>
                                                        ) : (
                                                            <span className="sfr-reg-name">{reg.name}</span>
                                                        )}
                                                        <span className="sfr-reg-addr">0x{reg.addr.toString(16).toUpperCase().padStart(2, '0')}</span>
                                                        <span className="sfr-reg-val" onClick={cycleFormat} title="クリックで表示形式を切り替え">{formatValue(val, displayFormat)}</span>
                                                    </div>
                                                    {isRegExpanded && hasBitFields && (
                                                        <div className="sfr-bitfield-list">
                                                            {reg.bitFields!.map(bf => {
                                                                const bfVal = extractBitFieldValue(val, bf.bits);
                                                                const bitLabel = bf.bits.length === 1 ? `[${bf.bits[0]}]` : `[${bf.bits[0]}:${bf.bits[bf.bits.length - 1]}]`;
                                                                return (
                                                                    <div key={bf.name} className="sfr-bitfield-row" title={bf.description || ''}>
                                                                        <span className="sfr-bf-name">{bf.name}</span>
                                                                        <span className="sfr-bf-bits">{bitLabel}</span>
                                                                        <span className="sfr-bf-val" onClick={cycleFormat}>{formatValue(bfVal, displayFormat, bf.bits.length)}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
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
