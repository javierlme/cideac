import axios from 'redaxios';

export const API = axios.create({
  baseURL: false?'http://localhost:8081':'http://cidead.is-a-teacher.com:8081',
  headers: {},
});
