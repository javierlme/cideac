import { css } from 'goober';
import { h } from 'preact';

export default function IconButton(props) {
  const { icon, className = '', ...rest } = props;

  return (
    <button className={`IconButton ${Cls} ${className}`} {...rest}>
      {icon}
    </button>
  );
}

const Cls = css`
  display: flex;
  padding: 8px;
  border: 0;
  background: transparent;
  outline: 0;
  color: inherit;

  svg {
    width: var(--icon-size);
    height: var(--icon-size);
    fill: currentColor;
  }

  &[disabled] {
    color: var(--color-inactive);
    cursor: not-allowed;
  }
`;
