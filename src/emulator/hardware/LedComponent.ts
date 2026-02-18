
import { CPU } from 'avr8js';
import type { Component, LedState } from './Component';
import { getPinState } from '../PinMappings';

export class LedComponent implements Component {
    readonly type = 'LED';
    readonly id: string;
    readonly name: string;
    readonly pin: string;
    readonly color: string;

    constructor(
        id: string,
        name: string,
        pin: string, // 'D13', 'A0', etc
        color: string = '#ff0000'
    ) {
        this.id = id;
        this.name = name;
        this.pin = pin;
        this.color = color;
    }

    private isOn = false;

    update(cpu: CPU): void {
        this.isOn = getPinState(cpu, this.pin);
    }

    getState(): LedState {
        return {
            isOn: this.isOn,
            color: this.color
        };
    }
}
