/**
 * 资料通工程管理系统 - Axios HTTP 客户端实例
 *
 * 功能说明：
 * 1. 创建统一的 Axios 实例，配置基础 URL 和超时时间
 * 2. 请求拦截器：自动在请求头中附加 Authorization（Bearer Token）
 * 3. 响应拦截器：统一处理错误，401 状态码自动跳转登录页
 * 4. 支持普通请求（30秒超时）和 OCR 请求（10分钟超时）
 *
 * 基础配置：
 * - baseURL: '/api'（通过代理转发到后端服务）
 * - timeout: 30000ms（30秒）
 * - OCR 请求超时: 600000ms（10分钟）
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';

/* ========================================
 * Axios 实例创建与配置
 * ======================================== */

/**
 * 基础 Axios 实例
 * 用于常规 API 请求，超时时间为 30 秒
 */
const client: AxiosInstance = axios.create({
  baseURL: '/api',               /* API 基础路径，通过 Vite 代理转发 */
  timeout: 30000,                /* 请求超时时间：30 秒 */
  headers: {
    'Content-Type': 'application/json', /* 默认请求头：JSON 格式 */
  },
});

/**
 * OCR 专用 Axios 实例
 * OCR（光学字符识别）请求通常处理时间较长，设置 10 分钟超时
 */
export const ocrClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 600000,               /* OCR 请求超时时间：10 分钟 */
  headers: {
    'Content-Type': 'application/json',
  },
});

/* ========================================
 * 请求拦截器
 * 在每个请求发出前自动附加认证 Token
 * ======================================== */

/**
 * 通用请求拦截器配置函数
 * 为请求自动添加 Authorization 请求头
 *
 * @param config - Axios 请求配置对象
 * @returns 修改后的请求配置
 */
const requestInterceptor = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  /* 从 localStorage 获取 Token，兼容多个系统 key */
  const token = localStorage.getItem('zlt_token')
             || localStorage.getItem('wms_token')
             || localStorage.getItem('token');

  /* 如果 Token 存在，附加到请求头 */
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
};

/* 为基础实例添加请求拦截器 */
client.interceptors.request.use(requestInterceptor);

/* 为 OCR 实例添加请求拦截器 */
ocrClient.interceptors.request.use(requestInterceptor);

/* ========================================
 * Token 刷新逻辑
 * ======================================== */

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error || !token) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('zlt_refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    if (!result.success) return null;

    const { token, refreshToken: newRefreshToken } = result.data;
    localStorage.setItem('zlt_token', token);
    if (newRefreshToken) localStorage.setItem('zlt_refresh_token', newRefreshToken);
    return token;
  } catch {
    return null;
  }
}

function clearAuthAndRedirect() {
  localStorage.removeItem('zlt_token');
  localStorage.removeItem('zlt_refresh_token');
  localStorage.removeItem('zlt_user');
  if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/auth')) {
    window.location.href = '/login';
  }
}

/* ========================================
 * 响应拦截器
 * 统一处理响应错误，401 自动刷新 Token
 * ======================================== */

/**
 * 通用响应拦截器 - 错误处理
 *
 * @param error - Axios 错误对象
 * @returns 拒绝的 Promise（携带处理后的错误信息）
 */
