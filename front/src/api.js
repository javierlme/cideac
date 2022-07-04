import axios from 'redaxios';

export const API = axios.create({
  baseURL: false?'http://localhost:8081':'https://cidead.is-a-teacher.com:8443',
  headers: {}
});
