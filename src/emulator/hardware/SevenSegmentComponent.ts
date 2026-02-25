
import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState } from '../PinMappings';

export interface SevenSegmentState extends ComponentState {
    digits: ({ value: number | null, dp: boolean, active: boolean } | null)[]; // 4 digits.
}

export class SevenSegmentComponent implements Component {
    readonly type = 'SEVEN_SEGMENT';
    readonly id: string;
    readonly name: string;

    // Pin definitions
    // BCD Inputs
    readonly pinA = 'D4';
    readonly pinB = 'D5';
    readonly pinC = 'D6';
    readonly pinD = 'D7';

    // Digit Selects (Active LOW)
    readonly pinD1 = 'D8';
    readonly pinD2 = 'D9';
    readonly pinD3 = 'D10';
    readonly pinD4 = 'D11';

    // Decimal Point
    readonly pinDP = 'D3';

    // Internal state to hold the 'persisted' view of the digits
    private digitValues: (number | null)[] = [null, null, null, null];
    private digitDPs: boolean[] = [false, false, false, false];
    private digitActive: boolean[] = [false, false, false, false];
    private lastUpdateCycles: number[] = [0, 0, 0, 0];

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    update(cpu: CPU): void {
        // 1. Read BCD Value
        const a = getPinState(cpu, this.pinA) ? 1 : 0;
        const b = getPinState(cpu, this.pinB) ? 1 : 0;
        const c = getPinState(cpu, this.pinC) ? 1 : 0;
        const d = getPinState(cpu, this.pinD) ? 1 : 0;
        const bcdValue = a + (b * 2) + (c * 4) + (d * 8);

        // TC4511BP: 0-9 display number, 10-15 blank
        const displayValue = bcdValue <= 9 ? bcdValue : null;

        // 2. Read DP
        const dpState = getPinState(cpu, this.pinDP);

        // 3. Update active digits
        const currentCycles = cpu.cycles;
        // 20ms persistence at 16MHz
        const PERSISTENCE_CYCLES = 320000;

        const digitPins = [this.pinD1, this.pinD2, this.pinD3, this.pinD4];

        for (let i = 0; i < 4; i++) {
            const isActive = !getPinState(cpu, digitPins[i]);
            this.digitActive[i] = isActive;
            if (isActive) {
                this.digitValues[i] = displayValue;
                this.digitDPs[i] = dpState;
                this.lastUpdateCycles[i] = currentCycles;
            } else {
                if (currentCycles - this.lastUpdateCycles[i] > PERSISTENCE_CYCLES) {
                    this.digitValues[i] = null;
                    this.digitDPs[i] = false;
                }
            }
        }
    }

    getState(): SevenSegmentState {
        return {
            digits: this.digitValues.map((val, idx) => ({
                value: val,
                dp: this.digitDPs[idx],
                active: this.digitActive[idx]
            }))
        };
    }
}
