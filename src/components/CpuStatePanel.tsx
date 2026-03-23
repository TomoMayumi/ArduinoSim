import React, { memo, useState, useEffect } from 'react';
import { Atmega328P } from '../emulator/atmega328p';
import { CPU_GROUPS, PERIPHERAL_GROUPS, extractBitFieldValue } from './RegisterDefinitions';
import type { RegisterGroup } from './RegisterDefinitions';

interface CpuStatePanelProps {
    emulator: Atmega328P | null;
    isRunning: boolean;
}

type DisplayFormat = 'hex' | 'dec' | 'bin';
const FORMAT_CYCLE: DisplayFormat[] = ['hex', 'dec', 'bin'];

const ALL_GROUPS: RegisterGroup[] = [...CPU_GROUPS, ...PERIPHERAL_GROUPS];

const formatValue = (val: number, fmt: DisplayFormat, bitWidth: number = 8): React.ReactNode => {
    switch (fmt) {
        case 'hex': {
            const hexDigits = Math.ceil(bitWidth / 4);
            return <><span className="sfr-val-prefix">0x</span>{val.toString(16).toUpperCase().padStart(hexDigits, '0')}</>;
        }
        case 'dec': return val.toString(10);
        case 'bin': return <><span className="sfr-val-prefix">0b</span>{val.toString(2).padStart(bitWidth, '0')}</>;
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
            return saved ? JSON.parse(saved) : ['cpu', 'portb', 'portc', 'portd'];
        } catch {
            return ['cpu', 'portb', 'portc', 'portd'];
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

    interface EditingState {
        regName: string;
        bitFieldName?: string;
        tempValue: string;
        bitWidth: number;
        addr?: number;
        special?: string;
        baseValue: number; // for bitfield mod
        bits?: number[];   // for bitfield mod
    }
    const [editingReg, setEditingReg] = useState<EditingState | null>(null);

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

    /** レジスタの値を取得（special対応） */
    const getRegValue = (reg: { addr: number; special?: string }): number => {
        switch (reg.special) {
            case 'pc': return cpu.pc;
            case 'sp': return (cpu.data[0x5E] << 8) | cpu.data[0x5D];
            case 'x': return (cpu.data[27] << 8) | cpu.data[26];
            case 'y': return (cpu.data[29] << 8) | cpu.data[28];
            case 'z': return (cpu.data[31] << 8) | cpu.data[30];
            default: return cpu.data[reg.addr];
        }
    };

    /** アドレス表示（special対応） */
    const getAddrLabel = (reg: { addr: number; special?: string }): string => {
        if (reg.special) return '';
        return '0x' + reg.addr.toString(16).toUpperCase().padStart(2, '0');
    };

    const handleDoubleClick = (
        regName: string,
        val: number,
        bitWidth: number,
        addr: number,
        special?: string,
        readonly?: boolean,
        bitFieldName?: string,
        bits?: number[]
    ) => {
        if (readonly) return;
        
        let initialStr = '';
        if (displayFormat === 'hex') {
            const hexDigits = Math.ceil(bitWidth / 4);
            initialStr = '0x' + val.toString(16).toUpperCase().padStart(hexDigits, '0');
        } else if (displayFormat === 'bin') {
            initialStr = '0b' + val.toString(2).padStart(bitWidth, '0');
        } else {
            initialStr = val.toString(10);
        }

        setEditingReg({
            regName,
            bitFieldName,
            tempValue: initialStr,
            bitWidth,
            addr,
            special,
            baseValue: bitFieldName ? getRegValue({ addr, special }) : val,
            bits
        });
    };

    const commitEdit = () => {
        if (!editingReg) return;
        const { tempValue, special, addr, baseValue, bits, bitWidth } = editingReg;
        
        // parse value
        let numVal = 0;
        const trimmed = tempValue.trim().toLowerCase();
        if (trimmed.startsWith('0x')) {
            numVal = parseInt(trimmed.substring(2), 16);
        } else if (trimmed.startsWith('0b')) {
            numVal = parseInt(trimmed.substring(2), 2);
        } else {
            numVal = parseInt(trimmed, 10);
        }

        if (isNaN(numVal)) {
            setEditingReg(null);
            return;
        }

        const maxVal = (1 << bitWidth) - 1;
        numVal = numVal & maxVal;

        let finalWriteVal = numVal;
        if (bits && bits.length > 0) {
            // Modify only the specified bits
            let mask = 0;
            for (const b of bits) mask |= (1 << b);
            
            // shift numVal to the correct position
            const shift = bits[bits.length - 1]; // e.g. bits=[7,6] -> shift=6
            finalWriteVal = (baseValue & ~mask) | ((numVal << shift) & mask);
        }

        if (special === 'pc') {
            cpu.pc = finalWriteVal;
        } else if (special === 'sp') {
            cpu.writeData(0x5D, finalWriteVal & 0xFF);
            cpu.writeData(0x5E, (finalWriteVal >> 8) & 0xFF);
        } else if (special === 'x') {
            cpu.writeData(26, finalWriteVal & 0xFF);
            cpu.writeData(27, (finalWriteVal >> 8) & 0xFF);
        } else if (special === 'y') {
            cpu.writeData(28, finalWriteVal & 0xFF);
            cpu.writeData(29, (finalWriteVal >> 8) & 0xFF);
        } else if (special === 'z') {
            cpu.writeData(30, finalWriteVal & 0xFF);
            cpu.writeData(31, (finalWriteVal >> 8) & 0xFF);
        } else if (addr !== undefined) {
            cpu.writeData(addr, finalWriteVal);
        }

        setEditingReg(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commitEdit();
        } else if (e.key === 'Escape') {
            setEditingReg(null);
        }
    };

    return (
        <div className="cpu-state-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0, color: '#cbd5e1' }}>レジスタ</h4>
                <span className="sfr-format-toggle" onClick={cycleFormat} title="クリックで表示形式を切り替え">{formatLabel(displayFormat)}</span>
            </div>
            <div className="sfr-tree">
                {ALL_GROUPS.map(group => {
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
                                        const val = getRegValue(reg);
                                        const bitWidth = reg.bitWidth || 8;
                                        const hasBitFields = reg.bitFields && reg.bitFields.length > 0;
                                        const isRegExpanded = expandedRegs.has(reg.name);
                                        const addrLabel = getAddrLabel(reg);
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
                                                    <span className="sfr-reg-addr">{addrLabel}</span>
                                                    <span
                                                        className={`sfr-reg-val ${reg.readonly ? 'readonly' : ''}`}
                                                        onDoubleClick={() => handleDoubleClick(reg.name, val, bitWidth, reg.addr, reg.special, reg.readonly)}
                                                        title={reg.readonly ? "読み取り専用" : "ダブルクリックで編集"}
                                                    >
                                                        {editingReg?.regName === reg.name && !editingReg.bitFieldName ? (
                                                            <input
                                                                autoFocus
                                                                className="sfr-reg-input"
                                                                type="text"
                                                                value={editingReg.tempValue}
                                                                onChange={(e) => setEditingReg({ ...editingReg, tempValue: e.target.value })}
                                                                onKeyDown={handleKeyDown}
                                                                onBlur={commitEdit}
                                                            />
                                                        ) : (
                                                            formatValue(val, displayFormat, bitWidth)
                                                        )}
                                                    </span>
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
                                                                    <span
                                                                        className={`sfr-bf-val ${bf.readonly ? 'readonly' : ''}`}
                                                                        onDoubleClick={() => handleDoubleClick(reg.name, bfVal, bf.bits.length, reg.addr, reg.special, bf.readonly, bf.name, bf.bits)}
                                                                        title={bf.readonly ? "読み取り専用" : "ダブルクリックで編集"}
                                                                    >
                                                                        {editingReg?.regName === reg.name && editingReg.bitFieldName === bf.name ? (
                                                                            <input
                                                                                autoFocus
                                                                                className="sfr-reg-input"
                                                                                type="text"
                                                                                value={editingReg.tempValue}
                                                                                onChange={(e) => setEditingReg({ ...editingReg, tempValue: e.target.value })}
                                                                                onKeyDown={handleKeyDown}
                                                                                onBlur={commitEdit}
                                                                            />
                                                                        ) : (
                                                                            formatValue(bfVal, displayFormat, bf.bits.length)
                                                                        )}
                                                                    </span>
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
    );
});
