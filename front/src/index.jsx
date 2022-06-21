import { setup } from 'goober';
import { h, render } from 'preact';
import 'preact/devtools';
import App from './App.js';
import './index.css';

setup(h);

render(<App />, document.getElementById('root'));
