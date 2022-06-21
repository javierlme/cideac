import { styled } from '../../_snowpack/pkg/goober.js';
import { h } from '../../_snowpack/pkg/preact.js';
import shallow from '../../_snowpack/pkg/zustand/shallow.js';
import Field from '../components/forms/Field.js';
import Input from '../components/forms/Input.js';
import Button from '../components/Button.js';
import { useSession } from '../stores/session.js';
import { Redirect, useLocation } from '../../_snowpack/pkg/wouter-preact.js';
import { useState } from '../../_snowpack/pkg/preact/hooks.js';
const selector = (state) => [state.user, state.login];
export default function Login(props) {
  const [, setLocation] = useLocation();
  const [user, login] = useSession(selector, shallow);
  const [error, setError] = useState('');
  if (user)
    return /* @__PURE__ */ h(Redirect, {
      href: '/',
    });
  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      email: e.target.email.value,
      pwd: e.target.pwd.value,
    };
    try {
      setError('');
      await login(data);
      setLocation('/');
    } catch (err) {
      console.log(err.data.code);
      setError('Credenciales incorrectas');
    }
  };
  return /* @__PURE__ */ h(
    Container,
    null,
    /* @__PURE__ */ h(
      'div',
      {
        className: 'content',
      },
      /* @__PURE__ */ h(
        'div',
        {
          className: 'info',
        },
        /* @__PURE__ */ h('img', {
          src: 'assets/logo.png',
          alt: '',
        }),
        'Plataforma de Asignación de plazas de ciclos de formación',
      ),
      /* @__PURE__ */ h(
        'form',
        {
          onSubmit: handleSubmit,
        },
        /* @__PURE__ */ h('h1', null, 'Iniciar sesión'),
        /* @__PURE__ */ h(
          Field,
          {
            label: 'Email',
          },
          /* @__PURE__ */ h(Input, {
            name: 'email',
            required: true,
          }),
        ),
        /* @__PURE__ */ h(
          Field,
          {
            label: 'Contraseña',
          },
          /* @__PURE__ */ h(Input, {
            name: 'pwd',
            type: 'password',
            required: true,
          }),
        ),
        /* @__PURE__ */ h(
          'div',
          {
            className: 'errorMsg',
          },
          error,
        ),
        /* @__PURE__ */ h(
          'div',
          {
            className: 'actions',
          },
          /* @__PURE__ */ h(
            Button,
            {
              tertiary: true,
            },
            'He olvidado la contraseña',
          ),
          /* @__PURE__ */ h(
            Button,
            {
              type: 'submit',
              primary: true,
            },
            'Iniciar sesión',
          ),
        ),
      ),
    ),
  );
}
const Container = styled('div')`
  display: grid;
  place-items: center;
  padding: 48px;

  background: left center / cover no-repeat url(assets/login-bg.png),
    var(--color-accent-100);
  height: 100vh;

  .content {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 200px;
  }

  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 35px;
    color: white;
    font-weight: bold;
    font-size: 32px;
    line-height: 37px;

    width: min(50%, 400px);

    img {
      height: 50px;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 20px;

    width: min(50%, 550px);
    background: white;
    box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
    border-radius: 10px;

    padding: 80px 45px;

    color: var(--color-neutral-100);

    h1 {
      font-size: 32px;
      line-height: 37px;
    }

    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }
  .errorMsg {
    color: var(--color-error);
    text-align: center;
    margin-bottom: 20px;
    height: 18px;
  }
`;