const responseErrorInterceptor = async (error: AxiosError): Promise<any> => {
  /* 检查是否有响应（服务器返回了错误状态码） */
  if (error.response) {
    const { status, data, config } = error.response;
    const errorMessage = (data as any)?.message || '请求失败';

    /* 将后端错误消息挂载到 error.message，方便前端 catch 直接使用 */
    (error as any).friendlyMessage = errorMessage;
    if (error.message === `Request failed with status code ${status}`) {
      (error as any).message = errorMessage;
    }

    switch (status) {
      case 401:
        /*
         * 401 未认证 - 尝试用 refreshToken 刷新
         * 排除 refresh 端点自身，避免无限循环
         */
        if (!config?.url?.includes('/auth/refresh')) {
          if (!isRefreshing) {
            isRefreshing = true;
            const newToken = await tryRefreshToken();
            isRefreshing = false;

            if (newToken) {
              processQueue(null, newToken);
              // 重试原始请求
              if (config) {
                config.headers = config.headers || {};
                (config.headers as any).Authorization = `Bearer ${newToken}`;
                return client(config);
              }
            } else {
              processQueue(new Error('Refresh failed'), null);
              clearAuthAndRedirect();
            }
          } else {
            // 已经有刷新在进行中，排队等待
            return new Promise((resolve, reject) => {
              failedQueue.push({
                resolve: (token: string) => {
                  if (config) {
                    config.headers = config.headers || {};
                    (config.headers as any).Authorization = `Bearer ${token}`;
                    resolve(client(config));
                  }
                },
                reject,
              });
            });
          }
        } else {
          // refresh 端点自身返回 401，说明 refreshToken 也过期了
          clearAuthAndRedirect();
        }
        break;

      case 403:
        /* 403 禁止访问 - 无权限 */
        console.error('无权限访问该资源');
        break;

      case 404:
        /* 404 资源不存在 */
        console.error('请求的资源不存在');
        break;

      case 422:
        /* 422 参数验证失败 */
        console.error('请求参数验证失败:', errorMessage);
        break;

      case 500:
        /* 500 服务器内部错误 */
        console.error('服务器内部错误');
        break;

      default:
        /* 其他错误状态码 */
        console.error(`请求错误 (${status}):`, errorMessage);
    }
  } else if (error.request) {
    /*
     * 请求已发出但未收到响应
     * 可能原因：网络断开、服务器无响应、请求超时
     */
    console.error('网络错误：无法连接到服务器');
  } else {
    /* 请求配置错误 */
    console.error('请求配置错误:', error.message);
  }

  /* 将错误继续向上抛出，由调用方处理 */
  return Promise.reject(error);
};

/* 为基础实例添加响应拦截器 */
client.interceptors.response.use(
  (response: AxiosResponse) => response,  /* 成功响应直接返回 */
  responseErrorInterceptor                 /* 错误响应统一处理 */
);

/* 为 OCR 实例添加响应拦截器 */
ocrClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  responseErrorInterceptor
);

/* ========================================
 * 导出
 * ======================================== */

export default client;

/**
 * 导出便捷请求方法
 * 封装常用的 GET / POST / PUT / DELETE 方法
 * 自动携带 Token 并处理错误
 */
export const http = {
  /**
   * GET 请求
   * @param url - 请求路径
   * @param params - URL 查询参数
   * @param config - 额外的 Axios 配置
   */
  get: <T = any>(url: string, params?: any, config?: AxiosRequestConfig) =>
    client.get<T, AxiosResponse<T>>(url, { params, ...config }),

  /**
   * POST 请求
   * @param url - 请求路径
   * @param data - 请求体数据
   * @param config - 额外的 Axios 配置
   */
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    client.post<T, AxiosResponse<T>>(url, data, config),

  /**
   * PUT 请求
   * @param url - 请求路径
   * @param data - 请求体数据
   * @param config - 额外的 Axios 配置
   */
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    client.put<T, AxiosResponse<T>>(url, data, config),

  /**
   * PATCH 请求
   * @param url - 请求路径
   * @param data - 请求体数据
   * @param config - 额外的 Axios 配置
   */
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    client.patch<T, AxiosResponse<T>>(url, data, config),

  /**
   * DELETE 请求
   * @param url - 请求路径
   * @param config - 额外的 Axios 配置
   */
  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    client.delete<T, AxiosResponse<T>>(url, config),

  /**
   * 文件上传请求
   * 自动设置 multipart/form-data 请求头
   * @param url - 请求路径
   * @param formData - FormData 对象
   * @param config - 额外的 Axios 配置
   */
  upload: <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig) =>
    client.post<T, AxiosResponse<T>>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }),
};
