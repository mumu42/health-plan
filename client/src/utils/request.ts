import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import Taro from '@tarojs/taro';

// 创建axios实例
const service = axios.create({
  baseURL: 'http://10.10.82.89:3001', // 替换为实际API地址
  timeout: 10000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
});

// 请求拦截器
service.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    // 在这里可以添加token等全局请求头
    const token = Taro.getStorageSync('token');
    if (token) {
      config.headers!['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 在这里处理响应数据
    if (response.status === 200) {
      return response.data;
    } else {
      return Promise.reject(response);
    }
  },
  (error) => {
    // 在这里处理错误
    Taro.showToast({
      title: '网络请求失败',
      icon: 'none'
    });
    return Promise.reject(error);
  }
);

// 封装GET请求
export const get = <T>(url: string, params?: object): Promise<T> => {
  return service.get(url, { params });
};

// 封装POST请求
export const post = <T>(url: string, data?: object): Promise<T> => {
  return service.post(url, data);
};

// 封装文件上传
export const upload = <T>(url: string, filePath: string, formData?: object): Promise<T> => {
  return Taro.uploadFile({
    url: service.defaults.baseURL + url,
    filePath,
    name: 'file',
    formData,
    header: {
      'Authorization': `Bearer ${Taro.getStorageSync('token')}`
    }
  }) as unknown as Promise<T>;
};

export default service;