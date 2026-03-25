/**
 * デバッグ機能の共通型定義
 */

/** ブレークポイント情報 */
export interface BreakpointInfo {
  /** 有効/無効 */
  enabled: boolean;
  /** 条件式（空文字列 or undefinedなら無条件） */
  condition?: string;
}

/** ウォッチ式 */
export interface WatchExpression {
  id: string;
  expression: string;
  format: 'hex' | 'dec' | 'bin';
}

/** ウォッチ結果 */
export interface WatchResult {
  id: string;
  expression: string;
  value: number | null;
  error?: string;
  format: 'hex' | 'dec' | 'bin';
}

/** DWARFから抽出した変数情報 */
export interface DebugVariable {
  /** 変数名 */
  name: string;
  /** 型名（例: "int", "uint8_t", "char"） */
  typeName: string;
  /** SRAMアドレス（グローバル/static変数の場合） */
  address: number;
  /** バイトサイズ */
  size: number;
  /** 定義元ファイル名 */
  file?: string;
  /** 所属関数名（グローバルの場合はundefined） */
  function?: string;
}

/** ELFパース結果 */
export interface ElfParseResult {
  /** プログラムデータ（Uint16Array、HEX相当） */
  program: Uint16Array;
  /** デバッグ変数一覧 */
  variables: DebugVariable[];
}
