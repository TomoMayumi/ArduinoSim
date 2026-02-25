import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState } from '../PinMappings';

export interface MotorState extends ComponentState {
    speed: number; // 0.0 to 1.0 (PWM duty cycle)
}

export class MotorComponent implements Component {
    readonly type = 'MOTOR';
    readonly id: string;
    readonly name: string;
    readonly pin: string;

    private lastCycles: number = 0;
    private highCycles: number = 0;
    private totalCycles: number = 0;
    private currentSpeed: number = 0;

    constructor(id: string, name: string, pin: string) {
        this.id = id;
        this.name = name;
        this.pin = pin;
    }

    update(cpu: CPU): void {
        const pinState = getPinState(cpu, this.pin);
        const delta = cpu.cycles - this.lastCycles;

        if (delta > 0) {
            this.totalCycles += delta;
            if (pinState) {
                this.highCycles += delta;
            }
        }

        this.lastCycles = cpu.cycles;

        // Calculate duty cycle periodically (e.g., every 10ms at 16MHz = 160,000 cycles)
        const SAMPLE_PERIOD = 160000;
        if (this.totalCycles >= SAMPLE_PERIOD) {
            this.currentSpeed = this.highCycles / this.totalCycles;
            this.totalCycles = 0;
            this.highCycles = 0;
        }
    }

    getState(): MotorState {
        return {
            speed: this.currentSpeed
        };
    }
}
