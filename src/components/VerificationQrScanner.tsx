import type { IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState } from 'react';

type VerificationQrScannerProps = {
  startLabel: string;
  stopLabel: string;
  readyLabel: string;
  scanningLabel: string;
  cameraErrorLabel: string;
  onScan: (payload: string) => void;
};

export function VerificationQrScanner({
  startLabel,
  stopLabel,
  readyLabel,
  scanningLabel,
  cameraErrorLabel,
  onScan,
}: VerificationQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState(readyLabel);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  async function startScanning() {
    if (!videoRef.current) {
      return;
    }

    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(true);
    setStatus(scanningLabel);

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        },
        videoRef.current,
        (result, _error, callbackControls) => {
          if (!result) {
            return;
          }

          const text = result.getText();
          callbackControls.stop();
          controlsRef.current = null;
          setIsScanning(false);
          setStatus(readyLabel);
          onScan(text);
        },
      );

      controlsRef.current = controls;
    } catch {
      controlsRef.current = null;
      setIsScanning(false);
      setStatus(cameraErrorLabel);
    }
  }

  function stopScanning() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
    setStatus(readyLabel);
  }

  return (
    <div className="verificationScanner">
      <video ref={videoRef} muted playsInline />
      <div className="verificationScannerActions">
        <button className="restoreButton inlineActionButton" type="button" onClick={startScanning} disabled={isScanning}>
          {startLabel}
        </button>
        <button className="restoreButton inlineActionButton" type="button" onClick={stopScanning} disabled={!isScanning}>
          {stopLabel}
        </button>
      </div>
      <small>{status}</small>
    </div>
  );
}
