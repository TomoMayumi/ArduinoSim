import React, { useState, useEffect } from 'react';

export type PanelId = 'hardware' | 'serial' | 'cpu' | 'breakpoints' | 'watch' | 'view' | 'oscilloscope';

const DEFAULT_LAYOUT: { [key: string]: PanelId[] } = {
  left: ['hardware', 'oscilloscope', 'serial'],
  middle: ['cpu', 'breakpoints', 'watch'],
  right: ['view']
};

export function usePanelLayout() {
  // パネルレイアウト状態（localStorage永続化）
  const [panelLayout, setPanelLayout] = useState<{ [key: string]: PanelId[] }>(() => {
    try {
      const saved = localStorage.getItem('arduinoSim_panelLayout');
      return saved ? JSON.parse(saved) : { ...DEFAULT_LAYOUT };
    } catch {
      return { ...DEFAULT_LAYOUT };
    }
  });

  useEffect(() => {
    localStorage.setItem('arduinoSim_panelLayout', JSON.stringify(panelLayout));
  }, [panelLayout]);

  // ドラッグ中のパネル
  const [draggingPanel, setDraggingPanel] = useState<PanelId | null>(null);

  // カラム幅のリサイズ状態
  const [leftWidth, setLeftWidth] = useState(450);
  const [middleWidth, setMiddleWidth] = useState(300);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingMiddle, setIsResizingMiddle] = useState(false);

  // リサイズのマウスイベントハンドラ
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(300, e.clientX - 12);
        setLeftWidth(newWidth);
      } else if (isResizingMiddle) {
        const newWidth = Math.max(250, e.clientX - leftWidth - 20);
        setMiddleWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingMiddle(false);
      document.body.style.cursor = '';
    };

    if (isResizingLeft || isResizingMiddle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingMiddle, leftWidth]);

  // ドラッグ&ドロップハンドラ
  const handleDragStart = (e: React.DragEvent, panelId: PanelId) => {
    setDraggingPanel(panelId);
    e.dataTransfer.setData('panelId', panelId);
    e.dataTransfer.effectAllowed = 'move';

    const card = (e.target as HTMLElement).closest('.card');
    if (card) {
      e.dataTransfer.setDragImage(card, 20, 10);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, columnId: string, targetIndex: number) => {
    e.preventDefault();
    const panelId = e.dataTransfer.getData('panelId') as PanelId;
    if (!panelId) return;

    const nextLayout = { ...panelLayout };

    // 現在の位置から削除
    let sourceCol = '';
    for (const colId in nextLayout) {
      if (nextLayout[colId].includes(panelId)) {
        sourceCol = colId;
        nextLayout[colId] = nextLayout[colId].filter(id => id !== panelId);
        break;
      }
    }

    // 同じカラム内で後ろに移動する場合、削除によってインデックスがずれるのを調整
    let adjustedIndex = targetIndex;
    if (sourceCol === columnId) {
      const sourceIndex = panelLayout[columnId].indexOf(panelId);
      if (sourceIndex < targetIndex) {
        adjustedIndex = Math.max(0, targetIndex - 1);
      }
    }

    nextLayout[columnId].splice(adjustedIndex, 0, panelId);
    setPanelLayout({ ...nextLayout });
    setDraggingPanel(null);
  };

  const startResizeLeft = () => setIsResizingLeft(true);
  const startResizeMiddle = () => setIsResizingMiddle(true);

  return {
    panelLayout,
    draggingPanel,
    leftWidth,
    middleWidth,
    isResizingLeft,
    isResizingMiddle,
    handleDragStart,
    handleDragOver,
    handleDrop,
    startResizeLeft,
    startResizeMiddle,
  };
}
