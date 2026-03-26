/**
 * DWARF2 デバッグ情報パーサ
 * ELFファイルの .debug_info, .debug_abbrev, .debug_str セクションから
 * グローバル/static変数の情報を抽出する。
 */

import type { DebugVariable } from './DebugTypes';
import type { ElfRawResult } from './ElfParser';

// DWARF Tag定数
const DW_TAG_compile_unit = 0x11;
const DW_TAG_variable = 0x34;
const DW_TAG_base_type = 0x24;
const DW_TAG_typedef = 0x16;
const DW_TAG_member = 0x0d;
const DW_TAG_constant = 0x27;
const DW_TAG_pointer_type = 0x0f;
const DW_TAG_const_type = 0x26;
const DW_TAG_volatile_type = 0x35;
const DW_TAG_array_type = 0x01;
const DW_TAG_structure_type = 0x13;
const DW_TAG_union_type = 0x17;
const DW_TAG_enumeration_type = 0x04;
const DW_TAG_subprogram = 0x2e;
const DW_TAG_formal_parameter = 0x05;
const DW_TAG_lexical_block = 0x0b;
const DW_TAG_inlined_subroutine = 0x1d;

// DWARF Attribute定数
const DW_AT_location = 0x02;
const DW_AT_byte_size = 0x0b;
const DW_AT_name = 0x03;
const DW_AT_type = 0x49;
const DW_AT_low_pc = 0x11;
const DW_AT_high_pc = 0x12;
const DW_AT_frame_base = 0x40;
const DW_AT_abstract_origin = 0x31;
const DW_AT_specification = 0x47;

// DWARF Form定数
const DW_FORM_addr = 0x01;
const DW_FORM_block2 = 0x03;
const DW_FORM_block4 = 0x04;
const DW_FORM_data2 = 0x05;
const DW_FORM_data4 = 0x06;
const DW_FORM_data8 = 0x07;
const DW_FORM_string = 0x08;
const DW_FORM_block = 0x09;
const DW_FORM_block1 = 0x0a;
const DW_FORM_data1 = 0x0b;
const DW_FORM_flag = 0x0c;
const DW_FORM_sdata = 0x0d;
const DW_FORM_strp = 0x0e;
const DW_FORM_udata = 0x0f;
const DW_FORM_ref_addr = 0x10;
const DW_FORM_ref1 = 0x11;
const DW_FORM_ref2 = 0x12;
const DW_FORM_ref4 = 0x13;
const DW_FORM_ref8 = 0x14;
const DW_FORM_ref_udata = 0x15;
const DW_FORM_indirect = 0x16;
const DW_FORM_sec_offset = 0x17;
const DW_FORM_exprloc = 0x18;

// DWARF Location Expression オペコード
const DW_OP_addr = 0x03;
const DW_OP_reg0 = 0x50;  // DW_OP_reg0 .. DW_OP_reg31
const DW_OP_fbreg = 0x91;

/** 略語テーブルのエントリ */
interface AbbrevEntry {
  tag: number;
  hasChildren: boolean;
  attributes: { name: number; form: number }[];
}

/** DIE（Debug Information Entry）内の属性値 */
interface DieAttribute {
  name: number;
  form: number;
  value: number | string | Uint8Array;
}

/** パース済みDIE */
interface Die {
  offset: number;
  tag: number;
  hasChildren: boolean;
  attributes: Map<number, DieAttribute>;
  children: Die[];
  parent?: Die;
}

/** バイトストリームリーダ */
class ByteReader {
  private view: DataView;
  public offset: number;
  private data: Uint8Array;

