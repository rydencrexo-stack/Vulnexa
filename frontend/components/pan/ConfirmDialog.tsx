"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, busy = false, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) return null;
  return (
    <div className="pan-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div aria-describedby="pan-dialog-description" aria-labelledby="pan-dialog-title" aria-modal="true" className="pan-dialog" role="alertdialog">
        <button aria-label="Close dialog" className="pan-dialog-close" onClick={onCancel}><X size={17} /></button>
        <span className={danger ? "pan-dialog-icon pan-dialog-icon-danger" : "pan-dialog-icon"}><AlertTriangle size={22} /></span>
        <h2 id="pan-dialog-title">{title}</h2>
        <p id="pan-dialog-description">{description}</p>
        <div className="pan-dialog-actions">
          <button className="pan-button pan-button-secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? "pan-button pan-button-danger" : "pan-button pan-button-primary"} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
