import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { ARDUINO_PINS } from '../PinMappings';

export interface AdKeyboardState extends ComponentState {
    pressedKey: 1 | 2 | 3 | 4 | null;
}

export class AdKeyboardComponent implements Component {
    readonly type = 'AD_KEYBOARD';
    readonly id: string;
    readonly name: string;
    readonly pin: string;

    private pressedKey: 1 | 2 | 3 | 4 | null = null;

    constructor(
        id: string,
        name: string,
        pin: string // e.g. 'A1'
    ) {
        this.id = id;
        this.name = name;
        this.pin = pin;
    }

    update(cpu: CPU): void {
        const adc = (cpu as any).adc;
        if (adc && ARDUINO_PINS[this.pin]) {
            const channel = ARDUINO_PINS[this.pin].pinIndex;
            let voltage = 5.0; // Default pull-up

            // Calculate voltage based on the resistor ladder:
            // 5V --- 300 ohm ---+--- 100 ohm ---+--- 200 ohm ---+--- 600 ohm ---+
            //                   |               |               |               |
            //                  SW4             SW3             SW2             SW1
            //                   |               |               |               |
            //                  GND             GND             GND             GND

            switch (this.pressedKey) {
                case 4:
                    // Connected directly to GND
                    voltage = 0.0;
                    break;
                case 3:
                    // 100 ohm to GND
                    voltage = 5.0 * (100 / (300 + 100)); // 1.25V
                    break;
                case 2:
                    // 100 + 200 = 300 ohm to GND
                    voltage = 5.0 * (300 / (300 + 300)); // 2.50V
                    break;
                case 1:
                    // 100 + 200 + 600 = 900 ohm to GND
                    voltage = 5.0 * (900 / (300 + 900)); // 3.75V
                    break;
                case null:
                default:
                    voltage = 5.0;
                    break;
            }

            adc.channelValues[channel] = voltage;
        }
    }

    getState(): AdKeyboardState {
        return {
            pressedKey: this.pressedKey
        };
    }

    public setPressedKey(key: 1 | 2 | 3 | 4 | null) {
        this.pressedKey = key;
    }
}
