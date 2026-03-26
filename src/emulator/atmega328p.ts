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
  public breakReason: string | null = null;


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

    // Patch for PWM Inverting Mode with OCR=0 (Fast PWM)
    // In avr8js, Inverting Mode + OCR=0 results in constant LOW (0% duty).
    // However, according to ATmega328P datasheet, it should be constant HIGH (100% duty).
    // We patch updateCompPin to fix this behavior.
    const patchTimer = (timer: AVRTimer) => {
      const originalUpdateCompPin = (timer as any).updateCompPin.bind(timer);
      (timer as any).updateCompPin = (compValue: number, pinName: string, bottom: boolean = false) => {
        if ((timer as any).timerMode === 3 /* FastPWM */ && compValue === 3 /* Inverting */) {
          const ocr = pinName === 'A' ? (timer as any).ocrA : pinName === 'B' ? (timer as any).ocrB : (timer as any).ocrC;
          const nextOcr = pinName === 'A' ? (timer as any).nextOcrA : pinName === 'B' ? (timer as any).nextOcrB : (timer as any).nextOcrC;
          // When 'bottom' (overflow) occurs, 'nextOcr' will be the value for the next period.
          const isOcrZero = bottom ? nextOcr === 0 : ocr === 0;

          if (isOcrZero) {
            // Force HIGH when OCR is 0 in inverting mode to match datasheet behavior (100% duty)
            if (pinName === 'A') (timer as any).updateCompA(2 /* Set (HIGH) in avr8js */);
            else if (pinName === 'B') (timer as any).updateCompB(2 /* Set (HIGH) in avr8js */);
            else (timer as any).updateCompC(2 /* Set (HIGH) in avr8js */);
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

      // PC (Program Counter) はワード単位。バイト単位のアドレスに変換してチェック。
      const addr = this.cpu.pc * 2;
      const bp = breakpoints.get(addr);
      if (bp && bp.enabled) {
        // 条件式がなければ無条件停止、あれば条件が真の場合のみ停止
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

      // 内部で updateInterval に基づき最適化されるため、毎サイクル呼び出して良い
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
    this.cpu.SP = 0x08ff;
    this.cpu.data[0x5d] = 0xff; // SPL
    this.cpu.data[0x5e] = 0x08; // SPH
    this.cpu.pc = 0;
  }
}
