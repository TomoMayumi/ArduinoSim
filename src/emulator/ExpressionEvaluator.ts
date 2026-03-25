/**
 * 式評価エンジン
 * ウォッチ式・条件付きブレークポイントの式を評価する。
 *
 * 対応する式の例:
 *   r16                    → レジスタR16の値
 *   PORTB                  → SFRの値
 *   counter                → C変数の値（DWARFから解決）
 *   [0x100]                → SRAMアドレス0x100の値
 *   counter == 10          → 比較
 *   r16 & 0x0F             → ビット演算
 *   counter + 1            → 算術演算
 */

import type { CPU } from 'avr8js';
import type { DebugVariable } from './DebugTypes';

// トークンの種類
type TokenType =
  | 'number'
  | 'identifier'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
  numValue?: number;
}

// 演算子の優先度（低い数値 = 低い優先度）
const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6, '!=': 6,
  '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
};

// レジスタ名→データアドレスのマッピング
const REGISTER_MAP: Record<string, { addr: number; size: number; special?: string }> = {};

// r0〜r31 → アドレス0〜31
for (let i = 0; i <= 31; i++) {
  REGISTER_MAP[`r${i}`] = { addr: i, size: 1 };
}

// 特殊レジスタ
REGISTER_MAP['pc'] = { addr: 0, size: 2, special: 'pc' };
REGISTER_MAP['sp'] = { addr: 0, size: 2, special: 'sp' };
REGISTER_MAP['sreg'] = { addr: 0x5f, size: 1 };
REGISTER_MAP['x'] = { addr: 0, size: 2, special: 'x' };
REGISTER_MAP['y'] = { addr: 0, size: 2, special: 'y' };
REGISTER_MAP['z'] = { addr: 0, size: 2, special: 'z' };

// I/O レジスタ名（よく使うもの）
const SFR_MAP: Record<string, number> = {
  // PORT
  'portb': 0x25, 'ddrb': 0x24, 'pinb': 0x23,
  'portc': 0x28, 'ddrc': 0x27, 'pinc': 0x26,
  'portd': 0x2b, 'ddrd': 0x2a, 'pind': 0x29,
  // Timer0
  'tcnt0': 0x46, 'ocr0a': 0x47, 'ocr0b': 0x48,
  'tccr0a': 0x44, 'tccr0b': 0x45,
  // Timer1
  'tcnt1l': 0x84, 'tcnt1h': 0x85,
  'ocr1al': 0x88, 'ocr1ah': 0x89,
  'ocr1bl': 0x8a, 'ocr1bh': 0x8b,
  'tccr1a': 0x80, 'tccr1b': 0x81,
  // Timer2
  'tcnt2': 0xb2, 'ocr2a': 0xb3, 'ocr2b': 0xb4,
  'tccr2a': 0xb0, 'tccr2b': 0xb1,
  // USART
  'udr0': 0xc6, 'ubrr0l': 0xc4, 'ubrr0h': 0xc5,
  'ucsr0a': 0xc0, 'ucsr0b': 0xc1, 'ucsr0c': 0xc2,
  // ADC
  'adcl': 0x78, 'adch': 0x79,
  'admux': 0x7c, 'adcsra': 0x7a, 'adcsrb': 0x7b,
  // その他
  'eimsk': 0x3d, 'eifr': 0x3c,
  'timsk0': 0x6e, 'timsk1': 0x6f, 'timsk2': 0x70,
  'tifr0': 0x35, 'tifr1': 0x36, 'tifr2': 0x37,
};

export class ExpressionEvaluator {
  private variables: DebugVariable[];

  constructor(variables: DebugVariable[] = []) {
    this.variables = variables;
  }

  /** 変数リストを更新 */
  public setVariables(variables: DebugVariable[]): void {
    this.variables = variables;
  }

  /** 式を評価して数値を返す */
  public evaluate(expression: string, cpu: CPU): number {
    const tokens = this.tokenize(expression);
    const result = this.parseExpression(tokens, cpu, 0);
    return result.value;
  }

  /** 条件式を評価してブール値を返す */
  public evaluateCondition(expression: string, cpu: CPU): boolean {
    try {
      const value = this.evaluate(expression, cpu);
      return value !== 0;
    } catch {
      return true; // エラー時は停止させる（安全側）
    }
  }

  /** 式を評価し、エラー時はエラーメッセージを返す */
  public tryEvaluate(expression: string, cpu: CPU): { value: number | null; error?: string } {
    try {
      const value = this.evaluate(expression, cpu);
      return { value };
    } catch (e: any) {
      return { value: null, error: e.message || '評価エラー' };
    }
  }

