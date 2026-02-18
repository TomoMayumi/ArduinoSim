import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { setPinInput } from '../PinMappings';

export interface SwitchState extends ComponentState {
    isPressed: boolean;
    mode: 'momentary' | 'toggle';
}

export class SwitchComponent implements Component {
    readonly type = 'SWITCH';
    readonly id: string;
    readonly name: string;
    readonly pin: string;
    readonly mode: 'momentary' | 'toggle';

    constructor(
        id: string,
        name: string,
        pin: string, // 'D2', etc
        mode: 'momentary' | 'toggle' = 'momentary'
    ) {
        this.id = id;
        this.name = name;
        this.pin = pin;
        this.mode = mode;
    }

    private isPressed = false;

    update(cpu: CPU): void {
        setPinInput(cpu, this.pin, this.isPressed);
    }

    getState(): SwitchState {
        return {
            isPressed: this.isPressed,
            mode: this.mode
        };
    }

    // 操作用メソッド
    public setPressed(pressed: boolean) {
        this.isPressed = pressed;
    }

    public toggle() {
        this.isPressed = !this.isPressed;
    }
}
