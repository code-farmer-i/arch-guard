/** 标题转 slug（被 CrewsPage 引用；clean 夹具里它必须可达）。 */
export function formatSlug(title: string): string {
  return title.toLowerCase().split(' ').join('-')
}
