
export interface ComponentState {
    // 汎用的な状態格納用
    [key: string]: any;
}

export interface Component {
    id: string;
    type: string;
    name: string;

    // 更新間隔 (サイクル数)。未指定の場合はデフォルト (例: 512サイクル)
    updateInterval?: number;

    // シミュレーションステップごとの更新処理
    // cpu: CPUインスタンス (AVRまたはARM)
    update(cpu: any): void;

    // Reactコンポーネント用の状態を返す
    getState(): ComponentState;
}

export interface LedState extends ComponentState {
    isOn: boolean;
    color: string;
}
