import { css } from 'goober';
import { h } from 'preact';

const btnProps = (props) => {
  const { type = 'button', disabled, onClick } = props;
  return { type, disabled, onClick };
};

export default function Button(props) {
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
      class={`Button ${Cls} ${className}`}
      {...btnStyle}
      {...btnProps(props)}
    >
      {props.children}
    </button>
  );
}

const Cls = css`
  display: flex;
  align-items: center;
  gap: 12px;

  font-family: Arial;
  font-style: normal;
  font-weight: bold;
  font-size: 16px;
  line-height: 18px;
  border: 0;

  &[condesed] {
    padding: 2px 8px;
    font-size: 12px;
    line-height: 14px;
    gap: 6px;
  }

  &[primary] {
    background: var(--color-accent-100);
    color: white;
    height: 35px;
    border-radius: 4px;
    border: 1px solid #000;
    padding: 10px;
    margin: 0px;
  }
  &[secondary] {
    background: #ccc;
    color: #000;
    border-radius: 4px;
    border: 1px solid #aaa;
    height: 35px;
    padding: 10px;
    margin: 0px;
  }
  &[tertiary] {
    font-size: 14px;
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