  /** トークナイズ */
  private tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const s = expr.trim();

    while (i < s.length) {
      // 空白スキップ
      if (s[i] === ' ' || s[i] === '\t') {
        i++;
        continue;
      }

      // 数値リテラル
      if (s[i] >= '0' && s[i] <= '9') {
        let numStr = '';
        if (s[i] === '0' && i + 1 < s.length && (s[i + 1] === 'x' || s[i + 1] === 'X')) {
          // 16進
          numStr = '0x';
          i += 2;
          while (i < s.length && /[0-9a-fA-F]/.test(s[i])) {
            numStr += s[i++];
          }
        } else if (s[i] === '0' && i + 1 < s.length && (s[i + 1] === 'b' || s[i + 1] === 'B')) {
          // 2進
          numStr = '0b';
          i += 2;
          while (i < s.length && (s[i] === '0' || s[i] === '1')) {
            numStr += s[i++];
          }
        } else {
          // 10進
          while (i < s.length && s[i] >= '0' && s[i] <= '9') {
            numStr += s[i++];
          }
        }
        const val = numStr.startsWith('0x') ? parseInt(numStr, 16)
          : numStr.startsWith('0b') ? parseInt(numStr.substring(2), 2)
            : parseInt(numStr, 10);
        tokens.push({ type: 'number', value: numStr, numValue: val });
        continue;
      }

      // 識別子（変数名、レジスタ名）
      if (/[a-zA-Z_]/.test(s[i])) {
        let ident = '';
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
          ident += s[i++];
        }
        tokens.push({ type: 'identifier', value: ident });
        continue;
      }

      // 2文字演算子
      if (i + 1 < s.length) {
        const two = s[i] + s[i + 1];
        if (['==', '!=', '<=', '>=', '&&', '||', '<<', '>>'].includes(two)) {
          tokens.push({ type: 'operator', value: two });
          i += 2;
          continue;
        }
      }

      // 1文字演算子・括弧
      if ('+-*/%&|^<>~!'.includes(s[i])) {
        tokens.push({ type: 'operator', value: s[i] });
        i++;
        continue;
      }

      if (s[i] === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
      if (s[i] === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
      if (s[i] === '[') { tokens.push({ type: 'lbracket', value: '[' }); i++; continue; }
      if (s[i] === ']') { tokens.push({ type: 'rbracket', value: ']' }); i++; continue; }

      throw new Error(`不正な文字: '${s[i]}'`);
    }

    tokens.push({ type: 'eof', value: '' });
    return tokens;
  }

  /** 式を再帰下降法でパース・評価 */
  private parseExpression(tokens: Token[], cpu: CPU, minPrec: number): { value: number; pos: number } {
    let left = this.parsePrimary(tokens, cpu);

    while (true) {
      const token = tokens[left.pos];
      if (!token || token.type !== 'operator') break;
      const prec = PRECEDENCE[token.value];
      if (prec === undefined || prec < minPrec) break;

      const op = token.value;
      left.pos++;
      const right = this.parseExpression(tokens, cpu, prec + 1);

      left = {
        value: this.applyOp(op, left.value, right.value),
        pos: right.pos
      };
    }

    return left;
  }

  /** 一次式のパース */
  private parsePrimary(tokens: Token[], cpu: CPU): { value: number; pos: number } {
    // 既にパース済みの位置を見つける
    // 実際には pos は caller が管理すべきだが、簡略化のため tokens を消費する形で実装
    // → 配列の先頭を消費する方式に変更
    const token = tokens[0];

    if (!token || token.type === 'eof') {
      throw new Error('式が不完全です');
    }

    // 数値リテラル
    if (token.type === 'number') {
      tokens.shift();
      return { value: token.numValue!, pos: 0 };
    }

    // 単項演算子
    if (token.type === 'operator') {
      if (token.value === '-') {
        tokens.shift();
        const operand = this.parsePrimary(tokens, cpu);
        return { value: -operand.value, pos: 0 };
      }
      if (token.value === '~') {
        tokens.shift();
        const operand = this.parsePrimary(tokens, cpu);
        return { value: ~operand.value, pos: 0 };
      }
      if (token.value === '!') {
        tokens.shift();
        const operand = this.parsePrimary(tokens, cpu);
        return { value: operand.value === 0 ? 1 : 0, pos: 0 };
      }
    }

    // 括弧
    if (token.type === 'lparen') {
      tokens.shift();
      const result = this.parseExprFromTokens(tokens, cpu, 0);
      const closing = tokens[0];
      if (!closing || closing.type !== 'rparen') {
        throw new Error('閉じ括弧がありません');
      }
      tokens.shift();
      return { value: result, pos: 0 };
    }

    // メモリ参照 [アドレス]
    if (token.type === 'lbracket') {
      tokens.shift();
      const addrResult = this.parseExprFromTokens(tokens, cpu, 0);
      const closing = tokens[0];
      if (!closing || closing.type !== 'rbracket') {
        throw new Error('閉じ括弧 ] がありません');
      }
      tokens.shift();
      const memValue = cpu.data[addrResult] || 0;
      return { value: memValue, pos: 0 };
    }

    // 識別子（レジスタ名、SFR名、変数名）
    if (token.type === 'identifier') {
      tokens.shift();
      const value = this.resolveIdentifier(token.value, cpu);
      return { value, pos: 0 };
    }

    throw new Error(`予期しないトークン: '${token.value}'`);
  }

