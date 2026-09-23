/** S19 反例二：单文件 4 个组件 > 上限 3 → 该拆成组件目录。 */

export function Alpha({ label }: { label: number }) {
  return <div>{label}</div>
}

export function Beta({ label }: { label: number }) {
  return <span>{label}</span>
}

export function Gamma({ label }: { label: number }) {
  return <b>{label}</b>
}

export function Delta({ label }: { label: number }) {
  return <i>{label}</i>
}
