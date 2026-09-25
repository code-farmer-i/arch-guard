/** 缓存键的唯一出处：键字面量只许写在这里（别处引用它） */
export const crewsKeys = {
  list: ['crews'],
  detail: (id: string) => ['crews', id],
}