  /** トークン配列から式をパース（内部用） */
  private parseExprFromTokens(tokens: Token[], cpu: CPU, minPrec: number): number {
    let leftVal = this.parsePrimary(tokens, cpu).value;

    while (true) {
      const token = tokens[0];
      if (!token || token.type !== 'operator') break;
      const prec = PRECEDENCE[token.value];
      if (prec === undefined || prec < minPrec) break;

      const op = token.value;
      tokens.shift();
      const rightVal = this.parseExprFromTokens(tokens, cpu, prec + 1);

      leftVal = this.applyOp(op, leftVal, rightVal);
    }

    return leftVal;
  }

  /** 識別子を解決して値を返す */
  private resolveIdentifier(name: string, cpu: CPU): number {
    const lower = name.toLowerCase();
    // レジスタ
    const reg = REGISTER_MAP[lower];
    if (reg) {
      if (reg.special === 'pc') return cpu.pc;
      if (reg.special === 'sp') return (cpu.data[0x5e] << 8) | cpu.data[0x5d];
      if (reg.special === 'x') return (cpu.data[27] << 8) | cpu.data[26];
      if (reg.special === 'y') return (cpu.data[29] << 8) | cpu.data[28];
      if (reg.special === 'z') return (cpu.data[31] << 8) | cpu.data[30];
      if (reg.size === 1) return cpu.data[reg.addr];
      return (cpu.data[reg.addr + 1] << 8) | cpu.data[reg.addr];
    }

    // SFR
    const sfrAddr = SFR_MAP[lower];
    if (sfrAddr !== undefined) {
      return cpu.data[sfrAddr] || 0;
    }

    // DWARF変数（大文字小文字を区別して検索）
    const debugVar = this.variables.find(v => v.name === name);
    if (debugVar) {
      // サイズに応じてメモリから読み出す
      return this.readMemory(cpu, debugVar.address, debugVar.size);
    }

    throw new Error(`未知の識別子: '${name}'`);
  }

  /** メモリからサイズ分のデータを読む（リトルエンディアン） */
  private readMemory(cpu: CPU, address: number, size: number): number {
    let value = 0;
    for (let i = 0; i < size && i < 4; i++) {
      value |= (cpu.data[address + i] || 0) << (i * 8);
    }
    // 符号なし値として返す
    return value >>> 0;
  }

  /** 二項演算を適用 */
  private applyOp(op: string, left: number, right: number): number {
    switch (op) {
      case '+': return (left + right) | 0;
      case '-': return (left - right) | 0;
      case '*': return (left * right) | 0;
      case '/':
        if (right === 0) throw new Error('ゼロ除算');
        return (left / right) | 0;
      case '%':
        if (right === 0) throw new Error('ゼロ除算');
        return left % right;
      case '&': return left & right;
      case '|': return left | right;
      case '^': return left ^ right;
      case '<<': return left << right;
      case '>>': return left >> right;
      case '==': return left === right ? 1 : 0;
      case '!=': return left !== right ? 1 : 0;
      case '<': return left < right ? 1 : 0;
      case '>': return left > right ? 1 : 0;
      case '<=': return left <= right ? 1 : 0;
      case '>=': return left >= right ? 1 : 0;
      case '&&': return (left !== 0 && right !== 0) ? 1 : 0;
      case '||': return (left !== 0 || right !== 0) ? 1 : 0;
      default: throw new Error(`未対応の演算子: '${op}'`);
    }
  }
}
