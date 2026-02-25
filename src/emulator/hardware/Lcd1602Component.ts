import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState } from '../PinMappings';

export interface Lcd1602State extends ComponentState {
    lines: string[]; // 2 lines of 16 characters each
    cursorRow: number;
    cursorCol: number;
}

export class Lcd1602Component implements Component {
    readonly type = 'LCD1602';
    readonly id: string;
    readonly name: string;

    // Pin configurations (standard 4-bit mode)
    readonly rsPin: string;
    readonly enPin: string;
    readonly d4Pin: string;
    readonly d5Pin: string;
    readonly d6Pin: string;
    readonly d7Pin: string;

    private lines: string[] = ['                ', '                '];
    private cursorRow: number = 0;
    private cursorCol: number = 0;

    private lastEnState: boolean = false;
    private isWaitingForLowerNibble: boolean = false;
    private upperNibble: number = 0;

    constructor(id: string, name: string, rs: string, en: string, d4: string, d5: string, d6: string, d7: string) {
        this.id = id;
        this.name = name;
        this.rsPin = rs;
        this.enPin = en;
        this.d4Pin = d4;
        this.d5Pin = d5;
        this.d6Pin = d6;
        this.d7Pin = d7;
    }

    update(cpu: CPU): void {
        const enState = getPinState(cpu, this.enPin);

        // Detect falling edge of EN pin
        if (this.lastEnState && !enState) {
            this.processNibble(cpu);
        }

        this.lastEnState = enState;
    }

    private processNibble(cpu: CPU) {
        const rs = getPinState(cpu, this.rsPin);

        const d4 = getPinState(cpu, this.d4Pin) ? 1 : 0;
        const d5 = getPinState(cpu, this.d5Pin) ? 1 : 0;
        const d6 = getPinState(cpu, this.d6Pin) ? 1 : 0;
        const d7 = getPinState(cpu, this.d7Pin) ? 1 : 0;

        const nibble = (d7 << 3) | (d6 << 2) | (d5 << 1) | d4;

        if (!this.isWaitingForLowerNibble) {
            // Received upper nibble
            this.upperNibble = nibble;
            // In 4-bit initialization, some commands are sent as single nibbles.
            // But for this simple simulation, we will assume it's always sending full bytes (2 nibbles)
            // after the initial setup. We will simplify and always expect pairs.
            this.isWaitingForLowerNibble = true;
        } else {
            // Received lower nibble
            const data = (this.upperNibble << 4) | nibble;
            this.isWaitingForLowerNibble = false;

            if (rs) {
                // Data (character)
                this.writeChar(data);
            } else {
                // Command
                this.executeCommand(data);
            }
        }
    }

    private writeChar(charCode: number) {
        if (this.cursorRow < 2 && this.cursorCol < 16) {
            const char = String.fromCharCode(charCode);
            const line = this.lines[this.cursorRow];
            this.lines[this.cursorRow] = line.substring(0, this.cursorCol) + char + line.substring(this.cursorCol + 1);
            this.cursorCol++;
        }
    }

    private executeCommand(cmd: number) {
        if (cmd === 0x01) { // Clear display
            this.lines = ['                ', '                '];
            this.cursorRow = 0;
            this.cursorCol = 0;
        } else if (cmd === 0x02) { // Return home
            this.cursorRow = 0;
            this.cursorCol = 0;
        } else if ((cmd & 0x80) === 0x80) { // Set DDRAM address (cursor position)
            const addr = cmd & 0x7F;
            if (addr >= 0x40) {
                this.cursorRow = 1;
                this.cursorCol = addr - 0x40;
            } else {
                this.cursorRow = 0;
                this.cursorCol = addr;
            }
        }
        // Other commands (display on/off, shift, function set) are ignored in this simplified model
    }

    getState(): Lcd1602State {
        return {
            lines: [...this.lines],
            cursorRow: this.cursorRow,
            cursorCol: this.cursorCol
        };
    }
}
