import { css } from 'goober';
import { cloneElement, h } from 'preact';

export default function Field(props) {
  const {
    label = '',
    error,
    element: Element = 'label',
    className = '',
    style = {},
  } = props;
  const children = Array.isArray(props.children)
    ? props.children
    : [props.children];
  const classNameStr = `Field ${Cls} ${className} ${error ? 'error' : ''}`;

  return (
    <Element className={classNameStr} style={style}>
      {label && <div className="label reg14">{label}</div>}
      {children.map((child) =>
        cloneElement(child, {
          className: `${child.props.className || ''} ${error ? 'error' : ''}`,
        }),
      )}
      {error && <div className="errorMsg">{error}</div>}
    </Element>
  );
}

const Cls = css`
  display: flex;
  flex-direction: column;

  .label {
    font-size: 14px;
    line-height: 16px;
    color: var(--color-neutral-100);
    margin-bottom: 4px;
  }
  .errorMsg {
    color: var(--color-error);
  }

  &.error {
    .label {
      color: var(--color-error);
    }
  }
`;
