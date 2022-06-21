import { h } from 'preact';
import Login from './pages/login';
import Home from './pages/index';
import { Route, Router, Switch } from 'wouter-preact';

function App() {
  return (
    <Router base={import.meta.env.SNOWPACK_PUBLIC_BASE}>
      <Switch className="App">
        <Route path="/login" component={Login} />
        <Route path="/" component={Home} />
      </Switch>
    </Router>
  );
}

export default App;
