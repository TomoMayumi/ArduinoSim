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
    readonly updateInterval = 1;
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

        // Calculate duty cycle periodically
        // Increased from 10ms (160,000) to 500ms (8,000,000) to support low-frequency PWM (e.g. 100ms/200ms period)
        const SAMPLE_PERIOD = 8000000;
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
