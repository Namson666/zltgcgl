/**
 * useConfigList - 配置列表管理通用 Hook
 *
 * 封装配置列表的增删改查、测试连通性、启用停用、选中切换等通用逻辑，
 * 用于 AiConfig 和 OcrConfig 页面，避免重复代码。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/* ========================================
 * 类型定义
 * ======================================== */

export interface UseConfigListOptions<T extends { id: string }> {
  /** 获取配置列表的 API 函数 */
  fetchApi: () => Promise<any>;
  /** 保存（创建/更新）配置的 API 函数 */
  saveApi: (data: any) => Promise<any>;
  /** 删除配置的 API 函数 */
  deleteApi: (id: string) => Promise<any>;
  /** 测试连通性的 API 函数 */
  testApi: (data: any) => Promise<any>;
  /** 启用/停用配置的 API 函数 */
  toggleApi?: (id: string, enabled: boolean) => Promise<any>;
  /** 新建配置时的默认表单值 */
  defaultForm: Omit<T, 'id'>;
  /** 从配置对象生成显示名称 */
  getDisplayName: (item: T) => string;
  /** 保存成功后的提示信息前缀 */
  saveLabel?: string;
  /**
   * 敏感字段列表（如 apiKey、secretKey）
   * 加载已有配置时这些字段会被清空，防止脱敏值被保存回数据库
   */
  sensitiveFields?: (keyof T)[];
}

export interface UseConfigListReturn<T extends { id: string }> {
  configs: T[];
  selectedId: string | null;
  form: Omit<T, 'id'> & { id?: string };
  isNew: boolean;
  loading: boolean;
  saving: boolean;
  testStatus: 'idle' | 'testing' | 'success' | 'failed';
  testMessage: string;
  selectConfig: (id: string) => void;
  newConfig: () => void;
  updateField: (field: keyof T, value: string) => void;
  handleSave: () => Promise<void>;
  handleTest: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleToggle: (enabled: boolean) => Promise<void>;
  toggleConfig: (id: string, enabled: boolean) => Promise<void>;
}

/* ========================================
 * Hook
 * ======================================== */

