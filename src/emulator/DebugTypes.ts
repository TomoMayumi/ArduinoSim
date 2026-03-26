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
  /** SRAMアドレス（グローバル/static変数の場合。オプションに変更） */
  address?: number;
  /** DWARFロケーション式（ローカル変数の場合） */
  location?: Uint8Array;
  /** ロケーションリストで使用するベースアドレス（CUのlow_pc） */
  baseAddress?: number;
  /** ロケーション情報が .debug_loc 形式（Location List）かどうか */
  isLocationList?: boolean;
  /** 関数のフレームベース計算式（DW_OP_fbreg 用） */
  frameBase?: Uint8Array;
  /** バイトサイズ */
  size: number;
  /** 定義元ファイル名 */
  file?: string;
  /** 所属関数名（グローバルの場合はundefined） */
  function?: string;
  /** 変数が有効なPC範囲（word address、ローカル変数の場合） */
  scope?: { start: number; end: number };
}

/** ELFパース結果 */
export interface ElfParseResult {
  /** プログラムデータ（Uint16Array、HEX相当） */
  program: Uint16Array;
  /** デバッグ変数一覧 */
  variables: DebugVariable[];
}
