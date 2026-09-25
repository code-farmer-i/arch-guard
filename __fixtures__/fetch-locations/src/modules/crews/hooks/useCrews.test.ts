// 合规：测试里调 useQuery（renderHook）是正常用法，豁免
export function renderCrewsHook() {
  return useQuery({ queryKey: ['crews'], queryFn: loadCrews })
}
