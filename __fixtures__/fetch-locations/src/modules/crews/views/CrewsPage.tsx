// 违规：页面里直接取数（S36）
export default function CrewsPage() {
  const { data } = useQuery({ queryKey: ['crews'], queryFn: loadCrews })
  return <div>{data?.length}</div>
}
