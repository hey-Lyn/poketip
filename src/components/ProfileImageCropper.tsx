import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Image as ImageIcon, RotateCw, X } from "lucide-react";
import { exportCrop, getCropRectangle, getRotatedDimensions } from "../services/imageCrop";
import type { CropSettings } from "../services/imageCrop";
import "./ProfileImageCropper.css";

export default function ProfileImageCropper({ source, kind, onApply, onClose }: {
  source: string;
  kind: "avatar" | "cover";
  onApply: (file: File) => Promise<void>; // eslint-disable-line no-unused-vars
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; start: CropSettings }>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const [settings, setSettings] = useState<CropSettings>({ zoom: 1, x: 50, y: 50 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const aspect = kind === "avatar" ? 1 : 2.5;

  useEffect(() => {
    const element = frameRef.current;
    function zoomWithWheel(event: WheelEvent) {
      event.preventDefault();
      if (busy || !imageRef.current?.naturalWidth) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      setSettings((previous) => ({ ...previous, zoom: Math.max(1, Math.min(4, previous.zoom * Math.exp(-delta * 0.0015))) }));
    }
    element.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => element.removeEventListener("wheel", zoomWithWheel);
  }, [busy]);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const observer = new ResizeObserver(([entry]) => setFrame({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(frameRef.current);
    return () => { observer.disconnect(); document.body.style.overflow = previousOverflow; dialog.close(); };
  }, []);

  const rotatedDimensions = getRotatedDimensions(dimensions.width, dimensions.height, rotation);
  const crop = dimensions.width ? getCropRectangle(rotatedDimensions.width, rotatedDimensions.height, aspect, settings) : null;
  const containScale = dimensions.width ? Math.min(frame.width / rotatedDimensions.width, frame.height / rotatedDimensions.height) : 1;
  const selectionWidth = kind === "avatar" ? Math.min(frame.width, frame.height) - 4
    : Math.min(frame.width - 4, rotatedDimensions.width * containScale);
  const selectionHeight = selectionWidth / aspect;
  const selectionLeft = (frame.width - selectionWidth) / 2;
  const selectionTop = (frame.height - selectionHeight) / 2;
  const scale = crop && frame.width ? selectionWidth / crop.width : 1;
  function drag(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !crop) return;
    const start = dragRef.current;
    const horizontalRange = (rotatedDimensions.width - crop.width) * scale;
    const verticalRange = (rotatedDimensions.height - crop.height) * scale;
    setSettings({ ...start.start,
      x: Math.max(0, Math.min(100, start.start.x - (horizontalRange ? (event.clientX - start.clientX) / horizontalRange * 100 : 0))),
      y: Math.max(0, Math.min(100, start.start.y - (verticalRange ? (event.clientY - start.clientY) / verticalRange * 100 : 0))),
    });
  }

  async function apply() {
    setBusy(true); setError("");
    try {
      const file = await exportCrop(imageRef.current, aspect, { ...settings, rotation });
      await onApply(file);
      onClose();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  return (
    <dialog ref={dialogRef} className="profileCropDialog" aria-labelledby="crop-title" aria-describedby="crop-help" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <header><h2 id="crop-title">Edit image</h2><button type="button" className="cropClose" aria-label="Close crop editor" disabled={busy} onClick={onClose}><X aria-hidden="true" /></button></header>
      <p id="crop-help" className="cropHelp">Drag to reposition, or focus the image and use arrow keys. Adjust zoom below. GIF images become a still image.</p>
      <div ref={frameRef} className="profileCropFrame" tabIndex={0} role="group" aria-label="Image position" aria-describedby="crop-help"
        onKeyDown={(event) => {
          if (busy || !crop || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          const step = event.shiftKey ? 5 : 1;
          setSettings((previous) => ({ ...previous,
            x: Math.max(0, Math.min(100, previous.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0))),
            y: Math.max(0, Math.min(100, previous.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0))),
          }));
        }}
        onPointerDown={(event) => { if (busy || !crop) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { clientX: event.clientX, clientY: event.clientY, start: settings }; }}
        onPointerMove={drag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
        <img ref={imageRef} src={source} alt="Image to crop" draggable={false}
          onLoad={(event) => { setError(""); setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }}
          onError={() => setError("Unable to open this image. Try another file.")}
          style={crop ? {
            width: dimensions.width * scale, height: dimensions.height * scale,
            left: selectionLeft - crop.x * scale + (rotatedDimensions.width - dimensions.width) * scale / 2,
            top: selectionTop - crop.y * scale + (rotatedDimensions.height - dimensions.height) * scale / 2,
            transform: `rotate(${rotation}deg)`,
          } : undefined} />
        {!!frame.width && crop && <span className={`profileCropSelection ${kind === "avatar" ? "isAvatar" : ""}`} aria-hidden="true"
          style={{ width: selectionWidth, height: selectionHeight, left: selectionLeft, top: selectionTop }} />}
      </div>
      <div className="profileCropControls">
        <div className="profileCropZoom"><ImageIcon className="cropSmallImage" aria-hidden="true" /><input aria-label="Zoom" type="range" min="1" max="4" step="0.01" value={settings.zoom} disabled={busy || !crop} onChange={(event) => setSettings((previous) => ({ ...previous, zoom: Number(event.target.value) }))} /><ImageIcon aria-hidden="true" /></div>
        <button type="button" className="cropRotate" aria-label="Rotate image" title="Rotate image" disabled={busy || !crop} onClick={() => { setRotation((previous) => (previous + 90) % 360); setSettings({ zoom: 1, x: 50, y: 50 }); }}><RotateCw aria-hidden="true" /></button>
      </div>
      {error && <p className="profileCropError" role="alert">{error}</p>}
      <footer><button className="cropReset" type="button" disabled={busy || !crop || (settings.zoom === 1 && settings.x === 50 && settings.y === 50 && rotation === 0)} onClick={() => { setRotation(0); setSettings({ zoom: 1, x: 50, y: 50 }); }}>Reset</button><button className="cropCancel" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="cropApply" type="button" disabled={busy || !crop} onClick={apply}>{busy ? "Applying..." : "Apply"}</button></footer>
    </dialog>
  );
}
