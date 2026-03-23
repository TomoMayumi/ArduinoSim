import { CPU } from 'avr8js';
import type { Component, ComponentState } from './Component';
import { getPinState } from '../PinMappings';

export interface PinSample {
    cycle: number;
    value: number;
}

export interface OscilloscopeChannelState {
    pin: string;
    mode: 'digital' | 'analog';
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

    private channels: { pin: string; mode: 'digital' | 'analog'; isAnalogPin: boolean; adcChannel: number; samples: PinSample[]; lastValue: number | null }[] = [];
    private maxSamples = 10000; // チャンネルあたりの最大サンプル数
    private bufferSizeCycles = 32000000; // 2秒分 (16MHz想定) に増強

    constructor(id: string, name: string, pins: string[]) {
        this.id = id;
        this.name = name;
        this.channels = pins.map(pin => ({
            pin,
            mode: 'digital',
            isAnalogPin: pin.startsWith('A'),
            adcChannel: pin.startsWith('A') ? parseInt(pin.substring(1)) : -1,
            samples: [],
            lastValue: null
        }));
    }

    update(cpu: CPU): void {
        const currentCycle = cpu.cycles;
        this.lastUpdateCycle = currentCycle;

        for (const channel of this.channels) {
            if (channel.pin === 'None') {
                if (channel.samples.length > 0) {
                    channel.samples = [];
                    channel.lastValue = null;
                }
                continue;
            }

            let value = 0.0;
            if (channel.mode === 'analog' && channel.isAnalogPin) {
                const adc = (cpu as any).adc;
                if (adc) {
                    value = adc.channelValues[channel.adcChannel] || 0.0;
                }
            } else {
                value = getPinState(cpu, channel.pin) ? 5.0 : 0.0;
            }
            
            // 初回または値が変化した場合のみ記録
            // 比較は strict に行って浮動小数点のわずかな変動でも記録する
            if (channel.lastValue === null || value !== channel.lastValue) {
                channel.samples.push({ cycle: currentCycle, value });
                channel.lastValue = value;

                // 古いサンプルを捨てる (時間ベース)
                const minCycle = currentCycle - this.bufferSizeCycles;
                while (channel.samples.length > 0 && channel.samples[0].cycle < minCycle) {
                    channel.samples.shift();
                }

                // 数制限
                if (channel.samples.length > this.maxSamples) {
                    channel.samples.shift();
                }
            }
        }
    }

    getState(): OscilloscopeState {
        // updateの中で保持していた最新サイクルを使用する
        return {
            channels: this.channels.map(ch => ({
                pin: ch.pin,
                mode: ch.mode,
                samples: [...ch.samples]
            })),
            currentCycle: this.lastUpdateCycle
        };
    }

    private lastUpdateCycle = 0;

    // ピンの変更（UIから呼び出し可能にするための準備）
    setChannelPin(index: number, pin: string) {
        if (this.channels[index]) {
            this.channels[index].pin = pin;
            this.channels[index].isAnalogPin = pin.startsWith('A');
            this.channels[index].adcChannel = pin.startsWith('A') ? parseInt(pin.substring(1)) : -1;
            this.channels[index].samples = [];
            this.channels[index].lastValue = null;
        }
    }

    setChannelMode(index: number, mode: 'digital' | 'analog') {
        if (this.channels[index]) {
            this.channels[index].mode = mode;
            this.channels[index].samples = [];
            this.channels[index].lastValue = null;
        }
    }
}
