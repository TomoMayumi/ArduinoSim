export interface SourceFile {
    name: string;
    content: string;
    lines: string[];
}

export class SourceFileManager {
    private files: Map<string, SourceFile> = new Map();

    public addFile(name: string, content: string) {
        this.files.set(name, {
            name,
            content,
            lines: content.split(/\r?\n/)
        });
    }

    public getFile(name: string): SourceFile | undefined {
        // 1. 完全一致で検索
        if (this.files.has(name)) return this.files.get(name);

        // 2. 正規化（バックスラッシュをスラッシュに）して検索
        const normalized = name.replace(/\\/g, '/');
        if (this.files.has(normalized)) return this.files.get(normalized);

        // 3. ベース名だけで検索（ユニークな場合に限る、または最初に見つかったもの）
        const baseName = normalized.split('/').pop() || normalized;
        for (const [key, value] of this.files) {
            const keyBase = key.split('/').pop();
            if (keyBase === baseName) return value;
        }

        return undefined;
    }

    public getAllFiles(): SourceFile[] {
        return Array.from(this.files.values());
    }

    public clear() {
        this.files.clear();
    }

    /**
     * 関数名から定義されているファイルと開始行番号を探す (簡易検索)
     */
    public findFunctionDefinition(functionName: string): { fileName: string, lineNumber: number } | undefined {
        const regex = new RegExp(`\\b${functionName}\\s*\\([^)]*\\)\\s*(?:{|$)`);

        for (const file of this.files.values()) {
            for (let i = 0; i < file.lines.length; i++) {
                if (regex.test(file.lines[i])) {
                    return { fileName: file.name, lineNumber: i + 1 };
                }
            }
        }
        return undefined;
    }

    /**
     * コードの断片(LSS内のC行)から該当する場所を探す
     */
    public findCodeFragment(fragment: string, fileNameHint?: string): { fileName: string, lineNumber: number } | undefined {
        const normalizedFragment = fragment.trim();
        if (!normalizedFragment) return undefined;

        const filesToSearch = fileNameHint ? [this.getFile(fileNameHint)].filter(f => f) : Array.from(this.files.values());

        for (const file of filesToSearch) {
            if (!file) continue;
            for (let i = 0; i < file.lines.length; i++) {
                if (file.lines[i].includes(normalizedFragment)) {
                    return { fileName: file.name, lineNumber: i + 1 };
                }
            }
        }
        return undefined;
    }
}
