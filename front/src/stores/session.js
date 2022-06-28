import create from 'zustand';
import { API } from '../api';

export const useSession = create((set) => {
  let session = null;
  try {
    session = JSON.parse(localStorage.FPS_SESSION);
    API.defaults.headers['x-access-token'] = session.token;
  } catch (err) {}

  return {
    user: null,
    token: null,
    expiration: null,
    ...session,
    async login(data) {
      const res = await API.post('/users/login', data);
      const { expiration, token, user } = res.data.result;
      set({ expiration, token, user });
    },
    logout() {
      set({ user: null, token: null, expiration: null });
    },
  };
});

useSession.subscribe((session) => {
  if (session.token) {
    localStorage.FPS_SESSION = JSON.stringify(session);
    API.defaults.headers['x-access-token'] = session.token;
  } else {
    delete localStorage.FPS_SESSION;
    delete API.defaults.headers['x-access-token'];
  }
});
