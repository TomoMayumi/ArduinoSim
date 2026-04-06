import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  noResetMode: boolean;
  onNoResetModeChange: (value: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  noResetMode,
  onNoResetModeChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ 設定</h2>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={noResetMode}
                onChange={(e) => onNoResetModeChange(e.target.checked)}
              />
              RESET EN 切断モード (リセットなし)
            </label>
            <button
              onClick={() => {
                localStorage.removeItem('arduino_sim_hardware_config');
                window.location.reload();
              }}
              style={{ background: '#475569', fontSize: '0.8rem', padding: '0.5rem' }}
            >
              ハードウェア設定を初期化
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('arduinoSim_panelLayout');
                window.location.reload();
              }}
              style={{ background: '#475569', fontSize: '0.8rem', padding: '0.5rem' }}
            >
              レイアウトを初期化
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
