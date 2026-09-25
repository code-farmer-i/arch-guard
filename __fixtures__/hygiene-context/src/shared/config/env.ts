// H08 反例：配置文件里也写死了本地地址 —— H08 照报。
// 豁免是**宿主侧**的规则级例外（`exceptions: [{ rule: 'H08', glob: 'src/shared/config/**', reason: '地址唯一出处' }]`），
// 本体不认识"哪个目录是地址的唯一出处"这类宿主路径（写死进本体会被 portability 检查拦下）。
export const API_BASE_URL = 'http://localhost:3000'