export function useConfigList<T extends { id: string }>(
  options: UseConfigListOptions<T>,
): UseConfigListReturn<T> {
  const { fetchApi, saveApi, deleteApi, testApi, toggleApi, defaultForm, getDisplayName, saveLabel, sensitiveFields } = options;

  // ---- refs to avoid callback dependency churn ----
  const fetchApiRef = useRef(fetchApi);
  const saveApiRef = useRef(saveApi);
  const deleteApiRef = useRef(deleteApi);
  const testApiRef = useRef(testApi);
  const toggleApiRef = useRef(toggleApi);
  const defaultFormRef = useRef(defaultForm);
  const getDisplayNameRef = useRef(getDisplayName);
  const saveLabelRef = useRef(saveLabel);
  const configsRef = useRef<T[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const formRef = useRef<Omit<T, 'id'> & { id?: string }>({ ...defaultForm } as any);

  fetchApiRef.current = fetchApi;
  saveApiRef.current = saveApi;
  deleteApiRef.current = deleteApi;
  testApiRef.current = testApi;
  toggleApiRef.current = toggleApi;
  defaultFormRef.current = defaultForm;
  getDisplayNameRef.current = getDisplayName;
  saveLabelRef.current = saveLabel;

  // ---- state ----
  const [configs, setConfigs] = useState<T[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<T, 'id'> & { id?: string }>({ ...defaultForm } as any);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // keep refs in sync with state
  configsRef.current = configs;
  selectedIdRef.current = selectedId;
  formRef.current = form;

  const isNew = !selectedId;

  /* ---------- 获取配置列表 ---------- */

  const fetchConfigs = useCallback(async (preserveSelection?: boolean) => {
    const prevSelected = selectedIdRef.current;
    try {
      setLoading(true);
      const res = await fetchApiRef.current();
      const body = res.data || res;
      const items = body.data || [];
      const list: T[] = Array.isArray(items) ? items : [];
      setConfigs(list);

      if (preserveSelection && prevSelected && list.some((c) => c.id === prevSelected)) {
        // keep current selection if it still exists
      } else if (list.length > 0) {
        setSelectedId(list[0].id);
        const { createdAt: _, ...rest } = list[0] as any;
        // 清除敏感字段（防止脱敏值被保存回数据库）
        const cleanRest = { ...rest };
        if (sensitiveFields) {
          for (const field of sensitiveFields) {
            (cleanRest as any)[field] = '';
          }
        }
        setForm({ id: list[0].id, ...cleanRest });
      } else {
        setSelectedId(null);
      }
    } catch (error) {
      console.error('加载配置列表失败:', error);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load — runs once
  useEffect(() => {
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 选中配置 ---------- */

  const selectConfig = useCallback((id: string) => {
    const item = configsRef.current.find((c) => c.id === id);
    if (item) {
      setSelectedId(id);
      const { createdAt: _, ...rest } = item as any;
      // 清除敏感字段（防止脱敏值被保存回数据库）
      const cleanRest = { ...rest };
      if (sensitiveFields) {
        for (const field of sensitiveFields) {
          (cleanRest as any)[field] = '';
        }
      }
      setForm({ id, ...cleanRest });
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [sensitiveFields]);

  /* ---------- 新建配置 ---------- */

  const newConfig = useCallback(() => {
    setSelectedId(null);
    setForm({ ...defaultFormRef.current } as any);
    setTestStatus('idle');
    setTestMessage('');
  }, []);

  /* ---------- 更新字段 ---------- */

  const updateField = useCallback((field: keyof T, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTestStatus('idle');
    setTestMessage('');
  }, []);

  /* ---------- 保存配置 ---------- */

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const payload = { ...formRef.current };
      await saveApiRef.current(payload);
      toast.success(`${saveLabelRef.current || '配置'}保存成功`);
      await fetchConfigs(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [fetchConfigs]);

  /* ---------- 测试连通性 ---------- */

  const handleTest = useCallback(async () => {
    const currentForm = formRef.current;
    const currentId = selectedIdRef.current;
    const payload = currentId ? { id: currentId, ...currentForm } : currentForm;
    try {
      setTestStatus('testing');
      setTestMessage('');
      const res = await testApiRef.current(payload);
      const body = res.data || res;
      setTestStatus('success');
      setTestMessage(body.message || '连通性测试通过');
      toast.success('连通性测试通过');
    } catch (error: any) {
      setTestStatus('failed');
      setTestMessage(error.response?.data?.message || error.message || '连通性测试失败');
      toast.error('连通性测试失败');
    }
  }, []);

  /* ---------- 删除配置 ---------- */

  const handleDelete = useCallback(async () => {
    const currentId = selectedIdRef.current;
    if (!currentId) return;
    const item = configsRef.current.find((c) => c.id === currentId);
    const name = item ? getDisplayNameRef.current(item) : currentId;
    if (!window.confirm(`确定要删除配置「${name}」吗？`)) return;

    try {
      await deleteApiRef.current(currentId);
      toast.success('配置已删除');
      await fetchConfigs();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || '删除失败');
    }
  }, [fetchConfigs]);

  /* ---------- 启用/停用 ---------- */

  const handleToggle = useCallback(async (enabled: boolean) => {
    const currentId = selectedIdRef.current;
    if (!currentId || !toggleApiRef.current) return;

    try {
      await toggleApiRef.current(currentId, enabled);
      // update local state immediately
      setConfigs((prev) =>
        prev.map((c) => (c.id === currentId ? { ...c, isEnabled: enabled } as T : c)),
      );
      setForm((prev) => ({ ...prev, isEnabled: enabled }));
      toast.success(`配置已${enabled ? '启用' : '停用'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || '操作失败');
    }
  }, []);

  /* ---------- 直接按 ID 启用/停用（列表用） ---------- */

  const toggleConfig = useCallback(async (id: string, enabled: boolean) => {
    if (!toggleApiRef.current) return;
    try {
      await toggleApiRef.current(id, enabled);
      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isEnabled: enabled } as T : c)),
      );
      if (selectedIdRef.current === id) {
        setForm((prev) => ({ ...prev, isEnabled: enabled }));
      }
      toast.success(`配置已${enabled ? '启用' : '停用'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || '操作失败');
    }
  }, []);

  return {
    configs,
    selectedId,
    form,
    isNew,
    loading,
    saving,
    testStatus,
    testMessage,
    selectConfig,
    newConfig,
    updateField,
    handleSave,
    handleTest,
    handleDelete,
    handleToggle,
    toggleConfig,
  };
}
