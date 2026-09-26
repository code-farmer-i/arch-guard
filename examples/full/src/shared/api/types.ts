export interface CrewDto {
  id: string
  name: string
}

export interface OrderDto {
  id: string
  total: number
}

export interface CustomerDto {
  id: string
  name: string
}

export interface InvoiceDto {
  id: string
  amount: number
  /** 后端已经带上班组标识：DTO 归 shared（后端契约），领域实体归各域（见 mapper） */
  crew: string
}