  constructor(data: Uint8Array, offset: number = 0) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offset = offset;
  }

  get remaining(): number {
    return this.data.length - this.offset;
  }

  readU8(): number {
    return this.data[this.offset++];
  }

  readU16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readU32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readBytes(count: number): Uint8Array {
    const result = this.data.slice(this.offset, this.offset + count);
    this.offset += count;
    return result;
  }

  /** ULEB128 (Unsigned LEB128) を読む */
  readULEB128(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.data[this.offset++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }

  /** SLEB128 (Signed LEB128) を読む */
  readSLEB128(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.data[this.offset++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    if (shift < 32 && (byte & 0x40)) {
      result |= -(1 << shift);
    }
    return result;
  }

  /** Null終端文字列を読む */
  readCString(): string {
    let end = this.offset;
    while (end < this.data.length && this.data[end] !== 0) end++;
    const str = new TextDecoder('utf-8').decode(this.data.slice(this.offset, end));
    this.offset = end + 1;
    return str;
  }
}

export class DwarfParser {
  private debugInfo: Uint8Array;
  private debugAbbrev: Uint8Array;
  private debugStr: Uint8Array | null;
  private addrSize: number = 4; // AVR: 32bit アドレスポインタ（DWARF内での扱い）

  constructor(elfResult: ElfRawResult) {
    const infoSection = elfResult.sections.get('.debug_info');
    const abbrevSection = elfResult.sections.get('.debug_abbrev');
    const strSection = elfResult.sections.get('.debug_str');
    const locSection = elfResult.sections.get('.debug_loc');

    if (!infoSection || !abbrevSection) {
      throw new Error('DWARFデバッグ情報が見つかりません。-g オプション付きでコンパイルしてください。');
    }

    this.debugInfo = infoSection.data;
    this.debugAbbrev = abbrevSection.data;
    this.debugStr = strSection ? strSection.data : null;
    this.debugLoc = locSection ? locSection.data : null;
  }
  private debugLoc: Uint8Array | null = null;

  /** 変数情報を抽出する */
  public extractVariables(): DebugVariable[] {
    const variables: DebugVariable[] = [];

    // .debug_info をパース
    const reader = new ByteReader(this.debugInfo);

    while (reader.remaining > 0) {
      // Compilation Unit ヘッダ
      const unitHeaderOffset = reader.offset;
      const unitLength = reader.readU32();
      if (unitLength === 0 || unitLength === 0xffffffff) break;
      const cuEndOffset = reader.offset + unitLength;

      const version = reader.readU16();
      if (version !== 2 && version !== 3 && version !== 4) {
        // 未対応バージョンはスキップ
        reader.offset = cuEndOffset;
        continue;
      }

      const abbrevOffset = reader.readU32();
      this.addrSize = reader.readU8();

      // このCUの略語テーブルを読む
      const abbrevTable = this.parseAbbrevTable(abbrevOffset);

      // DIEツリーをパース
      const dies = this.parseDies(reader, cuEndOffset, abbrevTable, unitHeaderOffset);

      // DIEツリーから変数を抽出
      this.extractVariablesFromDies(dies, variables);

      reader.offset = cuEndOffset;
    }

    return variables;
  }

  /** 略語テーブルをパース */
  private parseAbbrevTable(offset: number): Map<number, AbbrevEntry> {
    const table = new Map<number, AbbrevEntry>();
    const reader = new ByteReader(this.debugAbbrev, offset);

    while (true) {
      const code = reader.readULEB128();
      if (code === 0) break;

      const tag = reader.readULEB128();
      const hasChildren = reader.readU8() === 1;
      const attributes: { name: number; form: number }[] = [];

      while (true) {
        const attrName = reader.readULEB128();
        const attrForm = reader.readULEB128();
        if (attrName === 0 && attrForm === 0) break;
        attributes.push({ name: attrName, form: attrForm });
      }

      table.set(code, { tag, hasChildren, attributes });
    }

    return table;
  }

  /** DIEツリーをパース */
  private parseDies(reader: ByteReader, endOffset: number, abbrevTable: Map<number, AbbrevEntry>, unitOffset: number): Die[] {
    const result: Die[] = [];
    const stack: Die[] = [];

    while (reader.offset < endOffset) {
      const dieOffset = reader.offset;
      const abbrevCode = reader.readULEB128();

      if (abbrevCode === 0) {
        // Null DIE: 子リストの終了
        stack.pop();
        continue;
      }

      const abbrev = abbrevTable.get(abbrevCode);
      if (!abbrev) {
        // 不明な略語コード。残りをスキップ
        break;
      }

      const die: Die = {
        offset: dieOffset,
        tag: abbrev.tag,
        hasChildren: abbrev.hasChildren,
        attributes: new Map(),
        children: [],
      };

      // 属性値を読む
      for (const attrSpec of abbrev.attributes) {
        const value = this.readAttributeValue(reader, attrSpec.form, unitOffset);
        die.attributes.set(attrSpec.name, {
          name: attrSpec.name,
          form: attrSpec.form,
          value
        });
      }

      // ツリー構造を構築
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children.push(die);
        die.parent = parent;
      } else {
        result.push(die);
      }

      if (abbrev.hasChildren) {
        stack.push(die);
      }
    }

    return result;
  }

  /** 属性値を読む */
  private readAttributeValue(reader: ByteReader, form: number, unitOffset: number): number | string | Uint8Array {
    switch (form) {
      case DW_FORM_addr:
        // AVRのDWARFではアドレスは通常4バイト
        if (this.addrSize === 2) return reader.readU16();
        return reader.readU32();
      case DW_FORM_data1:
      case DW_FORM_flag:
        return reader.readU8();
      case DW_FORM_ref1:
        return unitOffset + reader.readU8();
      case DW_FORM_data2:
        return reader.readU16();
      case DW_FORM_ref2:
        return unitOffset + reader.readU16();
      case DW_FORM_data4:
      case DW_FORM_sec_offset:
        return reader.readU32();
      case DW_FORM_ref4:
        return unitOffset + reader.readU32();
      case DW_FORM_exprloc: {
        const len = reader.readULEB128();
        return reader.readBytes(len);
      }
      case DW_FORM_data8:
      case DW_FORM_ref8:
        // 8バイト値は上位4バイトを捨てる（AVRでは使わない）
        const low = reader.readU32();
        reader.readU32();
        return low;
      case DW_FORM_sdata:
        return reader.readSLEB128();
      case DW_FORM_udata:
        return reader.readULEB128();
      case DW_FORM_ref_udata:
        return unitOffset + reader.readULEB128();
      case DW_FORM_string:
        return reader.readCString();
      case DW_FORM_strp: {
        const strOffset = reader.readU32();
        if (this.debugStr) {
          return this.readCStringAt(this.debugStr, strOffset);
        }
        return `<str@${strOffset}>`;
      }
      case DW_FORM_block1: {
        const len = reader.readU8();
        return reader.readBytes(len);
      }
      case DW_FORM_block2: {
        const len = reader.readU16();
        return reader.readBytes(len);
      }
      case DW_FORM_block4: {
        const len = reader.readU32();
        return reader.readBytes(len);
      }
      case DW_FORM_block: {
        const len = reader.readULEB128();
        return reader.readBytes(len);
      }
      case DW_FORM_ref_addr:
        return reader.readU32();
      case DW_FORM_indirect: {
        const actualForm = reader.readULEB128();
        return this.readAttributeValue(reader, actualForm, unitOffset);
      }
      default:
        // 未対応フォームはスキップ不能。ベストエフォートで0を返す
        console.warn(`未対応のDWARF form: 0x${form.toString(16)}`);
        return 0;
    }
  }

  private extractVariablesFromDies(dies: Die[], variables: DebugVariable[]): void {
    for (const die of dies) {
      if (die.tag === DW_TAG_compile_unit) {
        const cuBase = this.getNumAttr(die, DW_AT_low_pc) || 0;
        // CU直下の変数（グローバル変数）を探す
        this.collectVariables(die.children, variables, dies, undefined, undefined, undefined, cuBase);
      }
    }
  }

  private collectVariables(dies: Die[], variables: DebugVariable[], allDies: Die[], scopeFunction?: string, currentScope?: { start: number; end: number }, currentFrameBase?: Uint8Array, cuBase?: number): void {
    for (const die of dies) {
      if (die.tag === DW_TAG_variable || die.tag === DW_TAG_formal_parameter || die.tag === DW_TAG_constant) {
        const variable = this.dieToVariable(die, allDies, scopeFunction, currentScope, currentFrameBase, cuBase);
        if (variable) {
          variables.push(variable);
        }
      } else if (die.tag === DW_TAG_subprogram || die.tag === DW_TAG_lexical_block || die.tag === DW_TAG_inlined_subroutine) {
        const name = this.getInheritedStringAttr(die, DW_AT_name, allDies);
        const lowPc = this.getNumAttr(die, DW_AT_low_pc);
        let highPc = this.getNumAttr(die, DW_AT_high_pc);

        let newFrameBase = currentFrameBase;
        if (die.tag === DW_TAG_subprogram) {
          const fbAttr = die.attributes.get(DW_AT_frame_base);
          if (fbAttr && fbAttr.value instanceof Uint8Array) {
            newFrameBase = fbAttr.value;
          }
        }
        
        let newScope = currentScope;
        if (lowPc !== undefined && highPc !== undefined) {
          const absoluteHighPc = (highPc < lowPc) ? (lowPc + highPc) : highPc;
          newScope = { start: lowPc, end: absoluteHighPc };
        }

        const funcName = (die.tag === DW_TAG_subprogram || die.tag === DW_TAG_inlined_subroutine) ? name : scopeFunction;
        if (die.children.length > 0) {
          this.collectVariables(die.children, variables, allDies, funcName, newScope, newFrameBase, cuBase);
        }
      }
    }
  }

  /** DIEから変数情報を構築 */
  private dieToVariable(die: Die, allDies: Die[], scopeFunction?: string, scope?: { start: number; end: number }, frameBase?: Uint8Array, cuBase?: number): DebugVariable | null {
    const name = this.getInheritedStringAttr(die, DW_AT_name, allDies);
    if (!name) return null;

    // ロケーション情報を取得
    const locationAttr = this.getInheritedAttr(die, DW_AT_location, allDies);
    if (!locationAttr) return null;

    const locValue = locationAttr.value;
    
    // 静的アドレスか、動的ロケーション式かを判定
    let address: number | undefined = undefined;
    let location: Uint8Array | undefined = undefined;
    let isLocationList: boolean = false;

    if (typeof locValue === 'number' && locationAttr.form !== DW_FORM_addr) {
      // 数値だが DW_FORM_addr でない場合、.debug_loc へのオフセット（Location List）
      if (this.debugLoc) {
        location = this.extractLocList(locValue);
        isLocationList = true;
      }
    } else if (typeof locValue === 'number') {
      address = locValue;
    } else if (locValue instanceof Uint8Array) {
      if (locValue.length > 0 && locValue[0] === DW_OP_addr) {
        const addr = this.evaluateLocation(locValue);
        address = addr === null ? undefined : addr;
      } else {
        location = locValue;
      }
    }

    if (address === undefined && location === undefined) return null;

    if (address !== undefined && address >= 0x800000) {
      address -= 0x800000;
    }

    const typeInfo = this.resolveType(die, allDies);

    return {
      name,
      typeName: typeInfo.name,
      address,
      location,
      isLocationList,
      baseAddress: cuBase,
      frameBase,
      size: typeInfo.size,
      function: scopeFunction,
      scope,
    };
  }

  /** .debug_loc からロケーションリストを抽出 */
  private extractLocList(offset: number): Uint8Array {
    if (!this.debugLoc || offset >= this.debugLoc.length) return new Uint8Array(0);
    // Location List は 2つのアドレスペアで始まる。終端は [0, 0]
    // ここでは evaluator に渡すためにそのままコピー
    // ※実際には現在の CU のベースアドレスが必要だが、AVR では通常 0
    let end = offset;
    const view = new DataView(this.debugLoc.buffer, this.debugLoc.byteOffset, this.debugLoc.byteLength);
    while (end + 4 <= this.debugLoc.length) {
      const s = view.getUint32(end, true);
      const e = view.getUint32(end + 4, true);
      if (s === 0 && e === 0) {
        end += 8;
        break;
      }
      end += 8;
      const len = view.getUint16(end, true);
      end += 2 + len;
    }
    return this.debugLoc.slice(offset, end);
  }

  /** 属性を継承（abstract_origin / specification）を考慮して取得 */
  private getInheritedAttr(die: Die, attr: number, allDies: Die[]): { name: number, form: number, value: any } | undefined {
    const a = die.attributes.get(attr);
    if (a) return a;

    const origin = die.attributes.get(DW_AT_abstract_origin) || die.attributes.get(DW_AT_specification);
    if (origin && typeof origin.value === 'number') {
      const targetDie = this.findDieByOffset(allDies, origin.value);
      if (targetDie && targetDie !== die) {
        return this.getInheritedAttr(targetDie, attr, allDies);
      }
    }
    return undefined;
  }

  private getInheritedStringAttr(die: Die, attr: number, allDies: Die[]): string | undefined {
    const a = this.getInheritedAttr(die, attr, allDies);
    if (a && typeof a.value === 'string') return a.value;
    return undefined;
  }

  /** ロケーション式を評価してアドレスを返す */
  private evaluateLocation(value: number | string | Uint8Array): number | null {
    if (typeof value === 'number') {
      // DW_FORM_addr 等で直接アドレスが入っている場合
      return value;
    }
    if (value instanceof Uint8Array) {
      // ロケーションブロック
      if (value.length === 0) return null;
      const op = value[0];

      if (op === DW_OP_addr) {
        // DW_OP_addr: 固定アドレス（グローバル/static変数）
        if (value.length >= 5) {
          // 4バイトアドレス（リトルエンディアン）
          return value[1] | (value[2] << 8) | (value[3] << 16) | (value[4] << 24);
        } else if (value.length >= 3) {
          // 2バイトアドレス
          return value[1] | (value[2] << 8);
        }
      }

      // DW_OP_reg* (レジスタ変数) — 今はスキップ
      if (op >= DW_OP_reg0 && op <= DW_OP_reg0 + 31) {
        return null; // レジスタ変数は初期版では非対応
      }

      // DW_OP_fbreg (スタック変数) — 今はスキップ
      if (op === DW_OP_fbreg) {
        return null; // スタックフレームベースはローカル変数用、初期版では非対応
      }

      // その他の複雑なロケーション式はスキップ
      return null;
    }
    return null;
  }

  /** 型を再帰的に解決 */
  private resolveType(die: Die, allDies: Die[]): { name: string; size: number } {
    const typeRef = this.getInheritedAttr(die, DW_AT_type, allDies);
    if (!typeRef || typeof typeRef.value !== 'number') {
      return { name: 'unknown', size: 1 };
    }

    // DW_FORM_ref* はCU内のオフセット。DIEツリーからoffsetで検索
    const typeDie = this.findDieByOffset(allDies, typeRef.value);
    if (!typeDie) {
      return { name: 'unknown', size: 1 };
    }

    return this.getTypeInfo(typeDie, allDies);
  }

  /** 型DIEから名前とサイズを取得 */
  private getTypeInfo(typeDie: Die, allDies: Die[]): { name: string; size: number } {
    switch (typeDie.tag) {
      case DW_TAG_base_type: {
        const name = this.getStringAttr(typeDie, DW_AT_name) || 'unknown';
        const size = this.getNumAttr(typeDie, DW_AT_byte_size) || 1;
        return { name, size };
      }
      case DW_TAG_typedef: {
        const name = this.getStringAttr(typeDie, DW_AT_name) || 'unknown';
        const underlying = this.resolveTypeFromDie(typeDie, allDies);
        return { name, size: underlying.size };
      }
      case DW_TAG_pointer_type: {
        const size = this.getNumAttr(typeDie, DW_AT_byte_size) || 2; // AVR: 2バイトポインタ
        return { name: 'pointer', size };
      }
      case DW_TAG_const_type:
      case DW_TAG_volatile_type: {
        return this.resolveTypeFromDie(typeDie, allDies);
      }
      case DW_TAG_structure_type: {
        const name = this.getStringAttr(typeDie, DW_AT_name) || 'struct';
        const size = this.getNumAttr(typeDie, DW_AT_byte_size) || 1;
        return { name: `struct ${name}`, size };
      }
      case DW_TAG_union_type: {
        const name = this.getStringAttr(typeDie, DW_AT_name) || 'union';
        const size = this.getNumAttr(typeDie, DW_AT_byte_size) || 1;
        return { name: `union ${name}`, size };
      }
      case DW_TAG_enumeration_type: {
        const name = this.getStringAttr(typeDie, DW_AT_name) || 'enum';
        const size = this.getNumAttr(typeDie, DW_AT_byte_size) || 1;
        return { name, size };
      }
      case DW_TAG_array_type: {
        const elemType = this.resolveTypeFromDie(typeDie, allDies);
        return { name: `${elemType.name}[]`, size: elemType.size };
      }
      default:
        return { name: 'unknown', size: 1 };
    }
  }

  /** 型DIEのDW_AT_typeを辿って型情報を取得 */
  private resolveTypeFromDie(die: Die, allDies: Die[]): { name: string; size: number } {
    const typeRef = this.getInheritedAttr(die, DW_AT_type, allDies);
    if (!typeRef || typeof typeRef.value !== 'number') {
      return { name: 'void', size: 0 };
    }
    const typeDie = this.findDieByOffset(allDies, typeRef.value);
    if (!typeDie) return { name: 'unknown', size: 1 };
    return this.getTypeInfo(typeDie, allDies);
  }

  /** オフセットでDIEを検索（再帰） */
  private findDieByOffset(dies: Die[], offset: number): Die | null {
    for (const die of dies) {
      if (die.offset === offset) return die;
      if (die.children.length > 0) {
        const found = this.findDieByOffset(die.children, offset);
        if (found) return found;
      }
    }
    return null;
  }

  /** 文字列属性を取得 */
  private getStringAttr(die: Die, attr: number): string | undefined {
    const a = die.attributes.get(attr);
    if (!a) return undefined;
    if (typeof a.value === 'string') return a.value;
    return undefined;
  }

  /** 数値属性を取得 */
  private getNumAttr(die: Die, attr: number): number | undefined {
    const a = die.attributes.get(attr);
    if (!a) return undefined;
    if (typeof a.value === 'number') return a.value;
    return undefined;
  }

  /** 指定位置からNull終端文字列を読む */
  private readCStringAt(data: Uint8Array, offset: number): string {
    let end = offset;
    while (end < data.length && data[end] !== 0) end++;
    return new TextDecoder('utf-8').decode(data.slice(offset, end));
  }
}
