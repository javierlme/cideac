import { setup } from './lib/goober.js';
import { h, render } from 'preact';
// import 'preact/devtools'; // Solo para desarrollo, causa error en build
import App from './App.js';
import './index.css';

setup(h);

render(<App />, document.getElementById('root'));
