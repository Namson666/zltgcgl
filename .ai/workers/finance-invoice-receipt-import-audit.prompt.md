你是独立 audit_worker。请审查当前 git diff，重点关注财务发票/收款/合同盈亏/导入导出切片：
1. 前后端字段是否打通：invoiceNumber/invoiceNo、accountName/bankAccount、description/remark。
2. 发票、收款 detail/update/delete 是否具备 tenantId 隔离，是否会跨企业读写。
3. 收款关联发票/合同是否校验同租户、同合同。
4. /finance/import 是否支持真实文件导入，/finance/export 和 /finance/export-summary 是否真实下载 Excel。
5. 真实 Chrome smoke 是否覆盖录入、编辑、删除、导入、导出、盈亏数据校验。
6. 是否存在明显权限倒退、假数据、死按钮、或 Product Green 误报。
请输出 PASS/FAIL，阻塞问题，非阻塞建议。
