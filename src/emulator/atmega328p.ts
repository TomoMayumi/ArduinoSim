import {
  CPU,
  avrInstruction,
  AVRTimer,
  AVRUSART,
  AVRIOPort,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
} from 'avr8js';

export interface EmulatorConfig {
  program: Uint16Array;
}

export class Atmega328P {
  public cpu: CPU;
  public timer0: AVRTimer;
  public timer1: AVRTimer;
  public timer2: AVRTimer;
  public uart: AVRUSART;
  public portB: AVRIOPort;
  public portC: AVRIOPort;
  public portD: AVRIOPort;

  private stopFlag = false;

  constructor(program: Uint16Array) {
    console.log('Atmega328P: Constructor started. Program length:', program.length);
    // ATmega328P has 2048 bytes of SRAM
    this.cpu = new CPU(program, 2048);

    // Stack Pointer (SP) should be initialized to the end of RAM (0x08ff)
    this.cpu.SP = 0x08ff;
    console.log('Atmega328P: CPU and SP initialized. SP:', this.cpu.SP.toString(16));

    this.timer0 = new AVRTimer(this.cpu, timer0Config);
    this.timer1 = new AVRTimer(this.cpu, timer1Config);
    this.timer2 = new AVRTimer(this.cpu, timer2Config);
    this.uart = new AVRUSART(this.cpu, usart0Config, 16000000); // 16MHz
    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    console.log('Atmega328P: Peripherals initialized.');
  }

  private stepCount = 0;
  public step() {
    if (this.stepCount % 60 === 0) {
      console.log('Atmega328P: step() called. PC:', this.cpu.pc, 'Cycles:', this.cpu.cycles);
    }
    this.stepCount++;

    for (let i = 0; i < 50000; i++) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }
  }

  public stop() {
    this.stopFlag = true;
  }

  public reset() {
    this.cpu.pc = 0;
    // メモリのリセットなどは必要に応じて追加
  }
}
