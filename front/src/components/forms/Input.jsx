import { css } from 'goober';
import { h } from 'preact';

const inputProps = (props) => {
  const {
    type = 'text',
    value,
    name,
    placeholder,
    required,
    disabled,
    min,
    max,
    onInput,
    onChange,
  } = props;
  return {
    type,
    value,
    name,
    placeholder,
    required,
    disabled,
    min,
    max,
    onInput,
    onChange,
  };
};

export default function Input(props) {
  const { className = '', disabled, style = {} } = props;
  return (
    <div
      className={`Input ${Cls} ${className}`}
      style={style}
      disabled={disabled}
    >
      {props.preffix}
      <input className="reg14" {...inputProps(props)} />
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

  input {
    background: transparent;
    border: 0;
    padding: 8px 0;
    flex: 1;
    height: 38px;
    outline: 0;
  }

  &.error {
    border-color: var(--input-color-error);
  }
  &[disabled] {
    background: var(--input-color-disabled);
  }
  :focus-within {
  }
`;
