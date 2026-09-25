import { defineAdapter, defineFacet } from '../../engine/adapters.js'
import type { DataLayerAdapter } from '../../engine/types.js'

defineFacet('data-layer', {
  fields: [
    'packages',
    'queryKeyFrom',
    'queryKeyProps',
    'fetchApis',
    'numberNames',
    'singletons',
    'fetchIn',
    'examples',
  ],
  capabilityRoot: 'dataLayer',
})

/** 这套方案的取数 API（判据按整名或 `.` 后缀匹配，所以方法名也放得进来） */
const REACT_QUERY_APIS = [
  'useQuery',
  'useQueries',
  'useInfiniteQuery',
  'useMutation',
  'useQueryClient',
  'invalidateQueries',
  'setQueryData',
  'fetchQuery',
]

export interface ReactQueryKitOptions {
  /**
   * **缓存键的唯一出处**（如 `src/shared/api/queryKeys.ts`）→ 启用 D22。
   *
   * 落点是**项目决定**（同 `designSystem({ styleDir })`），所以由这里传入而不是 kit 写死；
   * 不传 → D22 明列停用（`requires`），不空转。
   */
  queryKeyFrom?: string
  /** 缓存键挂在哪几个属性上（缺省 `['queryKey']`） */
  queryKeyProps?: string[]
  /**
   * **取数只许出现的落点**（glob 列表，如 `['src/modules/<域>/hooks/**','src/shared/api/**']`）→ 启用 S36。
   *
   * 同样是项目决定；不传 → S36 明列停用。
   */
  fetchIn?: string[]
  /**
   * 覆盖取数 API 名（缺省是 react-query 那一套）。
   *
   * 项目自封装的取数函数（`fetch` / 自家 `useApi`）也放进来 —— 判据只看"谁在调它"。
   */
  fetchApis?: string[]
  /** 覆盖"策略/阈值数字"的属性名（D20 的 numberHomes 缺省用它）：默认 `staleTime` / `retry` / `gcTime`… */
  numberNames?: string[]
  /** 覆盖"只许单例"的构造器名：默认 `['QueryClient']` */
  singletons?: string[]
}

/** react-query 适配器：服务端状态的取数与缓存方案 */
/**
 * react-query 里那些**策略/阈值数字**的属性名（D20 的家）：库的事实 → 适配器给默认，
 * 宿主 `designSystem({ numberHomes: [{ name: '请求策略', in: [...] }] })` 只写"家在哪"。
 */
/** react-query 里**只许单例**的构造器：两个 `QueryClient` = 两个缓存实例（`invalidateQueries` 莫名不生效） */
const REACT_QUERY_SINGLETONS = ['QueryClient']

const REACT_QUERY_NUMBER_NAMES = ['staleTime', 'gcTime', 'retry', 'retryDelay', 'refetchInterval']

export function reactQueryKit(options: ReactQueryKitOptions = {}): DataLayerAdapter {
  return defineAdapter<DataLayerAdapter>('data-layer', {
    id: 'react-query',
    specVersion: '1',
    packages: ['@tanstack/react-query'],
    fetchApis: [...(options.fetchApis ?? REACT_QUERY_APIS)],
    numberNames: [...(options.numberNames ?? REACT_QUERY_NUMBER_NAMES)],
    singletons: [...(options.singletons ?? REACT_QUERY_SINGLETONS)],
    ...(options.queryKeyFrom ? { queryKeyFrom: options.queryKeyFrom } : {}),
    ...(options.queryKeyProps ? { queryKeyProps: [...options.queryKeyProps] } : {}),
    ...(options.fetchIn ? { fetchIn: [...options.fetchIn] } : {}),
  })
}
