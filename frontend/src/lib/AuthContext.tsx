/**
 * 资料通工程管理系统 - 认证状态管理（Zustand Store）
 *
 * 功能说明：
 * 使用 Zustand 替代传统 React Context 管理全局认证状态。
 * 提供用户登录、登出、Token 管理、权限校验等功能。
 *
 * 状态字段：
 * - user: 当前登录用户信息
 * - token: JWT 认证令牌
 * - isAuthenticated: 是否已认证
 * - isDeveloper: 是否为开发者账号
 * - isDevView: 是否处于开发者视角模式
 *
 * 方法：
 * - login(params): 登录（支持开发者和企业用户两种模式）
 * - logout(): 退出登录
 * - updateToken(token): 更新认证令牌
 * - can(permission): 检查当前用户是否拥有指定权限
 *
 * 持久化：
 * - Token 存储在 localStorage（key: 'zlt_token'）
 * - 用户信息存储在 localStorage（key: 'zlt_user'）
 * - 应用启动时自动从 localStorage 恢复登录状态
 */

import { create } from 'zustand';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

/** 用户信息接口 */
export interface User {
  id: number;                    /* 用户唯一标识 */
  username: string;              /* 用户名 */
  realName?: string;             /* 真实姓名 */
  email?: string;                /* 邮箱地址 */
  phone?: string;                /* 手机号码 */
  avatar?: string;               /* 头像 URL */
  role?: string;                 /* 角色名称 */
  permissions?: string[];        /* 权限列表 */
  enabledModules?: string[];     /* 企业已开通业务模块：wms/labor/finance */
  tenantId?: number;             /* 所属项目部 ID */
  tenantName?: string;           /* 所属项目部名称 */
  tenantCode?: string;           /* 企业代码 */
  isDeveloper?: boolean;         /* 是否为开发者 */
}

/** 开发者登录参数 */
interface DeveloperLoginParams {
  username: string;              /* 开发者用户名 */
  password: string;              /* 开发者密码 */
}

/** 企业用户登录参数 */
interface UserLoginParams {
  tenantCode: string;            /* 企业代码 */
  username: string;              /* 用户名 */
  password: string;              /* 密码 */
}

/** API 响应包装 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** 登录响应数据 */
interface LoginResponse {
  token: string;                 /* JWT 令牌 */
  refreshToken: string;          /* 长期登录凭证（30天有效） */
  user: User;                    /* 用户信息 */
}

/** 认证 Store 状态接口 */
interface AuthState {
  /* ---------- 状态字段 ---------- */
  user: User | null;             /* 当前用户信息 */
  token: string | null;          /* 认证令牌 */
  refreshToken: string | null;   /* 长期登录凭证（30天有效） */
  isAuthenticated: boolean;      /* 是否已认证 */
  isDeveloper: boolean;          /* 是否为开发者 */
  isDevView: boolean;            /* 是否处于开发者视角 */
  developerToken: string | null; /* 开发者原始令牌（进入企业视角前保存） */
  developerUser: User | null;   /* 开发者原始用户信息（进入企业视角前保存） */

  /* ---------- 方法 ---------- */
  /** 开发者登录 */
  developerLogin: (params: DeveloperLoginParams) => Promise<void>;
  /** 企业用户登录 */
  userLogin: (params: UserLoginParams) => Promise<void>;
  /** 退出登录 */
  logout: () => void;
  /** 更新认证令牌（Token 刷新时使用） */
  updateToken: (token: string, refreshToken?: string) => void;
  /** 更新用户信息 */
  updateUser: (user: Partial<User>) => void;
  /** 检查是否拥有指定权限 */
  can: (permission: string) => boolean;
  /** 检查企业是否开通指定模块 */
  hasModule: (moduleKey: string) => boolean;
  /** 切换开发者视角 */
  toggleDevView: () => void;
  /** 进入企业视角（保存开发者凭证，切换到企业 token） */
  enterEnterpriseView: (tenantToken: string, tenantUser: User, tenantRefreshToken?: string) => void;
  /** 退出企业视角（恢复开发者凭证） */
  exitEnterpriseView: () => Promise<void>;
}

/* ========================================
 * localStorage 存储键名常量
 * ======================================== */
const TOKEN_KEY = 'zlt_token';           /* Token 存储键 */
const REFRESH_TOKEN_KEY = 'zlt_refresh_token'; /* 长期凭证存储键 */
const USER_KEY = 'zlt_user';             /* 用户信息存储键 */
const DEV_TOKEN_KEY = 'zlt_dev_token';   /* 开发者原始 Token（进入企业视角前保存） */
const DEV_USER_KEY = 'zlt_dev_user';     /* 开发者原始用户信息（进入企业视角前保存） */

/* ========================================
 * 辅助函数
 * ======================================== */

