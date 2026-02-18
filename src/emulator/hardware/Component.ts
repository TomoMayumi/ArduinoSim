import { CPU } from 'avr8js';

export interface ComponentState {
    // 汎用的な状態格納用
    [key: string]: any;
}

export interface Component {
    id: string;
    type: string;
    name: string;

    // シミュレーションステップごとの更新処理
    // cpu: CPUインスタンス
    // cycles: 現在のサイクル数 (前回呼び出しからの差分ではない点に注意)
    update(cpu: CPU): void;

    // Reactコンポーネント用の状態を返す
    getState(): ComponentState;
}

export interface LedState extends ComponentState {
    isOn: boolean;
    color: string;
}
