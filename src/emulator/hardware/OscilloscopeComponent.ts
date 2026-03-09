import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState } from '../PinMappings';

export interface PinSample {
    cycle: number;
    value: boolean;
}

export interface OscilloscopeChannelState {
    pin: string;
    samples: PinSample[];
}

export interface OscilloscopeState extends ComponentState {
    channels: OscilloscopeChannelState[];
    currentCycle: number;
}

export class OscilloscopeComponent implements Component {
    readonly type = 'OSCILLOSCOPE';
    readonly id: string;
    readonly name: string;
    readonly updateInterval = 1; // 毎サイクル監視

    private channels: { pin: string; samples: PinSample[]; lastValue: boolean | null }[] = [];
    private maxSamples = 2000; // チャンネルあたりの最大サンプル数（エッジの変化点のみ記録）
    private bufferSizeCycles = 1600000; // 100ms分 (16MHz想定)

    constructor(id: string, name: string, pins: string[]) {
        this.id = id;
        this.name = name;
        this.channels = pins.map(pin => ({
            pin,
            samples: [],
            lastValue: null
        }));
    }

    update(cpu: CPU): void {
        const currentCycle = cpu.cycles;

        for (const channel of this.channels) {
            const value = getPinState(cpu, channel.pin);
            
            // 初回または値が変化した場合のみ記録
            if (channel.lastValue === null || value !== channel.lastValue) {
                channel.samples.push({ cycle: currentCycle, value });
                channel.lastValue = value;

                // 古いサンプルを捨てる (時間ベース)
                const minCycle = currentCycle - this.bufferSizeCycles;
                while (channel.samples.length > 0 && channel.samples[0].cycle < minCycle) {
                    channel.samples.shift();
                }

                // 数制限 (念のため)
                if (channel.samples.length > this.maxSamples) {
                    channel.samples.shift();
                }
            }
        }
    }

    getState(): OscilloscopeState {
        return {
            channels: this.channels.map(ch => ({
                pin: ch.pin,
                samples: [...ch.samples] // コピーを返す
            })),
            currentCycle: 0 // HardwareManagerでセットされる可能性もあるが、ここでは0かダミー
        };
    }

    // ピンの変更（UIから呼び出し可能にするための準備）
    setChannelPin(index: number, pin: string) {
        if (this.channels[index]) {
            this.channels[index].pin = pin;
            this.channels[index].samples = [];
            this.channels[index].lastValue = null;
        }
    }
}
