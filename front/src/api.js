import axios from 'redaxios';

export const API = axios.create({
  baseURL: true?'http://localhost:8081':'http://cidead.is-a-teacher.com:8081',
  headers: {},
});
