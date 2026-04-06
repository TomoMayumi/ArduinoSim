import React from 'react';
import type { ToastState } from '../hooks/useToast';

interface Props {
  toast: ToastState | null;
}

export const ToastNotification: React.FC<Props> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className={`toast-notification ${toast.type}`}>
      {toast.message}
    </div>
  );
};
