export interface SourceLine {
    lineNumber: number;       // 表示上の行番号 (1-indexed)
    text: string;             // 行のテキスト
    addresses: number[];      // この行に含まれるPCアドレス(ワード単位)のリスト
}

export class SourceMapper {
    public sourceLines: SourceLine[] = [];
    public addressToLine: Map<number, number> = new Map(); // PC address (word) -> lineNumber
    public hasSource: boolean = false;

    public parseLss(lssText: string) {
        this.sourceLines = [];
        this.addressToLine.clear();
        this.hasSource = false;

        const lines = lssText.split(/\r?\n/);
        let currentLineNumber = 1;

        // LSSファイルの解析
        const addressRowRegex = /^\s*([0-9a-fA-F]+):\s+([0-9a-fA-F]{2}\s+)+/;

        for (const line of lines) {
            const match = line.match(addressRowRegex);
            const addresses: number[] = [];

            if (match) {
                // アドレス行の場合
                const byteAddress = parseInt(match[1], 16);
                addresses.push(byteAddress);

                // 命令が複数ワードにまたがる場合（簡易対応：LSSの次の行で続くことは少ないが、
                // opcodeから推測する必要がある。ここではこの行に表示されている最初のアドレスだけを記録しておく）
                this.addressToLine.set(byteAddress, currentLineNumber);
            } else {
                // アドレス以外の行（Cのソースコード、セクションラベル、空行など）
                // ただし、関数ラベル `00000092 <main>:` などの形式はアドレスを持たない純粋な行として扱う
            }

            this.sourceLines.push({
                lineNumber: currentLineNumber,
                text: line,
                addresses: addresses
            });

            currentLineNumber++;
        }

        this.hasSource = this.sourceLines.length > 0;
    }

    public getLineForAddress(address: number): number | undefined {
        return this.addressToLine.get(address);
    }

    public getAddressesForLine(lineNumber: number): number[] {
        if (lineNumber >= 1 && lineNumber <= this.sourceLines.length) {
            return this.sourceLines[lineNumber - 1].addresses;
        }
        return [];
    }
}
