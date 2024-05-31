import { styled } from 'goober';
import { h } from 'preact';
import shallow from 'zustand/shallow';
import Field from '../components/forms/Field';
import Input from '../components/forms/Input';
import Button from '../components/Button';
import { useSession } from '../stores/session';
import { Redirect, useLocation } from 'wouter-preact';
import { useState } from 'preact/hooks';

const selector = (state) => [state.user, state.login];

export default function Login(props) {
  const [, setLocation] = useLocation();
  const [user, login] = useSession(selector, shallow);
  const [error, setError] = useState('');

  if (user) return <Redirect href="/" />;

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

  return (
    <Container>
      <div className="content">
        <div className="info">
          <img src="assets/logo.png" alt="" />
          Plataforma de Asignación de plazas de ciclos de formación 2024
        </div>
        <form onSubmit={handleSubmit}>
          <h1>Iniciar sesión</h1>
          <Field label="Email">
            <Input name="email" required />
          </Field>
          <Field label="Contraseña">
            <Input name="pwd" type="password" required />
          </Field>
          <div className="errorMsg">{error}</div>
          <div className="actions">
            <Button tertiary>He olvidado la contraseña</Button>
            <Button type="submit" primary>
              Iniciar sesión
            </Button>
          </div>
        </form>
      </div>
    </Container>
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
