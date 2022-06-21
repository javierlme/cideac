import axios from 'redaxios';

export const API = axios.create({
  baseURL: 'http://cidead.is-a-teacher.com:8081',
  headers: {},
});
