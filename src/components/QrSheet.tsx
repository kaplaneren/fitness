import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Program linkini QR kod olarak gösterir; diğer telefon kamerasıyla okutup açar. */
export default function QrSheet({ text, title, onClose }: { text: string; title: string; onClose: () => void }) {
  const [svg, setSvg] = useState('')
  useEffect(() => { QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'L' }).then(setSvg).catch(() => setSvg('')) }, [text])
  const isLink = /^https?:/.test(text)
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {svg ? <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="muted small">QR kod oluşturulamadı (program çok uzun olabilir). Paylaş ile link gönder.</p>}
        <p className="muted small">{isLink ? 'Arkadaşın telefon kamerasıyla okutup linki açınca program eklenir. Uygulamayı ana ekrandan kullanıyorsa linki "Paylaşılan programı içe aktar"a yapıştırsın.' : 'Bu önizlemede link yok; QR kod, "Paylaşılan programı içe aktar"a yapıştırılacak kodu içerir.'}</p>
        <div className="dialog-actions"><button className="btn primary" onClick={onClose}>Kapat</button></div>
      </div>
    </div>
  )
}
