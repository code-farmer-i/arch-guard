const theme = { color: '#ff5a1f' } // 非 style 对象：那是设计系统的家，D15 不管

export function CrewsCard() {
  return (
    <div
      style={{
        color: 'var(--brand)',
        margin: '8px',
        padding: 0,
        lineHeight: 1.5,
        zIndex: 10,
      }}
    >
      {theme.color}
    </div>
  )
}
