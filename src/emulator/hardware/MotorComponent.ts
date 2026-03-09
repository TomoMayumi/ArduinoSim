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
    readonly updateInterval = 1; // 毎サイクル更新して精度を最大化する

    private currentSpeed = 0;
    private lastCycles = 0;
    private highCycles = 0;
    private totalCycles = 0;

    constructor(
        id: string,
        name: string,
        pin: string
    ) {
        this.id = id;
        this.name = name;
        this.pin = pin;
    }

    update(cpu: CPU): void {
        const cyclesPassed = cpu.cycles - this.lastCycles;
        if (cyclesPassed <= 0) return;

        if (getPinState(cpu, this.pin)) {
            this.highCycles += cyclesPassed;
        }
        this.totalCycles += cyclesPassed;
        this.lastCycles = cpu.cycles;

        // 計算期間を PWM 周期（100ms = 1,600,000 サイクル）に合わせる
        // これにより PWM の一周期を正確に捉えられる
        const SAMPLE_PERIOD = 1600000;
        if (this.totalCycles >= SAMPLE_PERIOD) {
            this.currentSpeed = this.highCycles / this.totalCycles;
            this.totalCycles -= SAMPLE_PERIOD;
            this.highCycles = 0;
            // totalCycles に残った端数は次のサンプリングに引き継がれる
        }
    }

    getState(): MotorState {
        return {
            speed: this.currentSpeed
        };
    }
}
