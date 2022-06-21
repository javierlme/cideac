import { css } from 'goober';
import { h } from 'preact';

const inputProps = (props) => {
  const { name, value, placeholder, disabled, onInput, onChange } = props;
  return { name, value, placeholder, disabled, onInput, onChange };
};

export default function Combo(props) {
  const { options = [], disabled, className = '', style } = props;
  return (
    <div
      className={`Combo ${Cls} ${className}`}
      style={style}
      disabled={disabled}
    >
      {props.preffix}
      <select className="reg14" {...inputProps(props)}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {props.suffix}
    </div>
  );
}

const Cls = css`
  display: flex;
  align-items: center;
  border: 1px solid var(--input-color-border);
  padding: 0 12px;
  gap: 12px;
  font-size: 14px;
  line-height: 16px;

  select {
    background: transparent;
    border: 0;
    padding: 8px 0;
    flex: 1;
    outline: 0;
  }
  &.error {
    border-color: var(--input-color-error);
  }
  &[disabled] {
    background: var(--input-color-border);
  }
  :focus-within {
  }
`;
