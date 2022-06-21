import { styled } from 'goober';
import { Fragment, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { error, file as fileIcon, signout, trash } from '../icons';
import { Redirect } from 'wouter-preact';
import { useSession } from '../stores/session';
import shallow from 'zustand/shallow';
import { API } from '../api';

const selector = (state) => [state.user, state.logout];

const defaultSteps = [
  //{ id: 'settings', title: 'Subir archivo de configuración', state: 'uploaded', file: { name: 'configuracion.xlsx' } },
  { id: 'slots', title: 'Subir archivo de plazas', state: 'pending' },
  { id: 'assign', title: 'Subir archivo de solicitudes', state: 'disabled' },
  {
    id: 'download',
    title: 'Descargar archivo de asignaciones',
    state: 'disabled',
  },
];

export default function Home() {
  const [user, logout] = useSession(selector, shallow);
  const [steps, setSteps] = useState(defaultSteps);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [popupOpen, setPopupOpen] = useState(null);
  const categoryObj = categories.find((c) => c.name === category);

  useEffect(() => {
    if (!user) return;
    API.get('/courses/categories').then(async (res) => {
      const categories = res.data.result;
      setCategories(categories);
      setCategory(categories[0].name);
    });
  }, []);
  useEffect(() => {
    if (categoryObj?.city == null) return;
    API.get('/courses/checkSlots', {
      params: { city: categoryObj.city },
    }).then(async (res) => {
      const newSteps = [...steps];
      if (res.data.result) {
        newSteps[1] = {
          ...newSteps[1],
          state: 'uploaded',
          file: { name: 'Fichero de vacantes.xlsx' },
        };
        newSteps[2] = { ...newSteps[2], state: 'pending' };
      } else {
        newSteps[1] = {
          ...newSteps[1],
          state: 'pending',
          file: null,
        };
        newSteps[2] = { ...newSteps[2], state: 'pending' };
      }
      setSteps(newSteps);
    });
  }, [categoryObj?.city]);

  if (!user) return <Redirect href="/login" />;

  const uploadFile = async (step, file) => {
    console.log(file);
    const formData = new FormData();
    formData.set('file', file);
    let res;
    try {
      if (step.id === 'settings') {
        res = { data: null };
      } else if (step.id === 'slots') {
        formData.set('city', categoryObj.city);
        res = await API.post('/courses/slots', formData);
      } else if (step.id === 'assign') {
        formData.set('city', categoryObj.city);
        formData.set('category', categoryObj.code);
        formData.set('config', { 
          "percentageHandicap": Number(5/100), 
          "numSlotsBySeatHandicap": Number(1),
          "percentageAthlete": Number(5/100), 
          "numSlotsBySeatAthlete": Number(1),
        });
        res = await API.post('/courses/assign', formData);
      }
      console.log(res);
      const newSteps = [...steps];
      const index = steps.indexOf(step);
      newSteps[index] = { ...newSteps[index], state: 'uploaded', file };
      newSteps[index + 1] = {
        ...newSteps[index + 1],
        state:
          newSteps[index + 1].state == 'disabled'
            ? 'pending'
            : newSteps[index + 1].state,
        url: res.data?.url,
      };
      setSteps(newSteps);
    } catch (err) {
      const newSteps = [...steps];
      const index = steps.indexOf(step);
      newSteps[index] = {
        ...newSteps[index],
        state: 'error',
        info: err.data.additionalInfo,
        file: null,
      };
      setSteps(newSteps);
    }
  };
  const removeFile = async (step) => {
    const newSteps = [...steps];
    const index = steps.indexOf(step);
    newSteps[index] = { ...newSteps[index], state: 'pending', file: null };
    setSteps(newSteps);
  };
  const downloadFile = async (step) => {
    const filename = step.url;
    console.log(`filename:${filename}`);
    const { data } = await API.get(`/courses/files/${filename}`);
    if (data) {
      const blob = new Blob([data], { type: 'application/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  };

  return (
    <Container>
      <header>
        <img src="assets/logo.png" alt="" />
        <Button tertiary onClick={logout}>
          <Icon icon={signout} />
          Cerrar sesión
        </Button>
      </header>
      <section className="intro">
        <h1>
          <b>
            Plataforma de asignación de plazas de ciclo de formación <br />
            2022
          </b>
        </h1>
        <p>Para comenzar sigue los pasos a continuación:</p>
        <label className="selector">
          Seleccionar ciclo
          <select
            id="categorySelect"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((option) => (
              <option value={option.name} key={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="steps">
        {steps.map((step, index) => (
          <Step
            key={step.id}
            step={step}
            index={index}
            onDownload={downloadFile}
            onUpload={uploadFile}
            onRemove={removeFile}
            onShowErrors={(step) => setPopupOpen(step)}
          />
        ))}
      </section>
      {popupOpen && (
        <div className="ErrorPopup">
          <div className="Content">
            <h2>Errores</h2>
            <div className="errorText">
              {popupOpen.info.desc.split(/\r\n/).map((err) => (
                <div key={err}>
                  <Icon icon={error} />
                  {err}
                </div>
              ))}
            </div>
            <Button primary onClick={() => setPopupOpen(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}

const input = document.createElement('input');
input.type = 'file';
input.accept = '.xls,.xlsx';

function Step(props) {
  const { step, index, onUpload, onDownload, onRemove, onShowErrors } = props;
  const uploadFile = () => {
    input.onchange = () => {
      onUpload(step, input.files[0]);
      input.value = null;
    };
    input.click();
  };
  return (
    <div className="step" key={step.title} state={step.state}>
      <div className="number">{index + 1}</div>
      <div className="title">{step.title}</div>
      <div className="file">
        <div className="FileInput">
          {step.id === 'download' && (
            <Fragment>
              El archivo de asignaciones ya está listo
              <Button primary onClick={() => onDownload(step)}>
                Descargar
              </Button>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'pending' && (
            <Fragment>
              Arrastrar archivo o elegir archivo de equipo
              <Button primary onClick={uploadFile}>
                Seleccionar archivo...
              </Button>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'uploaded' && (
            <Fragment>
              <Icon className="fileIcon" icon={fileIcon} />
              <div className="fileName">{step.file.name}</div>
              <Button
                className="removeBtn"
                tertiary
                onClick={() => onRemove(step)}
              >
                <Icon icon={trash} />
                Eliminar
              </Button>
            </Fragment>
          )}
          {step.id !== 'download' && step.state === 'error' && (
            <Fragment>
              <Icon
                className="errorIcon"
                icon={error}
                onClick={() => onShowErrors(step)}
              />
              Ha ocurrido un error, vuelve a subir el archivo
              <Button primary onClick={uploadFile}>
                Seleccionar archivo...
              </Button>
            </Fragment>
          )}
        </div>
      </div>
    </div>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100vh;

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 10px 48px 10px 180px;

    background: var(--color-accent-100);

    .Button {
      color: white;
    }
  }

  .intro {
    padding: 50px 50px 50px 180px;
    color: var(--color-neutral-100);

    h1 {
      font-weight: normal;
      font-size: 32px;
      line-height: 37px;
    }

    .selector {
      display: flex;
      align-items: center;
      gap: 12px;

      .Combo {
        min-width: 200px;
      }
    }
  }
  .steps {
    flex: 1;

    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
    gap: 24px;

    background: #f9f9f9;
    border-top: 1px solid var(--color-neutral-80);

    padding: 70px 180px 70px 180px;
    color: var(--color-neutral-100);

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;

      &[state='disabled'] {
        filter: opacity(0.5) grayscale(2);
        pointer-events: none;

        .number {
          background: transparent;
          border: 1px dashed #0861d4;
          color: #0861d4;
        }
      }
      &[state='pending'] {
        .number {
          background: transparent;
          border: 1px dashed #0861d4;
          color: #0861d4;
        }
      }

      .number {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #0861d4;
        color: white;

        font-weight: bold;
        font-size: 20px;
        line-height: 23px;
        text-align: center;
        margin-bottom: 10px;
      }
      .title {
        font-size: 20px;
        line-height: 23px;
        text-align: center;
        margin-bottom: 25px;
        width: 180px;
      }

      .file {
        background: white;
        border: 1px dashed #8d8d8d;
        box-sizing: border-box;
        border-radius: 5px;
        width: 250px;
        min-height: 250px;

        display: grid;
        place-items: center;
        padding: 24px;

        .fileName {
          font-weight: bold;
          font-size: 13px;
          line-height: 16px;
          text-align: center;
        }

        .fileIcon {
          --icon-size: 55px;
          color: var(--color-accent-80);
          margin-top: 40px;
        }
        .errorIcon {
          --icon-size: 55px;
          color: var(--color-error);
        }
        .removeBtn {
          margin-top: 20px;
        }
      }
    }
  }

  .FileInput {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    text-align: center;
  }

  .ErrorPopup {
    position: fixed;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    background: rgb(0 0 0 / 10%);
    display: grid;
    place-items: center;
    .Content {
      display: flex;
      flex-direction: column;
      gap: 24px;
      min-width: 500px;
      min-height: 300px;
      background: white;
      padding: 24px;
      box-shadow: 0 0 5px 0 rgb(0 0 0 / 10%);
      border-radius: 5px;
      h2 {
        margin: 0;
      }

      .errorText {
        flex: 1;
        max-height: 300px;
        overflow-y: auto;
        padding-right: 20px;

        div {
          display: flex;
          align-items: center;
          gap: 12px;

          .Icon {
            color: var(--color-error);
          }
        }
      }

      .Button {
        margin-top: 12px;
        align-self: center;
        min-width: 150px;
        justify-content: center;
      }
    }
  }
`;
