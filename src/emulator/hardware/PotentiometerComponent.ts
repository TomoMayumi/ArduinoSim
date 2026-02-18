
import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { ARDUINO_PINS } from '../PinMappings';

export interface PotentiometerState extends ComponentState {
    value: number; // 0.0 - 5.0 (Voltage)
}

export class PotentiometerComponent implements Component {
    readonly type = 'POTENTIOMETER';
    readonly id: string;
    readonly name: string;
    readonly pin: string;

    constructor(
        id: string,
        name: string,
        pin: string, // 'A0', etc
        initialVoltage: number = 0.0
    ) {
        this.id = id;
        this.name = name;
        this.pin = pin;
        this.value = initialVoltage;
    }

    private value = 0.0;

    update(cpu: CPU): void {
        // ADC channel update is a bit tricky since we don't have direct access to 'adc' instance from 'cpu' object easily 
        // unless we attach it. 
        // However, HardwareManager receives 'cpu'. 
        // Ideally HardwareManager should hold reference to Atmega328P or we extend CPU?
        // Actually, in our architecture, HardwareManager holds CPU. 
        // We need access to AVRADC instance.

        // Workaround: We will assume we can access adc via some global or attached property, 
        // OR we change Component.update signature to take Atmega328P? 
        // No, HardwareManager only knows CPU.

        // Let's attach adc to cpu for convenience or pass it?
        // But strictly speaking, we can write to channelValues if we know where they are?
        // No, channelValues is a property of AVRADC instance.

        // Solution: Cast cpu to any and assume 'emulator' logic attached adc? 
        // initializing logic in Atmega328P constructor:
        // this.cpu = ...
        // this.adc = ...
        // (this.cpu as any).adc = this.adc; // Let's add this link in Atmega328P constructor!

        const adc = (cpu as any).adc;
        if (adc && ARDUINO_PINS[this.pin]) {
            const channel = ARDUINO_PINS[this.pin].pinIndex;
            // ADC channelValues are expected to be voltages (0-5)
            adc.channelValues[channel] = this.value;
        }
    }

    getState(): PotentiometerState {
        return {
            value: this.value
        };
    }

    public setValue(volts: number) {
        this.value = Math.max(0, Math.min(5, volts));
    }
}
