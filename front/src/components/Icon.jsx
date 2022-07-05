import { css } from 'goober';
import { h } from 'preact';

export default function Icon(props) {
  const { icon, className = '', ...rest } = props;

  return (
    <div className={`Icon ${Cls} ${className}`} {...rest}>
      {icon}
    </div>
  );
}

const Cls = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;

  svg {
    fill: currentColor;
    width: var(--icon-size, 24px);
    height: var(--icon-size, 24px);
  }
`;
