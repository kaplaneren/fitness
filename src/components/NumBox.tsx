import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'

// Sayı kutusu: yazarken boş bırakılabilir (silince "0" kalmaz, 150 → 140 yazınca 0140 olmaz).
// Virgül ve nokta kabul edilir. Boşken onChange(undefined) çağrılır; kutudan çıkınca son geçerli değer gösterilir.
// Odaklanınca içerik seçilir, böylece yazmak eski değerin yerine geçer.

const show = (v?: number) => (v == null || !Number.isFinite(v) ? '' : String(v).replace('.', ','))

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  value?: number
  onChange: (v: number | undefined) => void
  integer?: boolean
}

export default function NumBox({ value, onChange, integer, onFocus, onBlur, ...rest }: Props) {
  const [text, setText] = useState(show(value))
  const focused = useRef(false)
  useEffect(() => {
    if (focused.current) {
      // Dışarıdan farklı bir değer geldiyse (ör. hızlı buton) yazılanı güncelle
      const n = parseFloat(text.replace(',', '.'))
      if (value != null && n !== value) setText(show(value))
      return
    }
    setText(show(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={text}
      onFocus={(e) => { focused.current = true; e.target.select(); onFocus?.(e) }}
      onBlur={(e) => { focused.current = false; setText(show(value)); onBlur?.(e) }}
      onChange={(e) => {
        const t = e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '')
        setText(t)
        const n = parseFloat(t.replace(',', '.'))
        onChange(t === '' || Number.isNaN(n) ? undefined : n)
      }}
    />
  )
}
