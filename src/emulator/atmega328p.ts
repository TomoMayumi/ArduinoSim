import {
  CPU,
  avrInstruction,
  AVRTimer,
  AVRUSART,
  AVRIOPort,
  AVRADC,
  portBConfig,
  portCConfig,
  portDConfig,
  adcConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
} from 'avr8js';

export interface EmulatorConfig {
  program: Uint16Array;
}

import { HardwareManager } from './hardware/HardwareManager';

export class Atmega328P {
  public cpu: CPU;
  public timer0: AVRTimer;
  public timer1: AVRTimer;
  public timer2: AVRTimer;
  public uart: AVRUSART;
  public adc: AVRADC;
  public portB: AVRIOPort;
  public portC: AVRIOPort;
  public portD: AVRIOPort;
  public hardware: HardwareManager;


  constructor(program: Uint16Array) {
    // ATmega328P has 2048 bytes of SRAM. Using 8192 just in case some code overruns.
    this.cpu = new CPU(program, 8192);

    // Stack Pointer (SP) should be initialized to the end of RAM (0x08ff)
    this.cpu.SP = 0x08ff;
    // Also set SPH/SPL registers explicitly to be sure avr8js registers it.
    this.cpu.data[0x5d] = 0xff; // SPL
    this.cpu.data[0x5e] = 0x08; // SPH

    this.timer0 = new AVRTimer(this.cpu, timer0Config);
    this.timer1 = new AVRTimer(this.cpu, timer1Config);
    this.timer2 = new AVRTimer(this.cpu, timer2Config);
    this.uart = new AVRUSART(this.cpu, usart0Config, 16000000); // 16MHz
    this.adc = new AVRADC(this.cpu, adcConfig);
    (this.cpu as any).adc = this.adc;
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);

    this.hardware = new HardwareManager(this.cpu);
  }

  public step() {
    for (let i = 0; i < 50000; i++) {
      avrInstruction(this.cpu);
      this.cpu.tick();
      // ダイナミック点灯などを正確にサンプリングするため、512サイクル(約32us)毎に状態を更新
      if ((i & 511) === 0) {
        this.hardware.update();
      }
    }
    this.hardware.update();
  }

  public stepInstruction() {
    avrInstruction(this.cpu);
    this.cpu.tick();
    this.hardware.update();
  }

  public stop() {
    // 停止処理が必要な場合は記述
  }

  public reset() {
    this.cpu.reset();
    this.cpu.SP = 0x08ff;
    this.cpu.data[0x5d] = 0xff; // SPL
    this.cpu.data[0x5e] = 0x08; // SPH
    this.cpu.pc = 0;
  }
}
