const TextField = ({ label, name, type = 'text', value, onChange, placeholder, error, autoComplete }) => (
  <label className="field-block">
    <span className="input-label">{label}</span>
    <input
      className="text-input"
      name={name}
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={onChange}
      autoComplete={autoComplete}
      required
    />
    {error ? <span className="inline-error">{error}</span> : null}
  </label>
)

export default TextField
