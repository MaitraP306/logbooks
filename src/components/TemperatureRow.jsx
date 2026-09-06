function TemperatureRow({
  item,
  value,
  onChange,
  correctiveAction,
  onCorrectiveActionChange,
  temperatureRules = {},
}) {
  const rule = temperatureRules[`temperature:${item.id}`] || {
    fieldType: 'number',
    required: item.required !== false,
    enforceRange: false,
    minValue: '',
    maxValue: '',
    decimalPlaces: 1,
  }

  const hasValue = value !== undefined && value !== ''
  const numericValue = Number(value)
  const acceptable = hasValue && numericValue >= Number(item.min_temp) && numericValue <= Number(item.max_temp)
  const step = rule.fieldType === 'integer' ? '1' : 10 ** -Number(rule.decimalPlaces ?? 1)

  return (
    <div className={`temperature-row ${hasValue && !acceptable ? 'temperature-row-out-of-range' : ''}`}>
      <div className="temperature-name">
        <strong>{item.name}</strong>
        {rule.required ? <span className="required-label">Required</span> : <span className="optional-label">Optional</span>}
      </div>

      <div className="temperature-range">
        Operating range: {item.min_temp} – {item.max_temp} {item.unit}
        {rule.enforceRange && rule.minValue !== '' && rule.maxValue !== '' && (
          <small>Input validation range: {rule.minValue} – {rule.maxValue}</small>
        )}
      </div>

      <div className="temperature-input">
        <input
          type="number"
          step={step}
          value={value ?? ''}
          onChange={event => onChange(item.id, event.target.value)}
          placeholder="Enter temp"
          required={rule.required}
        />

        {hasValue && <span className={acceptable ? 'reading-good' : 'reading-warning'}>{acceptable ? '✓ Within operating range' : '⚠ Outside operating range'}</span>}

        {hasValue && !acceptable && (
          <div className="corrective-action-wrap">
            <label className="corrective-action-label">Corrective action <span>*</span></label>
          <input
            className="corrective-action-input"
            value={correctiveAction || ''}
            onChange={event => onCorrectiveActionChange(item.id, event.target.value)}
            placeholder="Document corrective action"
            required
          />
          </div>
        )}
      </div>
    </div>
  )
}

export default TemperatureRow
