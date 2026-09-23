import { SmileOutlined } from '@ant-design/icons'
import { FaUser } from 'react-icons/fa'

// P05 反例：@ant-design/icons 是适配器登记的图标包（合规），react-icons 不是（违规）
export function IconRow() {
  return (
    <span>
      <SmileOutlined />
      <FaUser />
    </span>
  )
}
