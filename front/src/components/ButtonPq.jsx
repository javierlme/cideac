import { css } from 'goober';
import { h } from 'preact';

const btnProps = (props) => {
  const { type = 'button', disabled, onClick } = props;
  return { type, disabled, onClick };
};

export default function ButtonPq(props) {
  const {
    primary,
    secondary,
    tertiary,
    quaternary,
    condesed,
    className = '',
  } = props;
  const btnStyle = {
    primary,
    secondary,
    tertiary,
    quaternary,
    condesed,
  };
  return (
    <button
      class={`Button ${ClsPq} ${className}`}
      {...btnStyle}
      {...btnProps(props)}
    >
      {props.children}
    </button>
  );
}

const ClsPq = css`
  display: flex;
  align-items: center;
  gap: 0px;

  font-family: Arial;
  font-style: normal;
  font-weight: bold;
  font-size: 11px;
  line-height: 14px;
  border: 0;
  border-radius: 4px;
  width: 70px;
  height: 30px;
  padding: 0px;
  margin: 0px;

  &[primary] {
    background: var(--color-accent-100);
    color: white;
    border: 1px solid #000;
  }
  &[secondary] {
    background: #ccc;
    color: #000;
    border: 1px solid #aaa;
  }
  &[tertiary] {
    background: transparent;
    color: var(--color-accent-100);
  }
  &[quaternary] {
    background: transparent;
    color: var(--color-yellow);
    border: 1px solid var(--color-yellow);
  }
  &[disabled] {
    background: var(--color-inactive);
    color: var(--color-white);
    cursor: not-allowed;
  }
`;