/**
 * 从 localStorage 读取 Token
 * @returns 存储的 Token 字符串，不存在则返回 null
 */
const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * 从 localStorage 读取用户信息
 * @returns 解析后的用户对象，不存在则返回 null
 */
const getStoredUser = (): User | null => {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * 将 Token 保存到 localStorage
 * @param token - 要保存的 Token 字符串
 */
const setStoredToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('保存 Token 到 localStorage 失败:', error);
  }
};

/**
 * 将用户信息保存到 localStorage
 * @param user - 要保存的用户对象
 */
const setStoredUser = (user: User): void => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('保存用户信息到 localStorage 失败:', error);
  }
};

/**
 * 从 localStorage 读取 RefreshToken
 */
const getStoredRefreshToken = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * 保存 RefreshToken 到 localStorage
 */
const setStoredRefreshToken = (refreshToken: string): void => {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error('保存 RefreshToken 失败:', error);
  }
};

/**
 * 清除 localStorage 中的认证数据
 */
const clearStoredAuth = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(DEV_USER_KEY);
  } catch (error) {
    console.error('清除 localStorage 认证数据失败:', error);
  }
};

/**
 * 从 localStorage 读取开发者原始 Token
 */
const getStoredDevToken = (): string | null => {
  try {
    return localStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * 从 localStorage 读取开发者原始用户信息
 */
const getStoredDevUser = (): User | null => {
  try {
    const data = localStorage.getItem(DEV_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/**
 * 保存开发者凭证到 localStorage
 */
const setStoredDevAuth = (token: string, user: User): void => {
  try {
    localStorage.setItem(DEV_TOKEN_KEY, token);
    localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('保存开发者凭证到 localStorage 失败:', error);
  }
};

/**
 * 清除 localStorage 中的开发者凭证
 */
const clearStoredDevAuth = (): void => {
  try {
    localStorage.removeItem(DEV_TOKEN_KEY);
    localStorage.removeItem(DEV_USER_KEY);
  } catch (error) {
    console.error('清除开发者凭证失败:', error);
  }
};

/* ========================================
 * Zustand Store 创建
 * ======================================== */

/**
 * 认证状态管理 Store
 *
 * 初始化时自动从 localStorage 恢复登录状态，
 * 确保用户刷新页面后仍保持登录。
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  /* ---------- 初始状态（从 localStorage 恢复） ---------- */
  user: getStoredUser(),
  token: getStoredToken(),
  refreshToken: getStoredRefreshToken(),
  isAuthenticated: !!getStoredToken(),    /* 有 Token 即视为已认证 */
  isDeveloper: getStoredUser()?.isDeveloper ?? false,
  /* 如果 localStorage 有开发者凭证但当前用户不是开发者，说明处于企业视角模式 */
  isDevView: !!getStoredDevToken() && !(getStoredUser()?.isDeveloper),
  developerToken: getStoredDevToken(),    /* 从 localStorage 恢复 */
  developerUser: getStoredDevUser(),      /* 从 localStorage 恢复 */

  /* ---------- 方法实现 ---------- */

  /**
   * 开发者登录
   * @param params - 包含用户名和密码的登录参数
   * @throws 登录失败时抛出错误
   */
  developerLogin: async (params: DeveloperLoginParams) => {
    try {
      /* 调用开发者登录 API */
      const response = await fetch('/api/auth/developer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const result: ApiResponse<LoginResponse> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '登录失败');
      }

      const { token, refreshToken, user } = result.data;

      /* 持久化认证信息 */
      setStoredToken(token);
      setStoredRefreshToken(refreshToken);
      setStoredUser({ ...user, isDeveloper: true });

      /* 更新 Store 状态 */
      set({
        user: { ...user, isDeveloper: true },
        token,
        refreshToken,
        isAuthenticated: true,
        isDeveloper: true,
        isDevView: false,
      });

      toast.success('登录成功');
    } catch (error: any) {
      toast.error(error.message || '登录失败，请检查用户名和密码');
      throw error;
    }
  },

  /**
   * 企业用户登录
   * @param params - 包含企业代码、用户名和密码的登录参数
   * @throws 登录失败时抛出错误
   */
  userLogin: async (params: UserLoginParams) => {
    try {
      /* 调用企业用户登录 API */
      const response = await fetch('/api/auth/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const result: ApiResponse<LoginResponse> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || '登录失败');
      }

      const { token, refreshToken, user } = result.data;

      /* 持久化认证信息 */
      setStoredToken(token);
      setStoredRefreshToken(refreshToken);
      setStoredUser({ ...user, isDeveloper: false });

      /* 更新 Store 状态 */
      set({
        user: { ...user, isDeveloper: false },
        token,
        refreshToken,
        isAuthenticated: true,
        isDeveloper: false,
        isDevView: false,
      });

      toast.success('登录成功');
    } catch (error: any) {
      toast.error(error.message || '登录失败，请检查企业代码和账号信息');
      throw error;
    }
  },

  /**
   * 退出登录
   * 清除所有认证状态和本地存储
   */
  logout: () => {
    /* 清除 localStorage 中的认证数据 */
    clearStoredAuth();

    /* 重置 Store 状态 */
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isDeveloper: false,
      isDevView: false,
      developerToken: null,
      developerUser: null,
    });

    toast.success('已退出登录');
  },

  /**
   * 更新认证令牌
   * 用于 Token 刷新场景，保持用户登录状态
   * @param token - 新的 JWT 令牌
   */
  updateToken: (token: string, newRefreshToken?: string) => {
    setStoredToken(token);
    if (newRefreshToken) setStoredRefreshToken(newRefreshToken);
    set({ token, ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}) });
  },

  /**
   * 更新用户信息
   * 用于修改个人资料等场景，部分更新用户字段
   * @param userData - 要更新的用户字段（Partial 类型）
   */
  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      setStoredUser(updatedUser);
      set({ user: updatedUser });
    }
  },

  /**
   * 权限检查
   * 判断当前用户是否拥有指定的操作权限
   * 开发者默认拥有所有权限
   *
   * @param permission - 权限标识符（如 'wms:view', 'labor:manage'）
   * @returns 是否拥有该权限
   */
  can: (permission: string): boolean => {
    const { user, isDeveloper } = get();

    /* 开发者拥有所有权限 */
    if (isDeveloper) return true;

    /* 未登录用户无权限 */
    if (!user) return false;

    /* 管理员角色拥有所有权限 */
    if (user.role === 'admin') return true;

    /* 检查用户权限列表 */
    return user.permissions?.includes(permission) ?? false;
  },

  hasModule: (moduleKey: string): boolean => {
    const { user, isDeveloper, isDevView } = get();
    if (isDeveloper && !isDevView) return true;
    if (!user) return false;
    return user.enabledModules?.includes(moduleKey) ?? false;
  },

  /**
   * 切换开发者视角
   * 开发者可以在开发者后台和企业视角之间切换
   */
  toggleDevView: () => {
    set((state) => ({ isDevView: !state.isDevView }));
  },

  /**
   * 进入企业视角
   * 保存开发者的原始 token/user，切换到企业的 token/user
   */
  enterEnterpriseView: (tenantToken: string, tenantUser: User, tenantRefreshToken?: string) => {
    const { token, user } = get();
    // 持久化企业 token 到 localStorage，后续 API 请求使用 dev-view token
    // dev-view token 包含 tenantId，可通过租户中间件访问业务数据
    setStoredToken(tenantToken);
    setStoredUser(tenantUser);
    // 持久化 dev-view 专用 refreshToken（用于过期后自动续期时保留 isDevView / tenantId）
    if (tenantRefreshToken) {
      setStoredRefreshToken(tenantRefreshToken);
    }
    // 将开发者凭证持久化到 localStorage（刷新后可恢复）
    if (token && user) {
      setStoredDevAuth(token, user);
    }
    set({
      developerToken: token,               // 保存开发者原始 token
      developerUser: user,                  // 保存开发者原始用户信息
      token: tenantToken,                   // 切换到企业 token
      user: { ...tenantUser, isDeveloper: false },
      refreshToken: tenantRefreshToken || null, // 保存 dev-view refresh token
      isDevView: true,                      // 标记为企业视角
    });
  },

  /**
   * 退出企业视角
   * 调用退出 API 并恢复开发者的原始 token/user
   */
  exitEnterpriseView: async () => {
    const state = get();
    // 优先使用内存中的凭证，降级到 localStorage（刷新后恢复的场景）
    const devToken = state.developerToken || getStoredDevToken();
    const devUser = state.developerUser || getStoredDevUser();
    if (!devToken || !devUser) {
      // 没有保存的开发者凭证，清除企业凭证并回到登录页
      clearStoredAuth();
      set({
        user: null, token: null, isAuthenticated: false,
        isDeveloper: false, isDevView: false,
        developerToken: null, developerUser: null,
      });
      window.location.href = '/login';
      return;
    }

    try {
      // 调用后端退出企业视角 API
      await fetch('/api/auth/developer/exit-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`,
        },
      });
    } catch {
      // API 调用失败不影响本地恢复
    }

    // 恢复开发者凭证
    setStoredToken(devToken);
    setStoredUser(devUser);
    clearStoredDevAuth();

    set({
      token: devToken,
      user: devUser,
      isDevView: false,
      developerToken: null,
      developerUser: null,
    });
  },
}));
