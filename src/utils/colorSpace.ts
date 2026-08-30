// ============================================================
// 色彩空间转换工具
// RGB → XYZ → Lab 转换 + CIE Delta E (CIE76 & CIEDE2000)
// 这些函数不依赖任何色卡数据，是纯数学运算
// ============================================================

/** RGB 转 XYZ（sRGB, D65 白点） */
export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // sRGB → 线性 RGB
  const toLinear = (c: number): number => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  }

  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)

  // 线性 RGB → XYZ（sRGB D65 矩阵）
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041

  return [X * 100, Y * 100, Z * 100]
}

/** XYZ 转 Lab（D65 参考白点） */
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  // D65 参考白点
  const Xn = 95.047
  const Yn = 100.0
  const Zn = 108.883

  const f = (t: number): number => {
    const d = 6.0 / 29.0
    return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4.0 / 29.0
  }

  const fx = f(x / Xn)
  const fy = f(y / Yn)
  const fz = f(z / Zn)

  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)

  return [L, a, b]
}

/** RGB 转 Lab */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b)
  return xyzToLab(x, y, z)
}

/**
 * CIE76 Delta E 公式
 * 简单快速，适合大多数颜色匹配场景
 */
export function deltaE76(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0]
  const da = lab1[1] - lab2[1]
  const db = lab1[2] - lab2[2]
  return Math.sqrt(dL * dL + da * da + db * db)
}

/**
 * CIEDE2000 Delta E 公式
 * 精确实现 CIE 技术报告 15:2004 标准
 * 参考公式来源：https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
 */
export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  // Step 1: 计算 C*ab, G, a'
  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const Cbar = (C1 + C2) / 2

  // G = 0.5 * (1 - sqrt(C̄^7 / (C̄^7 + 25^7)))
  // 25^7 = 6103515625
  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625)))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2

  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)

  // h' 角度（弧度）
  let h1p = Math.atan2(b1, a1p)
  let h2p = Math.atan2(b2, a2p)

  // 规范到 [0, 2π)
  h1p = h1p < 0 ? h1p + 2 * Math.PI : h1p
  h2p = h2p < 0 ? h2p + 2 * Math.PI : h2p

  // Step 2: 计算差异
  const dLp = L2 - L1
  const dCp = C2p - C1p

  // Δh'
  let dhp: number
  const diff = Math.abs(h2p - h1p)
  if (diff <= Math.PI) {
    dhp = h2p - h1p
  } else if (h2p - h1p > Math.PI) {
    dhp = h2p - h1p - 2 * Math.PI
  } else {
    dhp = h2p - h1p + 2 * Math.PI
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2)

  // Step 3: 计算权重函数
  const Lbar = (L1 + L2) / 2
  const Cpbar = (C1p + C2p) / 2

  // h̄'
  let hpbar: number
  const hdiff = Math.abs(h1p - h2p)
  if (hdiff <= Math.PI) {
    hpbar = (h1p + h2p) / 2
  } else if (h1p + h2p < 2 * Math.PI) {
    hpbar = (h1p + h2p + 2 * Math.PI) / 2
  } else {
    hpbar = (h1p + h2p - 2 * Math.PI) / 2
  }

  // T 函数
  const T = 1
    - 0.17 * Math.cos(hpbar - Math.PI / 6)
    + 0.24 * Math.cos(2 * hpbar)
    + 0.32 * Math.cos(3 * hpbar + Math.PI / 30)
    - 0.20 * Math.cos(4 * hpbar - 63 * Math.PI / 180)

  // Δθ
  const dtheta = (30 * Math.PI / 180) * Math.exp(-Math.pow((hpbar * 180 / Math.PI - 275) / 25, 2))

  // SL, SC, SH
  const SL = 1 + 0.015 * (Lbar - 50) * (Lbar - 50) / Math.sqrt(20 + (Lbar - 50) * (Lbar - 50))
  const SC = 1 + 0.045 * Cpbar
  const SH = 1 + 0.015 * Cpbar * T

  // RT = -sin(2*Δθ) * sqrt(C̄'^7 / (C̄'^7 + 25^7))
  const Cpbar7 = Math.pow(Cpbar, 7)
  const RT = -Math.sin(2 * dtheta) * Math.sqrt(Cpbar7 / (Cpbar7 + 6103515625))

  // Step 4: 最终 Delta E
  const kL = 1, kC = 1, kH = 1
  const dE = Math.sqrt(
    (dLp / (kL * SL)) * (dLp / (kL * SL)) +
    (dCp / (kC * SC)) * (dCp / (kC * SC)) +
    (dHp / (kH * SH)) * (dHp / (kH * SH)) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  )

  return dE
}

/** 根据色差值返回描述级别 */
export function getDifferenceLevel(deltaE: number): 'low' | 'medium' | 'high' {
  if (deltaE < 2.3) return 'low'
  if (deltaE < 5.0) return 'medium'
  return 'high'
}

/** 预计算 Lab 值的色卡颜色 */
export interface LabColor {
  code: string
  name: string
  hex: string
  rgb: [number, number, number]
  lab: [number, number, number]
}
