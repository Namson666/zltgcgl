// ============================================
// 资料通工程管理系统 - 数据库种子数据
// ============================================
// 用于初始化开发者账号、默认租户、默认角色和权限
// 执行命令：npx ts-node prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始导入种子数据...');

  // ============================================
  // 1. 创建开发者/超级管理员
  // ============================================
  console.log('\n📝 创建开发者账号...');

  const developerPassword = await bcrypt.hash('Admin@2024', 10);
  const developer = await prisma.developer.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      passwordHash: developerPassword,
      name: '系统管理员',
      email: 'admin@zlt.com',
      phone: '13800000000',
      isActive: true,
    },
  });
  console.log(`  ✓ 开发者账号创建成功: ${developer.username}`);

  // ============================================
  // 2. 创建默认租户（演示企业）
  // ============================================
  console.log('\n📝 创建默认租户...');

  const tenant = await prisma.tenant.upsert({
    where: { code: 'demo' },
    update: {},
    create: {
      name: '演示建筑工程有限公司',
      code: 'demo',
      contactName: '张总',
      contactPhone: '13800000001',
      address: '广东省深圳市南山区',
      isActive: true,
    },
  });
  console.log(`  ✓ 租户创建成功: ${tenant.name} (${tenant.code})`);

  // ============================================
  // 3. 创建订阅信息
  // ============================================
  console.log('\n📝 创建订阅信息...');

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      plan: 'FULL',
      tier: 'MEDIUM',
      maxUsers: 10,
      pricePerMonth: 1288,
      pricePerExtraUser: 100,
      currentUsers: 6,
      status: 'ACTIVE',
      trialEndAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  ✓ 订阅创建成功: ${subscription.plan} / ${subscription.tier}`);

  // ============================================
  // 4. 创建默认角色和权限
  // ============================================
  console.log('\n📝 创建默认角色和权限...');

  // 角色定义
  const rolesDefinition = [
    {
      name: 'boss',
      displayName: '老板',
      description: '企业负责人，可查看所有数据和财务管理',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canManageSystem: true,
        canViewLogs: true,
        canExport: true,
        canViewInventory: true,
        canViewRecords: true,
        canViewWorkTeamLedger: true,
        canManagePersonnel: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManagePayment: true,
        canManageAnomaly: true,
        canManageReport: true,
        canManageContract: true,
        canManageDepartment: true,
        canFinanceView: true,
        canFinancePnl: true,
      },
    },
    {
      name: 'admin',
      displayName: '管理员',
      description: '企业管理员，拥有所有功能权限',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canManageSystem: true,
        canViewLogs: true,
        canExport: true,
        canViewInventory: true,
        canInbound: true,
        canOutbound: true,
        canReturn: true,
        canTransfer: true,
        canViewRecords: true,
        canViewWorkTeamLedger: true,
        canManagePersonnel: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManagePayment: true,
        canManageAnomaly: true,
        canManageReport: true,
        canManageContract: true,
        canManageDepartment: true,
        canFinanceView: true,
        canFinanceEntryDept: true,
        canFinanceEntryFinance: true,
        canFinanceApprove: true,
        canFinancePettyCash: true,
        canFinanceInvoice: true,
        canFinanceReceipt: true,
        canFinancePnl: true,
      },
    },
    {
      name: 'material',
      displayName: '物资员',
      description: '物资管理，负责入库、出库、退库、调拨',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canViewInventory: true,
        canInbound: true,
        canOutbound: true,
        canReturn: true,
        canTransfer: true,
        canViewRecords: true,
        canViewWorkTeamLedger: true,
        canExport: true,
      },
    },
    {
      name: 'labor',
      displayName: '劳资员',
      description: '劳资管理，负责人事、考勤、工资核算',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canManagePersonnel: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManageAnomaly: true,
        canManageReport: true,
        canExport: true,
      },
    },
    {
      name: 'finance',
      displayName: '财务',
      description: '财务管理，查看数据和工资发放',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canViewInventory: true,
        canViewRecords: true,
        canViewWorkTeamLedger: true,
        canManagePersonnel: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManagePayment: true,
        canManageAnomaly: true,
        canManageReport: true,
        canExport: true,
        canFinanceView: true,
        canFinanceEntryDept: true,
        canFinanceEntryFinance: true,
        canFinanceApprove: true,
        canFinancePettyCash: true,
        canFinanceInvoice: true,
        canFinanceReceipt: true,
        canFinancePnl: true,
      },
    },
    {
      name: 'cashier',
      displayName: '出纳',
      description: '出纳，查看数据和工资发放',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canViewRecords: true,
        canManagePayment: true,
        canExport: true,
      },
    },
    {
      name: 'project_cashier',
      displayName: '项目出纳',
      description: '项目出纳，查看项目数据和项目工资发放',
      isDefault: true,
      permissions: {
        canViewDashboard: true,
        canViewRecords: true,
        canManagePayment: true,
        canExport: true,
      },
    },
  ];

  const createdRoles: Record<string, string> = {};

  for (const roleDef of rolesDefinition) {
    const existingRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, name: roleDef.name },
    });
    if (existingRole) {
      // Update permissions on re-run (ensures new permission fields are set)
      await prisma.role.update({
        where: { id: existingRole.id },
        data: {
          displayName: roleDef.displayName,
          description: roleDef.description,
          isDefault: roleDef.isDefault,
        },
      });
      const existingPerm = await prisma.permission.findFirst({
        where: { roleId: existingRole.id },
      });
      if (existingPerm) {
        await prisma.permission.update({
          where: { id: existingPerm.id },
          data: roleDef.permissions,
        });
      } else {
        await prisma.permission.create({
          data: { roleId: existingRole.id, ...roleDef.permissions },
        });
      }
      createdRoles[roleDef.name] = existingRole.id;
    } else {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: roleDef.name,
          displayName: roleDef.displayName,
          description: roleDef.description,
          isDefault: roleDef.isDefault,
          permissions: {
            create: roleDef.permissions,
          },
        },
      });
      createdRoles[roleDef.name] = role.id;
    }
    console.log(`  ✓ 角色创建成功: ${roleDef.displayName} (${roleDef.name})`);
  }

  // ============================================
  // 5. 创建默认用户
  // ============================================
  console.log('\n📝 创建默认用户...');

  const usersDefinition = [
    { username: 'admin', name: '管理员', password: 'Admin@2024', roleName: 'admin', dataScope: 'ALL' },
    { username: 'boss', name: '张总', password: 'Boss@2024', roleName: 'boss', dataScope: 'ALL' },
    { username: 'material', name: '物资员小李', password: 'Material@2024', roleName: 'material', dataScope: 'OWN_DEPARTMENT' },
    { username: 'labor', name: '劳资员小王', password: 'Labor@2024', roleName: 'labor', dataScope: 'OWN_DEPARTMENT' },
    { username: 'finance', name: '财务小陈', password: 'Finance@2024', roleName: 'finance', dataScope: 'ALL' },
    { username: 'cashier', name: '出纳小赵', password: 'Cashier@2024', roleName: 'cashier', dataScope: 'ALL' },
  ];

  for (const userDef of usersDefinition) {
    const passwordHash = await bcrypt.hash(userDef.password, 10);
    const user = await prisma.user.upsert({
      where: {
        tenantId_username: { tenantId: tenant.id, username: userDef.username },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        username: userDef.username,
        passwordHash,
        name: userDef.name,
        phone: `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        roleId: createdRoles[userDef.roleName],
        dataScope: userDef.dataScope,
        isActive: true,
      },
    });
    console.log(`  ✓ 用户创建成功: ${userDef.name} (${userDef.username})`);
  }

  // ============================================
  // 6. 创建演示项目部
  // ============================================
  console.log('\n📝 创建演示项目部...');

  // 先创建一个演示合同
  const contract = await prisma.contract.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HT-2026-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      type: 'CONSTRUCTION',
      name: 'XX市政道路改造工程',
      code: 'HT-2026-001',
      totalAmount: 5000000,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });
  console.log(`  ✓ 合同创建成功: ${contract.name}`);

  let dept1 = await prisma.department.findFirst({ where: { tenantId: tenant.id, code: 'DEPT-001' } });
  if (!dept1) {
    dept1 = await prisma.department.create({
      data: {
        tenantId: tenant.id,
        contractId: contract.id,
        name: '第一项目部',
        code: 'DEPT-001',
        description: '负责市政道路改造工程',
      },
    });
  }
  console.log(`  ✓ 项目部创建成功: ${dept1.name}`);

  let dept2 = await prisma.department.findFirst({ where: { tenantId: tenant.id, code: 'DEPT-002' } });
  if (!dept2) {
    dept2 = await prisma.department.create({
      data: {
        tenantId: tenant.id,
        contractId: contract.id,
        name: '第二项目部',
        code: 'DEPT-002',
        description: '负责配套管网工程',
      },
    });
  }
  console.log(`  ✓ 项目部创建成功: ${dept2.name}`);

  // 创建子项目（code 是 nullable，PF-304：不能用 upsert）
  let subProject1 = await prisma.subProject.findFirst({ where: { tenantId: tenant.id, departmentId: dept1.id, code: 'SP-001-01' } });
  if (!subProject1) {
    subProject1 = await prisma.subProject.create({
      data: {
        tenantId: tenant.id,
        departmentId: dept1.id,
        name: '路基工程',
        code: 'SP-001-01',
      },
    });
  }
  console.log(`  ✓ 子项目创建成功: ${subProject1.name}`);

  let subProject2 = await prisma.subProject.findFirst({ where: { tenantId: tenant.id, departmentId: dept1.id, code: 'SP-001-02' } });
  if (!subProject2) {
    subProject2 = await prisma.subProject.create({
      data: {
        tenantId: tenant.id,
        departmentId: dept1.id,
        name: '路面工程',
        code: 'SP-001-02',
      },
    });
  }
  console.log(`  ✓ 子项目创建成功: ${subProject2.name}`);

  // ============================================
  // 7. 创建演示供应商和班组
  // ============================================
  console.log('\n📝 创建演示供应商和班组...');

  let supplier1 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: '华南建材有限公司' } });
  if (!supplier1) {
    supplier1 = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: '华南建材有限公司',
        contactName: '李经理',
        phone: '13900001111',
        address: '广州市天河区',
      },
    });
  }
  console.log(`  ✓ 供应商创建成功: ${supplier1.name}`);

  let supplier2 = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: '深圳钢铁贸易有限公司' } });
  if (!supplier2) {
    supplier2 = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: '深圳钢铁贸易有限公司',
        contactName: '王经理',
        phone: '13900002222',
        address: '深圳市宝安区',
      },
    });
  }
  console.log(`  ✓ 供应商创建成功: ${supplier2.name}`);

  let workTeam1 = await prisma.workTeam.findFirst({ where: { tenantId: tenant.id, name: '张三施工班组' } });
  if (!workTeam1) {
    workTeam1 = await prisma.workTeam.create({
      data: {
        tenantId: tenant.id,
        name: '张三施工班组',
        leaderName: '张三',
        phone: '13800001111',
        memberCount: 15,
      },
    });
  }
  console.log(`  ✓ 班组创建成功: ${workTeam1.name}`);

  let workTeam2 = await prisma.workTeam.findFirst({ where: { tenantId: tenant.id, name: '李四钢筋班组' } });
  if (!workTeam2) {
    workTeam2 = await prisma.workTeam.create({
      data: {
        tenantId: tenant.id,
        name: '李四钢筋班组',
        leaderName: '李四',
        phone: '13800002222',
        memberCount: 20,
      },
    });
  }
  console.log(`  ✓ 班组创建成功: ${workTeam2.name}`);

  // ============================================
  // 8. 创建财务费用类别
  // ============================================
  console.log('\n📝 创建财务费用类别...');

  const financeCategories = [
    {
      name: '材料费',
      sortOrder: 1,
      subs: ['材料采购', '运费', '其他'],
    },
    {
      name: '工器具',
      sortOrder: 2,
      subs: ['工器具采购', '租赁费(挖机/吊车/泵车/货车/空压机等)', '油费', '维修费', '运费', '其他'],
    },
    {
      name: '机械使用费',
      sortOrder: 3,
      subs: ['租赁费', '其他'],
    },
    {
      name: '劳保用品',
      sortOrder: 4,
      subs: ['工作服', '安全帽', '其他'],
    },
    {
      name: '车辆费用',
      sortOrder: 5,
      subs: ['油费', '过路费/停车费', '车补', '洗车费', '维修费', '保险费', '租赁费', '其他'],
    },
    {
      name: '生活开支',
      sortOrder: 6,
      subs: ['房租', '水电气', '日常开支', '住宿费'],
    },
    {
      name: '管理费用',
      sortOrder: 7,
      subs: ['办公费', '办公用品', '招待费', '业务烟', '保险费', '快递运费', '其他'],
    },
    {
      name: '工人工资',
      sortOrder: 8,
      subs: ['人工工资', '小工工资'],
    },
    {
      name: '管理人员工资',
      sortOrder: 9,
      subs: ['管理人员工资'],
    },
    {
      name: '税费',
      sortOrder: 10,
      subs: ['发票金额', '实缴税额'],
    },
    {
      name: '征地青苗',
      sortOrder: 11,
      subs: ['协调费', '征地费', '青苗费'],
    },
    {
      name: '固定资产',
      sortOrder: 12,
      subs: ['设备/车辆等'],
    },
    {
      name: '其他',
      sortOrder: 13,
      subs: ['未分类开支'],
    },
  ];

  for (const cat of financeCategories) {
    // Find or create the category
    let catRecord = await prisma.finCategory.findFirst({
      where: { tenantId: tenant.id, name: cat.name },
    });
    if (!catRecord) {
      catRecord = await prisma.finCategory.create({
        data: {
          tenantId: tenant.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
        },
      });
    }
    // Find or create sub-categories (idempotent on re-run)
    let subCreated = 0;
    for (let i = 0; i < cat.subs.length; i++) {
      const existingSub = await prisma.finSubCategory.findFirst({
        where: { tenantId: tenant.id, categoryId: catRecord.id, name: cat.subs[i] },
      });
      if (!existingSub) {
        await prisma.finSubCategory.create({
          data: {
            tenantId: tenant.id,
            categoryId: catRecord.id,
            name: cat.subs[i],
            sortOrder: i + 1,
          },
        });
        subCreated++;
      }
    }
    console.log(`  ✓ 费用类别: ${cat.name} (${subCreated > 0 ? subCreated : '已存在'} )`);
  }

  console.log('\n✅ 种子数据导入完成！');
  console.log('\n默认账号：');
  console.log('  开发者：superadmin / Admin@2024');
  console.log('  企业登录：demo（企业代码）');
  console.log('  管理员：admin / Admin@2024');
  console.log('  老板：boss / Boss@2024');
  console.log('  物资员：material / Material@2024');
  console.log('  劳资员：labor / Labor@2024');
  console.log('  财务：finance / Finance@2024');
  console.log('  出纳：cashier / Cashier@2024');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
