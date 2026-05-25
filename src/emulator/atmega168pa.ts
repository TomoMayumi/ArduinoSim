import type { BreakpointInfo } from './DebugTypes';
import type { ExpressionEvaluator } from './ExpressionEvaluator';
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

import type { Emulator } from './Emulator';
import { HardwareManager } from './hardware/HardwareManager';

export class Atmega168PA implements Emulator {
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
  public breakReason: string | null = null;

  constructor(program: Uint16Array) {
    // ATmega168PA has 1024 bytes of SRAM. Using 4096 just in case some code overruns.
    this.cpu = new CPU(program, 4096);

    // Stack Pointer (SP) should be initialized to the end of RAM (0x04ff)
    this.cpu.SP = 0x04ff;
    // Also set SPH/SPL registers explicitly to be sure avr8js registers it.
    this.cpu.data[0x5d] = 0xff; // SPL
    this.cpu.data[0x5e] = 0x04; // SPH

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

    // Patch for PWM Inverting Mode with OCR=0 (Fast PWM)
    // Same behavior fix as ATmega328P.
    const patchTimer = (timer: AVRTimer) => {
      const originalUpdateCompPin = (timer as any).updateCompPin.bind(timer);
      (timer as any).updateCompPin = (compValue: number, pinName: string, bottom: boolean = false) => {
        if ((timer as any).timerMode === 3 /* FastPWM */ && compValue === 3 /* Inverting */) {
          const ocr = pinName === 'A' ? (timer as any).ocrA : pinName === 'B' ? (timer as any).ocrB : (timer as any).ocrC;
          const nextOcr = pinName === 'A' ? (timer as any).nextOcrA : pinName === 'B' ? (timer as any).nextOcrB : (timer as any).nextOcrC;
          const isOcrZero = bottom ? nextOcr === 0 : ocr === 0;

          if (isOcrZero) {
            if (pinName === 'A') (timer as any).updateCompA(2);
            else if (pinName === 'B') (timer as any).updateCompB(2);
            else (timer as any).updateCompC(2);
            return;
          }
        }
        originalUpdateCompPin(compValue, pinName, bottom);
      };
    };

    patchTimer(this.timer0);
    patchTimer(this.timer1);
    patchTimer(this.timer2);
  }

  public step(breakpoints: Map<number, BreakpointInfo> = new Map(), evaluator?: ExpressionEvaluator): number | null {
    for (let i = 0; i < 50000; i++) {
      avrInstruction(this.cpu);
      this.cpu.tick();

      const addr = this.cpu.pc * 2;
      const bp = breakpoints.get(addr);
      if (bp && bp.enabled) {
        if (!bp.condition || !evaluator) {
          this.hardware.update();
          return addr;
        }

        const result = evaluator.tryEvaluate(bp.condition, this.cpu, this.cpu.pc);
        if (result.error) {
          this.breakReason = `条件エラー (アドレス 0x${addr.toString(16)}): ${result.error}`;
          this.hardware.update();
          return addr;
        } else if (result.value !== 0) {
          this.breakReason = null;
          this.hardware.update();
          return addr;
        }
      }

      this.hardware.update();
    }
    this.hardware.update();
    return null;
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
    this.cpu.SP = 0x04ff;
    this.cpu.data[0x5d] = 0xff; // SPL
    this.cpu.data[0x5e] = 0x04; // SPH
    this.cpu.pc = 0;
  }
}
