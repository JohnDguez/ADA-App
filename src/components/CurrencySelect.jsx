import { useTranslation } from 'react-i18next'
import { Select } from './Select'
import { CURRENCIES, CURRENCY_CODES } from '../lib/currency'

// Selector de moneda (hoja inferior). Reutilizado en el onboarding, en
// Ajustes → Periodo de cobro e ingresos, y en la moneda de cada espacio
// compartido. `value` vacío = sin elegir (se ve el placeholder).
export function CurrencySelect({ value, onChange, sheetTitle }) {
  const { t } = useTranslation()
  const options = CURRENCY_CODES.map(code => ({
    value: code,
    label: `${t(`currency.names.${code}`)} (${CURRENCIES[code].code})`,
  }))
  return (
    <Select
      value={value || ''}
      onChange={onChange}
      options={options}
      placeholder={t('currency.placeholder')}
      sheet
      sheetTitle={sheetTitle || t('currency.sheetTitle')}
    />
  )
}
