/**
 * 中文字体工具
 *
 * 为 PDFKit 提供中文字体注册功能。
 * 按优先级尝试以下路径：
 * 1. 项目内 bundled 字体
 * 2. 系统字体（macOS STHeiti / Linux Noto Sans CJK / Windows SimHei）
 * 3. 回退到无中文（仅英文显示）
 */
import path from 'path';
import fs from 'fs';

type SystemFont = { path: string; name: string };

const SYSTEM_FONTS: SystemFont[] = [
  // macOS (PingFang — 现代 macOS 默认中文字体)
  { path: '/System/Library/Fonts/PingFang.ttc', name: 'PingFangSC-Regular' },
  { path: '/System/Library/Fonts/PingFang.ttc', name: 'PingFangSC' },
  // macOS (STHeiti — 旧版 macOS)
  { path: '/System/Library/Fonts/STHeiti Light.ttc', name: 'STHeitiSC-Light' },
  { path: '/System/Library/Fonts/STHeiti Light.ttc', name: 'STHeitiSCLight' },
  { path: '/System/Library/Fonts/STHeiti Medium.ttc', name: 'STHeitiSC-Medium' },
  { path: '/System/Library/Fonts/STHeiti Medium.ttc', name: 'STHeitiSCMedium' },
  { path: '/System/Library/Fonts/Supplemental/Songti.ttc', name: 'SongtiSC' },
  // Linux (Noto Sans CJK SC)
  { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', name: 'NotoSansCJK' },
  { path: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', name: 'NotoSansCJK' },
  // Windows
  { path: 'C:/Windows/Fonts/simhei.ttf', name: 'SimHei' },
  { path: 'C:/Windows/Fonts/simsun.ttc', name: 'SimSun' },
];

/** 获取系统中可用的中文字体信息 */
export function getChineseFont(): { path: string; fontName: string } | null {
  const bundledPath = path.join(__dirname, '..', 'fonts', 'chinese.ttf');
  if (fs.existsSync(bundledPath)) {
    return { path: bundledPath, fontName: 'Chinese' };
  }
  for (const f of SYSTEM_FONTS) {
    if (fs.existsSync(f.path)) {
      return { path: f.path, fontName: f.name };
    }
  }
  return null;
}

/** 注册中文字体到 PDFKit document，返回是否成功 */
export function registerChineseFont(doc: any): boolean {
  const font = getChineseFont();
  if (font) {
    try {
      doc.registerFont('Chinese', font.path, font.fontName);
      return true;
    } catch (e) {
      // TTC 字体名不匹配时尝试替代名称
      const altNames: string[] = [];
      if (font.path.includes('STHeiti')) {
        altNames.push('STHeitiSC-Light', 'STHeitiSCLight', '华文细黑', 'STXihei');
      } else if (font.path.includes('PingFang')) {
        altNames.push('PingFangSC-Regular', 'PingFangSC', '苹方');
      } else if (font.path.includes('Noto')) {
        altNames.push('NotoSansCJK', 'NotoSansCJKsc-Regular');
      }
      for (const name of altNames) {
        try {
          doc.registerFont('Chinese', font.path, name);
          return true;
        } catch {}
      }
      console.error('注册中文字体失败:', e);
      return false;
    }
  }
  return false;
}
