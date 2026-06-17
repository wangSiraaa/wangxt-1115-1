import axios, { AxiosInstance, AxiosResponse } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

const request: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
});

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    if (res.code !== 0) {
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return res.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default request;
