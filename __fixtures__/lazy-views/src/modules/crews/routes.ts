// 合规：页面走懒加载
export const crewsRoutes = [
  { path: '/crews', lazy: () => import('./views/CrewsPage') },
]
