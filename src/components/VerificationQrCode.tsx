import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';

type VerificationQrCodeProps = {
  payload: string;
  label: string;
};

export function VerificationQrCode({ payload, label }: VerificationQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function renderQrCode() {
      if (!payload) {
        setQrDataUrl('');
        return;
      }

      try {
        const dataUrl = await toDataURL(payload, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 168,
          color: {
            dark: '#18231dff',
            light: '#fffffff0',
          },
        });

        if (isMounted) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (isMounted) {
          setQrDataUrl('');
        }
      }
    }

    void renderQrCode();

    return () => {
      isMounted = false;
    };
  }, [payload]);

  if (!qrDataUrl) {
    return null;
  }

  return (
    <div className="verificationQrCode" aria-label={label}>
      <img src={qrDataUrl} alt={label} />
    </div>
  );
}
