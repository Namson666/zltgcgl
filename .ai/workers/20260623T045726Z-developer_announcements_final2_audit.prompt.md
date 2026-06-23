请审查当前最终 diff：开发者系统公告生命周期。重点：创建即发布、前端 isPublished 状态兼容、表单 testid、真实 Chrome 覆盖创建/编辑/下架/再发布/删除、API 验证每一步、企业用户 GET/POST/PUT/PUBLISH/DELETE 开发者公告接口全部 403、再发布 publishedAt 变化。请给 PASS/WARN/FAIL，列出 blockers/yellow risks，简短。不要调用工具。

diff --git a/backend/src/modules/developer/service.ts b/backend/src/modules/developer/service.ts
index 6114be0..14d6db3 100644
--- a/backend/src/modules/developer/service.ts
+++ b/backend/src/modules/developer/service.ts
@@ -670,7 +670,15 @@ export async function listAnnouncements(params: AnnouncementListParams) {
 }
 
 export const createAnnouncement = (data: { title: string; content: string; type?: string }) =>
-  prisma.announcement.create({ data: { title: data.title, content: data.content, type: data.type || 'info' } });
+  prisma.announcement.create({
+    data: {
+      title: data.title,
+      content: data.content,
+      type: data.type || 'info',
+      isPublished: true,
+      publishedAt: new Date(),
+    },
+  });
 
 export const updateAnnouncement = (id: string, data: { title?: string; content?: string; type?: string }) => {
   const updateData: any = {};
diff --git a/frontend/src/pages/developer/Announcements.tsx b/frontend/src/pages/developer/Announcements.tsx
index 5778f01..ed24238 100644
--- a/frontend/src/pages/developer/Announcements.tsx
+++ b/frontend/src/pages/developer/Announcements.tsx
@@ -44,7 +44,8 @@ interface Announcement {
   title: string;                    /* 公告标题 */
   content: string;                  /* 公告内容 */
   type: AnnouncementType;           /* 公告类型 */
-  status: string;                   /* 状态：published / draft */
+  status?: string;                  /* 兼容旧状态字段：published / draft */
+  isPublished?: boolean;            /* 后端真实字段 */
   publishedAt?: string;             /* 发布时间 */
   createdAt: string;                /* 创建时间 */
 }
@@ -74,6 +75,9 @@ const TYPE_BADGE: Record<AnnouncementType, { label: string; type: 'info' | 'warn
   maintenance: { label: '维护', type: 'danger' },
 };
 
+const getAnnouncementStatus = (announcement: Announcement) =>
+  announcement.status || (announcement.isPublished ? 'published' : 'draft');
+
 /* ========================================
  * Announcements 系统公告管理组件
  * ======================================== */
@@ -204,7 +208,7 @@ const Announcements: React.FC = () => {
   const handleToggleStatus = async (announcement: Announcement) => {
     try {
       await developerApi.toggleAnnouncement(announcement.id);
-      const actionText = announcement.status === 'published' ? '已下架' : '已发布';
+      const actionText = getAnnouncementStatus(announcement) === 'published' ? '已下架' : '已发布';
       toast.success(`公告${actionText}`);
       fetchAnnouncements();
     } catch (error: any) {
@@ -273,6 +277,7 @@ const Announcements: React.FC = () => {
                 </label>
                 <input
                   type="text"
+                  data-testid="announcement-title"
                   value={formData.title}
                   onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                   className="input w-full text-sm"
@@ -283,6 +288,7 @@ const Announcements: React.FC = () => {
               <div>
                 <label className="block text-xs text-gray-500 mb-1">公告类型</label>
                 <select
+                  data-testid="announcement-type"
                   value={formData.type}
                   onChange={(e) => setFormData({ ...formData, type: e.target.value as AnnouncementType })}
                   className="input w-full text-sm"
@@ -300,6 +306,7 @@ const Announcements: React.FC = () => {
                   公告内容 <span className="text-red-500">*</span>
                 </label>
                 <textarea
+                  data-testid="announcement-content"
                   value={formData.content}
                   onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                   className="input w-full text-sm"
@@ -379,6 +386,7 @@ const Announcements: React.FC = () => {
                 /* 公告数据行 */
                 announcements.map((announcement) => {
                   const badgeInfo = TYPE_BADGE[announcement.type] || { label: announcement.type, type: 'default' as const };
+                  const status = getAnnouncementStatus(announcement);
                   return (
                     <tr key={announcement.id} className="hover:bg-gray-50 transition-colors">
                       {/* 标题 */}
@@ -407,8 +415,8 @@ const Announcements: React.FC = () => {
                       {/* 状态 */}
                       <td className="px-5 py-3">
                         <StatusBadge
-                          status={announcement.status === 'published' ? '已发布' : '草稿'}
-                          type={announcement.status === 'published' ? 'success' : 'default'}
+                          status={status === 'published' ? '已发布' : '草稿'}
+                          type={status === 'published' ? 'success' : 'default'}
                         />
                       </td>
                       {/* 发布时间 */}
@@ -434,11 +442,11 @@ const Announcements: React.FC = () => {
                           <button
                             onClick={() => handleToggleStatus(announcement)}
                             className={`p-1.5 rounded-lg transition-colors ${
-                              announcement.status === 'published'
+                              status === 'published'
                                 ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                 : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                             }`}
-                            title={announcement.status === 'published' ? '下架' : '发布'}
+                            title={status === 'published' ? '下架' : '发布'}
                           >
                             <Send size={15} />
                           </button>
diff --git a/frontend/tests/smoke/browser-smoke.spec.ts b/frontend/tests/smoke/browser-smoke.spec.ts
index a7d4cc9..f28771c 100644
--- a/frontend/tests/smoke/browser-smoke.spec.ts
+++ b/frontend/tests/smoke/browser-smoke.spec.ts
@@ -604,6 +604,129 @@ test.describe('browser smoke: authenticated core navigation', () => {
     });
   });
 
+  test('developer can manage announcement lifecycle', async ({ page }) => {
+    test.setTimeout(90_000);
+    const stamp = Date.now();
+    const initialTitle = `公告生命周期${stamp}`;
+    const editedTitle = `公告生命周期已编辑${stamp}`;
+    const initialContent = `公告内容${stamp}`;
+    const editedContent = `公告内容已编辑${stamp}`;
+
+    await loginDeveloper(page);
+    await page.goto('/dev/announcements');
+    await expect(page.getByRole('heading', { name: '系统公告' })).toBeVisible();
+
+    await page.getByRole('button', { name: '发布公告' }).click();
+    await page.getByTestId('announcement-title').fill(initialTitle);
+    await page.getByTestId('announcement-type').selectOption('maintenance');
+    await page.getByTestId('announcement-content').fill(initialContent);
+    await page.getByRole('button', { name: '确认发布' }).click();
+    await expect(page.getByText('公告已发布')).toBeVisible();
+    let announcementRow = page.locator('tr', { hasText: initialTitle });
+    await expect(announcementRow).toBeVisible();
+    await expect(announcementRow).toContainText('维护');
+    await expect(announcementRow).toContainText('已发布');
+
+    const developerToken = await page.evaluate(() => localStorage.getItem('zlt_token') || localStorage.getItem('token'));
+    expect(developerToken).toBeTruthy();
+    const enterpriseLogin = await page.request.post('/api/auth/user/login', {
+      data: enterpriseAccount,
+    });
+    expect(enterpriseLogin.status()).toBe(200);
+    const enterpriseLoginBody = await readJson(enterpriseLogin);
+    const enterpriseToken = enterpriseLoginBody?.data?.token;
+    expect(enterpriseToken).toBeTruthy();
+    const forbiddenDeveloperResponse = await page.request.get('/api/developer/announcements', {
+      headers: { Authorization: `Bearer ${enterpriseToken}` },
+    });
+    expect(forbiddenDeveloperResponse.status()).toBe(403);
+
+    const listAnnouncements = async () => {
+      const response = await page.request.get('/api/developer/announcements', {
+        headers: { Authorization: `Bearer ${developerToken}` },
+      });
+      expect(response.status()).toBe(200);
+      return readJson(response);
+    };
+    let listBody = await listAnnouncements();
+    let announcement = (listBody?.data || []).find((item: any) => item.title === initialTitle);
+    expect(announcement?.id).toBeTruthy();
+    expect(announcement?.isPublished).toBe(true);
+    expect(announcement?.publishedAt).toBeTruthy();
+    expect(announcement?.type).toBe('maintenance');
+    const firstPublishedAt = announcement.publishedAt;
+
+    const forbiddenCreateResponse = await page.request.post('/api/developer/announcements', {
+      headers: { Authorization: `Bearer ${enterpriseToken}` },
+      data: { title: `非法公告${stamp}`, content: '企业用户不能创建开发者公告', type: 'info' },
+    });
+    expect(forbiddenCreateResponse.status()).toBe(403);
+    const forbiddenUpdateResponse = await page.request.put(`/api/developer/announcements/${announcement.id}`, {
+      headers: { Authorization: `Bearer ${enterpriseToken}` },
+      data: { title: `非法编辑${stamp}` },
+    });
+    expect(forbiddenUpdateResponse.status()).toBe(403);
+    const forbiddenPublishResponse = await page.request.post(`/api/developer/announcements/${announcement.id}/publish`, {
+      headers: { Authorization: `Bearer ${enterpriseToken}` },
+    });
+    expect(forbiddenPublishResponse.status()).toBe(403);
+    const forbiddenDeleteResponse = await page.request.delete(`/api/developer/announcements/${announcement.id}`, {
+      headers: { Authorization: `Bearer ${enterpriseToken}` },
+    });
+    expect(forbiddenDeleteResponse.status()).toBe(403);
+
+    await announcementRow.getByTitle('编辑').click();
+    await page.getByTestId('announcement-title').fill(editedTitle);
+    await page.getByTestId('announcement-type').selectOption('warning');
+    await page.getByTestId('announcement-content').fill(editedContent);
+    await page.getByRole('button', { name: '保存修改' }).click();
+    await expect(page.getByText('公告已更新')).toBeVisible();
+    announcementRow = page.locator('tr', { hasText: editedTitle });
+    await expect(announcementRow).toBeVisible();
+    await expect(announcementRow).toContainText('警告');
+    await expect(announcementRow).toContainText(editedContent);
+
+    listBody = await listAnnouncements();
+    announcement = (listBody?.data || []).find((item: any) => item.id === announcement.id);
+    expect(announcement?.title).toBe(editedTitle);
+    expect(announcement?.content).toBe(editedContent);
+    expect(announcement?.type).toBe('warning');
+    expect(announcement?.isPublished).toBe(true);
+
+    await announcementRow.getByTitle('下架').click();
+    await expect(page.getByText('公告已下架')).toBeVisible();
+    announcementRow = page.locator('tr', { hasText: editedTitle });
+    await expect(announcementRow).toContainText('草稿');
+    listBody = await listAnnouncements();
+    announcement = (listBody?.data || []).find((item: any) => item.id === announcement.id);
+    expect(announcement?.isPublished).toBe(false);
+    expect(announcement?.publishedAt).toBeNull();
+
+    await announcementRow.getByTitle('发布').click();
+    await expect(page.getByText('公告已发布')).toBeVisible();
+    announcementRow = page.locator('tr', { hasText: editedTitle });
+    await expect(announcementRow).toContainText('已发布');
+    listBody = await listAnnouncements();
+    announcement = (listBody?.data || []).find((item: any) => item.id === announcement.id);
+    expect(announcement?.isPublished).toBe(true);
+    expect(announcement?.publishedAt).toBeTruthy();
+    expect(announcement?.publishedAt).not.toBe(firstPublishedAt);
+
+    await announcementRow.getByTitle('删除').click();
+    await expect(page.getByText('确定要删除此公告吗？此操作不可撤销。')).toBeVisible();
+    await page.getByRole('button', { name: '删除' }).last().click();
+    await expect(page.getByText('公告已删除')).toBeVisible();
+    await expect(page.locator('tr', { hasText: editedTitle })).toHaveCount(0);
+    listBody = await listAnnouncements();
+    announcement = (listBody?.data || []).find((item: any) => item.id === announcement.id);
+    expect(announcement).toBeUndefined();
+
+    await page.screenshot({
+      path: '../docs/smoke-evidence/开发者系统公告生命周期CRUD.png',
+      fullPage: true,
+    });
+  });
+
   test('enterprise user can create edit and delete supplier and work team', async ({ page }) => {
     await loginEnterprise(page);
     const stamp = Date.now();
