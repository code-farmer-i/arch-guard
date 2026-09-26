export interface InvoiceRow {
  id: string
  amount: number
  /** 这张发票是**哪个班组**的（billing 与 crews 是两个域：展示班组名要走对方的公开面） */
  crew: string
}
