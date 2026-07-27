import axios from 'redaxios';

const isDev = process.env.NODE_ENV === 'development';

export const API = axios.create({
  baseURL: isDev ? 'http://localhost:8081' : 'https://cidead.is-a-teacher.com:8443',
  headers: {}
});
